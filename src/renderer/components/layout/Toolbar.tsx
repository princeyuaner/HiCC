import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/app-store';
import SftpDialog from './SftpDialog';
import type { SshConfig, FileNode } from '../../../shared/types';

interface ToolbarProps {
  projectName: string | null;
}

const Toolbar: React.FC<ToolbarProps> = ({ projectName }) => {
  const { t } = useTranslation();
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const theme = useAppStore((s) => s.theme);
  const setActiveSidebar = useAppStore((s) => s.setActiveSidebar);
  const [showSftp, setShowSftp] = useState(false);
  const remoteHost = useAppStore((s) => s.remoteHost);
  const isRemoteConnected = useAppStore((s) => s.isRemoteConnected);

  const handleOpenProject = async () => {
    const result = await window.hicc.openProject();
    if (result) {
      const store = useAppStore.getState();
      store.setProject(result.path, result.name);
      await window.hicc.setProject(result.path);
      await store.refreshFileTree();
      try { await window.hicc.interrupt(); } catch { /* ignore */ }
      store.clearMessages();
      useAppStore.setState({
        contextUsage: null,
        cumulativeInputTokens: 0,
        cumulativeOutputTokens: 0,
        cumulativeCost: 0,
        isRemoteConnected: false,
        remoteHost: null,
      });
      window.hicc.startSession(store.activeModelKey).catch(console.error);
    }
  };

  const handleSftpDisconnect = async () => {
    try {
      await window.hicc.sftpDisconnect();
    } catch { /* ignore */ }
    const store = useAppStore.getState();
    useAppStore.setState({
      isRemoteConnected: false,
      remoteHost: null,
      projectPath: null,
      projectName: null,
      fileTree: [],
    });
  };

  // Connect and browse — keeps connection open, returns file listing
  const handleConnectAndBrowse = async (config: SshConfig): Promise<FileNode[]> => {
    await window.hicc.sftpConnect(config);
    const files = await window.hicc.listFiles('.', 1);
    return files;
  };

  // List directory while browsing (connection already open)
  const handleListRemoteDir = async (dirPath: string): Promise<FileNode[]> => {
    return window.hicc.listFiles(dirPath, 1);
  };

  // Final connect from browse — reconnect with selected path, refresh tree
  const handleSftpSelect = async (config: SshConfig) => {
    // Reconnect with the selected rootPath
    await window.hicc.sftpDisconnect();
    await window.hicc.sftpConnect(config);
    const store = useAppStore.getState();
    store.setProject(config.rootPath, config.name);
    try { await store.refreshFileTree(); } catch (err) { console.error(err); }
    try { await window.hicc.interrupt(); } catch { /* ignore */ }
    store.clearMessages();
    useAppStore.setState({
      contextUsage: null,
      cumulativeInputTokens: 0,
      cumulativeOutputTokens: 0,
      cumulativeCost: 0,
      isRemoteConnected: true,
      remoteHost: config.host,
    });
    setShowSftp(false);
    window.hicc.startSession(store.activeModelKey).catch(console.error);
  };

  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: 36,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '0 14px',
        gap: 10,
        WebkitAppRegion: 'drag' as const,
      }}>
        <button
          onClick={handleOpenProject}
          style={{
            padding: '4px 14px',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            WebkitAppRegion: 'no-drag' as const,
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
        >
          {t('toolbar.openProject')}
        </button>
        {isRemoteConnected ? (
          <button
            onClick={handleSftpDisconnect}
            title={`Disconnect from ${remoteHost}`}
            style={{
              padding: '4px 14px',
              borderRadius: 8,
              border: '1px solid var(--accent-green)',
              background: 'rgba(63, 185, 80, 0.1)',
              color: 'var(--accent-green)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              WebkitAppRegion: 'no-drag' as const,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(63, 185, 80, 0.2)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(63, 185, 80, 0.1)'; }}
          >
            {t('sftp.disconnect')}
          </button>
        ) : (
          <button
            onClick={() => setShowSftp(true)}
            style={{
              padding: '4px 14px',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              WebkitAppRegion: 'no-drag' as const,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
          >
            {t('toolbar.remote')}
          </button>
        )}
        <span style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: 500,
        }}>
          {isRemoteConnected ? `🔗 ${remoteHost}` : (projectName || 'No project')}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={toggleTheme}
          style={{
            padding: '4px 10px',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 14,
            WebkitAppRegion: 'no-drag' as const,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        <button
          onClick={() => setActiveSidebar('settings')}
          title="Settings"
          style={{
            padding: '4px 10px',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 14,
            WebkitAppRegion: 'no-drag' as const,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          ⚙
        </button>
      </div>
      {showSftp && (
        <SftpDialog
          onConnect={handleSftpSelect}
          onCancel={() => setShowSftp(false)}
          connectAndBrowse={handleConnectAndBrowse}
          listRemoteDir={handleListRemoteDir}
        />
      )}
    </>
  );
};

export default Toolbar;
