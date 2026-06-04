import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/app-store';

const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const activeSidebar = useAppStore((s) => s.activeSidebar);
  const setActiveSidebar = useAppStore((s) => s.setActiveSidebar);

  const items = [
    { id: 'files' as const, label: t('sidebar.files'), icon: '📁' },
    { id: 'search' as const, label: t('sidebar.search'), icon: '🔍' },
    { id: 'git' as const, label: t('sidebar.git'), icon: '🔀' },
    { id: 'review' as const, label: t('sidebar.review'), icon: '🛡' },
    { id: 'svn' as const, label: t('sidebar.svn'), icon: '🔃' },
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
