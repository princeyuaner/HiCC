import { ipcMain, dialog, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import { addRecentProject, getRecentProjects } from '../store/config-store';
import type { GitService } from '../services/git-service';
import type { SvnService } from '../services/svn-service';
import type { FileSystemService } from '../services/file-system';
import type { AnthropicClient } from '../services/anthropic-client';
import type { FileWatcherService } from '../services/file-watcher';
import fs from 'fs';

let fileSystemService: FileSystemService | null = null;
let anthropicClient: AnthropicClient | null = null;
let fileWatcherService: FileWatcherService | null = null;
let gitService: GitService | null = null;
let svnService: SvnService | null = null;
let mainWindow: BrowserWindow | null = null;
let currentProjectPath = '';

export function getProjectRoot(): string {
  return currentProjectPath;
}

export function setProjectDependencies(
  fileSystem: FileSystemService,
  aiClient: AnthropicClient,
  fileWatcher?: FileWatcherService,
  git?: GitService,
  svn?: SvnService,
): void {
  fileSystemService = fileSystem;
  anthropicClient = aiClient;
  if (fileWatcher) fileWatcherService = fileWatcher;
  if (git) gitService = git;
  if (svn) svnService = svn;
}

export function setProjectWindow(window: BrowserWindow): void {
  mainWindow = window;
}

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

  ipcMain.handle(IPC_CHANNELS.PROJECT_SET, async (_event, projectPath: string) => {
    if (!fileSystemService) throw new Error('FileSystemService not initialized');
    currentProjectPath = projectPath;
    fileSystemService.setProjectRoot(projectPath);
    if (fileWatcherService && mainWindow) {
      fileWatcherService.startWatching(projectPath, mainWindow);
    }
    if (gitService) {
      gitService.setProjectRoot(projectPath);
    }
    if (svnService) {
      svnService.setProjectRoot(projectPath);
      console.log('[Project] SVN service root set:', projectPath);
    }
    console.log('[Project] Set project root:', projectPath);
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
