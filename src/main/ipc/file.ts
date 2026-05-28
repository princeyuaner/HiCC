import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import { ReadFileArgs, WriteFileArgs, DeleteFileArgs, ListFilesArgs } from '../../shared/types';

let fileSystemService: import('../services/file-system').FileSystemService | null = null;

export function setFileSystemService(service: import('../services/file-system').FileSystemService): void {
  fileSystemService = service;
}

export function registerFileHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.FILE_READ, async (_event, args: unknown) => {
    const parsed = ReadFileArgs.parse(args);
    return fileSystemService!.readFile(parsed.path, parsed.offset, parsed.limit);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_WRITE, async (_event, args: unknown) => {
    const parsed = WriteFileArgs.parse(args);
    return fileSystemService!.writeFile(parsed.path, parsed.content);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_DELETE, async (_event, args: unknown) => {
    const parsed = DeleteFileArgs.parse(args);
    return fileSystemService!.deleteFile(parsed.path);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_LIST, async (_event, args: unknown) => {
    const parsed = ListFilesArgs.parse(args);
    return fileSystemService!.listFiles(parsed.dirPath, parsed.depth);
  });
}
