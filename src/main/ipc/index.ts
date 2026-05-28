import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import { registerFileHandlers } from './file';
import { registerProjectHandlers } from './project';
import { registerAiHandlers } from './ai';
import { registerTerminalHandlers } from './terminal';
import { registerConfigHandlers } from './config';

export function registerAllIpcHandlers(): void {
  registerFileHandlers();
  registerProjectHandlers();
  registerAiHandlers();
  registerTerminalHandlers();
  registerConfigHandlers();
}
