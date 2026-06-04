import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/app-store';
import type { FileNode } from '../types';

export type PaletteMode = 'files' | 'commands';

export interface PaletteState {
  open: boolean;
  mode: PaletteMode;
  query: string;
}

export function usePalette(): {
  state: PaletteState;
  openFiles: () => void;
  openCommands: () => void;
  close: () => void;
  updateQuery: (q: string) => void;
  results: PaletteResult[];
  execute: () => void;
} {
  const [state, setState] = useState<PaletteState>({ open: false, mode: 'files', query: '' });
  const [fileResults, setFileResults] = useState<PaletteResult[]>([]);
  const [cmdResults, setCmdResults] = useState<PaletteResult[]>([]);

  const openFiles = useCallback(() => setState({ open: true, mode: 'files', query: '' }), []);
  const openCommands = useCallback(() => setState({ open: true, mode: 'commands', query: '' }), []);
  const close = useCallback(() => setState({ open: false, mode: 'files', query: '' }), []);
  const updateQuery = useCallback((q: string) => setState(s => ({ ...s, query: q })), []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (e.shiftKey) openCommands();
        else openFiles();
        return;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openFiles, openCommands, close]);

  // Search files
  useEffect(() => {
    if (!state.open || state.mode !== 'files') return;
    const q = state.query.toLowerCase();
    const tree = useAppStore.getState().fileTree;
    const results: PaletteResult[] = [];
    const walk = (nodes: FileNode[]) => {
      for (const n of nodes) {
        if (n.type === 'file' && (!q || n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q))) {
          results.push({
            id: n.path,
            label: n.name,
            description: n.path,
            action: () => {
              const store = useAppStore.getState();
              store.openFile(n.path, n.name);
              close();
            },
          });
        }
        if (n.children) walk(n.children);
      }
    };
    walk(tree);
    setFileResults(results.slice(0, 20));
  }, [state.open, state.mode, state.query, close]);

  // Commands
  useEffect(() => {
    if (!state.open || state.mode !== 'commands') return;
    const commands: PaletteResult[] = [
      { id: 'git', label: 'Git: Show Git Panel', description: '', action: () => { useAppStore.getState().setActiveSidebar('git'); close(); } },
      { id: 'files', label: 'View: Show Explorer', description: '', action: () => { useAppStore.getState().setActiveSidebar('files'); close(); } },
      { id: 'search', label: 'View: Show Search', description: '', action: () => { useAppStore.getState().setActiveSidebar('search'); close(); } },
      { id: 'toggleTheme', label: 'Preferences: Toggle Theme', description: '', action: () => { useAppStore.getState().toggleTheme(); close(); } },
      { id: 'newChat', label: 'Chat: New Conversation', description: '', action: () => { useAppStore.getState().createConversation(); close(); } },
    ];
    const q = state.query.toLowerCase();
    const filtered = q ? commands.filter(c => c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) : commands;
    setCmdResults(filtered);
  }, [state.open, state.mode, state.query, close]);

  const results = state.mode === 'files' ? fileResults : cmdResults;

  const execute = useCallback(() => {
    if (results.length > 0) results[0].action();
  }, [results]);

  return { state, openFiles, openCommands, close, updateQuery, results, execute };
}

export interface PaletteResult {
  id: string;
  label: string;
  description: string;
  action: () => void;
}
