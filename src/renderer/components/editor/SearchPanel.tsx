import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppStore } from '../../store/app-store';
import styles from './SearchPanel.module.css';

interface SearchResult {
  file: string;
  line: number;
  content: string;
}

const SearchPanel: React.FC = () => {
  const [query, setQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [fileNameResults, setFileNameResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showFileFilter, setShowFileFilter] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build search options from toggles
  const searchOptions = useMemo(() => ({
    caseSensitive,
    wholeWord,
    useRegex,
    fileTypes: fileTypeFilter || undefined,
  }), [caseSensitive, wholeWord, useRegex, fileTypeFilter]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setFileNameResults([]); setLoading(false); return; }

    // 1. Fast filename search from in-memory file tree — show results immediately
    const tree = useAppStore.getState().fileTree;
    const nameHits: SearchResult[] = [];
    const lowerQ = q.toLowerCase();
    const walkTree = (nodes: Array<{ name: string; path: string; type: string; children?: typeof nodes }>) => {
      for (const n of nodes) {
        if (n.name.toLowerCase().includes(lowerQ)) {
          nameHits.push({ file: n.path, line: 0, content: n.name });
        }
        if (n.children) walkTree(n.children as typeof nodes);
        if (nameHits.length >= 50) return;
      }
    };
    walkTree(tree);
    setFileNameResults(nameHits.slice(0, 50));
    setLoading(true);

    // 2. Content search
    try {
      const r = await window.hicc.searchFiles(q, undefined, searchOptions);
      setResults(r.slice(0, 300));
    } catch { setResults([]); }
    setLoading(false);
    setSelectedIndex(-1);
    setCollapsedFiles(new Set());
  }, [searchOptions]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(query), 250);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, doSearch]);

  // Re-search when options change and there's a query
  useEffect(() => {
    if (!query.trim()) return;
    doSearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseSensitive, wholeWord, useRegex, fileTypeFilter]);

  // Build flat list for keyboard navigation — content results only
  const flatResults = useMemo(() => results, [results]);

  const handleResultClick = (r: SearchResult) => {
    const store = useAppStore.getState();
    const name = r.file.split(/[\\/]/).pop() || r.file;
    store.openFile(r.file, name);
    if (r.line > 0) store.focusLine(r.file, r.line);
  };

  const toggleFileCollapse = (file: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  };

  // Group content results by file
  const contentGroups = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    for (const r of results) {
      (groups[r.file] ||= []).push(r);
    }
    return groups;
  }, [results]);

  const groupEntries = useMemo(() => Object.entries(contentGroups), [contentGroups]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (query) { setQuery(''); setResults([]); setFileNameResults([]); }
      return;
    }
    if (flatResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      const r = flatResults[selectedIndex];
      if (r) handleResultClick(r);
    }
  };

  const hasFileNameHits = fileNameResults.length > 0;
  const hasContentHits = groupEntries.length > 0;
  const totalHits = flatResults.length;
  const totalFiles = groupEntries.length;

  // Highlight matching text in content
  const highlightMatch = (text: string, idx: number): React.ReactNode => {
    if (!query.trim()) return text;

    let escaped = query;
    try {
      if (!useRegex) {
        // Escape special regex chars for literal search
        escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      if (!caseSensitive) {
        escaped = escaped.split('').map((c) =>
          /[a-zA-Z]/.test(c) ? `[${c.toLowerCase()}${c.toUpperCase()}]` : c
        ).join('');
      }
      const regex = new RegExp(`(${escaped})`, wholeWord ? '' : 'g');
      const parts = text.split(regex);
      return parts.map((part, i) =>
        regex.test(part) && i % 2 === 1
          ? <mark key={`${idx}-${i}`} className={styles.highlight}>{part}</mark>
          : part
      );
    } catch {
      // If regex is invalid, just render plain text
      const idx = caseSensitive ? text.indexOf(query) : text.toLowerCase().indexOf(query.toLowerCase());
      if (idx < 0) return text;
      return (
        <>
          {text.slice(0, idx)}
          <mark className={styles.highlight}>{text.slice(idx, idx + query.length)}</mark>
          {text.slice(idx + query.length)}
        </>
      );
    }
  };

  // Build a global index map from flat results to display position
  const selectedFilePath = selectedIndex >= 0 && selectedIndex < flatResults.length
    ? flatResults[selectedIndex].file
    : null;
  const selectedLine = selectedIndex >= 0 && selectedIndex < flatResults.length
    ? flatResults[selectedIndex].line
    : null;

  // Scroll selected result into view
  const selectedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  return (
    <div className={styles.panel} onKeyDown={handleKeyDown}>
      {/* Search bar */}
      <div className={styles.searchBar}>
        <div className={styles.inputRow}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Search files by name or content..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {loading && <span className={styles.spinner}>⏳</span>}
        </div>
        <div className={styles.toggleRow}>
          <button
            className={`${styles.toggleBtn} ${caseSensitive ? styles.toggleBtnOn : ''}`}
            onClick={() => setCaseSensitive(!caseSensitive)}
            title="Case sensitive"
          >
            Aa
          </button>
          <button
            className={`${styles.toggleBtn} ${wholeWord ? styles.toggleBtnOn : ''}`}
            onClick={() => {
              setWholeWord(!wholeWord);
              if (!wholeWord) setUseRegex(false); // mutually exclusive with regex
            }}
            title="Match whole word"
          >
            ab
          </button>
          <button
            className={`${styles.toggleBtn} ${useRegex ? styles.toggleBtnOn : ''}`}
            onClick={() => {
              setUseRegex(!useRegex);
              if (!useRegex) setWholeWord(false); // mutually exclusive with whole word
            }}
            title="Use regular expression"
          >
            .*
          </button>
          <button
            className={`${styles.toggleBtn} ${showFileFilter ? styles.toggleBtnOn : ''}`}
            onClick={() => setShowFileFilter(!showFileFilter)}
            title="Filter by file type"
          >
            📄
          </button>
        </div>
      </div>

      {/* File type filter */}
      {showFileFilter && (
        <div className={styles.filterRow}>
          <input
            className={styles.filterInput}
            placeholder="Files to include (e.g. *.ts, *.tsx, *.json)"
            value={fileTypeFilter}
            onChange={(e) => setFileTypeFilter(e.target.value)}
          />
        </div>
      )}

      {/* Stats bar */}
      {query && !loading && (hasContentHits || hasFileNameHits) && (
        <div className={styles.statsBar}>
          {totalHits > 0
            ? `${totalHits} results in ${totalFiles} files`
            : `${fileNameResults.length} filename matches`}
        </div>
      )}

      {/* Results area */}
      <div className={styles.results}>
        {/* Empty states */}
        {query && !loading && !hasFileNameHits && !hasContentHits && (
          <div className={styles.empty}>No results found</div>
        )}
        {!query && (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>Search</div>
            <div className={styles.emptyHint}>Type to search by filename or content</div>
          </div>
        )}

        {/* Filename matches */}
        {hasFileNameHits && (
          <div className={styles.group}>
            <div className={styles.groupHeader} style={{ color: 'var(--accent-color)' }}>
              <span className={styles.groupIcon}>📄</span>
              <span className={styles.groupLabel}>Files</span>
              <span className={styles.groupCount}>{fileNameResults.length}</span>
            </div>
            <div className={styles.groupBody}>
              {fileNameResults.map((r, i) => (
                <div
                  key={`name-${r.file}-${i}`}
                  className={styles.resultItem}
                  onClick={() => handleResultClick(r)}
                >
                  <span className={styles.fileIcon}>📄</span>
                  <span className={styles.filePathText}>{r.file}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content matches grouped by file */}
        {groupEntries.map(([file, fileResults]) => {
          const isCollapsed = collapsedFiles.has(file);
          return (
            <div key={file} className={styles.group}>
              <div
                className={styles.groupHeader}
                onClick={() => toggleFileCollapse(file)}
              >
                <span className={styles.chevron}>{isCollapsed ? '▶' : '▼'}</span>
                <span className={styles.fileIcon}>📄</span>
                <span className={styles.groupLabel} title={file}>
                  {file.split(/[\\/]/).pop() || file}
                </span>
                <span className={styles.groupPath}>{file}</span>
                <span className={styles.groupCount}>{fileResults.length}</span>
              </div>
              {!isCollapsed && (
                <div className={styles.groupBody}>
                  {fileResults.map((r, i) => {
                    const globalIdx = flatResults.indexOf(r);
                    const isSelected = globalIdx === selectedIndex;
                    const contentKey = `${r.file}:${r.line}:${i}`;
                    return (
                      <div
                        key={contentKey}
                        ref={isSelected ? selectedRef : undefined}
                        className={`${styles.resultItem} ${isSelected ? styles.resultItemSelected : ''}`}
                        onClick={() => handleResultClick(r)}
                      >
                        <span className={styles.lineNumber}>{r.line}</span>
                        <span className={styles.lineContent}>
                          {highlightMatch(r.content.slice(0, 300), i)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SearchPanel;
