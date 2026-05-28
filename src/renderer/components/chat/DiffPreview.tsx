import React, { useState } from 'react';

interface DiffPreviewProps {
  filePath: string;
  newContent: string;
  oldContent?: string;
  onAccept: () => void;
  onReject: () => void;
}

const DiffPreview: React.FC<DiffPreviewProps> = ({
  filePath, newContent, oldContent, onAccept, onReject,
}) => {
  const [showDiff, setShowDiff] = useState(true);

  const lines = newContent.split('\n');
  const oldLines = (oldContent || '').split('\n');

  const computeDiff = (): Array<{ type: 'add' | 'remove' | 'same'; line: string; lineNum: number }> => {
    if (!oldContent) {
      return lines.map((line, i) => ({ type: 'add' as const, line, lineNum: i + 1 }));
    }

    const result: Array<{ type: 'add' | 'remove' | 'same'; line: string; lineNum: number }> = [];
    const maxLen = Math.max(oldLines.length, lines.length);

    for (let i = 0; i < maxLen; i++) {
      if (i < oldLines.length && i < lines.length) {
        if (oldLines[i] === lines[i]) {
          result.push({ type: 'same', line: lines[i], lineNum: i + 1 });
        } else {
          result.push({ type: 'remove', line: oldLines[i], lineNum: i + 1 });
          result.push({ type: 'add', line: lines[i], lineNum: i + 1 });
        }
      } else if (i < oldLines.length) {
        result.push({ type: 'remove', line: oldLines[i], lineNum: i + 1 });
      } else {
        result.push({ type: 'add', line: lines[i], lineNum: i + 1 });
      }
    }

    return result;
  };

  const diff = computeDiff();
  const addedLines = diff.filter((d) => d.type === 'add').length;
  const removedLines = diff.filter((d) => d.type === 'remove').length;

  return (
    <div style={{
      border: '1px solid var(--border-color)',
      borderRadius: 6,
      margin: '8px 0',
      overflow: 'hidden',
    }}>
      <div style={{
        background: 'var(--bg-tertiary)',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
      }}
        onClick={() => setShowDiff(!showDiff)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{showDiff ? '▼' : '▶'}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{filePath}</span>
          <span style={{ fontSize: 12, color: '#4caf50' }}>+{addedLines}</span>
          <span style={{ fontSize: 12, color: '#f44336' }}>-{removedLines}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onAccept(); }}
            style={{
              padding: '3px 10px',
              borderRadius: 3,
              border: 'none',
              background: '#2e7d32',
              color: 'white',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Accept
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onReject(); }}
            style={{
              padding: '3px 10px',
              borderRadius: 3,
              border: 'none',
              background: '#c62828',
              color: 'white',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Reject
          </button>
        </div>
      </div>
      {showDiff && (
        <div style={{
          maxHeight: 300,
          overflow: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          lineHeight: 1.6,
        }}>
          {diff.map((entry, i) => (
            <div
              key={i}
              style={{
                padding: '1px 12px',
                background: entry.type === 'add' ? 'rgba(76, 175, 80, 0.15)'
                  : entry.type === 'remove' ? 'rgba(244, 67, 54, 0.15)'
                  : 'transparent',
                color: entry.type === 'add' ? '#4caf50'
                  : entry.type === 'remove' ? '#f44336'
                  : 'var(--text-primary)',
                whiteSpace: 'pre',
              }}
            >
              <span style={{ color: 'var(--text-secondary)', marginRight: 8, userSelect: 'none' }}>
                {entry.lineNum.toString().padStart(4, ' ')}
              </span>
              <span>{entry.type === 'add' ? '+' : entry.type === 'remove' ? '-' : ' '} {entry.line}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DiffPreview;
