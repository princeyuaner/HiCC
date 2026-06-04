import React, { useState } from 'react';
import type { SshConfig, FileNode } from '../../../shared/types';
import styles from './SftpDialog.module.css';

interface SftpDialogProps {
  onConnect: (config: SshConfig) => Promise<void>;
  onCancel: () => void;
  connectAndBrowse: (config: SshConfig) => Promise<FileNode[]>;
  listRemoteDir: (path: string) => Promise<FileNode[]>;
}

type Step = 'credentials' | 'browse';

const SftpDialog: React.FC<SftpDialogProps> = ({ onConnect, onCancel, connectAndBrowse, listRemoteDir }) => {
  const [step, setStep] = useState<Step>('credentials');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [authType, setAuthType] = useState<'password' | 'key'>('password');
  const [browsePath, setBrowsePath] = useState('/');
  const [browseEntries, setBrowseEntries] = useState<FileNode[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);

  const buildConfig = (): SshConfig => ({
    name: name.trim() || host.trim(),
    host: host.trim(),
    port: parseInt(port, 10) || 22,
    username: username.trim(),
    password: authType === 'password' ? password : undefined,
    privateKey: authType === 'key' ? privateKey : undefined,
    rootPath: '/',
  });

  const loadDir = async (dir: string) => {
    setBrowseLoading(true);
    try {
      const entries = await listRemoteDir(dir);
      setBrowseEntries(entries);
      setBrowsePath(dir);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list files');
    } finally {
      setBrowseLoading(false);
    }
  };

  const handleConnectAndBrowse = async () => {
    if (!host.trim() || !username.trim() || !name.trim()) return;
    setConnecting(true);
    setError(null);
    try {
      const config = buildConfig();
      await connectAndBrowse(config);
      await loadDir('/');
      setStep('browse');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleSelectDir = async () => {
    setConnecting(true);
    setError(null);
    try {
      await onConnect({ ...buildConfig(), rootPath: browsePath });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setConnecting(false);
    }
  };

  const navigateTo = (node: FileNode) => {
    if (node.type === 'directory') {
      const newPath = browsePath === '/' ? `/${node.name}` : `${browsePath}/${node.name}`;
      loadDir(newPath);
    }
  };

  const goUp = () => {
    if (browsePath === '/') return;
    const parent = browsePath.split('/').slice(0, -1).join('/') || '/';
    loadDir(parent);
  };

  const dirs = browseEntries.filter((e) => e.type === 'directory');
  const files = browseEntries.filter((e) => e.type === 'file');

  if (step === 'browse') {
    return (
      <div className={styles.overlay}>
        <div className={styles.dialog} style={{ width: 500, maxHeight: '80vh' }}>
          <div className={styles.title}>Select Remote Directory</div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12,
            padding: '6px 10px', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
            fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-color)',
          }}>
            <button onClick={goUp} className={styles.upBtn} title="Go up">⬆</button>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{browsePath}</span>
          </div>
          <div style={{ maxHeight: 320, overflow: 'auto', marginBottom: 12 }}>
            {browseLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
            ) : (
              <>
                {dirs.map((d) => (
                  <div key={d.name} onClick={() => navigateTo(d)} className={styles.browseItem}>
                    <span>📁</span> <span style={{ color: 'var(--accent-color)' }}>{d.name}</span>
                  </div>
                ))}
                {files.map((f) => (
                  <div key={f.name} className={styles.browseItem} style={{ opacity: 0.5, cursor: 'default' }}>
                    <span>📄</span> <span>{f.name}</span>
                  </div>
                ))}
                {dirs.length === 0 && files.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Empty directory</div>
                )}
              </>
            )}
          </div>
          <div className={styles.actions}>
            <button className={styles.cancelBtn} onClick={() => setStep('credentials')}>Back</button>
            <button className={styles.connectBtn} onClick={handleSelectDir}>Select "{browsePath}"</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <div className={styles.title}>Connect to Remote Server</div>

        <div className={styles.field}>
          <label className={styles.label}>Connection Name</label>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="My Server" />
        </div>

        <div className={styles.row}>
          <div className={`${styles.field} ${styles.flex1}`}>
            <label className={styles.label}>Host</label>
            <input className={styles.input} value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.1.1" />
          </div>
          <div className={styles.field} style={{ width: 80 }}>
            <label className={styles.label}>Port</label>
            <input className={styles.input} value={port} onChange={(e) => setPort(e.target.value)} placeholder="22" />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Username</label>
          <input className={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="root" />
        </div>

        <div className={styles.authToggle}>
          <button className={`${styles.toggleBtn} ${authType === 'password' ? styles.toggleBtnActive : ''}`} onClick={() => setAuthType('password')}>Password</button>
          <button className={`${styles.toggleBtn} ${authType === 'key' ? styles.toggleBtnActive : ''}`} onClick={() => setAuthType('key')}>Private Key</button>
        </div>

        {authType === 'password' ? (
          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input className={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" />
          </div>
        ) : (
          <div className={styles.field}>
            <label className={styles.label}>Private Key</label>
            <textarea className={styles.textarea} value={privateKey} onChange={(e) => setPrivateKey(e.target.value)} placeholder="Paste private key content..." rows={4} />
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel} disabled={connecting}>Cancel</button>
          <button className={styles.connectBtn} onClick={handleConnectAndBrowse} disabled={connecting || !host.trim() || !username.trim()}>
            {connecting ? 'Connecting...' : 'Connect & Browse'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SftpDialog;
