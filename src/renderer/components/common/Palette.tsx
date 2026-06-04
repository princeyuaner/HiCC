import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../store/app-store';
import type { FileNode } from '../../types';
import styles from './Palette.module.css';

interface Result { id: string; label: string; description: string; action: () => void; _score?: number; }

const Palette: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'files' | 'commands'>('files');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => { setOpen(false); setQuery(''); }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (e.shiftKey) setMode('commands');
        else setMode('files');
        setOpen(true); setQuery(''); setSelectedIndex(0);
      }
      if (e.key === 'Escape' && open) { close(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Search
  useEffect(() => {
    if (!open) return;
    const q = query.toLowerCase().trim();
    if (mode === 'files') {
      const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
      const r: Result[] = [];
      const fileTree = useAppStore.getState().fileTree;
      const walk = (nodes: FileNode[]) => {
        for (const n of nodes) {
          if (n.type === 'file') {
            if (!q) {
              r.push({
                id: n.path, label: n.name, description: n.path,
                action: () => { useAppStore.getState().openFile(n.path, n.name); close(); },
              });
            } else {
              const lowerPath = n.path.toLowerCase();
              const lowerName = n.name.toLowerCase();
              // PyCharm-style: every token must match somewhere in the path
              const allMatch = tokens.every(t => lowerPath.includes(t));
              if (allMatch) {
                const nameMatches = tokens.filter(t => lowerName.includes(t)).length;
                r.push({
                  id: n.path, label: n.name, description: n.path,
                  action: () => { useAppStore.getState().openFile(n.path, n.name); close(); },
                  _score: nameMatches, // more name matches = higher relevance
                });
              }
            }
          }
          if (n.children) walk(n.children);
        }
      };
      walk(fileTree);
      // Sort: more name-token matches first, then exact name, then starts-with, then alpha
      r.sort((a, b) => {
        const sa = a._score ?? 0;
        const sb = b._score ?? 0;
        if (sa !== sb) return sb - sa;
        const aExact = a.label.toLowerCase() === q;
        const bExact = b.label.toLowerCase() === q;
        if (aExact !== bExact) return aExact ? -1 : 1;
        const aStarts = a.label.toLowerCase().startsWith(q);
        const bStarts = b.label.toLowerCase().startsWith(q);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return a.label.localeCompare(b.label);
      });
      setResults(r.slice(0, 50));
    } else {
      const cmds: Result[] = [
        { id: 'git', label: 'Git: Show Git Panel', description: '', action: () => { useAppStore.getState().setActiveSidebar('git'); close(); } },
        { id: 'files', label: 'View: Show Explorer', description: '', action: () => { useAppStore.getState().setActiveSidebar('files'); close(); } },
        { id: 'search', label: 'View: Show Search', description: '', action: () => { useAppStore.getState().setActiveSidebar('search'); close(); } },
        { id: 'toggleTheme', label: 'Preferences: Toggle Theme', description: '', action: () => { useAppStore.getState().toggleTheme(); close(); } },
        { id: 'newChat', label: 'Chat: New Conversation', description: '', action: () => { useAppStore.getState().createConversation(); close(); } },
      ];
      setResults(q ? cmds.filter(c => c.label.toLowerCase().includes(q)) : cmds);
    }
    setSelectedIndex(0);
  }, [open, mode, query, close]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) results[selectedIndex].action();
    }
  };

  return (
    <div className={styles.overlay} onClick={close}>
      <div className={styles.palette} onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className={styles.input}
          placeholder={mode === 'files' ? 'Search files by name...' : 'Type a command...'}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className={styles.results}>
          {results.map((r, i) => (
            <div key={r.id} className={`${styles.item} ${i === selectedIndex ? styles.itemSelected : ''}`}
              onClick={r.action} onMouseEnter={() => setSelectedIndex(i)}>
              <span className={styles.itemLabel}>{r.label}</span>
              {r.description && <span className={styles.itemDesc}>{r.description}</span>}
            </div>
          ))}
          {results.length === 0 && <div className={styles.empty}>No results</div>}
        </div>
      </div>
    </div>
  );
};

export default Palette;
