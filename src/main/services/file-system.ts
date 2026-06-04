import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import type { FileNode, SearchOptions } from '../../shared/types';
import { scanWorkerPool } from './scan-worker-pool';

const CACHE_DIR = '.hicc';
const CACHE_FILE = 'tree-cache.json';

interface ScanEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
}

export class FileSystemService {
  constructor(private projectRoot: string) {}

  setProjectRoot(root: string): void {
    this.projectRoot = root;
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }

  private resolvePath(filePath: string): string {
    const resolved = path.resolve(this.projectRoot, filePath);
    if (!resolved.startsWith(path.resolve(this.projectRoot))) {
      throw new Error(`Access denied: path "${filePath}" is outside project root`);
    }
    return resolved;
  }

  async readFile(filePath: string, offset?: number, limit?: number): Promise<string> {
    const fullPath = this.resolvePath(filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    if (offset !== undefined) {
      const lines = content.split('\n');
      const end = limit !== undefined ? offset + limit : lines.length;
      return lines.slice(offset, end).join('\n');
    }
    return content;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    await fs.rm(fullPath, { recursive: true, force: true });
  }

  async listFiles(dirPath: string = '.', depth: number = 2): Promise<FileNode[]> {
    const fullPath = this.resolvePath(dirPath);
    // Try cache first if asking for root
    if (dirPath === '.' || dirPath === '') {
      const cached = await this.loadCache();
      if (cached) return cached;
    }
    // Use worker for all scans (keeps main process responsive)
    return this.listFilesWithWorker(fullPath, depth);
  }

  // Load cached tree from disk (instant)
  async loadCache(): Promise<FileNode[] | null> {
    const cachePath = path.join(this.projectRoot, CACHE_DIR, CACHE_FILE);
    try {
      const data = await fs.readFile(cachePath, 'utf-8');
      return JSON.parse(data) as FileNode[];
    } catch {
      return null;
    }
  }

  // Save tree to disk cache
  async saveCache(tree: FileNode[]): Promise<void> {
    const cacheDir = path.join(this.projectRoot, CACHE_DIR);
    try {
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(
        path.join(cacheDir, CACHE_FILE),
        JSON.stringify(tree),
        'utf-8',
      );
    } catch {
      // Non-critical — cache save failure is silent
    }
  }

  // Full scan + save cache in background
  async refreshCache(): Promise<FileNode[]> {
    const tree = await this.listFilesWithWorker(
      this.projectRoot,
      2, // Scan 2 levels deep for cache
    );
    await this.saveCache(tree);
    return tree;
  }

  // Invalidate cache (delete it)
  async invalidateCache(): Promise<void> {
    const cachePath = path.join(this.projectRoot, CACHE_DIR, CACHE_FILE);
    try { await fs.unlink(cachePath); } catch { /* ignore */ }
  }

  private listFilesWithWorker(fullPath: string, depth: number): Promise<FileNode[]> {
    const relDirPath = path.relative(this.projectRoot, fullPath) || '.';
    return scanWorkerPool.scan(
      this.projectRoot,
      relDirPath,
      depth,
      this.onProgress ?? undefined,
    );
  }

  onProgress: ((count: number, currentFile?: string) => void) | null = null;

  private buildTree(map: Map<string, FileNode>, rootPath: string): FileNode[] {
    const roots: FileNode[] = [];
    const sorted = [...map.values()].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    const lookup = new Map<string, FileNode>();
    for (const node of sorted) lookup.set(node.path, node);
    for (const node of sorted) {
      const parentPath = node.path.split('/').slice(0, -1).join('/');
      const parent = parentPath ? lookup.get(parentPath) : null;
      if (parent && parent.type === 'directory') {
        if (!parent.children) parent.children = [];
        if (!parent.children.find((c: FileNode) => c.path === node.path)) {
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async listFilesStream(
    dirPath: string,
    depth: number,
    onEntry: (entry: FileNode) => void,
  ): Promise<void> {
    const isRoot = dirPath === '.' || dirPath === '';

    // Try cache first if asking for root
    if (isRoot) {
      const cached = await this.loadCache();
      if (cached) {
        // Replay cached tree as stream entries
        const flatten = (nodes: FileNode[]): void => {
          for (const n of nodes) {
            onEntry({ name: n.name, path: n.path, type: n.type, children: n.type === 'directory' ? [] : undefined } as FileNode);
            if (n.children) flatten(n.children);
          }
        };
        flatten(cached);
        return;
      }
    }

    const fullPath = this.resolvePath(dirPath);
    const relDirPath = path.relative(this.projectRoot, fullPath) || '.';

    // Batch entries to reduce IPC message frequency.
    // Also collect all entries for cache saving on root scans.
    const batch: FileNode[] = [];
    const allEntries: FileNode[] = [];
    const timer = setInterval(() => {
      if (batch.length > 0) {
        const chunk = batch.splice(0);
        for (const entry of chunk) onEntry(entry);
      }
    }, 200);

    try {
      await scanWorkerPool.scanStream(
        this.projectRoot,
        relDirPath,
        depth,
        (entry) => {
          batch.push(entry);
          if (isRoot) allEntries.push(entry);
        },
        this.onProgress ?? undefined,
      );
      clearInterval(timer);
      // Flush remaining entries
      if (batch.length > 0) {
        for (const entry of batch) onEntry(entry);
      }
      // Save cache for next time (only for root scans, non-blocking)
      if (isRoot && allEntries.length > 0) {
        const tree = this.buildTreeFromFlat(allEntries);
        this.saveCache(tree).catch(() => {});
      }
    } catch (err) {
      clearInterval(timer);
      throw err;
    }
  }

  /** Build a nested tree from flat file entries (used for cache saving after streaming scan). */
  private buildTreeFromFlat(entries: FileNode[]): FileNode[] {
    const map = new Map<string, FileNode>();
    for (const e of entries) {
      map.set(e.path, { ...e });
    }
    const roots: FileNode[] = [];
    for (const entry of map.values()) {
      const parentPath = entry.path.includes('/')
        ? entry.path.substring(0, entry.path.lastIndexOf('/'))
        : '';
      const parent = parentPath ? map.get(parentPath) : null;
      if (parent && parent.type === 'directory') {
        if (!parent.children) parent.children = [];
        parent.children.push(entry);
      } else {
        roots.push(entry);
      }
    }
    // Sort: dirs first, then alpha
    const sortNodes = (nodes: FileNode[]): void => {
      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      for (const n of nodes) {
        if (n.children) sortNodes(n.children);
      }
    };
    sortNodes(roots);
    return roots;
  }

  private async readDir(currentPath: string, maxDepth: number, currentDepth: number = 0): Promise<FileNode[]> {
    if (currentDepth > maxDepth) return [];

    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    const nodes: FileNode[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const entryPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(this.projectRoot, entryPath);

      if (entry.isDirectory()) {
        const children = currentDepth < maxDepth ? await this.readDir(entryPath, maxDepth, currentDepth + 1) : [];
        nodes.push({ name: entry.name, path: relativePath, type: 'directory', children });
      } else {
        nodes.push({ name: entry.name, path: relativePath, type: 'file' });
      }
    }

    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      const fullPath = this.resolvePath(filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async searchFiles(searchPattern: string, searchPath?: string, options?: SearchOptions): Promise<Array<{ file: string; line: number; content: string }>> {
    const cwd = searchPath ? this.resolvePath(searchPath) : this.projectRoot;
    if (!cwd) return [];

    const args: string[] = ['--line-number', '--no-heading'];

    // Case sensitivity
    if (options?.caseSensitive) {
      args.push('--case-sensitive');
    } else {
      args.push('--smart-case');
    }

    // Whole word
    if (options?.wholeWord) {
      args.push('--word-regexp');
    }

    // Regex vs fixed string
    if (options?.useRegex) {
      // ripgrep uses regex by default; just don't add --fixed-strings
    } else {
      args.push('--fixed-strings');
    }

    // File type globs
    if (options?.fileTypes) {
      const globs = options.fileTypes.split(',').map((g) => g.trim()).filter(Boolean);
      for (const g of globs) {
        args.push('--glob', g);
      }
    }

    // Default ignores
    args.push('--glob', '!node_modules', '--glob', '!.git', '--glob', '!dist');
    args.push('--', searchPattern);

    return new Promise((resolve) => {
      execFile('rg', args, { cwd, maxBuffer: 10 * 1024 * 1024, timeout: 30000 }, (err, stdout) => {
        if (err && err.code !== 1) {
          // rg not found — fall back to Node.js grep
          this.grepFallback(searchPattern, cwd).then(resolve);
          return;
        }
        const results = (stdout || '').trim().split('\n').filter(Boolean).map((line) => {
          const m = line.match(/^([^:]+):(\d+):(.*)$/);
          if (!m) return null;
          return { file: m[1], line: parseInt(m[2], 10), content: m[3] };
        }).filter(Boolean) as Array<{ file: string; line: number; content: string }>;
        resolve(results);
      });
    });
  }

  /** Fallback content search using Node.js when ripgrep is unavailable */
  private async grepFallback(pattern: string, cwd: string): Promise<Array<{ file: string; line: number; content: string }>> {
    const results: Array<{ file: string; line: number; content: string }> = [];
    const lowerPattern = pattern.toLowerCase();
    try {
      await this.walkForGrep(cwd, cwd, lowerPattern, results, 200);
    } catch { /* ignore errors */ }
    return results;
  }

  private async walkForGrep(
    dirPath: string, cwd: string, pattern: string,
    results: Array<{ file: string; line: number; content: string }>,
    maxResults: number,
  ): Promise<void> {
    if (results.length >= maxResults) return;
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxResults) return;
        if (entry.name.startsWith('.') || /^(node_modules|dist|build|out|__pycache__|venv|\.venv)$/.test(entry.name)) continue;
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await this.walkForGrep(fullPath, cwd, pattern, results, maxResults);
        } else {
          // Only search text-ish files
          if (/\.(py|js|ts|jsx|tsx|json|md|txt|css|html|yml|yaml|toml|xml|ini|cfg|sh|bat|ps1|java|go|rs|cpp|c|h|hpp|rb|php|sql|r|swift|kt|scala|dart|lua|vim|vimrc)$/i.test(entry.name)) {
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length && results.length < maxResults; i++) {
                if (lines[i].toLowerCase().includes(pattern)) {
                  const relPath = path.relative(cwd, fullPath).replace(/\\/g, '/');
                  results.push({ file: relPath, line: i + 1, content: lines[i].slice(0, 300) });
                }
              }
            } catch { /* skip unreadable files */ }
          }
        }
      }
    } catch { /* skip inaccessible dirs */ }
  }
}
