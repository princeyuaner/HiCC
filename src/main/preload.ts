import { contextBridge, ipcRenderer } from 'electron';

const api = {
  readFile: (filePath: string, offset?: number, limit?: number) =>
    ipcRenderer.invoke('file:read', { path: filePath, offset, limit }),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('file:write', { path: filePath, content }),
  deleteFile: (filePath: string) =>
    ipcRenderer.invoke('file:delete', { path: filePath }),
  listFiles: (dirPath: string, depth?: number) =>
    ipcRenderer.invoke('file:list', { dirPath, depth }),
  listFilesStream: (dirPath: string, depth?: number) =>
    ipcRenderer.invoke('file:list:stream', { dirPath, depth }),
  onFileListEntry: (callback: (entry: { name: string; path: string; type: string; children?: unknown[] }) => void) => {
    ipcRenderer.on('file:list-entry', (_event, entry) => callback(entry));
  },
  onFileListDone: (callback: (data: { dirPath: string }) => void) => {
    ipcRenderer.on('file:list-done', (_event, data) => callback(data));
  },

  refreshCache: () => ipcRenderer.invoke('file:refresh-cache'),
  invalidateCache: () => ipcRenderer.invoke('file:invalidate-cache'),

  onScanProgress: (callback: (data: { count: number; currentFile?: string }) => void) => {
    ipcRenderer.on('file:scan-progress', (_event, data) => callback(data));
  },
  searchFiles: (pattern: string, searchPath?: string, options?: import('../shared/types').SearchOptions) =>
    ipcRenderer.invoke('file:search', pattern, searchPath, options),
  onFileChanged: (callback: (event: { path: string; type: string }) => void) => {
    ipcRenderer.on('file:changed', (_event, data) => callback(data));
  },
  openProject: () => ipcRenderer.invoke('project:open'),
  setProject: (projectPath: string) => ipcRenderer.invoke('project:set', projectPath),
  getRecentProjects: () => ipcRenderer.invoke('project:recent'),

  // Session management
  startSession: (modelKey?: string, permissionMode?: string, effortLevel?: string) =>
    ipcRenderer.invoke('ai:start-session', modelKey, permissionMode, effortLevel),
  sendMessage: (message: string) => ipcRenderer.invoke('ai:send', message),
  interrupt: () => ipcRenderer.invoke('ai:interrupt'),
  cancelResponse: () => ipcRenderer.invoke('ai:cancel'),

  // Structured event listeners
  onContentBlockStart: (callback: (data: unknown) => void) => {
    ipcRenderer.removeAllListeners('ai:content-block-start');
    ipcRenderer.on('ai:content-block-start', (_event, data) => callback(data));
  },
  onThinkingDelta: (callback: (data: unknown) => void) => {
    ipcRenderer.removeAllListeners('ai:thinking-delta');
    ipcRenderer.on('ai:thinking-delta', (_event, data) => callback(data));
  },
  onTextDelta: (callback: (data: unknown) => void) => {
    ipcRenderer.removeAllListeners('ai:text-delta');
    ipcRenderer.on('ai:text-delta', (_event, data) => callback(data));
  },
  onContentBlockStop: (callback: (data: unknown) => void) => {
    ipcRenderer.removeAllListeners('ai:content-block-stop');
    ipcRenderer.on('ai:content-block-stop', (_event, data) => callback(data));
  },
  onToolUse: (callback: (data: unknown) => void) => {
    ipcRenderer.removeAllListeners('ai:tool-use');
    ipcRenderer.on('ai:tool-use', (_event, data) => callback(data));
  },
  onToolProgress: (callback: (data: unknown) => void) => {
    ipcRenderer.removeAllListeners('ai:tool-progress');
    ipcRenderer.on('ai:tool-progress', (_event, data) => callback(data));
  },
  onToolUseSummary: (callback: (data: unknown) => void) => {
    ipcRenderer.removeAllListeners('ai:tool-use-summary');
    ipcRenderer.on('ai:tool-use-summary', (_event, data) => callback(data));
  },
  onTurnComplete: (callback: (data: unknown) => void) => {
    ipcRenderer.removeAllListeners('ai:turn-complete');
    ipcRenderer.on('ai:turn-complete', (_event, data) => callback(data));
  },
  onAiStatus: (callback: (data: unknown) => void) => {
    ipcRenderer.removeAllListeners('ai:status');
    ipcRenderer.on('ai:status', (_event, data) => callback(data));
  },
  onAiInit: (callback: (data: unknown) => void) => {
    ipcRenderer.removeAllListeners('ai:init');
    ipcRenderer.on('ai:init', (_event, data) => callback(data));
  },
  onAiResult: (callback: (data: unknown) => void) => {
    ipcRenderer.removeAllListeners('ai:result');
    ipcRenderer.on('ai:result', (_event, data) => callback(data));
  },

  // Error handling
  onAiError: (callback: (errorMessage: string) => void) => {
    ipcRenderer.removeAllListeners('ai:error');
    ipcRenderer.on('ai:error', (_event, message) => callback(message));
  },
  onAiToolConfirm: (callback: (toolCall: unknown) => void) => {
    ipcRenderer.removeAllListeners('ai:tool-confirm');
    ipcRenderer.on('ai:tool-confirm', (_event, toolCall) => {
      console.log('[Preload] ai:tool-confirm received:', toolCall);
      callback(toolCall);
    });
  },
  confirmTool: (approved: boolean, toolUseID: string, alwaysAllow?: boolean) =>
    ipcRenderer.invoke('ai:confirm-tool', approved, toolUseID, alwaysAllow),
  answerQuestion: (toolUseId: string, answer: string) =>
    ipcRenderer.invoke('ai:answer-question', toolUseId, answer),
  onAiToolResult: (callback: (data: { toolUseId: string }) => void) => {
    ipcRenderer.removeAllListeners('ai:tool-result');
    ipcRenderer.on('ai:tool-result', (_event, data) => callback(data));
  },
  onAiToolDescription: (callback: (data: { toolUseId: string; description: string }) => void) => {
    ipcRenderer.removeAllListeners('ai:tool-description');
    ipcRenderer.on('ai:tool-description', (_event, data) => callback(data));
  },

  // Commands
  onCommandsLoaded: (callback: (commands: unknown) => void) => {
    ipcRenderer.removeAllListeners('ai:commands-loaded');
    ipcRenderer.on('ai:commands-loaded', (_event, commands) => callback(commands));
  },
  getCommands: () => ipcRenderer.invoke('ai:get-commands'),

  // Terminal
  createTerminal: (cwd: string) => ipcRenderer.invoke('terminal:create', cwd),
  writeToTerminal: (id: string, data: string) =>
    ipcRenderer.invoke('terminal:write', id, data),
  resizeTerminal: (id: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', id, cols, rows),
  onTerminalData: (callback: (data: { id: string; data: string }) => void) => {
    ipcRenderer.on('terminal:data', (_event, data) => callback(data));
  },

  // Config
  getProfiles: () => ipcRenderer.invoke('config:get-profiles'),
  getActiveProfile: () => ipcRenderer.invoke('config:get-active-profile'),
  setActiveProfile: (profileId: string) =>
    ipcRenderer.invoke('config:set-active-profile', profileId),
  createProfile: (name: string) => ipcRenderer.invoke('config:create-profile', name),
  updateProfile: (profile: unknown) =>
    ipcRenderer.invoke('config:update-profile', profile),
  deleteProfile: (profileId: string) =>
    ipcRenderer.invoke('config:delete-profile', profileId),
  loadClaudeSettings: () =>
    ipcRenderer.invoke('config:load-claude-settings'),

  // Chat persistence
  listConversations: () => ipcRenderer.invoke('chat:list-conversations'),
  saveConversation: (conv: unknown) => ipcRenderer.invoke('chat:save-conversation', conv),
  deleteConversation: (id: string) => ipcRenderer.invoke('chat:delete-conversation', id),
  getConversation: (id: string) => ipcRenderer.invoke('chat:get-conversation', id),
  generateConversationTitle: (firstMessage: string, apiKey: string, baseUrl?: string, model?: string) =>
    ipcRenderer.invoke('chat:generate-title', firstMessage, apiKey, baseUrl, model),

  // Session persistence
  saveSession: (state: unknown) => ipcRenderer.invoke('session:save', state),
  restoreSession: () => ipcRenderer.invoke('session:restore'),

  // File dialog
  openFiles: () => ipcRenderer.invoke('dialog:open-files'),

  // Inline completion
  inlineComplete: (params: unknown) => ipcRenderer.invoke('ai:inline-complete', params),

  // Code review
  reviewCode: (scope: string, commitHash?: string) => ipcRenderer.invoke('ai:review-code', scope, commitHash),

  // Binary file write (for pasted images)
  writeBinaryFile: (base64Data: string) => ipcRenderer.invoke('file:write-binary', base64Data),

  getContextUsage: () => ipcRenderer.invoke('ai:get-context-usage'),

  // SFTP
  sftpConnect: (config: unknown) => ipcRenderer.invoke('sftp:connect', config),
  sftpDisconnect: () => ipcRenderer.invoke('sftp:disconnect'),
  sftpStatus: () => ipcRenderer.invoke('sftp:status'),

  gitStatus: () => ipcRenderer.invoke('git:status'),
  gitDiff: (file?: string) => ipcRenderer.invoke('git:diff', file),
  gitDiffStaged: () => ipcRenderer.invoke('git:diff-staged'),
  gitStage: (file: string) => ipcRenderer.invoke('git:stage', file),
  gitUnstage: (file: string) => ipcRenderer.invoke('git:unstage', file),
  gitCommit: (message: string) => ipcRenderer.invoke('git:commit', message),
  gitBranches: () => ipcRenderer.invoke('git:branches'),
  gitCheckout: (branch: string) => ipcRenderer.invoke('git:checkout', branch),
  gitPull: () => ipcRenderer.invoke('git:pull'),
  gitPush: () => ipcRenderer.invoke('git:push'),
  gitLog: () => ipcRenderer.invoke('git:log'),

  svnStatus: () => ipcRenderer.invoke('svn:status'),
  svnDiff: (file?: string) => ipcRenderer.invoke('svn:diff', file),
  svnAdd: (file: string) => ipcRenderer.invoke('svn:add', file),
  svnRevert: (file: string) => ipcRenderer.invoke('svn:revert', file),
  svnCommit: (message: string) => ipcRenderer.invoke('svn:commit', message),
  svnUpdate: () => ipcRenderer.invoke('svn:update'),
  svnInfo: () => ipcRenderer.invoke('svn:info'),

  // MCP servers
  getMcpServers: () => ipcRenderer.invoke('config:get-mcp-servers'),
  saveMcpServers: (servers: unknown) => ipcRenderer.invoke('config:save-mcp-servers', servers),

  // Format
  formatDocument: (filePath: string, content: string) =>
    ipcRenderer.invoke('config:format-document', filePath, content),
  getFormatSettings: () => ipcRenderer.invoke('config:get-format-settings'),
  setFormatSettings: (settings: { formatOnSave: boolean }) =>
    ipcRenderer.invoke('config:set-format-settings', settings),

  // Locale
  getLanguage: () => ipcRenderer.invoke('config:get-language'),
  setLanguage: (lang: string) => ipcRenderer.invoke('config:set-language', lang),
  onLanguageChanged: (callback: (lang: string) => void) => {
    ipcRenderer.on('locale:changed', (_event, lang) => callback(lang));
  },
};

contextBridge.exposeInMainWorld('hicc', api);
