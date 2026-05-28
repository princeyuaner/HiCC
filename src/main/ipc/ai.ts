import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';

export function registerAiHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AI_SEND, async (_event, message: string) => {
    throw new Error('Not implemented yet');
  });
  ipcMain.handle(IPC_CHANNELS.AI_CONFIRM_TOOL, async (_event, approved: boolean) => {
    throw new Error('Not implemented yet');
  });
}
