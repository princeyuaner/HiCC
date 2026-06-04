import React from 'react';
import { useAppStore } from '../../store/app-store';
import CodeEditor from './CodeEditor';
import Breadcrumb from './Breadcrumb';

const EditorTabs: React.FC = () => {
  const openTabs = useAppStore((s) => s.openTabs);
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const closeTab = useAppStore((s) => s.closeTab);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {openTabs.length > 0 && (
        <div style={{
          display: 'flex',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-color)',
          overflow: 'auto',
          flexShrink: 0,
        }}>
          {openTabs.map((tab) => (
            <div
              key={tab.path}
              onClick={() => setActiveTab(tab.path)}
              style={{
                padding: '4px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                fontSize: 13,
                background: activeTab === tab.path ? 'var(--bg-primary)' : 'transparent',
                color: activeTab === tab.path ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderRight: '1px solid var(--border-color)',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{tab.isDirty ? '● ' : ''}{tab.name}</span>
              <span
                onClick={(e) => { e.stopPropagation(); closeTab(tab.path); }}
                style={{
                  marginLeft: 4,
                  cursor: 'pointer',
                  opacity: 0.5,
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                ×
              </span>
            </div>
          ))}
        </div>
      )}
      <Breadcrumb />
      <CodeEditor />
    </div>
  );
};

export default EditorTabs;
