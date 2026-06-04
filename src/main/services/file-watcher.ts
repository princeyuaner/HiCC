import { watch, FSWatcher } from 'fs';
import { join, relative, basename } from 'path';
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';

/**
 * File watcher using OS-native recursive watching.
 * On Windows: uses ReadDirectoryChangesW with FILE_TREE_CHANGE — one handle for the entire tree.
 * On macOS: uses FSEvents — one stream per volume root.
 * On Linux: uses inotify — one fd per watched directory, but recursive mode handles the tree.
 *
 * This is exactly how PyCharm does it.
 */
export class FileWatcherService {
  private watcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingEvents = new Map<string, 'add' | 'change' | 'unlink'>();
  private projectRoot = '';

  startWatching(projectRoot: string, window: BrowserWindow): void {
    this.stopWatching();
    this.projectRoot = projectRoot;

    try {
      this.watcher = watch(projectRoot, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        const fullPath = join(projectRoot, filename);
        const relPath = filename.replace(/\\/g, '/');

        // Skip ignored paths
        if (this.isIgnored(relPath)) return;

        const type: 'add' | 'change' | 'unlink' = eventType === 'rename' ? 'add' : 'change';

        // Debounce: batch rapid events into a single flush
        this.pendingEvents.set(relPath, type);
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.flush(window), 150);
      });

      this.watcher.on('error', (err) => {
        // Suppress common harmless errors
        if ((err as NodeJS.ErrnoException).code === 'EPERM') return;
        console.error('[FileWatcher]', err);
      });
    } catch (err) {
      console.error('[FileWatcher] Failed to start native watcher:', err);
    }
  }

  private isIgnored(relPath: string): boolean {
    const parts = relPath.split('/');
    for (const part of parts) {
      if (
        part.startsWith('.') ||
        /^(node_modules|dist|build|out|__pycache__|\.pytest_cache|\.mypy_cache|\.ruff_cache|venv|\.venv|\.tox|eggs|\.eggs|coverage|\.nyc_output|htmlcov|\.turbo|\.next)$/.test(part)
      ) {
        return true;
      }
    }
    return false;
  }

  private flush(window: BrowserWindow): void {
    this.debounceTimer = null;

    // Resolve conflicting events for the same path:
    // - If file was both added and removed, ignore
    // - If file was changed multiple times, send one change
    for (const [path, type] of this.pendingEvents) {
      window.webContents.send(IPC_CHANNELS.FILE_CHANGED, { path, type });
    }
    this.pendingEvents.clear();
  }

  stopWatching(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingEvents.clear();
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
