import React, { useState } from 'react';
import { useAppStore } from '../../store/app-store';
import styles from './ContextBar.module.css';

interface ContextBarProps {
  inputTokens: number;
  outputTokens: number;
  contextLimit?: number;
  cost?: number;
  contextFiles?: Array<{ path: string; type: string; tokens: number }>;
}

const ContextBar: React.FC<ContextBarProps> = ({
  inputTokens,
  outputTokens: _outputTokens,
  contextLimit = 200000,
  cost,
  contextFiles = [],
}) => {
  const pct = Math.min((inputTokens / contextLimit) * 100, 100);
  const barColor = pct > 80 ? '#f44336' : pct > 50 ? '#ff9800' : 'var(--accent-color)';
  const [showFiles, setShowFiles] = useState(false);

  const handleAttachFiles = async () => {
    const filePaths = await window.hicc.openFiles();
    if (filePaths.length > 0) {
      useAppStore.getState().setPendingFiles(filePaths);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.mainRow}>
        <button className={styles.attachButton} onClick={handleAttachFiles} title="Attach files">
          📎
        </button>
        <div className={styles.track}>
          <div className={styles.fill} style={{ width: `${pct}%`, background: barColor }} />
        </div>
        <span className={styles.tokenText}>
          {formatTokens(inputTokens)}
          <span className={styles.tokenLimit}> / {formatTokens(contextLimit)}</span>
        </span>
        <span className={styles.pct} style={{ color: barColor }}>{pct.toFixed(0)}%</span>
        {cost !== undefined && cost > 0 && (
          <span className={styles.cost}>${cost.toFixed(4)}</span>
        )}
        {contextFiles.length > 0 && (
          <button
            className={styles.filesToggle}
            onClick={() => setShowFiles(!showFiles)}
            title="Context files"
          >
            📄{contextFiles.length}
          </button>
        )}
      </div>
      {showFiles && contextFiles.length > 0 && (
        <div className={styles.filesList}>
          {contextFiles.map((f, i) => (
            <div key={i} className={styles.fileEntry} title={f.path}>
              <span className={styles.fileName}>
                {f.path.split(/[/\\]/).pop() || f.path}
              </span>
              <span className={styles.fileTokens}>{formatTokens(f.tokens)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export default ContextBar;
