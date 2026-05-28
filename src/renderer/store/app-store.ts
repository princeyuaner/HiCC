import { create } from 'zustand';
import type { FileNode, ChatMessage, EditorTab } from '../types';

interface AppState {
  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Project
  projectPath: string | null;
  projectName: string | null;
  setProject: (path: string, name: string) => void;

  // Editor
  openTabs: EditorTab[];
  activeTab: string | null;
  openFile: (filePath: string, fileName: string) => void;
  closeTab: (filePath: string) => void;
  setActiveTab: (filePath: string) => void;
  markTabDirty: (filePath: string, isDirty: boolean) => void;

  // File tree
  fileTree: FileNode[];
  setFileTree: (tree: FileNode[]) => void;
  refreshFileTree: () => Promise<void>;

  // Chat
  messages: ChatMessage[];
  isStreaming: boolean;
  addMessage: (message: ChatMessage) => void;
  appendToLastMessage: (content: string) => void;
  setStreaming: (streaming: boolean) => void;

  // API Key
  apiKey: string | null;
  setApiKey: (key: string | null) => void;

  // Sidebar
  activeSidebar: 'files' | 'search' | 'settings' | null;
  setActiveSidebar: (panel: 'files' | 'search' | 'settings' | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: 'dark',
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

  projectPath: null,
  projectName: null,
  setProject: (path, name) => set({ projectPath: path, projectName: name }),

  openTabs: [],
  activeTab: null,
  openFile: (filePath, fileName) => {
    const { openTabs } = get();
    const existing = openTabs.find((t) => t.path === filePath);
    if (existing) {
      set({ activeTab: filePath });
    } else {
      set({
        openTabs: [...openTabs, { path: filePath, name: fileName, isDirty: false }],
        activeTab: filePath,
      });
    }
  },
  closeTab: (filePath) => {
    const { openTabs, activeTab } = get();
    const idx = openTabs.findIndex((t) => t.path === filePath);
    const newTabs = openTabs.filter((t) => t.path !== filePath);
    const newActive = activeTab === filePath
      ? (newTabs[Math.min(idx, newTabs.length - 1)]?.path || null)
      : activeTab;
    set({ openTabs: newTabs, activeTab: newActive });
  },
  setActiveTab: (filePath) => set({ activeTab: filePath }),
  markTabDirty: (filePath, isDirty) => {
    set((s) => ({
      openTabs: s.openTabs.map((t) => (t.path === filePath ? { ...t, isDirty } : t)),
    }));
  },

  fileTree: [],
  setFileTree: (tree) => set({ fileTree: tree }),
  refreshFileTree: async () => {
    const { projectPath } = get();
    if (!projectPath) return;
    const tree = await window.hicc.listFiles('.', 3);
    set({ fileTree: tree });
  },

  messages: [],
  isStreaming: false,
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  appendToLastMessage: (content) => {
    set((s) => {
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant') {
        messages[messages.length - 1] = { ...last, content: last.content + content };
      }
      return { messages };
    });
  },
  setStreaming: (streaming) => set({ isStreaming: streaming }),

  apiKey: null,
  setApiKey: (key) => set({ apiKey: key }),

  activeSidebar: 'files',
  setActiveSidebar: (panel) => set((s) => ({
    activeSidebar: s.activeSidebar === panel ? null : panel,
  })),
}));
