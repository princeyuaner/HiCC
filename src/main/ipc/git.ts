import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { GitService } from '../services/git-service';

let gitService: GitService | null = null;

export function setGitService(service: GitService): void {
  gitService = service;
}

export function getGitService(): GitService | null {
  return gitService;
}

export function registerGitHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GIT_STATUS, async () => {
    if (!gitService) throw new Error('GitService not initialized');
    return gitService.getStatus();
  });

  ipcMain.handle(IPC_CHANNELS.GIT_DIFF, async (_event, file?: string) => {
    if (!gitService) throw new Error('GitService not initialized');
    return gitService.diff(file);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_DIFF_STAGED, async () => {
    if (!gitService) throw new Error('GitService not initialized');
    return gitService.diffStaged();
  });

  ipcMain.handle(IPC_CHANNELS.GIT_STAGE, async (_event, file: string) => {
    if (!gitService) throw new Error('GitService not initialized');
    await gitService.stage(file);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_UNSTAGE, async (_event, file: string) => {
    if (!gitService) throw new Error('GitService not initialized');
    await gitService.unstage(file);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_COMMIT, async (_event, message: string) => {
    if (!gitService) throw new Error('GitService not initialized');
    return gitService.commit(message);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_BRANCHES, async () => {
    if (!gitService) throw new Error('GitService not initialized');
    return gitService.getBranches();
  });

  ipcMain.handle(IPC_CHANNELS.GIT_CHECKOUT, async (_event, branch: string) => {
    if (!gitService) throw new Error('GitService not initialized');
    await gitService.checkout(branch);
  });

  ipcMain.handle(IPC_CHANNELS.GIT_PULL, async () => {
    if (!gitService) throw new Error('GitService not initialized');
    return gitService.pull();
  });

  ipcMain.handle(IPC_CHANNELS.GIT_PUSH, async () => {
    if (!gitService) throw new Error('GitService not initialized');
    return gitService.push();
  });

  ipcMain.handle(IPC_CHANNELS.GIT_LOG, async () => {
    if (!gitService) throw new Error('GitService not initialized');
    return gitService.log(30);
  });
}
