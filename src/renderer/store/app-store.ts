import { create } from 'zustand';
import type { FileNode, ChatMessage, EditorTab, ApiProfile, ContentBlock, ToolCall, ToolConfirmEvent, Conversation, Attachment } from '../types';

// Buffer for tool results that arrive before the tool_use block is created.
// This handles the race condition where IPC messages arrive out of order.
const pendingToolResults = new Map<string, { stdout?: string; stderr?: string }>();

function estimateCost(modelKey: string, inputTokens: number, outputTokens: number): number {
  const prices: Record<string, { input: number; output: number }> = {
    sonnet: { input: 3, output: 15 },
    opus: { input: 15, output: 75 },
    haiku: { input: 0.8, output: 4 },
  };
  const p = prices[modelKey] || prices.sonnet;
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

function isMessageComplete(msg: ChatMessage): boolean {
  if (!msg.contentBlocks || msg.contentBlocks.length === 0) return false;
  return msg.contentBlocks.every((b) => {
    if (b.type === 'text' || b.type === 'thinking') return b.complete;
    if (b.type === 'tool_use') return b.toolCall.status === 'executed' || b.toolCall.status === 'rejected' || b.toolCall.status === 'error';
    return true;
  });
}

function countNodes(nodes: FileNode[]): number {
  let count = 0;
  for (const n of nodes) {
    count++;
    if (n.children) count += countNodes(n.children);
  }
  return count;
}

function startBackgroundIndex(): void {
  const store = useAppStore.getState();
  // Only start if not already indexing
  if (store.indexProgress) return;
  useAppStore.setState({ indexProgress: 'Indexing... (0 files)' });
  const interval = setInterval(() => {
    const { fileTree } = useAppStore.getState();
    useAppStore.setState({ indexProgress: `Indexing... (${countNodes(fileTree)} files)` });
  }, 300);
  window.hicc.refreshCache().then(() => {
    clearInterval(interval);
    useAppStore.setState({ indexProgress: '' });
  }).catch(() => {
    clearInterval(interval);
    useAppStore.setState({ indexProgress: '' });
  });
}

function resendFromIndex(
  get: () => AppState,
  set: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
  trimIndex: number,
  text: string,
  editingMessageId?: string | null,
) {
  set((s) => ({
    messages: s.messages.filter((_, i) => i < trimIndex),
    ...(editingMessageId !== undefined ? { editingMessageId } : {}),
  }));
  setTimeout(() => {
    const state = get();
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      contentBlocks: [],
      timestamp: Date.now(),
    };
    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      contentBlocks: [],
      timestamp: Date.now(),
    };
    set({ messages: [...state.messages, userMsg, aiMsg], isStreaming: true });
    window.hicc.sendMessage(text).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      get().setMessageError(aiMsg.id, msg);
    });
  }, 0);
}

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
  activeFilePath: string | null;
  openFile: (filePath: string, fileName: string) => void;
  closeTab: (filePath: string) => void;
  setActiveTab: (filePath: string) => void;
  markTabDirty: (filePath: string, isDirty: boolean) => void;

  // File tree
  fileTree: FileNode[];
  fileTreeLoading: boolean;
  indexProgress: string;
  indexCount: number;
  indexCurrentFile: string;
  incrementalChangeCount: number;
  lastFullRefreshTime: number;
  expandedDirs: Set<string>;
  loadedDirs: Record<string, FileNode[]>;
  loadingDirs: Set<string>;
  setFileTree: (tree: FileNode[]) => void;
  refreshFileTree: () => Promise<void>;
  applyFileChange: (changePath: string, changeType: 'add' | 'change' | 'unlink') => void;
  toggleExpandDir: (path: string) => Promise<void>;
  collapseDir: (path: string) => void;

  // Chat
  messages: ChatMessage[];
  isStreaming: boolean;
  sessionId: string | null;
  sessionStatus: string | null;
  sessionError: string | null;
  editingMessageId: string | null;
  activeModelKey: string;
  contextUsage: { inputTokens: number; outputTokens: number } | null;
  pendingToolConfirmation: ToolConfirmEvent | null;
  pendingAskUserQuestion: { toolUseId: string; questions: Array<{ question: string; header: string; options: Array<{ label: string; description: string }>; multiSelect: boolean }> } | null;
  permissionMode: string;
  effortLevel: string;
  use1MContext: boolean;

  // Conversations
  conversations: { id: string; title: string; modelKey: string; permissionMode: string; createdAt: number; updatedAt: number }[];
  activeConversationId: string | null;

  // Cumulative token tracking
  cumulativeInputTokens: number;
  cumulativeOutputTokens: number;
  cumulativeCost: number;

  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  setStreaming: (streaming: boolean) => void;
  onContentBlockStart: (blockIndex: number, blockType: string) => void;
  onThinkingDelta: (blockIndex: number, thinking: string) => void;
  onTextDelta: (text: string, blockIndex: number) => void;
  onContentBlockStop: (blockIndex: number) => void;
  onToolUse: (id: string, name: string, input: Record<string, unknown>, description?: string) => void;
  onToolProgress: (toolUseId: string, toolName: string, elapsedSeconds: number) => void;
  onToolUseSummary: (summary: string, toolUseIds: string[]) => void;
  onToolResult: (toolUseId: string, stdout?: string, stderr?: string) => void;
  onTurnComplete: (usage?: { input_tokens: number; output_tokens: number }, totalCostUsd?: number) => void;
  onAiStatus: (status: string) => void;
  setSessionError: (error: string | null) => void;
  onAiInit: (sessionId: string) => void;
  onToolConfirm: (data: ToolConfirmEvent) => void;
  onToolDescription: (toolUseId: string, description: string) => void;
  clearToolConfirm: () => void;
  confirmTool: (approved: boolean, alwaysAllow?: boolean) => void;
  setPendingAskUserQuestion: (data: { toolUseId: string; questions: Array<{ question: string; header: string; options: Array<{ label: string; description: string }>; multiSelect: boolean }> } | null) => void;
  answerAskUserQuestion: (toolUseId: string, answers: Record<string, string | string[]>) => void;
  cancelStream: () => Promise<void>;
  setMessageError: (messageId: string, error: string) => void;
  retryFromMessage: (messageId: string) => void;
  startEditing: (messageId: string) => void;
  cancelEditing: () => void;
  editAndRetry: (messageId: string, newContent: string) => void;
  interruptSession: () => void;
  setActiveModelKey: (key: string) => void;
  setPermissionMode: (mode: string) => void;
  setEffortLevel: (level: string) => void;
  setUse1MContext: (use: boolean) => void;

  // Editor context menu
  pendingSelectionCommand: string | null;
  setPendingSelectionCommand: (cmd: string | null) => void;
  pendingAttachment: Attachment | null;
  setPendingAttachment: (att: Attachment | null) => void;
  pendingFiles: string[];
  setPendingFiles: (paths: string[]) => void;

  // Line focus for search results
  pendingLineFocus: { filePath: string; line: number } | null;
  focusLine: (filePath: string, line: number) => void;

  // Dirty editor content tracking
  dirtyContents: Record<string, string>;
  setDirtyContent: (path: string, content: string) => void;
  clearDirtyContent: (path: string) => void;
  saveAllDirtyTabs: () => Promise<void>;

  // Conversations
  loadConversations: () => Promise<void>;
  createConversation: () => void;
  switchConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  setActiveConversationId: (id: string | null) => void;

  // API Profiles
  profiles: ApiProfile[];
  activeProfileId: string | null;
  setProfiles: (profiles: ApiProfile[]) => void;
  setActiveProfileId: (id: string | null) => void;
  addProfile: (profile: ApiProfile) => void;
  updateProfileInStore: (profile: ApiProfile) => void;
  removeProfile: (id: string) => void;

  // Sidebar
  activeSidebar: 'files' | 'search' | 'git' | 'review' | 'svn' | 'settings' | null;
  setActiveSidebar: (panel: 'files' | 'search' | 'git' | 'review' | 'svn' | 'settings' | null) => void;

  // Slash commands
  availableCommands: Array<{ name: string; description: string; argumentHint: string; aliases?: string[] }>;
  setAvailableCommands: (commands: Array<{ name: string; description: string; argumentHint: string; aliases?: string[] }>) => void;

  // Chat drafts per conversation
  chatDrafts: Record<string, string>;
  setChatDraft: (conversationId: string, draft: string) => void;
  clearChatDraft: (conversationId: string) => void;

  // Diff acceptance
  acceptedDiffIds: Set<string>;
  acceptAllDiffs: () => void;
  acceptDiff: (toolUseId: string) => void;

  // Remote connection
  isRemoteConnected: boolean;
  remoteHost: string | null;

  // Editor cursor
  cursorLine: number;
  cursorColumn: number;
  setCursorPosition: (line: number, column: number) => void;
}

