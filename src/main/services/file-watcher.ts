import chokidar, { FSWatcher } from 'chokidar';
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';

export class FileWatcherService {
  private watcher: FSWatcher | null = null;

  startWatching(projectRoot: string, window: BrowserWindow): void {
    this.stopWatching();

    this.watcher = chokidar.watch(projectRoot, {
      ignored: /(^|[/\\])(\.git|node_modules|\.next|dist|build|\.cache)([/\\]|$)/,
      ignoreInitial: true,
      persistent: true,
    });

    this.watcher.on('add', (filePath: string) => {
      window.webContents.send(IPC_CHANNELS.FILE_CHANGED, { path: filePath, type: 'add' });
    });

    this.watcher.on('change', (filePath: string) => {
      window.webContents.send(IPC_CHANNELS.FILE_CHANGED, { path: filePath, type: 'change' });
    });

    this.watcher.on('unlink', (filePath: string) => {
      window.webContents.send(IPC_CHANNELS.FILE_CHANGED, { path: filePath, type: 'unlink' });
    });
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
