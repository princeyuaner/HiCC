import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from './store/app-store';
import type { FileNode } from './types';
import Sidebar from './components/layout/Sidebar';
import Toolbar from './components/layout/Toolbar';
import FileExplorer from './components/editor/FileExplorer';
import SearchPanel from './components/editor/SearchPanel';
import ReviewPanel from './components/editor/ReviewPanel';
import SettingsPanel from './components/layout/SettingsPanel';
import EditorTabs from './components/editor/EditorTabs';
import ChatPanel from './components/chat/ChatPanel';
import TerminalPanel from './components/terminal/TerminalPanel';
import GitPanel from './components/git/GitPanel';
import SvnPanel from './components/editor/SvnPanel';
import StatusBar from './components/layout/StatusBar';
import Palette from './components/common/Palette';
import ErrorBoundary from './components/common/ErrorBoundary';

const MIN_RIGHT_WIDTH = 200;
const MAX_RIGHT_WIDTH = 1000;
const MIN_LEFT_WIDTH = 180;
const MAX_LEFT_WIDTH = 500;

function buildTreeFromFlat(entries: FileNode[]): FileNode[] {
  const map = new Map<string, FileNode>();
  const roots: FileNode[] = [];
  // Normalize paths to forward slashes for cross-platform consistency
  for (const e of entries) {
    const normalized = e.path.replace(/\\/g, '/');
    map.set(normalized, { ...e, path: normalized, children: e.children ? [...e.children] : [] });
  }
  for (const node of map.values()) {
    const parentPath = node.path.includes('/')
      ? node.path.substring(0, node.path.lastIndexOf('/'))
      : '';
    const parent = parentPath ? map.get(parentPath) : null;
    if (parent && parent.type === 'directory') {
      if (!parent.children) parent.children = [];
      if (!parent.children.find((c: FileNode) => c.path === node.path)) {
        parent.children.push(node);
      }
      parent.children.sort((a: FileNode, b: FileNode) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    } else if (!parentPath) {
      if (!roots.find((r) => r.path === node.path)) {
        roots.push(node);
      }
    }
  }
  roots.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return roots;
}

const App: React.FC = () => {
  const theme = useAppStore((s) => s.theme);
  const projectName = useAppStore((s) => s.projectName);
  const activeSidebar = useAppStore((s) => s.activeSidebar);
  const setProfiles = useAppStore((s) => s.setProfiles);
  const setActiveProfileId = useAppStore((s) => s.setActiveProfileId);
  const projectPath = useAppStore((s) => s.projectPath);
  const openTabs = useAppStore((s) => s.openTabs);
  const activeTab = useAppStore((s) => s.activeTab);
  const [rightTab, setRightTab] = useState<'chat' | 'terminal'>('chat');
  const [rightWidth, setRightWidth] = useState(500);
  const [leftWidth, setLeftWidth] = useState(260);
  const resizing = useRef<'left' | 'right' | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    window.hicc.getProfiles().then((profiles) => {
      setProfiles(profiles);
    });
    window.hicc.getActiveProfile().then((profile) => {
      if (profile) setActiveProfileId(profile.id);
    });
  }, [setProfiles, setActiveProfileId]);

  // Restore session on mount (after project is loaded)
  useEffect(() => {
    if (!projectPath) return;
    window.hicc.restoreSession().then((state) => {
      if (!state) return;
      const store = useAppStore.getState();
      if (state.activeSidebar) store.setActiveSidebar(state.activeSidebar);
      if (state.openTabs?.length) {
        for (const tab of state.openTabs) {
          store.openFile(tab.path, tab.name);
        }
      }
      if (state.activeTab) store.setActiveTab(state.activeTab);
    }).catch(() => {});
  }, [projectPath]);

  // Save session state when tabs or sidebar change
  useEffect(() => {
    if (!projectPath) return;
    const state = {
      activeConversationId: useAppStore.getState().activeConversationId,
      openTabs,
      activeTab,
      activeSidebar,
    };
    window.hicc.saveSession(state).catch(() => {});
  }, [projectPath, openTabs, activeTab, activeSidebar]);

  // Scan progress updates
  useEffect(() => {
    window.hicc.onScanProgress(({ count, currentFile }) => {
      useAppStore.setState({
        indexCount: count,
        indexCurrentFile: currentFile || '',
        indexProgress: `Indexing files...`,
      });
    });
  }, []);

  // Listen for streaming file list entries
  useEffect(() => {
    let pendingTree: Record<string, FileNode> = {};
    let active = true;
    let rafId = 0;

    const unsub = useAppStore.subscribe((s, prev) => {
      if (s.fileTree.length === 0 && prev.fileTree.length > 0) {
        pendingTree = {};
      }
    });

    window.hicc.onFileListEntry((entry) => {
      if (!active) return;
      const normalizedPath = entry.path.replace(/\\/g, '/');
      pendingTree[normalizedPath] = {
        name: entry.name,
        path: normalizedPath,
        type: entry.type as 'file' | 'directory',
        children: entry.children as FileNode[] | undefined,
      };
      // Throttle: only update once per animation frame
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          useAppStore.setState({ fileTree: buildTreeFromFlat(Object.values(pendingTree)) });
        });
      }
    });
    window.hicc.onFileListDone(() => {
      if (active) {
        // Cancel any pending raF and do a final build with all entries
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        const finalTree = buildTreeFromFlat(Object.values(pendingTree));
        useAppStore.setState({
          fileTree: finalTree,
          fileTreeLoading: false,
          indexProgress: '',
          indexCount: 0,
          indexCurrentFile: '',
        });
      }
    });
    return () => { active = false; unsub(); };
  }, []);

  useEffect(() => {
    if (!projectPath) return;
    window.hicc.onFileChanged((event) => {
      // Debounce refreshes — batch rapid file changes (e.g. bulk writes)
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        const store = useAppStore.getState();
        store.applyFileChange(event.path, event.type as 'add' | 'change' | 'unlink');
      }, 300);
    });
  }, [projectPath]);

  const handleResizeStart = useCallback((side: 'left' | 'right') => () => {
    resizing.current = side;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (resizing.current === 'right') {
        const newWidth = window.innerWidth - e.clientX;
        setRightWidth(Math.min(MAX_RIGHT_WIDTH, Math.max(MIN_RIGHT_WIDTH, newWidth)));
      } else if (resizing.current === 'left') {
        const newWidth = e.clientX - 48; // 48px is sidebar width
        setLeftWidth(Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, newWidth)));
      }
    };
    const onMouseUp = () => {
      resizing.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <ErrorBoundary>
      <Palette />
      <div className="app">
        <Toolbar projectName={projectName} />
        <div className="app-body">
          <Sidebar />
          {activeSidebar === 'files' && (
            <div className="sidebar-panel" style={{ width: leftWidth, minWidth: leftWidth }}>
              <FileExplorer />
            </div>
          )}
          {activeSidebar === 'search' && (
            <div className="sidebar-panel" style={{ width: leftWidth, minWidth: leftWidth }}>
              <SearchPanel />
            </div>
          )}
          {activeSidebar === 'git' && (
            <div className="sidebar-panel" style={{ width: leftWidth, minWidth: leftWidth }}>
              <GitPanel />
            </div>
          )}
          {activeSidebar === 'review' && (
            <div className="sidebar-panel" style={{ width: leftWidth, minWidth: leftWidth }}>
              <ReviewPanel />
            </div>
          )}
          {activeSidebar === 'svn' && (
            <div className="sidebar-panel" style={{ width: leftWidth, minWidth: leftWidth }}>
              <SvnPanel />
            </div>
          )}
          {activeSidebar === 'settings' && (
            <SettingsPanel />
          )}
          {activeSidebar && (
            <div className="resize-handle" onMouseDown={handleResizeStart('left')} />
          )}
          <div className="main-content">
            <EditorTabs />
            <StatusBar />
          </div>
          <div className="resize-handle" onMouseDown={handleResizeStart('right')} />
          <div className="right-panel" style={{ width: rightWidth, minWidth: rightWidth }}>
            <div className="right-panel-tabs">
              {([
                { id: 'chat' as const, label: 'Chat' },
                { id: 'terminal' as const, label: 'Terminal' },
              ]).map((tab) => (
                <div
                  key={tab.id}
                  onClick={() => setRightTab(tab.id)}
                  className={`right-tab ${rightTab === tab.id ? 'active' : ''}`}
                >
                  {tab.label}
                </div>
              ))}
            </div>
            <div className="right-panel-body">
              {rightTab === 'chat' ? <ChatPanel /> : <TerminalPanel />}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default App;
