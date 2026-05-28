import React, { useEffect } from 'react';
import { useAppStore } from './store/app-store';
import Sidebar from './components/layout/Sidebar';
import Toolbar from './components/layout/Toolbar';
import Panel from './components/layout/Panel';
import FileExplorer from './components/editor/FileExplorer';
import EditorTabs from './components/editor/EditorTabs';
import ChatPanel from './components/chat/ChatPanel';
import ErrorBoundary from './components/common/ErrorBoundary';

const App: React.FC = () => {
  const theme = useAppStore((s) => s.theme);
  const projectName = useAppStore((s) => s.projectName);
  const activeSidebar = useAppStore((s) => s.activeSidebar);
  const setApiKey = useAppStore((s) => s.setApiKey);

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
            <Panel>
              <ChatPanel />
            </Panel>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default App;
