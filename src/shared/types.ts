import { z } from 'zod';

// --- Shared data types ---

export interface PersistedConversation {
  id: string;
  title: string;
  messages: unknown[];
  modelKey: string;
  permissionMode: string;
  createdAt: number;
  updatedAt: number;
}

// --- File operation schemas ---

export const ReadFileArgs = z.object({
  path: z.string(),
  offset: z.number().optional(),
  limit: z.number().optional(),
});
export type ReadFileArgs = z.infer<typeof ReadFileArgs>;

export const WriteFileArgs = z.object({
  path: z.string(),
  content: z.string(),
});
export type WriteFileArgs = z.infer<typeof WriteFileArgs>;

export const DeleteFileArgs = z.object({
  path: z.string(),
});
export type DeleteFileArgs = z.infer<typeof DeleteFileArgs>;

export const ListFilesArgs = z.object({
  dirPath: z.string(),
  depth: z.number().optional(),
});
export type ListFilesArgs = z.infer<typeof ListFilesArgs>;

// --- Search options ---

export interface SearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  useRegex?: boolean;
  fileTypes?: string;
}

// --- Code review ---

export type ReviewScope = 'working' | 'staged' | 'head' | 'commit';

export interface ReviewFinding {
  file: string;
  line: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'security' | 'bug' | 'performance' | 'style' | 'maintainability';
  title: string;
  description: string;
  suggestion: string;
}

export interface ReviewResult {
  findings: ReviewFinding[];
  summary: string;
  diagnostics?: string;  // debug info shown in UI
}

// --- API Profile ---

export interface ApiProfile {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  sonnetModel?: string;
  opusModel?: string;
  smallFastModel?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  thinkingEnabled?: boolean;
  thinkingBudget?: number;
}

// --- File node ---

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

// --- AI schemas ---

export const AiSendArgs = z.object({
  message: z.string(),
});
export type AiSendArgs = z.infer<typeof AiSendArgs>;

export const ToolConfirmArgs = z.object({
  approved: z.boolean(),
  toolUseID: z.string(),
  updatedPermissions: z.array(z.any()).optional(),
});
export type ToolConfirmArgs = z.infer<typeof ToolConfirmArgs>;

// --- AI event types (for IPC) ---

export interface ToolUseEvent {
  id: string;
  name: string;
  input: Record<string, unknown>;
  description?: string;
}

export interface ToolProgressEvent {
  toolUseId: string;
  toolName: string;
  elapsedSeconds: number;
}

export interface ToolUseSummaryEvent {
  summary: string;
  toolUseIds: string[];
}

export interface ToolConfirmEventData {
  toolName: string;
  input: Record<string, unknown>;
  toolUseID: string;
  title?: string;
  displayName?: string;
  description?: string;
  originalContent?: string;
}

export interface ContentBlockStartEventData {
  blockIndex: number;
  type: string;
}

export interface ThinkingDeltaEventData {
  blockIndex: number;
  thinking: string;
}

export interface TextDeltaEventData {
  text: string;
  blockIndex: number;
}

export interface ContentBlockStopEventData {
  blockIndex: number;
}

export interface TurnCompleteEventData {
  uuid: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  total_cost_usd?: number;
}

export interface AiStatusEventData {
  status: string;
  permissionMode?: string;
}

export interface AiInitEventData {
  sessionId: string;
  model: string;
  slashCommands?: string[];
  skills?: string[];
}

export interface SlashCommand {
  name: string;
  description: string;
  argumentHint: string;
  aliases?: string[];
}

// --- Terminal schemas ---

export const TerminalCreateArgs = z.object({
  cwd: z.string(),
});
export type TerminalCreateArgs = z.infer<typeof TerminalCreateArgs>;

export const TerminalWriteArgs = z.object({
  id: z.string(),
  data: z.string(),
});
export type TerminalWriteArgs = z.infer<typeof TerminalWriteArgs>;

export const TerminalResizeArgs = z.object({
  id: z.string(),
  cols: z.number(),
  rows: z.number(),
});
export type TerminalResizeArgs = z.infer<typeof TerminalResizeArgs>;

// --- Project schemas ---

