import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';

export function registerTerminalHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.TERMINAL_CREATE, async (_event, cwd: string) => {
    throw new Error('Not implemented yet');
  });
  ipcMain.handle(IPC_CHANNELS.TERMINAL_WRITE, async (_event, id: string, data: string) => {
    throw new Error('Not implemented yet');
  });
  ipcMain.handle(IPC_CHANNELS.TERMINAL_RESIZE, async (_event, id: string, cols: number, rows: number) => {
    throw new Error('Not implemented yet');
  });
}
