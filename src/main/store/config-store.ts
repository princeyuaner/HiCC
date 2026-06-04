import Store from 'electron-store';
import type { ApiProfile, McpServerConfig } from '../../shared/types';

interface ConfigSchema {
  profiles: ApiProfile[];
  activeProfileId: string | null;
  recentProjects: string[];
  theme: 'light' | 'dark';
  mcpServers: Record<string, McpServerConfig>;
  formatOnSave: boolean;
  sessionState: {
    activeConversationId: string | null;
    openTabs: Array<{ path: string; name: string; isDirty: boolean }>;
    activeTab: string | null;
    activeSidebar: 'files' | 'search' | 'settings' | null;
  } | null;
}

const store = new Store<ConfigSchema>({
  defaults: {
    profiles: [],
    activeProfileId: null,
    recentProjects: [],
    theme: 'dark',
    mcpServers: {},
    formatOnSave: false,
    sessionState: null,
  },
  encryptionKey: 'hicc-config-v1',
});

function migrateFromLegacyFormat(): void {
  const profiles = store.get('profiles');
  if (profiles.length > 0) return;

  const apiKey = store.get('apiKey' as keyof ConfigSchema) as unknown as string | undefined;
  if (!apiKey) return;

  const baseUrl = store.get('baseUrl' as keyof ConfigSchema) as unknown as string || '';
  const model = store.get('model' as keyof ConfigSchema) as unknown as string || 'claude-sonnet-4-6';

  const profile: ApiProfile = {
    id: 'default-001',
    name: 'Default',
    baseUrl,
    apiKey,
    model,
    sonnetModel: '',
    opusModel: '',
    smallFastModel: '',
    systemPrompt: '',
    temperature: undefined,
    maxTokens: undefined,
    thinkingEnabled: true,
    thinkingBudget: undefined,
  };

  store.set('profiles', [profile]);
  store.set('activeProfileId', profile.id);

  // Delete old keys
  store.delete('apiKey' as keyof ConfigSchema);
  store.delete('baseUrl' as keyof ConfigSchema);
  store.delete('model' as keyof ConfigSchema);
}

migrateFromLegacyFormat();

export function generateProfileId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function cleanAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '').replace(/\[\d+m\]?/g, '').trim();
}

export function getProfiles(): ApiProfile[] {
  return store.get('profiles').map(p => ({
    ...p,
    sonnetModel: p.sonnetModel ? cleanAnsi(p.sonnetModel) : p.sonnetModel,
    opusModel: p.opusModel ? cleanAnsi(p.opusModel) : p.opusModel,
    smallFastModel: p.smallFastModel ? cleanAnsi(p.smallFastModel) : p.smallFastModel,
    model: p.model ? cleanAnsi(p.model) : p.model,
  }));
}

export function getActiveProfileId(): string | null {
  return store.get('activeProfileId');
}

export function getActiveProfile(): ApiProfile | undefined {
  const profiles = store.get('profiles');
  const activeId = store.get('activeProfileId');
  return profiles.find((p) => p.id === activeId);
}

export function setActiveProfileId(id: string): void {
  store.set('activeProfileId', id);
}

export function createProfile(name: string): ApiProfile {
  const profile: ApiProfile = {
    id: generateProfileId(),
    name,
    baseUrl: '',
    apiKey: '',
    model: 'claude-sonnet-4-6',
    sonnetModel: '',
    opusModel: '',
    smallFastModel: '',
    systemPrompt: '',
    temperature: undefined,
    maxTokens: undefined,
    thinkingEnabled: true,
    thinkingBudget: undefined,
  };
  const profiles = store.get('profiles');
  profiles.push(profile);
  store.set('profiles', profiles);

  if (profiles.length === 1) {
    store.set('activeProfileId', profile.id);
  }

  return profile;
}

export function updateProfile(updated: ApiProfile): void {
  const profiles = store.get('profiles');
  const idx = profiles.findIndex((p) => p.id === updated.id);
  if (idx === -1) return;
  profiles[idx] = updated;
  store.set('profiles', profiles);
}

export function deleteProfile(id: string): void {
  let profiles = store.get('profiles');
  profiles = profiles.filter((p) => p.id !== id);
  store.set('profiles', profiles);

  const activeId = store.get('activeProfileId');
  if (activeId === id) {
    const newActive = profiles.length > 0 ? profiles[0].id : null;
    store.set('activeProfileId', newActive);
  }
}

export function getSessionState(): ConfigSchema['sessionState'] {
  return store.get('sessionState');
}

export function setSessionState(state: ConfigSchema['sessionState']): void {
  store.set('sessionState', state);
}

export function getRecentProjects(): string[] {
  return store.get('recentProjects');
}

export function addRecentProject(projectPath: string): void {
  const recent = store.get('recentProjects');
  const filtered = recent.filter((p) => p !== projectPath);
  filtered.unshift(projectPath);
  store.set('recentProjects', filtered.slice(0, 10));
}

export function getMcpServers(): Record<string, McpServerConfig> {
  return store.get('mcpServers');
}

export function saveMcpServers(servers: Record<string, McpServerConfig>): void {
  store.set('mcpServers', servers);
}

/** Migrate stored profiles to clean ANSI codes (one-time fix) */
export function migrateProfilesCleanAnsi(): void {
  const raw = store.get('profiles') as ApiProfile[];
  if (!raw || !Array.isArray(raw)) return;
  let changed = false;
  const cleaned = raw.map(p => {
    const c = { ...p };
    if (c.sonnetModel && (c.sonnetModel !== cleanAnsi(c.sonnetModel))) { c.sonnetModel = cleanAnsi(c.sonnetModel); changed = true; }
    if (c.opusModel && (c.opusModel !== cleanAnsi(c.opusModel))) { c.opusModel = cleanAnsi(c.opusModel); changed = true; }
    if (c.smallFastModel && (c.smallFastModel !== cleanAnsi(c.smallFastModel))) { c.smallFastModel = cleanAnsi(c.smallFastModel); changed = true; }
    if (c.model && (c.model !== cleanAnsi(c.model))) { c.model = cleanAnsi(c.model); changed = true; }
    return c;
  });
  if (changed) {
    store.set('profiles', cleaned);
    console.log('[Config] Migrated profiles: cleaned ANSI codes from model names');
  }
}

export function getTheme(): 'light' | 'dark' {
  return store.get('theme');
}

export function setTheme(theme: 'light' | 'dark'): void {
  store.set('theme', theme);
}

export function getFormatOnSave(): boolean {
  return store.get('formatOnSave');
}

export function setFormatOnSave(formatOnSave: boolean): void {
  store.set('formatOnSave', formatOnSave);
}
