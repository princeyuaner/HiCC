import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';

let anthropicClient: import('../services/anthropic-client').AnthropicClient | null = null;

export function setAnthropicClient(client: import('../services/anthropic-client').AnthropicClient): void {
  anthropicClient = client;
}

export function registerAiHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AI_SEND, async (event, message: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) throw new Error('No window found');
    await anthropicClient!.sendMessage(message, window);
  });

  ipcMain.handle(IPC_CHANNELS.AI_CONFIRM_TOOL, async (_event, approved: boolean) => {
    anthropicClient!.confirmTool(approved);
  });
}
