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

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  contentBlocks: ContentBlock[];
  timestamp: number;
  turnUuid?: string;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  modelKey: string;
  permissionMode: string;
  createdAt: number;
  updatedAt: number;
}

export interface Attachment {
  filePath: string;
  fileName: string;
  type: 'file' | 'directory' | 'selection';
  content?: string;
  language?: string;
  thumbnailDataUrl?: string;
}

export type ContentBlock =
  | { type: 'text'; text: string; blockIndex: number; complete: boolean }
  | { type: 'thinking'; thinking: string; blockIndex: number; complete: boolean }
  | { type: 'tool_use'; toolCall: ToolCall };

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'executing' | 'executed' | 'rejected' | 'error';
  result?: string;
  summary?: string;
  stdout?: string;
  stderr?: string;
  elapsedSeconds?: number;
  isImage?: boolean;
  description?: string;
  originalContent?: string;
  newFilePath?: string;
}

export interface TurnState {
  textBlocks: Map<number, string>;
  thinkingBlocks: Map<number, string>;
  toolCalls: ToolCall[];
  isStreaming: boolean;
}

export interface EditorTab {
  path: string;
  name: string;
  isDirty: boolean;
}

// Event types for IPC
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

export interface ToolConfirmEvent {
  toolName: string;
  input: Record<string, unknown>;
  toolUseID: string;
  title?: string;
  displayName?: string;
  description?: string;
}

export interface ContentBlockStartEvent {
  blockIndex: number;
  type: string;
}

export interface ThinkingDeltaEvent {
  blockIndex: number;
  thinking: string;
}

export interface TextDeltaEvent {
  text: string;
  blockIndex: number;
}

export interface ContentBlockStopEvent {
  blockIndex: number;
}

export interface TurnCompleteEvent {
  uuid: string;
  usage?: unknown;
  total_cost_usd?: number;
}

export interface AiStatusEvent {
  status: string;
  permissionMode?: string;
}

export interface AiInitEvent {
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
