import React, { useEffect } from 'react';
import { useAppStore } from '../../store/app-store';

const UpdateNotification: React.FC = () => {
  const updateStatus = useAppStore((s) => s.updateStatus);
  const setUpdateStatus = useAppStore((s) => s.setUpdateStatus);

  useEffect(() => {
    window.hicc.onUpdateStatusChanged((status) => {
      setUpdateStatus(status);
    });
  }, [setUpdateStatus]);

  if (!updateStatus || updateStatus.stage === 'idle') return null;

  const barStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 500,
    gap: 10,
  };

  const btnBase: React.CSSProperties = {
    padding: '3px 12px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
  };

  switch (updateStatus.stage) {
    case 'checking':
      return (
        <div style={{ ...barStyle, background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
          <span>Checking for updates…</span>
          <button style={{ ...btnBase, background: 'transparent', color: 'var(--text-muted)', marginLeft: 'auto' }}
            onClick={() => setUpdateStatus({ stage: 'idle' })}>✕</button>
        </div>
      );

    case 'available':
      return (
        <div style={{ ...barStyle, background: '#1a3a5c', color: '#58a6ff' }}>
          <span>v{updateStatus.version} available</span>
          <button style={{ ...btnBase, background: '#58a6ff', color: '#fff' }}
            onClick={() => window.hicc.downloadUpdate()}>Download</button>
          <button style={{ ...btnBase, background: 'transparent', color: '#58a6ff', marginLeft: 'auto' }}
            onClick={() => setUpdateStatus({ stage: 'idle' })}>✕</button>
        </div>
      );

    case 'downloading':
      return (
        <div style={{ ...barStyle, background: '#1a3a5c', color: '#58a6ff' }}>
          <span>Downloading… {updateStatus.progress.toFixed(0)}%</span>
          <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${updateStatus.progress}%`, height: '100%', background: '#58a6ff', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
        </div>
      );

    case 'downloaded':
      return (
        <div style={{ ...barStyle, background: '#1a3a2c', color: '#3fb950' }}>
          <span>Update ready — v{updateStatus.version} will install on restart</span>
          <button style={{ ...btnBase, background: '#3fb950', color: '#000' }}
            onClick={() => window.hicc.installUpdate()}>Restart Now</button>
          <button style={{ ...btnBase, background: 'transparent', color: '#3fb950', marginLeft: 'auto' }}
            onClick={() => setUpdateStatus({ stage: 'idle' })}>✕</button>
        </div>
      );

    case 'error':
      return (
        <div style={{ ...barStyle, background: '#5c1a1a', color: '#f85149' }}>
          <span>Update failed: {updateStatus.message}</span>
          <button style={{ ...btnBase, background: '#f85149', color: '#fff' }}
            onClick={() => window.hicc.checkForUpdates()}>Retry</button>
          <button style={{ ...btnBase, background: 'transparent', color: '#f85149', marginLeft: 'auto' }}
            onClick={() => setUpdateStatus({ stage: 'idle' })}>✕</button>
        </div>
      );

    default:
      return null;
  }
};

export default UpdateNotification;
