import { NodeSSH } from 'node-ssh';
import type { FileNode, SshConfig, SearchOptions } from '../../shared/types';
import path from 'path';

export class RemoteFileSystemService {
  private ssh: NodeSSH | null = null;
  private config: SshConfig | null = null;
  private rootPath = '';

  async connect(config: SshConfig): Promise<void> {
    this.config = config;
    this.rootPath = config.rootPath.replace(/\\/g, '/');
    this.ssh = new NodeSSH();

    console.log('[RemoteFS] Connecting to', config.host + ':' + (config.port || 22), 'as', config.username);
    try {
      await this.ssh.connect({
        host: config.host,
        port: config.port || 22,
        username: config.username,
        password: config.password || undefined,
        privateKey: config.privateKey || undefined,
        readyTimeout: 8000,
      });
    } catch (err) {
      console.error('[RemoteFS] Connect failed:', err instanceof Error ? err.message : err);
      this.ssh.dispose();
      this.ssh = null;
      throw err;
    }

    console.log('[RemoteFS] SSH established, verifying root:', this.rootPath);
    try {
      const result = await this.ssh.execCommand(`test -d "${this.rootPath}" && echo ok || echo fail`);
      if (result.stdout.trim() !== 'ok') {
        throw new Error(`Remote path does not exist: ${this.rootPath}`);
      }
    } catch (err) {
      console.error('[RemoteFS] Path check failed:', err instanceof Error ? err.message : err);
      this.ssh.dispose();
      this.ssh = null;
      throw err;
    }
    console.log('[RemoteFS] Connected and verified');
  }

  isConnected(): boolean {
    return this.ssh?.isConnected() ?? false;
  }

  getConnectionInfo(): { host: string; username: string; rootPath: string; name: string } | null {
    if (!this.config) return null;
    return {
      host: this.config.host,
      username: this.config.username,
      rootPath: this.config.rootPath,
      name: this.config.name,
    };
  }

  async disconnect(): Promise<void> {
    if (this.ssh) {
      this.ssh.dispose();
      this.ssh = null;
    }
    this.config = null;
    this.rootPath = '';
  }

  private remotePath(localPath: string): string {
    const clean = localPath.replace(/\\/g, '/');
    if (clean === '.' || clean === '') return this.rootPath;
    return path.posix.join(this.rootPath, clean);
  }

  private localPath(remotePath: string): string {
    if (remotePath.startsWith(this.rootPath)) {
      let rel = remotePath.slice(this.rootPath.length);
      if (rel.startsWith('/')) rel = rel.slice(1);
      return rel || '.';
    }
    return remotePath;
  }

  async listFiles(dirPath = '.', depth = 2): Promise<FileNode[]> {
    if (!this.ssh) throw new Error('Not connected');
    const remoteDir = this.remotePath(dirPath);
    return this.readDirRemote(remoteDir, depth, this.rootPath);
  }

  private async readDirRemote(
    remotePath: string,
    depth: number,
    rootRemotePath: string,
  ): Promise<FileNode[]> {
    if (depth < 0) return [];

    const result = await this.ssh!.execCommand(
      `ls -1p "${remotePath}" 2>/dev/null`,
    );
    if (result.stderr) return [];
    const entries = result.stdout
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('.'));

    const nodes: FileNode[] = [];

    for (const entry of entries) {
      const isDir = entry.endsWith('/');
      const name = isDir ? entry.slice(0, -1) : entry;
      if (name === 'node_modules' || name === '.git' || name === 'dist') continue;

      const fullRemotePath = `${remotePath}/${name}`;
      const localRelPath = this.localPath(fullRemotePath);

      if (isDir) {
        const children = depth > 0
          ? await this.readDirRemote(fullRemotePath, depth - 1, rootRemotePath)
          : [];
        nodes.push({
          name,
          path: localRelPath,
          type: 'directory',
          children: children.length > 0 ? children : [],
        });
      } else {
        nodes.push({
          name,
          path: localRelPath,
          type: 'file',
        });
      }
    }

    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return nodes;
  }

  async readFile(filePath: string, offset?: number, limit?: number): Promise<string> {
    if (!this.ssh) throw new Error('Not connected');
    const remote = this.remotePath(filePath);
    const result = await this.ssh.execCommand(`cat "${remote}"`);
    if (result.stderr && result.code !== 0) {
      throw new Error(`Failed to read file: ${result.stderr}`);
    }
    let content = result.stdout;
    if (offset !== undefined || limit !== undefined) {
      const lines = content.split('\n');
      const start = offset || 0;
      const end = limit ? start + limit : lines.length;
      content = lines.slice(start, end).join('\n');
    }
    return content;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    if (!this.ssh) throw new Error('Not connected');
    const remote = this.remotePath(filePath);
    // Write via echo + heredoc for simplicity
    const escaped = content
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "'\\''")
      .replace(/\$/g, '\\$');
    const result = await this.ssh.execCommand(
      `mkdir -p "$(dirname "${remote}")" && cat > "${remote}" << 'HICC_EOF'\n${escaped}\nHICC_EOF`,
    );
    if (result.stderr && result.code !== 0) {
      throw new Error(`Failed to write file: ${result.stderr}`);
    }
  }

  async searchFiles(pattern: string, searchPath?: string, options?: SearchOptions): Promise<Array<{ file: string; line: number; content: string }>> {
    if (!this.ssh) throw new Error('Not connected');
    const baseDir = searchPath ? this.remotePath(searchPath) : this.rootPath;

    // Build grep command with options
    const grepParts: string[] = ['grep', '-rn'];
    if (!options?.caseSensitive) grepParts.push('-i');
    if (options?.wholeWord) grepParts.push('-w');
    if (!options?.useRegex) grepParts.push('-F');

    // File type includes
    if (options?.fileTypes) {
      const globs = options.fileTypes.split(',').map((g) => g.trim()).filter(Boolean);
      for (const g of globs) {
        grepParts.push(`--include='${g}'`);
      }
    } else {
      grepParts.push("--include='*.ts'", "--include='*.tsx'", "--include='*.js'", "--include='*.json'", "--include='*.md'", "--include='*.css'");
    }

    const escapedPattern = pattern.replace(/"/g, '\\"');
    grepParts.push(`"${escapedPattern}"`, `"${baseDir}"`, '2>/dev/null', '| head -200');

    const result = await this.ssh.execCommand(grepParts.join(' '));
    if (!result.stdout.trim()) return [];
    return result.stdout.split('\n').filter(Boolean).map((line) => {
      const match = line.match(/^(.+?):(\d+):(.*)$/);
      if (match) {
        return {
          file: this.localPath(match[1]),
          line: parseInt(match[2], 10),
          content: match[3],
        };
      }
      return { file: '', line: 0, content: line };
    });
  }
}
