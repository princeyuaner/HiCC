import { ipcMain, dialog, BrowserWindow } from 'electron';
import { registerFileHandlers } from './file';
import { registerProjectHandlers } from './project';
import { registerAiHandlers, setAnthropicClient } from './ai';
import { registerTerminalHandlers } from './terminal';
import { registerConfigHandlers, setAnthropicClientForConfig } from './config';
import { registerChatHandlers } from './chat';
import { registerSftpHandlers } from './sftp';
import { registerGitHandlers } from './git';
import { registerSvnHandlers } from './svn';
import { registerFormatHandlers } from './format';
import { IPC_CHANNELS } from '../../shared/constants';
import type { AnthropicClient } from '../services/anthropic-client';

export function registerAllIpcHandlers(anthropicClient?: AnthropicClient): void {
  if (anthropicClient) {
    setAnthropicClient(anthropicClient);
    setAnthropicClientForConfig(anthropicClient);
  }
  registerFileHandlers();
  registerProjectHandlers();
  registerAiHandlers();
  registerTerminalHandlers();
  registerConfigHandlers();
  registerChatHandlers();
  registerSftpHandlers();
  registerGitHandlers();
  registerSvnHandlers();
  registerFormatHandlers();

  // File open dialog
  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_FILES, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return [];
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return result.canceled ? [] : result.filePaths;
  });
}
