import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/app-store';

const StatusBar: React.FC = () => {
  const cursorLine = useAppStore((s) => s.cursorLine);
  const cursorColumn = useAppStore((s) => s.cursorColumn);
  const activeTab = useAppStore((s) => s.activeTab);
  const openTabs = useAppStore((s) => s.openTabs);
  const [gitBranch, setGitBranch] = useState('');
  const projectPath = useAppStore((s) => s.projectPath);
  const indexProgress = useAppStore((s) => s.indexProgress);
  const indexCount = useAppStore((s) => s.indexCount);
  const indexCurrentFile = useAppStore((s) => s.indexCurrentFile);

  useEffect(() => {
    if (!projectPath) { setGitBranch(''); return; }
    window.hicc.gitStatus().then(s => setGitBranch(s.branch)).catch(() => setGitBranch(''));
  }, [projectPath]);

  const activeFile = openTabs.find(t => t.path === activeTab);
  const ext = activeFile?.name?.split('.').pop()?.toUpperCase() || '';

  return (
    <div style={{
      height: 24,
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 14px',
      fontSize: 11,
      color: 'var(--text-muted)',
      gap: 16,
      userSelect: 'none',
    }}>
      <span>Ln {cursorLine}, Col {cursorColumn}</span>
      {ext && <span>{ext}</span>}
      <span style={{ flex: 1 }} />
      {indexProgress && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--accent-color)' }} title={indexCurrentFile || undefined}>
          <span style={{ width: 80, height: 3, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden', verticalAlign: 'middle' }}>
            <span style={{ display: 'block', width: '100%', height: '100%', background: 'var(--accent-color)', borderRadius: 2, animation: 'pulse-progress 1.2s ease-in-out infinite' }} />
          </span>
          <span style={{ fontSize: 11 }}>
            {indexCount > 0 ? `${indexCount.toLocaleString()} files` : 'Scanning...'}
          </span>
        </span>
      )}
      {gitBranch && (
        <span style={{ fontFamily: 'var(--font-mono)' }}>🔀 {gitBranch}</span>
      )}
    </div>
  );
};

export default StatusBar;
