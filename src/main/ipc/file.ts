import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import { ReadFileArgs, WriteFileArgs, DeleteFileArgs, ListFilesArgs } from '../../shared/types';
import { isRemoteActive, getRemoteFileSystem } from './sftp';
import fs from 'fs';
import path from 'path';
import os from 'os';

let fileSystemService: import('../services/file-system').FileSystemService | null = null;

export function setFileSystemService(service: import('../services/file-system').FileSystemService): void {
  fileSystemService = service;
  // Wire progress callback
  (service as unknown as { onProgress: ((count: number, currentFile?: string) => void) | null }).onProgress = null;
}

export function getFileSystemService(): import('../services/file-system').FileSystemService | null {
  return fileSystemService;
}

export function registerFileHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.FILE_READ, async (_event, args: unknown) => {
    const parsed = ReadFileArgs.parse(args);
    const remote = getRemoteFileSystem();
    if (remote) return remote.readFile(parsed.path, parsed.offset, parsed.limit);
    return fileSystemService!.readFile(parsed.path, parsed.offset, parsed.limit);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_WRITE, async (_event, args: unknown) => {
    const parsed = WriteFileArgs.parse(args);
    const remote = getRemoteFileSystem();
    if (remote) return remote.writeFile(parsed.path, parsed.content);
    return fileSystemService!.writeFile(parsed.path, parsed.content);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_DELETE, async (_event, args: unknown) => {
    const parsed = DeleteFileArgs.parse(args);
    const remote = getRemoteFileSystem();
    if (remote) throw new Error('Delete not supported on remote files');
    return fileSystemService!.deleteFile(parsed.path);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_LIST, async (event, args: unknown) => {
    const parsed = ListFilesArgs.parse(args);
    const window = BrowserWindow.fromWebContents(event.sender);
    const remote = getRemoteFileSystem();
    if (remote) return remote.listFiles(parsed.dirPath, parsed.depth);

    // Wire progress to renderer
    if (window && fileSystemService) {
      fileSystemService.onProgress = (count: number, currentFile?: string) => {
        window.webContents.send(IPC_CHANNELS.FILE_SCAN_PROGRESS, { count, currentFile });
      };
    }
    try {
      return await fileSystemService!.listFiles(parsed.dirPath, parsed.depth);
    } finally {
      if (fileSystemService) fileSystemService.onProgress = null;
    }
  });

  // Streaming list: sends entries via webContents as they're discovered
  ipcMain.handle(IPC_CHANNELS.FILE_LIST + ':stream', async (event, args: unknown) => {
    const parsed = ListFilesArgs.parse(args);
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) throw new Error('No window');

    const remote = getRemoteFileSystem();
    if (remote) {
      const results = await remote.listFiles(parsed.dirPath, parsed.depth);
      for (const entry of results) {
        window.webContents.send(IPC_CHANNELS.FILE_LIST_ENTRY, entry);
      }
      window.webContents.send(IPC_CHANNELS.FILE_LIST_DONE, { dirPath: parsed.dirPath });
      return;
    }

    // Wire progress to renderer
    if (fileSystemService) {
      fileSystemService.onProgress = (count: number, currentFile?: string) => {
        window.webContents.send(IPC_CHANNELS.FILE_SCAN_PROGRESS, { count, currentFile });
      };
    }
    try {
      // Stream local files
      await fileSystemService!.listFilesStream(
        parsed.dirPath,
        parsed.depth ?? 2,
        (entry) => window.webContents.send(IPC_CHANNELS.FILE_LIST_ENTRY, entry),
      );
    } finally {
      if (fileSystemService) fileSystemService.onProgress = null;
    }
    window.webContents.send(IPC_CHANNELS.FILE_LIST_DONE, { dirPath: parsed.dirPath });
  });

  ipcMain.handle(IPC_CHANNELS.FILE_SEARCH, async (_event, pattern: string, searchPath?: string, options?: import('../../shared/types').SearchOptions) => {
    const remote = getRemoteFileSystem();
    if (remote) return remote.searchFiles(pattern, searchPath, options);
    return fileSystemService!.searchFiles(pattern, searchPath, options);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_WRITE_BINARY, async (_event, base64Data: string) => {
    const matches = base64Data.match(/^data:image\/(.+?);base64,(.+)$/);
    if (!matches) throw new Error('Invalid data URL');
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const fileName = `paste-${Date.now()}.${ext}`;
    const tmpDir = os.tmpdir();
    const filePath = path.join(tmpDir, fileName);
    const buffer = Buffer.from(matches[2], 'base64');
    fs.writeFileSync(filePath, buffer);
    return filePath;
  });

  // Cache operations
  ipcMain.handle('file:refresh-cache', async () => {
    const remote = getRemoteFileSystem();
    if (remote) return remote.listFiles('.', 2);
    if (!fileSystemService) throw new Error('Not initialized');
    return fileSystemService.refreshCache();
  });

  ipcMain.handle('file:invalidate-cache', async () => {
    if (!fileSystemService) throw new Error('Not initialized');
    await fileSystemService.invalidateCache();
  });
}
