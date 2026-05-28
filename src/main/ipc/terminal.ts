import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';

let terminalManager: import('../services/terminal-manager').TerminalManager | null = null;

export function setTerminalManager(manager: import('../services/terminal-manager').TerminalManager): void {
  terminalManager = manager;
}

export function registerTerminalHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.TERMINAL_CREATE, async (event, cwd: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) throw new Error('No window found');
    return terminalManager!.create(cwd, window);
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_WRITE, async (_event, id: string, data: string) => {
    terminalManager!.write(id, data);
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_RESIZE, async (_event, id: string, cols: number, rows: number) => {
    terminalManager!.resize(id, cols, rows);
  });
}
