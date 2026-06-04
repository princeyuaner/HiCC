import { parentPort } from 'worker_threads';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, relative, basename } from 'path';

interface ScanRequest {
  rootPath: string;
  dirPath: string;
  depth: number;
  sessionId: number;
  stream?: boolean; // If true, send entries one-by-one with a 'done' at the end
}

interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileEntry[];
}

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.next', '.cache', '.turbo',
  'coverage', '.nyc_output', '__pycache__', '.venv', 'venv',
]);

let fileCount = 0;
let lastProgressPath = '';
let rootPathGlobal = '';
let gitignorePatterns: string[] = [];

/** Parse .gitignore into match patterns */
function loadGitignore(rootPath: string): void {
  gitignorePatterns = [];
  const gitignorePath = join(rootPath, '.gitignore');
  try {
    if (!existsSync(gitignorePath)) return;
    const content = readFileSync(gitignorePath, 'utf-8');
    for (let line of content.split('\n')) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      // Skip negation patterns (!)
      if (line.startsWith('!')) continue;
      // Remove trailing /
      if (line.endsWith('/')) line = line.slice(0, -1);
      // Remove leading /
      if (line.startsWith('/')) line = line.slice(1);
      if (line) gitignorePatterns.push(line);
    }
  } catch {
    // Non-critical — missing or unreadable .gitignore is fine
  }
}

/** Check if a relative path matches any gitignore pattern */
function isGitignored(relPath: string, isDir: boolean): boolean {
  if (gitignorePatterns.length === 0) return false;
  const name = basename(relPath);
  for (const pat of gitignorePatterns) {
    // Exact name match
    if (pat === name) return true;
    if (pat === relPath) return true;
    // Simple glob: **/dirname or **/filename
    if (pat.includes('/')) {
      const suffix = pat.replace(/^\*\*\//, '');
      if (relPath.endsWith('/' + suffix) || relPath === suffix) return true;
    }
    // Wildcard match: *.ext
    if (pat.startsWith('*.')) {
      const ext = pat.slice(1);
      if (name.endsWith(ext)) return true;
    }
  }
  return false;
}

/** Combined check: skip dot-files, hardcoded skip dirs, and gitignore patterns */
function shouldSkip(name: string, relPath: string, isDir: boolean): boolean {
  if (name.startsWith('.')) return true;
  if (isDir && SKIP_DIRS.has(name)) return true;
  if (isGitignored(relPath, isDir)) return true;
  return false;
}

parentPort?.on('message', (req: ScanRequest) => {
  const { rootPath, dirPath, depth, sessionId, stream } = req;
  fileCount = 0;
  lastProgressPath = '';
  rootPathGlobal = rootPath;
  loadGitignore(rootPath);
  try {
    if (stream) {
      scanDirStream(join(rootPath, dirPath), rootPath, depth, 0, sessionId);
      parentPort?.postMessage({ type: 'done', sessionId });
    } else {
      const tree = scanDir(join(rootPath, dirPath), rootPath, depth, 0);
      parentPort?.postMessage({ type: 'tree', sessionId, tree, count: fileCount });
    }
  } catch (err) {
    parentPort?.postMessage({ type: 'error', sessionId, error: String(err) });
  }
});

function reportProgress(currentPath?: string) {
  // Throttled: every ~50 entries, or when passing a new directory
  if (fileCount % 50 === 0 || (currentPath && currentPath !== lastProgressPath)) {
    parentPort?.postMessage({
      type: 'progress',
      count: fileCount,
      currentFile: currentPath ? relative(rootPathGlobal, currentPath) : undefined,
    });
    if (currentPath) lastProgressPath = currentPath;
  }
}

function scanDir(
  currentPath: string,
  rootPath: string,
  maxDepth: number,
  currentDepth: number,
): FileEntry[] {
  if (currentDepth > maxDepth) return [];

  let entries;
  try {
    entries = readdirSync(currentPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const dirs: FileEntry[] = [];
  const files: FileEntry[] = [];

  for (const entry of entries) {
    const entryPath = join(currentPath, entry.name);
    const entryRelPath = relative(rootPath, entryPath);
    if (shouldSkip(entry.name, entryRelPath, entry.isDirectory())) continue;

    if (entry.isDirectory()) {
      const children = currentDepth < maxDepth
        ? scanDir(entryPath, rootPath, maxDepth, currentDepth + 1)
        : [];
      dirs.push({ name: entry.name, path: entryRelPath, type: 'directory', children });
      fileCount++;
      reportProgress(currentPath);
    } else {
      files.push({ name: entry.name, path: entryRelPath, type: 'file' });
      fileCount++;
      reportProgress(currentPath);
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));
  return [...dirs, ...files];
}

/**
 * Streaming variant — sends each entry as a flat message as soon as it's
 * discovered. No tree building or sorting on the worker side; the consumer
 * handles building the parent/child hierarchy.
 */
function scanDirStream(
  currentPath: string,
  rootPath: string,
  maxDepth: number,
  currentDepth: number,
  sessionId: number,
): void {
  if (currentDepth > maxDepth) return;

  let entries;
  try {
    entries = readdirSync(currentPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (shouldSkip(entry.name, relative(rootPath, join(currentPath, entry.name)), entry.isDirectory())) continue;
    const entryPath = join(currentPath, entry.name);
    const entryRelPath = relative(rootPath, entryPath);

    if (entry.isDirectory()) {
      parentPort?.postMessage({
        type: 'entry',
        sessionId,
        entry: { name: entry.name, path: entryRelPath, type: 'directory' },
      });
      fileCount++;
      reportProgress(currentPath);
      if (currentDepth < maxDepth) {
        scanDirStream(entryPath, rootPath, maxDepth, currentDepth + 1, sessionId);
      }
    } else {
      parentPort?.postMessage({
        type: 'entry',
        sessionId,
        entry: { name: entry.name, path: entryRelPath, type: 'file' },
      });
      fileCount++;
      reportProgress(currentPath);
    }
  }
}
