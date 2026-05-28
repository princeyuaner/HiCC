import React from 'react';
import { useAppStore } from '../../store/app-store';

const Sidebar: React.FC = () => {
  const activeSidebar = useAppStore((s) => s.activeSidebar);
  const setActiveSidebar = useAppStore((s) => s.setActiveSidebar);

  const items = [
    { id: 'files' as const, label: 'Files', icon: '📁' },
    { id: 'search' as const, label: 'Search', icon: '🔍' },
    { id: 'settings' as const, label: 'Settings', icon: '⚙' },
  ];

  return (
    <div style={{
      width: 48,
      background: 'var(--bg-tertiary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 8,
      gap: 4,
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
            borderRadius: 4,
            background: activeSidebar === item.id ? 'var(--accent-color)' : 'transparent',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: 18,
            opacity: activeSidebar === item.id ? 1 : 0.6,
          }}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
};

export default Sidebar;
