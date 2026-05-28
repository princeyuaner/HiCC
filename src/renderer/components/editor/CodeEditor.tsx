import React, { useEffect, useState, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useAppStore } from '../../store/app-store';

const CodeEditor: React.FC = () => {
  const activeTab = useAppStore((s) => s.activeTab);
  const openTabs = useAppStore((s) => s.openTabs);
  const theme = useAppStore((s) => s.theme);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [editorInstance, setEditorInstance] = useState<Parameters<OnMount>[0] | null>(null);

  const activeFile = openTabs.find((t) => t.path === activeTab);

  useEffect(() => {
    if (!activeTab) {
      setFileContent(null);
      return;
    }

    window.hicc.readFile(activeTab).then((content) => {
      setFileContent(content);
    }).catch(() => {
      setFileContent('// Error loading file');
    });
  }, [activeTab]);

  const handleEditorMount: OnMount = useCallback((editor) => {
    setEditorInstance(editor);
  }, []);

  const handleContentChange = useCallback((value: string | undefined) => {
    if (value !== undefined && activeTab) {
      setFileContent(value);
      useAppStore.getState().markTabDirty(activeTab, true);
    }
  }, [activeTab]);

  const handleSave = useCallback(() => {
    if (activeTab && fileContent !== null) {
      window.hicc.writeFile(activeTab, fileContent).then(() => {
        useAppStore.getState().markTabDirty(activeTab, false);
      });
    }
  }, [activeTab, fileContent]);

  // Keyboard shortcut: Ctrl+S
  useEffect(() => {
    if (!editorInstance) return;
    const disposable = editorInstance.addAction({
      id: 'save-file',
      label: 'Save File',
      keybindings: [2048 | 49], // Ctrl+S
      run: handleSave,
    });
    return () => disposable.dispose();
  }, [editorInstance, handleSave]);

  if (!activeTab || !activeFile) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
        fontSize: 14,
      }}>
        Select a file to edit
      </div>
    );
  }

  if (fileContent === null) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden' }}>
      <Editor
        height="100%"
        language={getLanguage(activeFile.name)}
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
        value={fileContent}
        onChange={handleContentChange}
        onMount={handleEditorMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: 'var(--font-mono, monospace)',
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'off',
          tabSize: 2,
        }}
      />
    </div>
  );
};

function getLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', go: 'go', java: 'java', rb: 'ruby',
    css: 'css', scss: 'scss', html: 'html', json: 'json', md: 'markdown',
    yaml: 'yaml', yml: 'yaml', xml: 'xml', sql: 'sql', sh: 'shell',
    bash: 'shell', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  };
  return map[ext || ''] || 'plaintext';
}

export default CodeEditor;
