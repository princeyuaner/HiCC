import React from 'react';
import styles from './AttachmentPill.module.css';

interface AttachmentPillProps {
  filePath: string;
  fileName: string;
  content?: string;
  language?: string;
  onRemove: () => void;
}

const LANG_ICONS: Record<string, string> = {
  ts: '🟦', tsx: '⚛️', js: '🟨', jsx: '⚛️',
  py: '🐍', rs: '🦀', go: '🔵', java: '☕',
  html: '🟧', css: '🟦', json: '📋', md: '📝',
};

function getLangIcon(lang?: string): string {
  if (!lang) return '📄';
  return LANG_ICONS[lang] || '📄';
}

const AttachmentPill: React.FC<AttachmentPillProps> = ({ filePath, fileName, content, language, onRemove }) => {
  const isSelection = !!content;
  const preview = content
    ? content.split('\n').slice(0, 3).join('\n') + (content.split('\n').length > 3 ? '\n...' : '')
    : '';

  return (
    <div className={`${styles.pill} ${isSelection ? styles.pillSelection : ''}`} title={isSelection ? preview : filePath}>
      <span className={styles.icon}>{getLangIcon(language)}</span>
      <span className={styles.name}>{fileName}</span>
      {isSelection && <span className={styles.preview}>{preview.slice(0, 80)}</span>}
      <button className={styles.remove} onClick={onRemove} title="Remove attachment">×</button>
    </div>
  );
};

export default AttachmentPill;
