import { z } from 'zod';

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
});
export type ToolConfirmArgs = z.infer<typeof ToolConfirmArgs>;

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

// --- Window API type (used by renderer via preload) ---

export interface HiccApi {
  readFile: (filePath: string, offset?: number, limit?: number) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  deleteFile: (filePath: string) => Promise<void>;
  listFiles: (dirPath: string, depth?: number) => Promise<FileNode[]>;
  onFileChanged: (callback: (event: { path: string; type: string }) => void) => void;
  openProject: () => Promise<ProjectOpenResult>;
  getRecentProjects: () => Promise<ProjectOpenResult[]>;
  sendMessage: (message: string) => Promise<void>;
  onAiDelta: (callback: (delta: string) => void) => void;
  onAiToolConfirm: (callback: (toolCall: unknown) => void) => void;
  confirmTool: (approved: boolean) => Promise<void>;
  createTerminal: (cwd: string) => Promise<string>;
  writeToTerminal: (id: string, data: string) => Promise<void>;
  resizeTerminal: (id: string, cols: number, rows: number) => Promise<void>;
  onTerminalData: (callback: (data: { id: string; data: string }) => void) => void;
  getApiKey: () => Promise<string>;
  setApiKey: (key: string) => Promise<void>;
}

declare global {
  interface Window {
    hicc: HiccApi;
  }
}
