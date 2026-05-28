import Store from 'electron-store';

interface ConfigSchema {
  apiKey: string;
  recentProjects: string[];
  theme: 'light' | 'dark';
}

const store = new Store<ConfigSchema>({
  defaults: {
    apiKey: '',
    recentProjects: [],
    theme: 'dark',
  },
  encryptionKey: 'hicc-config-v1',
});

export function getApiKey(): string {
  return store.get('apiKey');
}

export function setApiKey(key: string): void {
  store.set('apiKey', key);
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

export function getTheme(): 'light' | 'dark' {
  return store.get('theme');
}

export function setTheme(theme: 'light' | 'dark'): void {
  store.set('theme', theme);
}
