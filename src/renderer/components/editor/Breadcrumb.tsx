import React from 'react';
import { useAppStore } from '../../store/app-store';

const Breadcrumb: React.FC = () => {
  const activeTab = useAppStore((s) => s.activeTab);
  const projectPath = useAppStore((s) => s.projectPath);
  const setActiveSidebar = useAppStore((s) => s.setActiveSidebar);

  if (!activeTab || !projectPath) return null;

  // Calculate relative path from project root
  const normProject = projectPath.replace(/\\/g, '/');
  const normFile = activeTab.replace(/\\/g, '/');
  let relativePath = normFile;
  if (normFile.toLowerCase().startsWith(normProject.toLowerCase())) {
    relativePath = normFile.slice(normProject.length).replace(/^\//, '');
  }

  const segments = relativePath.split('/');

  const handleSegmentClick = (index: number) => {
    // Build the directory path up to this segment
    const dirSegments = segments.slice(0, index + 1);
    const dirPath = normProject + '/' + dirSegments.join('/');
    // Focus the file explorer and expand to this directory
    const store = useAppStore.getState();
    // Expand all ancestor dirs
    const normPath = dirPath.replace(/\\/g, '/');
    const parts = normPath.split('/');
    const expanded = new Set(store.expandedDirs);
    for (let i = 1; i <= parts.length; i++) {
      expanded.add(parts.slice(0, i).join('/'));
    }
    useAppStore.setState({ expandedDirs: expanded });
    setActiveSidebar('files');
  };

  const segStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '1px 2px',
    borderRadius: 3,
    transition: 'color 0.15s, background 0.15s',
    whiteSpace: 'nowrap',
  };

  const fileStyle: React.CSSProperties = {
    ...segStyle,
    color: 'var(--text-primary)',
    cursor: 'default',
    fontWeight: 500,
  };

  const separatorStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--border-color)',
    padding: '0 2px',
    userSelect: 'none',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      height: 26,
      padding: '0 12px',
      background: 'var(--bg-primary)',
      borderBottom: '1px solid var(--border-color)',
      overflowX: 'auto',
      flexShrink: 0,
      gap: 0,
    }}>
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && <span style={separatorStyle}>/</span>}
            <span
              style={isLast ? fileStyle : segStyle}
              onClick={isLast ? undefined : () => handleSegmentClick(i)}
              onMouseEnter={isLast ? undefined : (e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--accent-color)';
                (e.currentTarget as HTMLElement).style.background = 'rgba(88,166,255,0.08)';
              }}
              onMouseLeave={isLast ? undefined : (e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
              title={isLast ? activeTab : `Navigate to ${seg}`}
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
