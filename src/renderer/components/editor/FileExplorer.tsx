import React, { useState } from 'react';
import { useAppStore } from '../../store/app-store';
import type { FileNode } from '../../types';

const FileExplorer: React.FC = () => {
  const fileTree = useAppStore((s) => s.fileTree);
  const openFile = useAppStore((s) => s.openFile);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleFileClick = (node: FileNode) => {
    if (node.type === 'directory') {
      toggleDir(node.path);
    } else {
      openFile(node.path, node.name);
    }
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedDirs.has(node.path);
    const paddingLeft = 8 + depth * 16;

    return (
      <div key={node.path}>
        <div
          onClick={() => handleFileClick(node)}
          style={{
            padding: '3px 8px',
            paddingLeft,
            cursor: 'pointer',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--text-primary)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          <span style={{ width: 16, textAlign: 'center', flexShrink: 0 }}>
            {node.type === 'directory' ? (isExpanded ? '▼' : '▶') : '📄'}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.name}
          </span>
        </div>
        {node.type === 'directory' && isExpanded && node.children?.map((child) =>
          renderNode(child, depth + 1)
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{
        padding: '4px 12px',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        color: 'var(--text-secondary)',
        letterSpacing: 0.5,
      }}>
        Explorer
      </div>
      {fileTree.length === 0 ? (
        <div style={{
          padding: '12px',
          color: 'var(--text-secondary)',
          fontSize: 12,
          textAlign: 'center',
        }}>
          No project open
        </div>
      ) : (
        fileTree.map((node) => renderNode(node))
      )}
    </div>
  );
};

export default FileExplorer;
