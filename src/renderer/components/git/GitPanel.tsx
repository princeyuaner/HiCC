import React, { useEffect, useState, useCallback } from 'react';
import styles from './GitPanel.module.css';

interface GitFile { path: string; status: string; }
interface DiffLines { type: 'add' | 'remove' | 'header' | 'context'; line: string; }
interface CommitEntry { hash: string; message: string; author: string; date: string; }

const GitPanel: React.FC = () => {
  const [branch, setBranch] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [files, setFiles] = useState<GitFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffLines[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBranches, setShowBranches] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [log, setLog] = useState<CommitEntry[]>([]);
  const [feedback, setFeedback] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await window.hicc.gitStatus();
      setBranch(s.branch);
      setFiles(s.files);
      const b = await window.hicc.gitBranches();
      setBranches(b.branches);
    } catch { /* not a git repo */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const showDiff = async (file: string) => {
    setSelectedFile(file);
    try { const d = await window.hicc.gitDiff(file); setDiff(parseDiff(d)); }
    catch { setDiff([]); }
  };

  const handleStage = async (file: string) => { await window.hicc.gitStage(file); refresh(); };
  const handleUnstage = async (file: string) => { await window.hicc.gitUnstage(file); refresh(); };

  const handleCommit = async () => {
    if (!message.trim()) return;
    await window.hicc.gitCommit(message.trim());
    setMessage(''); setSelectedFile(null); setDiff([]); refresh();
    setFeedback('Committed');
    setTimeout(() => setFeedback(''), 2000);
  };

  const handleCheckout = async (b: string) => {
    await window.hicc.gitCheckout(b);
    setShowBranches(false);
    refresh();
    setFeedback(`Switched to ${b}`);
    setTimeout(() => setFeedback(''), 2000);
  };

  const handlePull = async () => {
    try { const r = await window.hicc.gitPull(); setFeedback(r); }
    catch (e) { setFeedback('Pull failed'); }
    setTimeout(() => setFeedback(''), 2000);
    refresh();
  };

  const handlePush = async () => {
    try { const r = await window.hicc.gitPush(); setFeedback(r); }
    catch (e) { setFeedback('Push failed'); }
    setTimeout(() => setFeedback(''), 2000);
  };

  const loadLog = async () => {
    if (showLog) { setShowLog(false); return; }
    try { const l = await window.hicc.gitLog(); setLog(l); setShowLog(true); }
    catch { setShowLog(false); }
  };

  const staged = files.filter(f => f.status === 'staged');
  const unstaged = files.filter(f => f.status !== 'staged');

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div style={{ position: 'relative' }}>
          <span className={styles.branch} onClick={() => setShowBranches(!showBranches)} style={{ cursor: 'pointer' }}>
            🔀 {branch || 'git'} ▾
          </span>
          {showBranches && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setShowBranches(false)} />
              <div className={styles.branchMenu}>
                {branches.map(b => (
                  <div key={b} className={`${styles.branchItem} ${b === branch ? styles.branchActive : ''}`}
                    onClick={() => handleCheckout(b)}>
                    {b} {b === branch && '✓'}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className={styles.actionBtn} onClick={handlePull} title="Pull">↓</button>
          <button className={styles.actionBtn} onClick={handlePush} title="Push">↑</button>
          <button className={styles.actionBtn} onClick={loadLog} title="History">☰</button>
          <button className={styles.actionBtn} onClick={refresh} title="Refresh">↻</button>
        </div>
      </div>

      {feedback && <div className={styles.feedback}>{feedback}</div>}

      {showLog && (
        <div className={styles.logView}>
          {log.map(c => (
            <div key={c.hash} className={styles.logEntry}>
              <span className={styles.logHash}>{c.hash}</span>
              <span className={styles.logMsg}>{c.message.slice(0, 50)}</span>
              <span className={styles.logMeta}>{c.author} · {c.date}</span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className={styles.empty}>Loading...</div>
      ) : files.length === 0 ? (
        <div className={styles.empty}>Clean working tree</div>
      ) : (
        <div className={styles.fileList}>
          {staged.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Staged ({staged.length})</div>
              {staged.map(f => (
                <div key={f.path} className={`${styles.fileItem} ${selectedFile === f.path ? styles.fileSelected : ''}`}>
                  <span className={styles.fileName} onClick={() => showDiff(f.path)}>{f.path}</span>
                  <button className={styles.fileAction} onClick={() => handleUnstage(f.path)}>−</button>
                </div>
              ))}
            </div>
          )}
          {unstaged.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Changes ({unstaged.length})</div>
              {unstaged.map(f => (
                <div key={f.path} className={`${styles.fileItem} ${selectedFile === f.path ? styles.fileSelected : ''}`}>
                  <span className={styles.fileName} onClick={() => showDiff(f.path)}
                    style={{ color: f.status === 'untracked' ? 'var(--accent-green)' : f.status === 'deleted' ? 'var(--accent-red)' : 'var(--accent-orange)' }}>
                    {f.status === 'untracked' ? 'U' : f.status === 'deleted' ? 'D' : 'M'} {f.path}
                  </span>
                  <button className={styles.fileAction} onClick={() => handleStage(f.path)}>+</button>
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

      {staged.length > 0 && (
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
    if (line.startsWith('@@')) return { type: 'header', line };
    if (line.startsWith('+')) return { type: 'add', line };
    if (line.startsWith('-')) return { type: 'remove', line };
    return { type: 'context', line };
  });
}

export default GitPanel;
