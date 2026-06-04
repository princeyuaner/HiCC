import React, { useEffect, useRef } from 'react';
import type { FileNode } from '../../types';
import styles from './FileMentionDropdown.module.css';

interface FileMentionDropdownProps {
  files: FileNode[];
  selectedIndex: number;
  onSelect: (filePath: string, fileName: string) => void;
  position: { top: number; left: number };
}

const FileMentionDropdown: React.FC<FileMentionDropdownProps> = ({ files, selectedIndex, onSelect, position }) => {
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <div className={styles.dropdown} style={{ top: position.top, left: position.left }}>
      {files.length === 0 ? (
        <div className={styles.empty}>No files found</div>
      ) : (
        <>
          {files.slice(0, 20).map((file, i) => (
            <div
              key={file.path}
              ref={i === selectedIndex ? activeRef : undefined}
              className={`${styles.item} ${i === selectedIndex ? styles.itemActive : ''}`}
              onClick={() => onSelect(file.path, file.name)}
            >
              <span className={styles.icon}>{file.type === 'directory' ? '📁' : '📄'}</span>
              <span className={styles.name}>{file.name}</span>
              <span className={styles.path}>{file.path}</span>
            </div>
          ))}
          {files.length > 20 && (
            <div className={styles.more}>+{files.length - 20} more — type to narrow down</div>
          )}
        </>
      )}
    </div>
  );
};

export default FileMentionDropdown;
