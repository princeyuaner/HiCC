import { ipcMain, dialog, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import { addRecentProject, getRecentProjects } from '../store/config-store';
import fs from 'fs';

export function registerProjectHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PROJECT_OPEN, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) throw new Error('No window found');

    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory'],
      title: 'Open Project Folder',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const projectPath = result.filePaths[0];
    const projectName = projectPath.split(/[/\\]/).pop() || projectPath;
    addRecentProject(projectPath);

    return { path: projectPath, name: projectName };
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_RECENT, async () => {
    const paths = getRecentProjects();
    return paths
      .filter((p) => {
        try { return fs.existsSync(p); } catch { return false; }
      })
      .map((p) => ({
        path: p,
        name: p.split(/[/\\]/).pop() || p,
      }));
  });
}
