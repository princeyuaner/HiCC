import React from 'react';
import { useAppStore } from '../../store/app-store';

const Breadcrumb: React.FC = () => {
  const activeTab = useAppStore((s) => s.activeTab);
  const projectPath = useAppStore((s) => s.projectPath);
  const projectName = useAppStore((s) => s.projectName);
  const setActiveSidebar = useAppStore((s) => s.setActiveSidebar);

  if (!activeTab) return null;

  // Fallback: if no project path, just show the full file path
  if (!projectPath) {
    const fullSegments = activeTab.replace(/\\/g, '/').split('/');
    return (
      <div style={{
        display: 'flex', alignItems: 'center', height: 28, padding: '0 10px',
        background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)',
        overflowX: 'auto', flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, padding: '1px 4px' }}>
          {fullSegments[fullSegments.length - 1]}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
          {activeTab}
        </span>
      </div>
    );
  }

  // Calculate relative path from project root
  const normProject = projectPath.replace(/\\/g, '/').replace(/\/$/, '');
  const normFile = activeTab.replace(/\\/g, '/');
  let relativePath = normFile;
  if (normFile.toLowerCase().startsWith(normProject.toLowerCase())) {
    relativePath = normFile.slice(normProject.length).replace(/^\//, '');
  }

  const segments = [projectName || normProject.split('/').pop() || '…', ...relativePath.split('/')];

  const handleSegmentClick = (index: number) => {
    if (index === 0) {
      // Root segment — expand project root in file tree
      const store = useAppStore.getState();
      const expanded = new Set(store.expandedDirs);
      expanded.add(normProject.replace(/^\//, ''));
      useAppStore.setState({ expandedDirs: expanded });
      setActiveSidebar('files');
      return;
    }
    // Build the directory path up to this segment
    const dirSegments = segments.slice(1, index + 1);
    const dirPath = normProject + '/' + dirSegments.join('/');
    const store = useAppStore.getState();
    const normPath = dirPath.replace(/\\/g, '/');
    const parts = normPath.split('/');
    const expanded = new Set(store.expandedDirs);
    for (let i = normProject.split('/').length + 1; i <= parts.length; i++) {
      expanded.add(parts.slice(0, i).join('/'));
    }
    useAppStore.setState({ expandedDirs: expanded });
    setActiveSidebar('files');
  };

  const segStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '1px 4px',
    borderRadius: 3,
    transition: 'color 0.15s, background 0.15s',
    whiteSpace: 'nowrap',
  };

  const fileStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--text-primary)',
    cursor: 'default',
    fontWeight: 600,
    padding: '1px 4px',
    borderRadius: 3,
    whiteSpace: 'nowrap',
  };

  const separatorStyle: React.CSSProperties = {
    fontSize: 14,
    color: 'var(--text-muted)',
    padding: '0 1px',
    userSelect: 'none',
    fontWeight: 300,
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      height: 28,
      padding: '0 10px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      overflowX: 'auto',
      flexShrink: 0,
      gap: 0,
    }}>
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && <span style={separatorStyle}>›</span>}
            <span
              style={isLast ? fileStyle : segStyle}
              onClick={isLast ? undefined : () => handleSegmentClick(i)}
              onMouseEnter={isLast ? undefined : (e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--accent-color)';
                (e.currentTarget as HTMLElement).style.background = 'rgba(88,166,255,0.1)';
              }}
              onMouseLeave={isLast ? undefined : (e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
              title={isLast ? activeTab : `Go to ${seg}`}
            >
              {seg}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default Breadcrumb;
