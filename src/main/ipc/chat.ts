import { ipcMain } from 'electron';
import Store from 'electron-store';
import { IPC_CHANNELS } from '../../shared/constants';

interface PersistedConversation {
  id: string;
  title: string;
  messages: unknown[];
  modelKey: string;
  permissionMode: string;
  createdAt: number;
  updatedAt: number;
}

const chatStore = new Store<{ conversations: PersistedConversation[] }>({
  name: 'chat-store',
  encryptionKey: 'hicc-chat-v1',
  defaults: { conversations: [] },
});

export function registerChatHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CHAT_LIST_CONVERSATIONS, async () => {
    return chatStore.get('conversations', []).map((c) => ({
      id: c.id,
      title: c.title,
      modelKey: c.modelKey,
      permissionMode: c.permissionMode,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  });

  ipcMain.handle(IPC_CHANNELS.CHAT_SAVE_CONVERSATION, async (_event, conv: PersistedConversation) => {
    const conversations = chatStore.get('conversations', []);
    const idx = conversations.findIndex((c) => c.id === conv.id);
    if (idx >= 0) {
      conversations[idx] = conv;
    } else {
      conversations.push(conv);
    }
    // Keep only the latest 50 conversations
    if (conversations.length > 50) {
      conversations.splice(0, conversations.length - 50);
    }
    chatStore.set('conversations', conversations);
  });

  ipcMain.handle(IPC_CHANNELS.CHAT_DELETE_CONVERSATION, async (_event, id: string) => {
    const conversations = chatStore.get('conversations', []);
    chatStore.set('conversations', conversations.filter((c) => c.id !== id));
  });

  ipcMain.handle(IPC_CHANNELS.CHAT_GET_CONVERSATION, async (_event, id: string) => {
    const conversations = chatStore.get('conversations', []);
    return conversations.find((c) => c.id === id) || null;
  });

  ipcMain.handle(IPC_CHANNELS.CHAT_GENERATE_TITLE, async (_event, firstMessage: string, apiKey: string, baseUrl?: string, model?: string) => {
    try {
      const response = await fetch(`${baseUrl || 'https://api.anthropic.com'}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model || 'claude-haiku-4-5-20250515',
          max_tokens: 20,
          messages: [{
            role: 'user',
            content: `Generate a very short title (max 5 words) for a conversation that starts with: "${firstMessage.slice(0, 200)}". Return ONLY the title, no quotes, no explanation.`,
          }],
        }),
      });
      const data = await response.json() as Record<string, unknown>;
      if (data.content && Array.isArray(data.content) && data.content.length > 0) {
        const text = (data.content[0] as Record<string, string>).text || '';
        return text.trim().slice(0, 60);
      }
      return null;
    } catch {
      return null;
    }
  });
}
