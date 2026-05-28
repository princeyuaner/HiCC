import React, { useEffect, useState } from 'react';
import { useAppStore } from './store/app-store';
import Sidebar from './components/layout/Sidebar';
import Toolbar from './components/layout/Toolbar';
import Panel from './components/layout/Panel';
import FileExplorer from './components/editor/FileExplorer';
import EditorTabs from './components/editor/EditorTabs';
import ChatPanel from './components/chat/ChatPanel';
import TerminalPanel from './components/terminal/TerminalPanel';
import ErrorBoundary from './components/common/ErrorBoundary';

const App: React.FC = () => {
  const theme = useAppStore((s) => s.theme);
  const projectName = useAppStore((s) => s.projectName);
  const activeSidebar = useAppStore((s) => s.activeSidebar);
  const setApiKey = useAppStore((s) => s.setApiKey);
  const [bottomTab, setBottomTab] = useState<'chat' | 'terminal'>('chat');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    window.hicc.getApiKey().then((key) => {
      if (key) setApiKey(key);
    });
  }, [setApiKey]);

  return (
    <ErrorBoundary>
      <div className="app">
        <Toolbar projectName={projectName} />
        <div className="app-body">
          <Sidebar />
          {activeSidebar === 'files' && (
            <div className="sidebar-panel">
              <FileExplorer />
            </div>
          )}
          <div className="main-content">
            <EditorTabs />
            <div style={{ borderTop: '1px solid var(--border-color)' }}>
              <div style={{
                display: 'flex',
                background: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-color)',
              }}>
                {([
                  { id: 'chat' as const, label: 'Chat' },
                  { id: 'terminal' as const, label: 'Terminal' },
                ]).map((tab) => (
                  <div
                    key={tab.id}
                    onClick={() => setBottomTab(tab.id)}
                    style={{
                      padding: '4px 16px',
                      cursor: 'pointer',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      borderBottom: bottomTab === tab.id ? '2px solid var(--accent-color)' : '2px solid transparent',
                      color: bottomTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {tab.label}
                  </div>
                ))}
              </div>
              <div style={{ height: 300 }}>
                {bottomTab === 'chat' ? <ChatPanel /> : <TerminalPanel />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default App;
