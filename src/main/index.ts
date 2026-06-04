import { app, BrowserWindow } from 'electron';
import path from 'path';
import { registerAllIpcHandlers } from './ipc/index';
import { setFileSystemService } from './ipc/file';
import { setAnthropicClient } from './ipc/ai';
import { setTerminalManager } from './ipc/terminal';
import { setProjectDependencies, setProjectWindow } from './ipc/project';
import { FileSystemService } from './services/file-system';
import { RemoteFileSystemService } from './services/remote-file-system';
import { GitService } from './services/git-service';
import { SvnService } from './services/svn-service';
import { FileWatcherService } from './services/file-watcher';
import { AnthropicClient } from './services/anthropic-client';
import { TerminalManager } from './services/terminal-manager';
import { getActiveProfile, migrateProfilesCleanAnsi } from './store/config-store';
import { setRemoteFileSystemService } from './ipc/sftp';
import { setGitService } from './ipc/git';
import { setSvnService } from './ipc/svn';

let mainWindow: BrowserWindow | null = null;

const fileSystem = new FileSystemService('');
const remoteFileSystem = new RemoteFileSystemService();
const gitService = new GitService();
const svnService = new SvnService();
const anthropicClient = new AnthropicClient(fileSystem);
const fileWatcher = new FileWatcherService();
const terminalManager = new TerminalManager();

setFileSystemService(fileSystem);
setRemoteFileSystemService(remoteFileSystem);
setGitService(gitService);
setSvnService(svnService);
setAnthropicClient(anthropicClient);
setTerminalManager(terminalManager);
setProjectDependencies(fileSystem, anthropicClient, fileWatcher, gitService, svnService);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('closed', () => {
    terminalManager.killAll();
    fileWatcher.stopWatching();
    mainWindow = null;
  });

  setProjectWindow(mainWindow);

  // Prevent Electron's default context menu so Monaco's custom menu is visible
  mainWindow.webContents.on('context-menu', (e) => e.preventDefault());

  // Debug: forward renderer console to main process terminal
  mainWindow.webContents.on('console-message', (_event, level, message) => {
    const prefix = level === 3 ? '[RDR-ERR]' : '[RDR-LOG]';
    console.log(prefix, message);
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  migrateProfilesCleanAnsi();
  const activeProfile = getActiveProfile();
  if (activeProfile) {
    anthropicClient.applyProfile(activeProfile, activeProfile.systemPrompt);
  }

  registerAllIpcHandlers(anthropicClient);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
