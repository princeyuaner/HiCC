import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import {
  getProfiles,
  getActiveProfile,
  getActiveProfileId,
  setActiveProfileId,
  createProfile,
  updateProfile,
  deleteProfile,
  getSessionState,
  setSessionState,
  getMcpServers,
  saveMcpServers,
  getFormatOnSave,
  setFormatOnSave,
  getLanguage,
  setLanguage,
} from '../store/config-store';
import { readClaudeSettings, writeClaudeModels, writeClaudeAuth } from '../services/claude-settings';
import type { ApiProfile } from '../../shared/types';

let anthropicClient: import('../services/anthropic-client').AnthropicClient | null = null;

export function setAnthropicClientForConfig(client: import('../services/anthropic-client').AnthropicClient): void {
  anthropicClient = client;
}

export function registerConfigHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_PROFILES, () => {
    return getProfiles();
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_ACTIVE_PROFILE, () => {
    return getActiveProfile() || null;
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET_ACTIVE_PROFILE, (_event, profileId: string) => {
    setActiveProfileId(profileId);
    const profile = getActiveProfile();
    anthropicClient?.applyProfile(profile, profile?.systemPrompt);
    if (profile) {
      syncProfileToClaude(profile);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_CREATE_PROFILE, (_event, name: string) => {
    const profile = createProfile(name);
    if (getActiveProfileId() === profile.id) {
      anthropicClient?.applyProfile(profile, profile.systemPrompt);
    }
    return profile;
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_UPDATE_PROFILE, (_event, updated) => {
    updateProfile(updated);
    const activeId = getActiveProfileId();
    if (activeId === updated.id) {
      anthropicClient?.applyProfile(updated, updated.systemPrompt);
      syncProfileToClaude(updated);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_DELETE_PROFILE, (_event, profileId: string) => {
    const wasActive = getActiveProfileId() === profileId;
    deleteProfile(profileId);
    if (wasActive) {
      const newActive = getActiveProfile();
      anthropicClient?.applyProfile(newActive || null);
    }
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_LOAD_CLAUDE_SETTINGS, () => {
    return readClaudeSettings();
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_SAVE, (_event, state: unknown) => {
    setSessionState(state as Parameters<typeof setSessionState>[0]);
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_RESTORE, () => {
    return getSessionState();
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_MCP_SERVERS, () => {
    return getMcpServers();
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_SAVE_MCP_SERVERS, (_event, servers: Record<string, unknown>) => {
    saveMcpServers(servers as Record<string, import('../../shared/types').McpServerConfig>);
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_FORMAT_SETTINGS, () => {
    return { formatOnSave: getFormatOnSave() };
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET_FORMAT_SETTINGS, (_event, settings: { formatOnSave: boolean }) => {
    setFormatOnSave(settings.formatOnSave);
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_LANGUAGE, () => {
    return getLanguage();
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET_LANGUAGE, (_event, lang: string) => {
    setLanguage(lang);
    // Notify all renderer windows about language change
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC_CHANNELS.LOCALE_CHANGED, lang);
    }
  });
}

function syncProfileToClaude(profile: ApiProfile): void {
  if (profile.sonnetModel || profile.opusModel || profile.smallFastModel) {
    writeClaudeModels({
      sonnetModel: profile.sonnetModel || '',
      opusModel: profile.opusModel || '',
      smallFastModel: profile.smallFastModel || '',
    });
  }
  if (profile.apiKey || profile.baseUrl) {
    writeClaudeAuth({
      authToken: profile.apiKey,
      baseUrl: profile.baseUrl,
    });
  }
}
