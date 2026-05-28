import React from 'react';
import { useAppStore } from '../../store/app-store';

interface ToolbarProps {
  projectName: string | null;
}

const Toolbar: React.FC<ToolbarProps> = ({ projectName }) => {
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const theme = useAppStore((s) => s.theme);
  const setApiKey = useAppStore((s) => s.setApiKey);
  const apiKey = useAppStore((s) => s.apiKey);

  const handleOpenProject = async () => {
    const result = await window.hicc.openProject();
    if (result) {
      useAppStore.getState().setProject(result.path, result.name);
      useAppStore.getState().refreshFileTree();
    }
  };

  const handleSetApiKey = () => {
    const key = prompt('Enter your Anthropic API key:', apiKey || '');
    if (key !== null) {
      window.hicc.setApiKey(key);
      setApiKey(key);
    }
  };

  return (
    <div style={{
      height: 36,
      background: 'var(--bg-tertiary)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      fontSize: 13,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 600 }}>HICC</span>
        {projectName && <span style={{ color: 'var(--text-secondary)' }}>{projectName}</span>}
        <button
          onClick={handleOpenProject}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            padding: '2px 8px',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Open Project
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={handleSetApiKey}
          title={apiKey ? 'API Key configured' : 'Set API Key'}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-color)',
            color: apiKey ? '#4caf50' : '#f44336',
            padding: '2px 8px',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {apiKey ? '● API Key' : '○ Set API Key'}
        </button>
        <button
          onClick={toggleTheme}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            padding: '2px 8px',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
