import React, { useState, useCallback, memo, useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/app-store';
import type { FileNode } from '../../types';

const EXT_COLORS: Record<string, string> = {
  ts: '#3178c6', tsx: '#61dafb', js: '#f7df1e', jsx: '#61dafb',
  py: '#3572a5', rs: '#dea584', go: '#00add8', java: '#b07219',
  html: '#e34c26', css: '#563d7c', json: '#5b5b5b', md: '#8b949e',
  yml: '#8b949e', yaml: '#8b949e', toml: '#8b949e',
};

interface CtxMenu { visible: boolean; x: number; y: number; node: FileNode | null; }

function getFileIcon(node: FileNode): string {
  if (node.type === 'directory') return '📁';
  const ext = node.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'ts' || ext === 'tsx') return '🟦'; if (ext === 'js' || ext === 'jsx') return '🟨';
  if (ext === 'py') return '🐍'; if (ext === 'rs') return '🦀'; if (ext === 'go') return '🔵';
  if (ext === 'html') return '🟧'; if (ext === 'css') return '🎨';
  if (ext === 'json') return '📋'; if (ext === 'md') return '📝';
  return '📄';
}

const ROW_HEIGHT = 28;
const OVERSCAN = 20;

interface FlatRow { node: FileNode; depth: number; isExpanded: boolean; isLoading: boolean; }

