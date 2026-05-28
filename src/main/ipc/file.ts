import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';

export function registerFileHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.FILE_READ, async (_event, filePath: string) => {
    throw new Error('Not implemented yet');
  });
  ipcMain.handle(IPC_CHANNELS.FILE_WRITE, async (_event, filePath: string, content: string) => {
    throw new Error('Not implemented yet');
  });
  ipcMain.handle(IPC_CHANNELS.FILE_DELETE, async (_event, filePath: string) => {
    throw new Error('Not implemented yet');
  });
  ipcMain.handle(IPC_CHANNELS.FILE_LIST, async (_event, dirPath: string, depth?: number) => {
    throw new Error('Not implemented yet');
  });
}
