import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';

export function registerProjectHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PROJECT_OPEN, async () => {
    throw new Error('Not implemented yet');
  });
  ipcMain.handle(IPC_CHANNELS.PROJECT_RECENT, async () => {
    throw new Error('Not implemented yet');
  });
}