const FileExplorer: React.FC = () => {
  const fileTree = useAppStore((s) => s.fileTree);
  const fileTreeLoading = useAppStore((s) => s.fileTreeLoading);
  const indexCount = useAppStore((s) => s.indexCount);
  const indexCurrentFile = useAppStore((s) => s.indexCurrentFile);
  const openFile = useAppStore((s) => s.openFile);
  const refreshFileTree = useAppStore((s) => s.refreshFileTree);
  const expandedDirs = useAppStore((s) => s.expandedDirs);
  const loadedDirs = useAppStore((s) => s.loadedDirs);
  const loadingDirs = useAppStore((s) => s.loadingDirs);
  const activeFilePath = useAppStore((s) => s.activeFilePath);
  const toggleExpandDir = useAppStore((s) => s.toggleExpandDir);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu>({ visible: false, x: 0, y: 0, node: null });
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(500);

  useEffect(() => {
    const updateHeight = () => setContainerHeight(window.innerHeight - 80);
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const handleClick = (node: FileNode) => {
    if (node.type === 'directory') toggleExpandDir(node.path);
    else openFile(node.path, node.name);
  };

  const flatRows = useMemo(() => {
    const rows: FlatRow[] = [];
    const flatten = (nodes: FileNode[], depth: number) => {
      for (const node of nodes) {
        const exp = expandedDirs.has(node.path);
        rows.push({ node, depth, isExpanded: exp, isLoading: loadingDirs.has(node.path) });
        if (node.type === 'directory' && exp) {
          flatten(loadedDirs[node.path] || node.children || [], depth + 1);
        }
      }
    };
    flatten(fileTree, 0);
    return rows;
  }, [fileTree, expandedDirs, loadedDirs, loadingDirs]);

  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(flatRows.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN);
  const visibleRows = flatRows.slice(startIdx, endIdx);
  const totalHeight = flatRows.length * ROW_HEIGHT;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileNode) => {
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, node });
  }, []);
  const closeMenu = () => setCtxMenu({ visible: false, x: 0, y: 0, node: null });
  const handleCopyPath = async () => { if (ctxMenu.node) { await navigator.clipboard.writeText(ctxMenu.node.path); } closeMenu(); };
  const handleDelete = async () => {
    if (!ctxMenu.node) return;
    if (!confirm(`Delete "${ctxMenu.node.name}"?`)) return;
    try { await window.hicc.deleteFile(ctxMenu.node.path); refreshFileTree(); } catch { /* ignore */ }
    closeMenu();
  };
  const handleRenameStart = () => {
    if (!ctxMenu.node) return;
    setRenaming(ctxMenu.node.path); setRenameText(ctxMenu.node.name); closeMenu();
  };
  const handleRenameSubmit = async (oldPath: string) => {
    if (!renameText.trim() || renameText === oldPath.split(/[\\/]/).pop()) { setRenaming(null); return; }
    const dir = oldPath.split(/[\\/]/).slice(0, -1).join('/');
    const newPath = dir ? `${dir}/${renameText}` : renameText;
    try { const c = await window.hicc.readFile(oldPath); await window.hicc.writeFile(newPath, c); await window.hicc.deleteFile(oldPath); refreshFileTree(); }
    catch { alert('Rename failed'); }
    setRenaming(null);
  };

  return (
    <div style={{ padding: '6px 0', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '6px 14px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: 0.8, flexShrink: 0 }}>Explorer</div>
      {fileTreeLoading ? (
        <div style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Progress bar */}
          <div style={{ width: '100%', height: 4, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: indexCount > 0 ? '100%' : '30%',
              height: '100%',
              background: 'var(--accent-color)',
              borderRadius: 2,
              animation: indexCount > 0 ? 'none' : 'pulse-progress 1.2s ease-in-out infinite',
              transition: 'width 0.3s ease',
            }} />
          </div>
          {/* File count */}
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Scanning {indexCount > 0 ? `${indexCount.toLocaleString()} files` : 'files'}...
          </div>
          {/* Current file path */}
          {indexCurrentFile && (
            <div style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontFamily: 'var(--font-mono, monospace)',
            }}>
              {indexCurrentFile}
            </div>
          )}
        </div>
      ) : fileTree.length === 0 ? (
        <div style={{ padding: '20px 12px', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>No project open</div>
      ) : (
        <div ref={containerRef} onScroll={handleScroll} style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <div style={{ height: totalHeight, position: 'relative' }}>
            {visibleRows.map((row, i) => {
              const idx = startIdx + i;
              const { node, depth, isExpanded, isLoading } = row;
              const ext = node.name.split('.').pop()?.toLowerCase() || '';
              const extColor = EXT_COLORS[ext];
              const pl = 14 + depth * 18;
              return renaming === node.path ? (
                <div key={node.path} style={{ position: 'absolute', top: idx * ROW_HEIGHT, left: 0, right: 0, height: ROW_HEIGHT, padding: '5px 12px', paddingLeft: pl, boxSizing: 'border-box' }}>
                  <input value={renameText} onChange={(e) => setRenameText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(node.path); if (e.key === 'Escape') setRenaming(null); }}
                    onBlur={() => handleRenameSubmit(node.path)} autoFocus
                    style={{ width: '100%', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--accent-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
                </div>
              ) : (
                <div key={node.path}
                  style={{
                    position: 'absolute', top: idx * ROW_HEIGHT, left: 0, right: 0, height: ROW_HEIGHT, padding: '5px 12px', paddingLeft: pl,
                    display: 'flex', alignItems: 'center', gap: 6, cursor: node.type === 'file' ? 'grab' : 'pointer',
                    fontSize: 13, color: 'var(--text-primary)', margin: '0 4px', boxSizing: 'border-box', borderRadius: 4, userSelect: 'none',
                    background: activeFilePath === node.path ? 'var(--bg-tertiary)' : 'transparent',
                  }}
                  draggable={node.type === 'file'}
                  onClick={() => handleClick(node)}
                  onContextMenu={(e) => handleContextMenu(e, node)}
                  onDragStart={(e) => { e.dataTransfer.setData('application/x-hicc-file', node.path); e.dataTransfer.setData('text/plain', node.name); e.dataTransfer.effectAllowed = 'copy'; }}
                >
                  <span style={{ width: 16, textAlign: 'center', flexShrink: 0, fontSize: 12 }}>{node.type === 'directory' ? (isExpanded ? '▾' : '▸') : getFileIcon(node)}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: node.type === 'directory' ? 500 : 400 }}>{node.name}</span>
                  {isLoading && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>...</span>}
                  {extColor && <span style={{ width: 6, height: 6, borderRadius: '50%', background: extColor, flexShrink: 0, marginLeft: 'auto', opacity: 0.7 }} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {ctxMenu.visible && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={closeMenu} />
          <div style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 200, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', padding: 4, minWidth: 160 }}>
            <div style={ctxItemStyle} onClick={handleRenameStart} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>✏️ Rename</div>
            <div style={ctxItemStyle} onClick={handleCopyPath} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>📋 Copy Path</div>
            {ctxMenu.node?.type === 'file' && <div style={{ ...ctxItemStyle, color: 'var(--accent-red)' }} onClick={handleDelete} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>🗑 Delete</div>}
          </div>
        </>
      )}
    </div>
  );
};

const ctxItemStyle: React.CSSProperties = { padding: '6px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 4, color: 'var(--text-primary)' };
const hoverOn = (e: React.MouseEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; };
const hoverOff = (e: React.MouseEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; };

export default memo(FileExplorer);
