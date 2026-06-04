import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { SvnService } from '../services/svn-service';

let svnService: SvnService | null = null;

export function setSvnService(service: SvnService): void {
  svnService = service;
}

export function getSvnService(): SvnService | null {
  return svnService;
}

export function registerSvnHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SVN_STATUS, async () => {
    if (!svnService) throw new Error('SvnService not initialized');
    return svnService.getStatus();
  });

  ipcMain.handle(IPC_CHANNELS.SVN_DIFF, async (_event, file?: string) => {
    if (!svnService) throw new Error('SvnService not initialized');
    return svnService.diff(file);
  });

  ipcMain.handle(IPC_CHANNELS.SVN_ADD, async (_event, file: string) => {
    if (!svnService) throw new Error('SvnService not initialized');
    await svnService.add(file);
  });

  ipcMain.handle(IPC_CHANNELS.SVN_REVERT, async (_event, file: string) => {
    if (!svnService) throw new Error('SvnService not initialized');
    await svnService.revert(file);
  });

  ipcMain.handle(IPC_CHANNELS.SVN_COMMIT, async (_event, message: string) => {
    if (!svnService) throw new Error('SvnService not initialized');
    await svnService.commit(message);
  });

  ipcMain.handle(IPC_CHANNELS.SVN_UPDATE, async () => {
    if (!svnService) throw new Error('SvnService not initialized');
    return svnService.update();
  });

  ipcMain.handle(IPC_CHANNELS.SVN_INFO, async () => {
    if (!svnService) throw new Error('SvnService not initialized');
    return svnService.getInfo();
  });
}
