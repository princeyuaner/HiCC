import React from 'react';
import { useAppStore } from '../../store/app-store';

const Sidebar: React.FC = () => {
  const activeSidebar = useAppStore((s) => s.activeSidebar);
  const setActiveSidebar = useAppStore((s) => s.setActiveSidebar);

  const items = [
    { id: 'files' as const, label: 'Files', icon: '📁' },
    { id: 'search' as const, label: 'Search', icon: '🔍' },
    { id: 'git' as const, label: 'Git', icon: '🔀' },
    { id: 'review' as const, label: 'Review', icon: '🛡' },
    { id: 'svn' as const, label: 'SVN', icon: '🔃' },
  ];

  return (
    <div style={{
      width: 48,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 10,
      gap: 2,
    }}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveSidebar(item.id)}
          title={item.label}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            borderRadius: 8,
            background: activeSidebar === item.id ? 'rgba(88, 166, 255, 0.12)' : 'transparent',
            color: activeSidebar === item.id ? 'var(--accent-color)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 16,
            transition: 'all 0.15s ease',
          }}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
};

export default Sidebar;