export const ProjectOpenResult = z.object({
  path: z.string(),
  name: z.string(),
});
export type ProjectOpenResult = z.infer<typeof ProjectOpenResult>;

export interface ToolResultData {
  toolUseId: string;
  stdout?: string;
  stderr?: string;
  interrupted?: boolean;
  isImage?: boolean;
}

export interface ToolDescriptionData {
  toolUseId: string;
  description: string;
}

export interface InlineCompleteParams {
  codeBefore: string;
  codeAfter: string;
  language: string;
  filePath: string;
}

export interface InlineCompleteResult {
  text: string | null;
}

export interface McpStdioConfig {
  type?: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpNetworkConfig {
  type: 'sse' | 'http';
  url: string;
  headers?: Record<string, string>;
}

export type McpServerConfig = McpStdioConfig | McpNetworkConfig;

// --- SSH/SFTP ---

export interface SshConfig {
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  rootPath: string;
}

// --- Window API type (used by renderer via preload) ---

export interface HiccApi {
  readFile: (filePath: string, offset?: number, limit?: number) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  deleteFile: (filePath: string) => Promise<void>;
  searchFiles: (pattern: string, searchPath?: string, options?: SearchOptions) => Promise<Array<{ file: string; line: number; content: string }>>;
  listFiles: (dirPath: string, depth?: number) => Promise<FileNode[]>;
  listFilesStream: (dirPath: string, depth?: number) => Promise<void>;
  onFileListEntry: (callback: (entry: FileNode) => void) => void;
  onFileListDone: (callback: (data: { dirPath: string }) => void) => void;

  // Cache
  refreshCache: () => Promise<FileNode[]>;
  invalidateCache: () => Promise<void>;

  onScanProgress: (callback: (data: { count: number; currentFile?: string }) => void) => void;
  onFileChanged: (callback: (event: { path: string; type: string }) => void) => void;
  openProject: () => Promise<ProjectOpenResult>;
  setProject: (projectPath: string) => Promise<void>;
  getRecentProjects: () => Promise<ProjectOpenResult[]>;

