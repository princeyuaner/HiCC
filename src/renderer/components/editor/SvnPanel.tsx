import React, { useEffect, useState, useCallback } from 'react';
import styles from '../git/GitPanel.module.css';

interface SvnFile { path: string; status: string; }
interface DiffLines { type: 'add' | 'remove' | 'header' | 'context'; line: string; }

const SvnPanel: React.FC = () => {
  const [revision, setRevision] = useState('');
  const [files, setFiles] = useState<SvnFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffLines[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await window.hicc.svnStatus();
      setRevision(s.revision);
      setFiles(s.files);
    } catch { setFiles([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const showDiff = async (file: string) => {
    setSelectedFile(file);
    try { const d = await window.hicc.svnDiff(file); setDiff(parseDiff(d)); }
    catch { setDiff([]); }
  };

  const handleAdd = async (file: string) => { await window.hicc.svnAdd(file); refresh(); };
  const handleRevert = async (file: string) => {
    if (!confirm(`Revert "${file}"?`)) return;
    await window.hicc.svnRevert(file);
    refresh();
  };

  const handleCommit = async () => {
    if (!message.trim()) return;
    await window.hicc.svnCommit(message.trim());
    setMessage(''); setSelectedFile(null); setDiff([]); refresh();
    setFeedback('Committed');
    setTimeout(() => setFeedback(''), 2000);
  };

  const handleUpdate = async () => {
    try { const r = await window.hicc.svnUpdate(); setFeedback(r); refresh(); }
    catch (e) { setFeedback('Update failed'); }
    setTimeout(() => setFeedback(''), 2000);
  };

  const modified = files.filter(f => f.status !== 'unversioned');
  const unversioned = files.filter(f => f.status === 'unversioned');

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.branch}>SVN r{revision}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className={styles.actionBtn} onClick={handleUpdate} title="Update">↓</button>
          <button className={styles.actionBtn} onClick={refresh} title="Refresh">↻</button>
        </div>
      </div>

      {feedback && <div className={styles.feedback}>{feedback}</div>}

      {loading ? (
        <div className={styles.empty}>Loading...</div>
      ) : files.length === 0 ? (
        <div className={styles.empty}>Clean working copy</div>
      ) : (
        <div className={styles.fileList}>
          {modified.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Changes ({modified.length})</div>
              {modified.map(f => (
                <div key={f.path} className={`${styles.fileItem} ${selectedFile === f.path ? styles.fileSelected : ''}`}>
                  <span className={styles.fileName} onClick={() => showDiff(f.path)}
                    style={{ color: f.status === 'added' ? 'var(--accent-green)' : f.status === 'deleted' ? 'var(--accent-red)' : 'var(--accent-orange)' }}>
                    {f.status === 'added' ? 'A' : f.status === 'deleted' ? 'D' : 'M'} {f.path}
                  </span>
                  <button className={styles.fileAction} onClick={() => handleRevert(f.path)}>↩</button>
                </div>
              ))}
            </div>
          )}
          {unversioned.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Unversioned ({unversioned.length})</div>
              {unversioned.map(f => (
                <div key={f.path} className={`${styles.fileItem} ${selectedFile === f.path ? styles.fileSelected : ''}`}>
                  <span className={styles.fileName} onClick={() => showDiff(f.path)} style={{ color: 'var(--accent-green)' }}>
                    ? {f.path}
                  </span>
                  <button className={styles.fileAction} onClick={() => handleAdd(f.path)}>+</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedFile && diff.length > 0 && (
        <div className={styles.diffView}>
          <div className={styles.diffHeader}>
            <span>{selectedFile}</span>
            <button className={styles.closeBtn} onClick={() => { setSelectedFile(null); setDiff([]); }}>×</button>
          </div>
          <div className={styles.diffContent}>
            {diff.map((l, i) => (
              <div key={i} className={`${styles.diffLine} ${l.type === 'add' ? styles.diffAdd : l.type === 'remove' ? styles.diffRemove : l.type === 'header' ? styles.diffHeaderLine : ''}`}>
                {l.line}
              </div>
            ))}
          </div>
        </div>
      )}

      {modified.length > 0 && (
        <div className={styles.commitArea}>
          <input className={styles.commitInput} value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Commit message..."
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCommit(); } }} />
          <button className={styles.commitBtn} onClick={handleCommit} disabled={!message.trim()}>Commit</button>
        </div>
      )}
    </div>
  );
};

function parseDiff(diff: string): DiffLines[] {
  return diff.split('\n').map(line => {
    if (line.startsWith('@@') || line.startsWith('Index:') || line.startsWith('===') || line.startsWith('---') || line.startsWith('+++'))
      return { type: 'header', line };
    if (line.startsWith('+')) return { type: 'add', line };
    if (line.startsWith('-')) return { type: 'remove', line };
    return { type: 'context', line };
  });
}

export default SvnPanel;
