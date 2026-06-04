import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);

export interface SvnStatusFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'unversioned' | 'conflicted' | 'replaced';
}

export interface SvnInfo {
  revision: string;
  url: string;
  lastChanged: string;
}

export class SvnService {
  private rootPath = '';

  setProjectRoot(root: string): void {
    this.rootPath = root;
  }

  private svn(args: string[]): ReturnType<typeof exec> {
    return exec('svn', args, { cwd: this.rootPath, maxBuffer: 10 * 1024 * 1024 });
  }

  async getStatus(): Promise<{ files: SvnStatusFile[]; revision: string }> {
    try {
      const { stdout } = await this.svn(['status', '--xml']);
      const out = String(stdout);
      const files: SvnStatusFile[] = [];
      const statusMap: Record<string, SvnStatusFile['status']> = {
        'modified': 'modified', 'added': 'added', 'deleted': 'deleted',
        'unversioned': 'unversioned', 'conflicted': 'conflicted', 'replaced': 'replaced',
        'missing': 'deleted',
      };

      // Simple XML parsing without full library
      const entries = out.match(/<entry[^>]*path="([^"]*)"[^>]*>/g) || [];
      for (const entry of entries) {
        const pathMatch = entry.match(/path="([^"]*)"/);
        const path = pathMatch?.[1] || '';
        const wcMatch = out.match(new RegExp(`<entry[^>]*path="${escapeRegex(path)}"[^>]*>[\\s\\S]*?<wc-status[^>]*item="([^"]*)"`));
        const item = wcMatch?.[1] || 'unversioned';
        const status = statusMap[item] || 'modified';
        if (status !== 'unversioned' && status !== 'added') {
          files.push({ path, status });
        }
      }

      // Unversioned files
      const unversioned = out.match(/<entry[^>]*path="([^"]*)"[^>]*>[\s\S]*?<wc-status[^>]*item="unversioned"/g) || [];
      for (const entry of unversioned) {
        const pathMatch = entry.match(/path="([^"]*)"/);
        if (pathMatch) files.push({ path: pathMatch[1], status: 'unversioned' });
      }

      // Get revision from info
      const { stdout: infoOut } = await this.svn(['info', '--xml']);
      const infoStr = String(infoOut);
      const revMatch = infoStr.match(/revision="(\d+)"/);
      return { files, revision: revMatch?.[1] || '?' };
    } catch {
      return { files: [], revision: '?' };
    }
  }

  async diff(file?: string): Promise<string> {
    try {
      const args = ['diff', '--notice-ancestry'];
      if (file) args.push(file);
      const { stdout, stderr } = await this.svn(args);
      if (stderr) console.error('[SvnService] diff stderr:', String(stderr).slice(0, 200));
      return String(stdout);
    } catch (e) {
      console.error('[SvnService] diff error:', e);
      return '';
    }
  }

  async diffRevision(rev: string): Promise<string> {
    try {
      const { stdout } = await this.svn(['diff', '-c', rev]);
      return String(stdout);
    } catch { return ''; }
  }

  async diffPrevHead(): Promise<string> {
    try {
      const { stdout } = await this.svn(['diff', '-r', 'PREV:HEAD']);
      return String(stdout);
    } catch { return ''; }
  }

  async add(file: string): Promise<void> {
    await this.svn(['add', file]);
  }

  async revert(file: string): Promise<void> {
    await this.svn(['revert', file]);
  }

  async commit(message: string): Promise<void> {
    await this.svn(['commit', '-m', message]);
  }

  async update(): Promise<string> {
    const { stdout } = await this.svn(['update']);
    return String(stdout).trim() || 'Updated';
  }

  async getInfo(): Promise<SvnInfo> {
    try {
      const { stdout } = await this.svn(['info', '--xml']);
      const out = String(stdout);
      const revMatch = out.match(/revision="(\d+)"/);
      const urlMatch = out.match(/<url>([^<]*)<\/url>/);
      const dateMatch = out.match(/<date>([^<]*)<\/date>/);
      return {
        revision: revMatch?.[1] || '?',
        url: urlMatch?.[1] || '',
        lastChanged: dateMatch?.[1]?.replace('T', ' ').replace(/\.\d+Z/, '') || '',
      };
    } catch {
      return { revision: '?', url: '', lastChanged: '' };
    }
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