  // Session management
  startSession: (modelKey?: string, permissionMode?: string, effortLevel?: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  interrupt: () => Promise<void>;
  cancelResponse: () => Promise<void>;

  // Structured event listeners
  onContentBlockStart: (callback: (data: ContentBlockStartEventData) => void) => void;
  onThinkingDelta: (callback: (data: ThinkingDeltaEventData) => void) => void;
  onTextDelta: (callback: (data: TextDeltaEventData) => void) => void;
  onContentBlockStop: (callback: (data: ContentBlockStopEventData) => void) => void;
  onToolUse: (callback: (data: ToolUseEvent) => void) => void;
  onToolProgress: (callback: (data: ToolProgressEvent) => void) => void;
  onToolUseSummary: (callback: (data: ToolUseSummaryEvent) => void) => void;
  onTurnComplete: (callback: (data: TurnCompleteEventData) => void) => void;
  onAiStatus: (callback: (data: AiStatusEventData) => void) => void;
  onAiInit: (callback: (data: AiInitEventData) => void) => void;
  onAiResult: (callback: (data: { subtype: string; errors?: string[] }) => void) => void;

  // Error handling
  onAiError: (callback: (errorMessage: string) => void) => void;
  onAiToolConfirm: (callback: (data: ToolConfirmEventData) => void) => void;
  confirmTool: (approved: boolean, toolUseID: string, alwaysAllow?: boolean) => Promise<void>;
  answerQuestion: (toolUseId: string, answer: string) => Promise<void>;
  onAiToolResult: (callback: (data: ToolResultData) => void) => void;
  onAiToolDescription: (callback: (data: ToolDescriptionData) => void) => void;

  // Commands
  onCommandsLoaded: (callback: (commands: SlashCommand[]) => void) => void;
  getCommands: () => Promise<SlashCommand[]>;

  // Terminal
  createTerminal: (cwd: string) => Promise<string>;
  writeToTerminal: (id: string, data: string) => Promise<void>;
  resizeTerminal: (id: string, cols: number, rows: number) => Promise<void>;
  onTerminalData: (callback: (data: { id: string; data: string }) => void) => void;

  // Config
  getProfiles: () => Promise<ApiProfile[]>;
  getActiveProfile: () => Promise<ApiProfile | null>;
  setActiveProfile: (profileId: string) => Promise<void>;
  createProfile: (name: string) => Promise<ApiProfile>;
  updateProfile: (profile: ApiProfile) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  loadClaudeSettings: () => Promise<{ sonnetModel: string; opusModel: string; smallFastModel: string; authToken: string; baseUrl: string }>;

  // Chat persistence
  listConversations: () => Promise<{ id: string; title: string; modelKey: string; permissionMode: string; createdAt: number; updatedAt: number }[]>;
  saveConversation: (conv: { id: string; title: string; messages: unknown[]; modelKey: string; permissionMode: string; createdAt: number; updatedAt: number }) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  getConversation: (id: string) => Promise<PersistedConversation | null>;
  generateConversationTitle: (firstMessage: string, apiKey: string, baseUrl?: string, model?: string) => Promise<string | null>;

  // Session persistence
  saveSession: (state: SessionState) => Promise<void>;
  restoreSession: () => Promise<SessionState | null>;

  // File dialog
  openFiles: () => Promise<string[]>;

  // Inline completion
  inlineComplete: (params: InlineCompleteParams) => Promise<InlineCompleteResult>;

  // Binary file
  writeBinaryFile: (base64Data: string) => Promise<string>;

  // Context usage
  getContextUsage: () => Promise<{ totalTokens: number; maxTokens: number; percentage: number; memoryFiles?: Array<{ path: string; type: string; tokens: number }> } | null>;

  // Code review
  reviewCode: (scope: ReviewScope, commitHash?: string) => Promise<ReviewResult>;

  // Format
  formatDocument: (filePath: string, content: string) => Promise<FormatResponse>;
  getFormatSettings: () => Promise<FormatSettings>;
  setFormatSettings: (settings: FormatSettings) => Promise<void>;

  // Locale
  getLanguage: () => Promise<string>;
  setLanguage: (lang: string) => Promise<void>;
  onLanguageChanged: (callback: (lang: string) => void) => void;

  // MCP servers
  getMcpServers: () => Promise<Record<string, McpServerConfig>>;
  saveMcpServers: (servers: Record<string, unknown>) => Promise<void>;

  // SFTP remote
  sftpConnect: (config: SshConfig) => Promise<void>;
  sftpDisconnect: () => Promise<void>;
  sftpStatus: () => Promise<{ connected: boolean; host?: string; rootPath?: string; name?: string } | null>;

  // Git
  gitStatus: () => Promise<{ branch: string; files: Array<{ path: string; status: string }>; ahead: number; behind: number }>;
  gitDiff: (file?: string) => Promise<string>;
  gitDiffStaged: () => Promise<string>;
  gitStage: (file: string) => Promise<void>;
  gitUnstage: (file: string) => Promise<void>;
  gitCommit: (message: string) => Promise<string>;
  gitBranches: () => Promise<{ current: string; branches: string[] }>;
  gitCheckout: (branch: string) => Promise<void>;
  gitPull: () => Promise<string>;
  gitPush: () => Promise<string>;
  gitLog: () => Promise<Array<{ hash: string; message: string; author: string; date: string }>>;

  // SVN
  svnStatus: () => Promise<{ files: Array<{ path: string; status: string }>; revision: string }>;
  svnDiff: (file?: string) => Promise<string>;
  svnAdd: (file: string) => Promise<void>;
  svnRevert: (file: string) => Promise<void>;
  svnCommit: (message: string) => Promise<void>;
  svnUpdate: () => Promise<string>;
  svnInfo: () => Promise<{ revision: string; url: string; lastChanged: string }>;
}

export interface SessionState {
  activeConversationId: string | null;
  openTabs: Array<{ path: string; name: string; isDirty: boolean }>;
  activeTab: string | null;
  activeSidebar: 'files' | 'search' | 'git' | 'review' | 'svn' | 'settings' | null;
}

// --- Format ---

export interface FormatResult {
  formatted: string;
}

export interface FormatError {
  error: string;
}

export type FormatResponse = FormatResult | FormatError;

export interface FormatSettings {
  formatOnSave: boolean;
}

declare global {
  interface Window {
    hicc: HiccApi;
  }
}
