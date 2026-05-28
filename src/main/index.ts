import { app, BrowserWindow } from 'electron';
import path from 'path';
import { registerAllIpcHandlers } from './ipc/index';
import { setFileSystemService } from './ipc/file';
import { setAnthropicClient } from './ipc/ai';
import { setTerminalManager } from './ipc/terminal';
import { FileSystemService } from './services/file-system';
import { FileWatcherService } from './services/file-watcher';
import { AnthropicClient } from './services/anthropic-client';
import { ToolExecutor } from './services/tool-executor';
import { TerminalManager } from './services/terminal-manager';
import { getApiKey } from './store/config-store';

let mainWindow: BrowserWindow | null = null;

const fileSystem = new FileSystemService('');
const toolExecutor = new ToolExecutor(fileSystem);
const anthropicClient = new AnthropicClient(fileSystem, toolExecutor);
const fileWatcher = new FileWatcherService();
const terminalManager = new TerminalManager();

setFileSystemService(fileSystem);
setAnthropicClient(anthropicClient);
setTerminalManager(terminalManager);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
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

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  const apiKey = getApiKey();
  if (apiKey) {
    anthropicClient.setApiKey(apiKey);
  }

  registerAllIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
