import React, { useEffect, useState, useCallback, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useAppStore } from '../../store/app-store';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  selectedText: string;
  fileName: string;
  ext: string;
  startLine: number;
  endLine: number;
}

const CodeEditor: React.FC = () => {
  const activeTab = useAppStore((s) => s.activeTab);
  const openTabs = useAppStore((s) => s.openTabs);
  const theme = useAppStore((s) => s.theme);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [editorInstance, setEditorInstance] = useState<Parameters<OnMount>[0] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, selectedText: '', fileName: '', ext: '', startLine: 0, endLine: 0,
  });

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

  // Auto-refresh when AI edits the current file
  useEffect(() => {
    const handler = (event: { path: string; type: string }) => {
      if (activeTab && event.path === activeTab) {
        window.hicc.readFile(activeTab).then((content) => {
          setFileContent(content);
          useAppStore.getState().markTabDirty(activeTab, false);
          useAppStore.getState().clearDirtyContent(activeTab);
        }).catch(() => {});
      }
    };
    window.hicc.onFileChanged(handler);
  }, [activeTab]);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    setEditorInstance(editor);

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      useAppStore.getState().setCursorPosition(e.position.lineNumber, e.position.column);
    });

    // Register AI inline completion provider
    const provider = monaco.languages.registerInlineCompletionsProvider('*', {
      provideInlineCompletions: async (
        model: Monaco.editor.ITextModel,
        position: Monaco.Position,
        _context: Monaco.languages.InlineCompletionContext,
        token: Monaco.CancellationToken,
      ) => {
        if (token.isCancellationRequested) return { items: [] };

        const codeBefore = model.getValueInRange({
          startLineNumber: Math.max(1, position.lineNumber - 50),
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });
        const codeAfter = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: Math.min(model.getLineCount(), position.lineNumber + 10),
          endColumn: model.getLineMaxColumn(Math.min(model.getLineCount(), position.lineNumber + 10)),
        });

        if (token.isCancellationRequested) return { items: [] };

        try {
          const result = await window.hicc.inlineComplete({
            codeBefore: codeBefore.slice(-500),
            codeAfter: codeAfter.slice(0, 100),
            language: model.getLanguageId(),
            filePath: model.uri.path,
          });

          if (token.isCancellationRequested || !result.text) return { items: [] };

          return {
            items: [{
              insertText: result.text,
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              },
            }],
          };
        } catch {
          return { items: [] };
        }
      },
    });

    // Cleanup on editor dispose
    editor.onDidDispose(() => provider.dispose());
  }, []);

  const handleContentChange = useCallback((value: string | undefined) => {
    if (value !== undefined && activeTab) {
      setFileContent(value);
      useAppStore.getState().markTabDirty(activeTab, true);
      useAppStore.getState().setDirtyContent(activeTab, value);
    }
  }, [activeTab]);

  const handleSave = useCallback(() => {
    if (activeTab && fileContent !== null) {
      window.hicc.writeFile(activeTab, fileContent).then(() => {
        useAppStore.getState().markTabDirty(activeTab, false);
        useAppStore.getState().clearDirtyContent(activeTab);
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

  // Custom context menu via DOM event (avoids Monaco/Electron menu conflicts)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleContextMenu = (e: MouseEvent) => {
      // Only handle right-clicks in the editor area
      const target = e.target as HTMLElement;
      if (!target.closest('.monaco-editor')) return;

      // Get selection from Monaco
      const editor = editorInstance;
      if (!editor) return;
      const selection = editor.getSelection();
      if (!selection || selection.isEmpty()) return;
      const model = editor.getModel();
      if (!model) return;
      const selectedText = model.getValueInRange(selection);
      if (!selectedText.trim()) return;

      e.preventDefault();
      e.stopPropagation();

      const uri = model.uri;
      const fileName = uri.path.split('/').pop() || 'selection';
      const ext = fileName.split('.').pop()?.toLowerCase() || '';

      setCtxMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        selectedText,
        fileName,
        ext,
        startLine: selection.startLineNumber,
        endLine: selection.endLineNumber,
      });
    };

    const hideMenu = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setCtxMenu((s) => ({ ...s, visible: false }));
    };

    container.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('mousedown', hideMenu);
    return () => {
      container.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('mousedown', hideMenu);
    };
  }, [editorInstance]);

  const handleExplain = () => {
    useAppStore.getState().setPendingSelectionCommand(
      `/explain\n` + '```' + `\n${ctxMenu.selectedText}\n` + '```'
    );
    setCtxMenu((s) => ({ ...s, visible: false }));
  };

  const handleFix = () => {
    useAppStore.getState().setPendingSelectionCommand(
      `/fix\n` + '```' + `\n${ctxMenu.selectedText}\n` + '```'
    );
    setCtxMenu((s) => ({ ...s, visible: false }));
  };

  const handleRefactor = () => {
    useAppStore.getState().setPendingSelectionCommand(
      `/refactor\n` + '```' + `\n${ctxMenu.selectedText}\n` + '```'
    );
    setCtxMenu((s) => ({ ...s, visible: false }));
  };

  const handleSendToChat = () => {
    const key = `${ctxMenu.fileName}:${ctxMenu.startLine}-${ctxMenu.endLine}`;
    useAppStore.getState().setPendingAttachment({
      filePath: key,
      fileName: `${ctxMenu.fileName}:${ctxMenu.startLine}-${ctxMenu.endLine}`,
      type: 'selection',
      content: ctxMenu.selectedText,
      language: ctxMenu.ext,
    });
    setCtxMenu((s) => ({ ...s, visible: false }));
  };

  // Line focus from search results
  const pendingLineFocus = useAppStore((s) => s.pendingLineFocus);
  useEffect(() => {
    if (!editorInstance || !pendingLineFocus || pendingLineFocus.filePath !== activeTab) return;
    editorInstance.revealLineInCenter(pendingLineFocus.line);
    editorInstance.setPosition({ lineNumber: pendingLineFocus.line, column: 1 });
    editorInstance.focus();
  }, [editorInstance, pendingLineFocus, activeTab]);

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
    <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
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
          contextmenu: false,
        }}
      />
      {ctxMenu.visible && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            left: ctxMenu.x,
            top: ctxMenu.y,
            zIndex: 10000,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            minWidth: 220,
            padding: '4px 0',
          }}
        >
          <MenuItem label="Explain" onClick={handleExplain} />
          <MenuItem label="Fix" onClick={handleFix} />
          <MenuItem label="Refactor" onClick={handleRefactor} />
          <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 0' }} />
          <MenuItem label="Send selection to chat" onClick={handleSendToChat} />
        </div>
      )}
    </div>
  );
};

const MenuItem: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <div
    onClick={onClick}
    style={{
      padding: '6px 16px',
      cursor: 'pointer',
      fontSize: 13,
      color: 'var(--text-primary)',
      transition: 'background 0.1s',
    }}
    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
  >
    {label}
  </div>
);

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