export const selectActiveProfile = (state: AppState): ApiProfile | undefined =>
  state.profiles.find((p) => p.id === state.activeProfileId);

export const selectIsConfigured = (state: AppState): boolean =>
  !!selectActiveProfile(state)?.apiKey;

export const useAppStore = create<AppState>((set, get) => ({
  theme: 'dark',
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

  projectPath: null,
  projectName: null,
  setProject: (path, name) => set({ projectPath: path, projectName: name }),

  openTabs: [],
  activeTab: null,
  activeFilePath: null,
  openFile: (filePath, fileName) => {
    const { openTabs, expandedDirs } = get();
    const existing = openTabs.find((t) => t.path === filePath);
    if (existing) {
      // Expand parent directories to reveal this file in the tree
      const nextExpanded = new Set(expandedDirs);
      const normPath = filePath.replace(/\\/g, '/');
      const parts = normPath.split('/');
      for (let i = 0; i < parts.length - 1; i++) {
        nextExpanded.add(parts.slice(0, i + 1).join('/'));
      }
      set({ activeTab: filePath, activeFilePath: filePath, expandedDirs: nextExpanded });
    } else {
      const nextExpanded = new Set(expandedDirs);
      const normPath = filePath.replace(/\\/g, '/');
      const parts = normPath.split('/');
      for (let i = 0; i < parts.length - 1; i++) {
        nextExpanded.add(parts.slice(0, i + 1).join('/'));
      }
      set({
        openTabs: [...openTabs, { path: filePath, name: fileName, isDirty: false }],
        activeTab: filePath,
        activeFilePath: filePath,
        expandedDirs: nextExpanded,
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
  fileTreeLoading: false,
  indexProgress: '',
  indexCount: 0,
  indexCurrentFile: '',
  incrementalChangeCount: 0,
  lastFullRefreshTime: Date.now(),
  expandedDirs: new Set<string>(),
  loadedDirs: {},
  loadingDirs: new Set<string>(),
  setFileTree: (tree) => set({ fileTree: tree }),
  refreshFileTree: async () => {
    const { projectPath } = get();
    if (!projectPath) return;
    set({ fileTree: [], fileTreeLoading: true, indexProgress: 'Loading files...' });
    try {
      // Full depth scan with streaming — entries appear progressively like PyCharm indexing
      await window.hicc.listFilesStream('.', 99);
      // onFileListDone in App.tsx handles clearing fileTreeLoading and indexProgress
      set({ incrementalChangeCount: 0, lastFullRefreshTime: Date.now() });
    } catch {
      set({ fileTreeLoading: false, indexProgress: 'Failed to load files' });
      setTimeout(() => set({ indexProgress: '' }), 2000);
    }
  },

  applyFileChange: (changePath: string, changeType: 'add' | 'change' | 'unlink') => {
    const state = get();
    const { fileTree, incrementalChangeCount, lastFullRefreshTime } = state;

    // 'change' events only affect file content, not tree structure — no action needed
    if (changeType === 'change') return;

    // Periodic full refresh guard: after 50 incremental changes or 30 seconds, do a full reload
    const now = Date.now();
    const newCount = incrementalChangeCount + 1;
    if (newCount >= 50 || (now - lastFullRefreshTime) > 30_000) {
      state.refreshFileTree();
      return;
    }

    try {
      // Deep clone tree to maintain immutability
      const newTree = JSON.parse(JSON.stringify(fileTree)) as FileNode[];

      const pathParts = changePath.replace(/\\/g, '/').split('/');
      const entryName = pathParts.pop()!;
      const parentPath = pathParts.join('/');

      // Helper: find a node by path in the tree (shallow — only checks one level)
      const findParent = (nodes: FileNode[], targetPath: string): FileNode | null => {
        for (const n of nodes) {
          if (n.path === targetPath) return n;
          if (n.children) {
            const found = findParent(n.children, targetPath);
            if (found) return found;
          }
        }
        return null;
      };

      if (changeType === 'add') {
        const parent = parentPath ? findParent(newTree, parentPath) : null;
        const targetArray = parent?.children ?? newTree;
        // Avoid duplicates
        if (!targetArray.find(n => n.path === changePath)) {
          // Heuristic: names without a dot are directories
          const isDir = !entryName.includes('.');
          targetArray.push({
            name: entryName,
            path: changePath,
            type: isDir ? 'directory' : 'file',
            children: isDir ? [] : undefined,
          } as FileNode);
          // Sort: directories first, then alphabetically
          targetArray.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
        }
      } else if (changeType === 'unlink') {
        const removeFromArray = (nodes: FileNode[]): boolean => {
          const idx = nodes.findIndex(n => n.path === changePath);
          if (idx >= 0) { nodes.splice(idx, 1); return true; }
          for (const n of nodes) {
            if (n.children && removeFromArray(n.children)) return true;
          }
          return false;
        };
        removeFromArray(newTree);
      }

      set({ fileTree: newTree, incrementalChangeCount: newCount });
    } catch {
      // On any error, fall back to full refresh
      state.refreshFileTree();
    }
  },

  toggleExpandDir: async (dirPath: string) => {
    const state = get();
    const { expandedDirs, loadedDirs, loadingDirs } = state;

    // If already expanded, collapse
    if (expandedDirs.has(dirPath)) {
      const next = new Set(expandedDirs);
      next.delete(dirPath);
      set({ expandedDirs: next });
      return;
    }

    // Expand — mark as expanded immediately
    const nextExpanded = new Set(expandedDirs);
    nextExpanded.add(dirPath);
    set({ expandedDirs: nextExpanded });

    // Lazy load children only if not already loaded AND not in the full tree
    if (!loadedDirs[dirPath] && !loadingDirs.has(dirPath)) {
      // Check if the tree already has children for this directory
      const findNode = (nodes: FileNode[], targetPath: string): FileNode | null => {
        for (const n of nodes) {
          if (n.path === targetPath) return n;
          if (n.children) {
            const found = findNode(n.children, targetPath);
            if (found) return found;
          }
        }
        return null;
      };
      const dirNode = findNode(get().fileTree, dirPath);
      const hasChildren = dirNode?.children && dirNode.children.length > 0;

      if (!hasChildren) {
        const nextLoading = new Set(loadingDirs);
        nextLoading.add(dirPath);
        set({ loadingDirs: nextLoading });
        try {
          const children = await window.hicc.listFiles(dirPath, 2);
          set({
            loadedDirs: { ...get().loadedDirs, [dirPath]: children },
            loadingDirs: (() => { const s = new Set(get().loadingDirs); s.delete(dirPath); return s; })(),
          });
        } catch {
          set({
            loadingDirs: (() => { const s = new Set(get().loadingDirs); s.delete(dirPath); return s; })(),
          });
        }
      }
    }
  },

  collapseDir: (dirPath: string) => {
    set((s) => {
      const next = new Set(s.expandedDirs);
      next.delete(dirPath);
      return { expandedDirs: next };
    });
  },

  // Chat state
  messages: [],
  isStreaming: false,
  sessionId: null,
  sessionStatus: null,
  sessionError: null,
  editingMessageId: null,
  activeModelKey: 'sonnet',
  contextUsage: null,
  pendingToolConfirmation: null,
  pendingAskUserQuestion: null,
  permissionMode: 'default',
  effortLevel: 'high',
  use1MContext: true,
  pendingSelectionCommand: null,
  pendingAttachment: null,
  setPendingSelectionCommand: (cmd) => set({ pendingSelectionCommand: cmd }),
  setPendingAttachment: (att) => set({ pendingAttachment: att }),
  pendingFiles: [],
  setPendingFiles: (paths) => set({ pendingFiles: paths }),
  pendingLineFocus: null,
  focusLine: (filePath, line) => set({ pendingLineFocus: { filePath, line } }),

  dirtyContents: {},
  setDirtyContent: (path, content) => set((s) => ({ dirtyContents: { ...s.dirtyContents, [path]: content } })),
  clearDirtyContent: (path) => set((s) => {
    const dc = { ...s.dirtyContents };
    delete dc[path];
    return { dirtyContents: dc };
  }),
  saveAllDirtyTabs: async () => {
    const { dirtyContents, openTabs } = get();
    for (const tab of openTabs) {
      if (tab.isDirty && dirtyContents[tab.path] !== undefined) {
        await window.hicc.writeFile(tab.path, dirtyContents[tab.path]);
        get().markTabDirty(tab.path, false);
        get().clearDirtyContent(tab.path);
      }
    }
  },

  // Conversations
  conversations: [],
  activeConversationId: null,
  cumulativeInputTokens: 0,
  cumulativeOutputTokens: 0,
  cumulativeCost: 0,

  setPermissionMode: (mode) => set({ permissionMode: mode }),
  setEffortLevel: (level) => set({ effortLevel: level }),
  setUse1MContext: (use) => set({ use1MContext: use }),

  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),

  clearMessages: () => set({ messages: [] }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  onContentBlockStart: (blockIndex, blockType) => {
    set((s) => {
      const messages = [...s.messages];
      let last = messages[messages.length - 1];
      // If last assistant message is complete (all blocks finished), start a new one
      if (!last || last.role !== 'assistant' || isMessageComplete(last)) {
        last = {
          id: Date.now().toString(),
          role: 'assistant' as const,
          content: '',
          contentBlocks: [],
          timestamp: Date.now(),
        };
        messages.push(last);
      }
      const blocks = [...last.contentBlocks];
      if (blockType === 'text') {
        blocks.push({ type: 'text', text: '', blockIndex, complete: false });
      } else if (blockType === 'thinking') {
        blocks.push({ type: 'thinking', thinking: '', blockIndex, complete: false });
      }
      messages[messages.length - 1] = { ...last, contentBlocks: blocks };
      return { messages };
    });
  },

  onThinkingDelta: (blockIndex, thinking) => {
    set((s) => {
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant') {
        const blocks = last.contentBlocks.map((b) =>
          b.type === 'thinking' && b.blockIndex === blockIndex
            ? { ...b, thinking: b.thinking + thinking }
            : b
        );
        messages[messages.length - 1] = {
          ...last,
          contentBlocks: blocks,
        };
      }
      return { messages };
    });
  },

  onTextDelta: (text, blockIndex) => {
    set((s) => {
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant') {
        const blocks = last.contentBlocks.map((b) =>
          b.type === 'text' && b.blockIndex === blockIndex
            ? { ...b, text: b.text + text }
            : b
        );
        messages[messages.length - 1] = {
          ...last,
          content: last.content + text,
          contentBlocks: blocks,
        };
      }
      return { messages };
    });
  },

  onContentBlockStop: (blockIndex) => {
    set((s) => {
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant') {
        const blocks = last.contentBlocks.map((b) =>
          'blockIndex' in b && b.blockIndex === blockIndex
            ? { ...b, complete: true }
            : b
        );
        messages[messages.length - 1] = { ...last, contentBlocks: blocks };
      }
      return { messages };
    });
  },

  onToolUse: (id, name, input, description?) => {
    const bufferedResult = pendingToolResults.get(id);

    set((s) => {
      const messages = [...s.messages];
      let last = messages[messages.length - 1];
      // If last assistant message is complete, start a new one (new turn)
      if (!last || last.role !== 'assistant' || isMessageComplete(last)) {
        last = {
          id: Date.now().toString(),
          role: 'assistant' as const,
          content: '',
          contentBlocks: [],
          timestamp: Date.now(),
        };
        messages.push(last);
      }
      const toolCall: ToolCall = {
        id,
        name,
        input,
        status: bufferedResult ? 'executed' as const : 'pending' as const,
        stdout: bufferedResult?.stdout,
        stderr: bufferedResult?.stderr,
        description,
      };
      const blocks: ContentBlock[] = [
        ...last.contentBlocks,
        { type: 'tool_use', toolCall },
      ];
      messages[messages.length - 1] = { ...last, contentBlocks: blocks };
      return { messages };
    });
    if (bufferedResult) {
      pendingToolResults.delete(id);
    }
  },

  onToolProgress: (toolUseId, toolName, elapsedSeconds) => {
    set((s) => {
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant') {
        const blocks = last.contentBlocks.map((b) => {
          if (b.type === 'tool_use' && b.toolCall.id === toolUseId) {
            return {
              ...b,
              toolCall: {
                ...b.toolCall,
                status: 'executing' as const,
                name: toolName || b.toolCall.name,
                elapsedSeconds,
              },
            };
          }
          return b;
        });
        messages[messages.length - 1] = { ...last, contentBlocks: blocks };
      }
      return { messages };
    });
  },

  onToolUseSummary: (summary, toolUseIds) => {
    set((s) => {
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant') {
        const blocks = last.contentBlocks.map((b) => {
          if (b.type === 'tool_use' && toolUseIds.includes(b.toolCall.id)) {
            return {
              ...b,
              toolCall: { ...b.toolCall, status: 'executed' as const, summary },
            };
          }
          return b;
        });
        messages[messages.length - 1] = { ...last, contentBlocks: blocks };
      }
      return { messages };
    });
  },

  onToolResult: (toolUseId, stdout?, stderr?) => {
    set((s) => {
      const messages = [...s.messages];
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role !== 'assistant') continue;
        const blocks = msg.contentBlocks.map((b) => {
          if (b.type === 'tool_use' && b.toolCall.id === toolUseId) {
            return {
              ...b,
              toolCall: {
                ...b.toolCall,
                status: 'executed' as const,
                stdout,
                stderr,
              },
            };
          }
          return b;
        });
        if (blocks !== msg.contentBlocks) {
          messages[i] = { ...msg, contentBlocks: blocks };
          return { messages };
        }
      }
      // Tool_use block not found yet — buffer the result for when it arrives
      pendingToolResults.set(toolUseId, { stdout, stderr });
      return { messages };
    });
  },

  onTurnComplete: (usage?: { input_tokens: number; output_tokens: number }, totalCostUsd?: number) => {
    const cost = totalCostUsd ?? estimateCost(
      get().activeModelKey,
      usage?.input_tokens ?? 0,
      usage?.output_tokens ?? 0,
    );
    set((s) => {
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant') {
        const toolBlocks = last.contentBlocks.filter((b) => b.type === 'tool_use');
        const textBlocks = last.contentBlocks.filter((b) => b.type === 'text' && b.text.trim().length > 0);
        console.log('[STORE] onTurnComplete: toolBlocks=' + toolBlocks.length + ' textBlocks=' + textBlocks.length +
          ' toolStatuses=[' + toolBlocks.map((b) => b.type === 'tool_use' ? b.toolCall.status : '').join(',') + ']');
        const blocks = last.contentBlocks.map((b) =>
          b.type === 'text' || b.type === 'thinking'
            ? { ...b, complete: true as const }
            : b
        );
        const finalBlocks = blocks.map((b) => {
          if (b.type === 'tool_use' && (b.toolCall.status === 'pending' || b.toolCall.status === 'executing')) {
            return { ...b, toolCall: { ...b.toolCall, status: 'executed' as const } };
          }
          return b;
        });
        messages[messages.length - 1] = {
          ...last,
          contentBlocks: finalBlocks,
          inputTokens: usage?.input_tokens ?? 0,
          outputTokens: usage?.output_tokens ?? 0,
        };
      }
      return {
        messages,
        isStreaming: false,
        contextUsage: {
          inputTokens: usage?.input_tokens || 0,
          outputTokens: usage?.output_tokens || 0,
        },
        cumulativeInputTokens: s.cumulativeInputTokens + (usage?.input_tokens || 0),
        cumulativeOutputTokens: s.cumulativeOutputTokens + (usage?.output_tokens || 0),
        cumulativeCost: s.cumulativeCost + cost,
      };
    });
  },

  onAiStatus: (status) => set({ sessionStatus: status }),

  setSessionError: (error) => set({ sessionError: error }),

  onAiInit: (sessionId) => set({ sessionId }),

  onToolConfirm: (data) => {
    set((s) => {
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant') {
        const blocks = last.contentBlocks.map((b) => {
          if (b.type === 'tool_use' && b.toolCall.id === data.toolUseID) {
            return {
              ...b,
              toolCall: {
                ...b.toolCall,
                originalContent: data.originalContent,
                newFilePath: (data.input as Record<string, unknown>).file_path as string | undefined,
              },
            };
          }
          return b;
        });
        messages[messages.length - 1] = { ...last, contentBlocks: blocks };
      }
      return { messages, pendingToolConfirmation: data };
    });
  },

  onToolDescription: (toolUseId, description) => {
    set((s) => {
      const messages = [...s.messages];
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role !== 'assistant') continue;
        const blocks = msg.contentBlocks.map((b) => {
          if (b.type === 'tool_use' && b.toolCall.id === toolUseId) {
            return { ...b, toolCall: { ...b.toolCall, description } };
          }
          return b;
        });
        if (blocks !== msg.contentBlocks) {
          messages[i] = { ...msg, contentBlocks: blocks };
          return { messages };
        }
      }
      return { messages };
    });
  },

  clearToolConfirm: () => set({ pendingToolConfirmation: null }),
  setPendingAskUserQuestion: (data) => set({ pendingAskUserQuestion: data }),
  answerAskUserQuestion: async (toolUseId, answers) => {
    const answerText: string[] = [];
    const { pendingAskUserQuestion } = get();
    if (pendingAskUserQuestion) {
      for (const q of pendingAskUserQuestion.questions) {
        const ans = answers[q.question];
        if (ans) {
          answerText.push(`**${q.header}**: ${Array.isArray(ans) ? ans.join(', ') : ans}`);
        }
      }
    }
    await window.hicc.answerQuestion(toolUseId, answerText.join('\n\n') || 'No answer');
    set({ pendingAskUserQuestion: null });
  },

  confirmTool: (approved, alwaysAllow) => {
    const { pendingToolConfirmation } = get();
    if (pendingToolConfirmation) {
      console.log('[STORE] confirmTool:', { approved, toolUseID: pendingToolConfirmation.toolUseID, toolName: pendingToolConfirmation.toolName });
      // Mark tool as executing in UI when approved
      if (approved) {
        set((s) => {
          const messages = [...s.messages];
          const last = messages[messages.length - 1];
          if (last && last.role === 'assistant') {
            const blocks = last.contentBlocks.map((b) => {
              if (b.type === 'tool_use' && b.toolCall.id === pendingToolConfirmation.toolUseID) {
                return {
                  ...b,
                  toolCall: { ...b.toolCall, status: 'executing' as const },
                };
              }
              return b;
            });
            messages[messages.length - 1] = { ...last, contentBlocks: blocks };
          }
          return { messages };
        });
      } else {
        set((s) => {
          const messages = [...s.messages];
          const last = messages[messages.length - 1];
          if (last && last.role === 'assistant') {
            const blocks = last.contentBlocks.map((b) => {
              if (b.type === 'tool_use' && b.toolCall.id === pendingToolConfirmation.toolUseID) {
                return {
                  ...b,
                  toolCall: { ...b.toolCall, status: 'rejected' as const },
                };
              }
              return b;
            });
            messages[messages.length - 1] = { ...last, contentBlocks: blocks };
          }
          return { messages };
        });
      }
      window.hicc.confirmTool(approved, pendingToolConfirmation.toolUseID, alwaysAllow);
      set({ pendingToolConfirmation: null });
    }
  },

  interruptSession: () => {
    window.hicc.interrupt();
    set({ isStreaming: false, sessionStatus: null });
  },

  cancelStream: async () => {
    await window.hicc.cancelResponse();
    set((s) => {
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant') {
        const blocks = last.contentBlocks.map((b) =>
          b.type === 'text' || b.type === 'thinking'
            ? { ...b, complete: true as const }
            : b
        );
        messages[messages.length - 1] = { ...last, contentBlocks: blocks };
      }
      return { messages, isStreaming: false };
    });
  },

  setMessageError: (messageId, error) => {
    set((s) => {
      const messages = s.messages.map((m) =>
        m.id === messageId ? { ...m, error } : m
      );
      return { messages, isStreaming: false };
    });
  },

  retryFromMessage: (messageId) => {
    const { messages } = get();
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx < 0) return;

    if (messages[idx].role === 'user') {
      resendFromIndex(get, set, idx, messages[idx].content);
    } else {
      const userMsg = messages[idx - 1];
      if (!userMsg || userMsg.role !== 'user') return;
      resendFromIndex(get, set, idx - 1, userMsg.content);
    }
  },

  startEditing: (messageId) => set({ editingMessageId: messageId }),

  cancelEditing: () => set({ editingMessageId: null }),

  editAndRetry: (messageId, newContent) => {
    const { messages } = get();
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx < 0) return;
    resendFromIndex(get, set, idx, newContent, null);
  },

  // Conversations
  setActiveConversationId: (id) => set({ activeConversationId: id }),

  loadConversations: async () => {
    try {
      const conversations = await window.hicc.listConversations();
      set({ conversations });
    } catch {
      // ignore if chat persistence not available
    }
  },

  createConversation: () => {
    const { conversations, messages } = get();
    // Auto-save current conversation
    const activeId = get().activeConversationId;
    if (activeId && messages.length > 0) {
      const current = conversations.find((c) => c.id === activeId);
      const title = current?.title || 'New Chat';
      window.hicc.saveConversation({
        id: activeId,
        title,
        messages,
        modelKey: get().activeModelKey,
        permissionMode: get().permissionMode,
        createdAt: current?.createdAt || Date.now(),
        updatedAt: Date.now(),
      }).catch(() => {});
    }
    const newId = Date.now().toString();
    set({
      activeConversationId: newId,
      messages: [],
      isStreaming: false,
      contextUsage: null,
    });
  },

  switchConversation: async (id) => {
    const { conversations, messages, activeConversationId } = get();
    // Save current first
    if (activeConversationId && messages.length > 0) {
      const current = conversations.find((c) => c.id === activeConversationId);
      const title = current?.title || 'New Chat';
      window.hicc.saveConversation({
        id: activeConversationId,
        title,
        messages,
        modelKey: get().activeModelKey,
        permissionMode: get().permissionMode,
        createdAt: current?.createdAt || Date.now(),
        updatedAt: Date.now(),
      }).catch(() => {});
    }
    try {
      const fullConv = await window.hicc.getConversation(id);
      const stored = await window.hicc.listConversations();
      set({
        activeConversationId: id,
        messages: (fullConv?.messages as ChatMessage[]) || [],
        isStreaming: false,
        contextUsage: null,
        conversations: stored,
      });
    } catch {
      set({ activeConversationId: id, messages: [], isStreaming: false, contextUsage: null });
    }
  },

  deleteConversation: async (id) => {
    await window.hicc.deleteConversation(id).catch(() => {});
    set((s) => {
      const filtered = s.conversations.filter((c) => c.id !== id);
      const newActive = s.activeConversationId === id
        ? (filtered[0]?.id || null)
        : s.activeConversationId;
      return {
        conversations: filtered,
        activeConversationId: newActive,
        messages: newActive === s.activeConversationId ? s.messages : [],
      };
    });
    // Auto-create if no conversations left
    const state = get();
    if (state.conversations.length === 0) {
      state.createConversation();
    }
  },

  setActiveModelKey: (key) => set({ activeModelKey: key }),

  // API Profiles
  profiles: [],
  activeProfileId: null,
  setProfiles: (profiles) => set({ profiles }),
  setActiveProfileId: (id) => set({ activeProfileId: id }),
  addProfile: (profile) => set((s) => ({ profiles: [...s.profiles, profile] })),
  updateProfileInStore: (profile) =>
    set((s) => ({
      profiles: s.profiles.map((p) => (p.id === profile.id ? profile : p)),
    })),
  removeProfile: (id) =>
    set((s) => ({
      profiles: s.profiles.filter((p) => p.id !== id),
    })),

  activeSidebar: 'files',
  setActiveSidebar: (panel) => set((s) => ({
    activeSidebar: s.activeSidebar === panel ? null : panel,
  })),

  availableCommands: [
    { name: 'compact', description: 'Compact conversation context', argumentHint: '' },
    { name: 'config', description: 'Configure Claude Code settings', argumentHint: '<key> <value>' },
    { name: 'cost', description: 'Show token usage and cost', argumentHint: '' },
    { name: 'init', description: 'Initialize CLAUDE.md for the project', argumentHint: '' },
    { name: 'login', description: 'Log in to Anthropic', argumentHint: '' },
    { name: 'logout', description: 'Log out of Anthropic', argumentHint: '' },
    { name: 'memory', description: 'Manage persistent memory', argumentHint: '' },
    { name: 'mcp', description: 'Manage MCP servers', argumentHint: '' },
    { name: 'output-style', description: 'Change output style', argumentHint: '<style>' },
    { name: 'permissions', description: 'Manage tool permissions', argumentHint: '' },
    { name: 'pr-comments', description: 'View PR comments', argumentHint: '' },
    { name: 'release-notes', description: 'Generate release notes', argumentHint: '' },
    { name: 'review', description: 'Review a pull request', argumentHint: '[pr-url]' },
    { name: 'security-review', description: 'Review for security issues', argumentHint: '' },
    { name: 'statusline', description: 'Configure status line', argumentHint: '' },
    { name: 'terminal-setup', description: 'Set up terminal integration', argumentHint: '' },
    { name: 'update', description: 'Update Claude Code', argumentHint: '' },
    { name: 'upgrade', description: 'Upgrade Claude Code', argumentHint: '' },
    { name: 'ide', description: 'IDE integration', argumentHint: '' },
    { name: 'plugin', description: 'Manage plugins', argumentHint: '' },
    { name: 'add-dir', description: 'Add directory to context', argumentHint: '<dir>' },
    { name: 'doctor', description: 'Check system setup', argumentHint: '' },
    { name: 'context', description: 'Show context usage', argumentHint: '' },
    { name: 'bashes', description: 'List running background shells', argumentHint: '' },
    { name: 'tasks', description: 'List active tasks', argumentHint: '' },
    { name: 'todos', description: 'Manage todo list', argumentHint: '' },
    { name: 'vim', description: 'Toggle vim mode', argumentHint: '' },
    { name: 'fix', description: 'Fix errors in selected file', argumentHint: '' },
    { name: 'explain', description: 'Explain selected code', argumentHint: '' },
    { name: 'refactor', description: 'Refactor selected code', argumentHint: '' },
    { name: 'test', description: 'Write tests for selected code', argumentHint: '' },
    { name: 'docs', description: 'Generate documentation', argumentHint: '' },
  ],
  setAvailableCommands: (commands) => set({ availableCommands: commands }),

  chatDrafts: {},
  setChatDraft: (conversationId, draft) =>
    set((s) => ({ chatDrafts: { ...s.chatDrafts, [conversationId]: draft } })),
  clearChatDraft: (conversationId) =>
    set((s) => {
      const drafts = { ...s.chatDrafts };
      delete drafts[conversationId];
      return { chatDrafts: drafts };
    }),

  acceptedDiffIds: new Set<string>(),
  acceptAllDiffs: () => {
    const { messages } = get();
    const ids = new Set<string>();
    for (const msg of messages) {
      for (const b of msg.contentBlocks) {
        if (b.type === 'tool_use' && (b.toolCall.name === 'Write' || b.toolCall.name === 'Edit')) {
          ids.add(b.toolCall.id);
        }
      }
    }
    set({ acceptedDiffIds: ids });
  },
  acceptDiff: (toolUseId) => {
    set((s) => {
      const next = new Set(s.acceptedDiffIds);
      next.add(toolUseId);
      return { acceptedDiffIds: next };
    });
  },

  isRemoteConnected: false,
  remoteHost: null,

  cursorLine: 1,
  cursorColumn: 1,
  setCursorPosition: (line, column) => set({ cursorLine: line, cursorColumn: column }),
}));
