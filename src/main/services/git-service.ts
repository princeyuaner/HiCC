import simpleGit, { SimpleGit, StatusResult, BranchSummary, LogResult, DefaultLogFields } from 'simple-git';

export interface GitStatusFile {
  path: string;
  status: 'staged' | 'modified' | 'untracked' | 'deleted';
}

export interface GitStatusResult {
  branch: string;
  files: GitStatusFile[];
  ahead: number;
  behind: number;
}

export class GitService {
  private git: SimpleGit | null = null;

  setProjectRoot(root: string): void {
    this.git = simpleGit(root);
  }

  private requireGit(): SimpleGit {
    if (!this.git) throw new Error('No project open');
    return this.git;
  }

  async getStatus(): Promise<GitStatusResult> {
    const git = this.requireGit();
    const status: StatusResult = await git.status();
    const branch = status.current || 'unknown';

    const files: GitStatusFile[] = [];
    for (const f of status.staged) {
      files.push({ path: f, status: 'staged' });
    }
    for (const f of status.modified) {
      files.push({ path: f, status: 'modified' });
    }
    for (const f of status.not_added) {
      files.push({ path: f, status: 'untracked' });
    }
    for (const f of status.deleted) {
      files.push({ path: f, status: 'deleted' });
    }

    return {
      branch,
      files,
      ahead: status.ahead,
      behind: status.behind,
    };
  }

  async diff(file?: string): Promise<string> {
    const git = this.requireGit();
    if (file) {
      return git.diff([file]);
    }
    return git.diff();
  }

  async diffStaged(): Promise<string> {
    const git = this.requireGit();
    return git.diff(['--cached']);
  }

  async diffBase(base: string): Promise<string> {
    const git = this.requireGit();
    return git.diff([base]);
  }

  async stage(file: string): Promise<void> {
    const git = this.requireGit();
    await git.add(file);
  }

  async unstage(file: string): Promise<void> {
    const git = this.requireGit();
    await git.reset(['--', file]);
  }

  async commit(message: string): Promise<string> {
    const git = this.requireGit();
    const result = await git.commit(message);
    return result.commit || '';
  }

  async getBranches(): Promise<{ current: string; branches: string[] }> {
    const git = this.requireGit();
    const summary: BranchSummary = await git.branch();
    return {
      current: summary.current,
      branches: summary.all,
    };
  }

  async checkout(branch: string): Promise<void> {
    const git = this.requireGit();
    await git.checkout(branch);
  }

  async pull(): Promise<string> {
    const git = this.requireGit();
    const result = await git.pull();
    return result.summary?.changes ? `${result.summary.changes} changes` : 'Up to date';
  }

  async push(): Promise<string> {
    const git = this.requireGit();
    const result = await git.push();
    const pushed = result.pushed?.[0] as { ref?: { name?: string } } | undefined;
    return pushed?.ref?.name || 'Pushed';
  }

  async log(count = 20): Promise<Array<{ hash: string; message: string; author: string; date: string }>> {
    const git = this.requireGit();
    const result = await git.log({ maxCount: count });
    return result.all.map((entry: DefaultLogFields) => ({
      hash: entry.hash.slice(0, 7),
      message: entry.message,
      author: entry.author_name,
      date: entry.date,
    }));
  }
}
