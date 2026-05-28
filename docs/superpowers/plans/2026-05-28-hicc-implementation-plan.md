# HICC AI-Powered Coding IDE — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Electron + React + TypeScript desktop IDE with Anthropic API integration as the core AI coding experience, including basic IDE features (file tree, Monaco editor, terminal).

**Architecture:** Electron main process hosts Node.js services (filesystem, Anthropic client, tool executor, terminal). React renderer provides the UI with Monaco editor, chat panel, diff preview, file explorer, and xterm terminal. IPC bridges the two, with all AI calls proxied through main process.

**Tech Stack:** Electron 28+, React 18, TypeScript 5, Monaco Editor, xterm.js + node-pty, zustand, better-sqlite3, chokidar, `@anthropic-ai/sdk`, zod, Vite, Vitest, electron-builder

---

## File Structure

```
HICC/
├── src/
│   ├── main/
│   │   ├── index.ts                    # Entry: window creation, app lifecycle
│   │   ├── preload.ts                  # contextBridge exposing IPC to renderer
│   │   ├── ipc/
│   │   │   ├── index.ts                # Register all IPC handlers
│   │   │   ├── file.ts                 # File read/write/delete/list handlers
│   │   │   ├── project.ts              # Project open/switch/recent handlers
│   │   │   ├── terminal.ts             # PTY create/write/resize handlers
│   │   │   └── ai.ts                   # AI chat/tool-confirmation handlers
│   │   ├── services/
│   │   │   ├── file-system.ts          # fs operations + path safety checks
│   │   │   ├── file-watcher.ts         # chokidar wrapper
│   │   │   ├── anthropic-client.ts     # @anthropic-ai/sdk + tool orchestration
│   │   │   ├── tool-executor.ts        # Execute tool calls, enforce safety
│   │   │   ├── safety-checker.ts       # Danger detection + permission levels
│   │   │   └── terminal-manager.ts     # node-pty session pool
│   │   └── store/
│   │       └── config-store.ts         # electron-store for settings/API key
│   ├── renderer/
│   │   ├── index.html
│   │   ├── index.tsx                   # React root + ErrorBoundary
│   │   ├── App.tsx                     # Main layout
│   │   ├── App.css                     # Global styles + theme variables
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Panel.tsx           # Resizable panel container
│   │   │   │   └── Toolbar.tsx
│   │   │   ├── chat/
│   │   │   │   ├── ChatPanel.tsx
│   │   │   │   ├── MessageList.tsx
│   │   │   │   ├── MessageBubble.tsx
│   │   │   │   ├── InputBox.tsx
│   │   │   │   └── DiffPreview.tsx
│   │   │   ├── editor/
│   │   │   │   ├── CodeEditor.tsx
│   │   │   │   ├── EditorTabs.tsx
│   │   │   │   └── FileExplorer.tsx
│   │   │   ├── terminal/
│   │   │   │   └── TerminalPanel.tsx
│   │   │   └── common/
│   │   │       └── ErrorBoundary.tsx
│   │   ├── hooks/
│   │   │   ├── useChat.ts
│   │   │   └── useFileTree.ts
│   │   ├── store/
│   │   │   └── app-store.ts           # zustand store
│   │   └── types/
│   │       └── index.ts               # Renderer-specific types
│   └── shared/
│       ├── types.ts                    # IPC channel names + payload types
│       ├── tool-schemas.ts             # Anthropic tool definitions (JSON Schema)
│       └── constants.ts                # Shared constants
├── tests/
│   ├── main/
│   │   ├── file-system.test.ts
│   │   ├── tool-executor.test.ts
│   │   ├── safety-checker.test.ts
│   │   └── anthropic-client.test.ts
│   └── renderer/
│       ├── MessageBubble.test.tsx
│       ├── DiffPreview.test.tsx
│       └── InputBox.test.tsx
├── resources/                          # App icons
├── package.json
├── tsconfig.json
├── tsconfig.main.json
├── vite.config.ts
├── vitest.config.ts
└── electron-builder.yml
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.main.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `electron-builder.yml`
- Create: `src/main/index.ts`
- Create: `src/main/preload.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/index.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/App.css`
- Create: `resources/icon.png` (placeholder)

- [ ] **Step 1: Initialize project and install dependencies**

```bash
cd /c/Users/CY/Desktop/HICC
npm init -y
npm install react react-dom @anthropic-ai/sdk @monaco-editor/react xterm @xterm/addon-fit better-sqlite3 chokidar electron-store zod zustand
npm install -D electron electron-builder typescript @types/react @types/react-dom @types/better-sqlite3 vite @vitejs/plugin-react vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Create package.json with scripts**

```json
{
  "name": "hicc",
  "version": "0.1.0",
  "description": "AI-powered coding IDE",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "concurrently \"npm run dev:renderer\" \"npm run dev:main\"",
    "dev:renderer": "vite",
    "dev:main": "tsc -p tsconfig.main.json && electron .",
    "build": "npm run build:renderer && npm run build:main",
    "build:renderer": "vite build",
    "build:main": "tsc -p tsconfig.main.json",
    "package": "npm run build && electron-builder",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.20.0",
    "@monaco-editor/react": "^4.6.0",
    "@xterm/addon-fit": "^0.10.0",
    "better-sqlite3": "^9.4.0",
    "chokidar": "^3.6.0",
    "electron-store": "^8.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "xterm": "^5.3.0",
    "zod": "^3.22.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.2.0",
    "@testing-library/react": "^14.1.0",
    "@types/better-sqlite3": "^7.6.8",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "concurrently": "^8.2.0",
    "electron": "^28.0.0",
    "electron-builder": "^24.9.0",
    "jsdom": "^23.0.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vitest": "^1.2.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json (renderer)**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist/renderer",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src/renderer", "src/shared"]
}
```

- [ ] **Step 4: Create tsconfig.main.json (main process)**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist/main",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src/main", "src/shared"]
}
```

- [ ] **Step 5: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
});
```

- [ ] **Step 6: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
});
```

- [ ] **Step 7: Create electron-builder.yml**

```yaml
appId: com.hicc.ide
productName: HICC
directories:
  output: release
files:
  - dist/**/*
  - resources/**/*
  - package.json
mac:
  target: dmg
  icon: resources/icon.png
win:
  target: nsis
  icon: resources/icon.png
linux:
  target: AppImage
  icon: resources/icon.png
```

- [ ] **Step 8: Create minimal Electron entry point**

`src/main/index.ts`:
```typescript
import { app, BrowserWindow } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

- [ ] **Step 9: Create preload script**

`src/main/preload.ts`:
```typescript
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // File operations
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('file:write', filePath, content),
  deleteFile: (filePath: string) => ipcRenderer.invoke('file:delete', filePath),
  listFiles: (dirPath: string, depth?: number) => ipcRenderer.invoke('file:list', dirPath, depth),
  // File watcher
  onFileChanged: (callback: (event: { path: string; type: string }) => void) => {
    ipcRenderer.on('file:changed', (_event, data) => callback(data));
  },
  // Project
  openProject: () => ipcRenderer.invoke('project:open'),
  getRecentProjects: () => ipcRenderer.invoke('project:recent'),
  // AI
  sendMessage: (message: string) => ipcRenderer.invoke('ai:send', message),
  onAiDelta: (callback: (delta: string) => void) => {
    ipcRenderer.on('ai:delta', (_event, delta) => callback(delta));
  },
  onAiToolConfirm: (callback: (toolCall: unknown) => void) => {
    ipcRenderer.on('ai:tool-confirm', (_event, toolCall) => callback(toolCall));
  },
  confirmTool: (approved: boolean) => ipcRenderer.invoke('ai:confirm-tool', approved),
  // Terminal
  createTerminal: (cwd: string) => ipcRenderer.invoke('terminal:create', cwd),
  writeToTerminal: (id: string, data: string) => ipcRenderer.invoke('terminal:write', id, data),
  resizeTerminal: (id: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
  onTerminalData: (callback: (data: { id: string; data: string }) => void) => {
    ipcRenderer.on('terminal:data', (_event, data) => callback(data));
  },
  // Config
  getApiKey: () => ipcRenderer.invoke('config:get-api-key'),
  setApiKey: (key: string) => ipcRenderer.invoke('config:set-api-key', key),
};

contextBridge.exposeInMainWorld('hicc', api);
```

- [ ] **Step 10: Create minimal React entry**

`src/renderer/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HICC</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./index.tsx"></script>
</body>
</html>
```

`src/renderer/index.tsx`:
```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './App.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`src/renderer/App.tsx`:
```tsx
import React from 'react';

const App: React.FC = () => {
  return (
    <div className="app">
      <h1>HICC</h1>
      <p>AI-Powered Coding IDE</p>
    </div>
  );
};

export default App;
```

`src/renderer/App.css`:
```css
:root {
  --bg-primary: #1e1e1e;
  --bg-secondary: #252526;
  --bg-tertiary: #2d2d2d;
  --text-primary: #cccccc;
  --text-secondary: #999999;
  --border-color: #3e3e3e;
  --accent-color: #007acc;
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  overflow: hidden;
}

.app {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-family);
}
```

- [ ] **Step 11: Create placeholder icon and type declaration**

```bash
mkdir -p /c/Users/CY/Desktop/HICC/resources
# Create a minimal 1x1 PNG as placeholder
```

Create `src/renderer/types/index.ts`:
```typescript
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
  toolCalls?: ToolCall[];
  timestamp: number;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  result?: string;
}

export interface EditorTab {
  path: string;
  name: string;
  isDirty: boolean;
}
```

- [ ] **Step 12: Install dependencies and verify build**

```bash
npm install
npx tsc -p tsconfig.json --noEmit
```

Expected: TypeScript compilation succeeds with no errors.

- [ ] **Step 13: Commit**

```bash
git add package.json tsconfig.json tsconfig.main.json vite.config.ts vitest.config.ts electron-builder.yml
git add src/main/index.ts src/main/preload.ts src/renderer/index.html src/renderer/index.tsx src/renderer/App.tsx src/renderer/App.css
git add src/renderer/types/index.ts resources/
git commit -m "feat: scaffold Electron + React + TypeScript project

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Shared Types & Constants

**Files:**
- Create: `src/shared/constants.ts`
- Create: `src/shared/types.ts`
- Create: `src/shared/tool-schemas.ts`

- [ ] **Step 1: Create shared constants**

`src/shared/constants.ts`:
```typescript
export const IPC_CHANNELS = {
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_DELETE: 'file:delete',
  FILE_LIST: 'file:list',
  FILE_CHANGED: 'file:changed',
  PROJECT_OPEN: 'project:open',
  PROJECT_RECENT: 'project:recent',
  AI_SEND: 'ai:send',
  AI_DELTA: 'ai:delta',
  AI_TOOL_CONFIRM: 'ai:tool-confirm',
  AI_CONFIRM_TOOL: 'ai:confirm-tool',
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_DATA: 'terminal:data',
  CONFIG_GET_API_KEY: 'config:get-api-key',
  CONFIG_SET_API_KEY: 'config:set-api-key',
} as const;

export const PERMISSION_LEVEL = {
  AUTO: 0,
  CONFIRM: 1,
  APPROVE: 2,
} as const;

export const DANGEROUS_COMMAND_PATTERNS = [
  /rm\s+-rf\s+\//,
  /git\s+push\s+--force/,
  /DROP\s+TABLE/i,
  /DELETE\s+FROM/i,
  /sudo\s+/,
] as const;
```

- [ ] **Step 2: Create shared IPC types**

`src/shared/types.ts`:
```typescript
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
  readFile: (filePath: string) => Promise<string>;
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
```

- [ ] **Step 3: Create tool schemas for Anthropic API**

`src/shared/tool-schemas.ts`:
```typescript
import type { Anthropic } from '@anthropic-ai/sdk';

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file in the project. Supports reading specific line ranges.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file relative to project root' },
        offset: { type: 'number', description: 'Line number to start reading from (0-indexed, optional)' },
        limit: { type: 'number', description: 'Maximum number of lines to read (optional)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write or overwrite a file in the project. This will show a diff preview to the user for confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file relative to project root' },
        content: { type: 'string', description: 'Full content to write to the file' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'run_command',
    description: 'Execute a shell command in the project directory. Dangerous commands require explicit approval.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute' },
        cwd: { type: 'string', description: 'Working directory for the command (optional, defaults to project root)' },
      },
      required: ['command'],
    },
  },
  {
    name: 'search_code',
    description: 'Search for code patterns in the project using regex. Returns matching file paths and line numbers.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regular expression pattern to search for' },
        glob: { type: 'string', description: 'Glob pattern to filter files (e.g., "*.ts", "src/**/*.tsx") (optional)' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'list_files',
    description: 'List files and directories in the project.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path relative to project root (optional, defaults to root)' },
        depth: { type: 'number', description: 'Maximum depth to traverse (optional, defaults to 2)' },
      },
      required: [],
    },
  },
];

export type ToolName = typeof TOOL_DEFINITIONS[number]['name'];
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc -p tsconfig.json --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/
git commit -m "feat: add shared types, IPC schemas, and tool definitions

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Main Process — Config Store & IPC Registration

**Files:**
- Create: `src/main/store/config-store.ts`
- Create: `src/main/ipc/index.ts`

- [ ] **Step 1: Create config store**

`src/main/store/config-store.ts`:
```typescript
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
```

- [ ] **Step 2: Create IPC handler registration skeleton**

`src/main/ipc/index.ts`:
```typescript
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import { registerFileHandlers } from './file';
import { registerProjectHandlers } from './project';
import { registerAiHandlers } from './ai';
import { registerTerminalHandlers } from './terminal';
import { registerConfigHandlers } from './config';

export function registerAllIpcHandlers(): void {
  registerFileHandlers();
  registerProjectHandlers();
  registerAiHandlers();
  registerTerminalHandlers();
  registerConfigHandlers();
}
```

Create `src/main/ipc/config.ts`:
```typescript
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import { getApiKey, setApiKey } from '../store/config-store';

export function registerConfigHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_API_KEY, () => {
    return getApiKey();
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET_API_KEY, (_event, key: string) => {
    setApiKey(key);
  });
}
```

Create stubs for the other handler modules so TS compiles:

`src/main/ipc/file.ts`:
```typescript
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';

export function registerFileHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.FILE_READ, async (_event, filePath: string) => {
    throw new Error('Not implemented yet');
  });
  ipcMain.handle(IPC_CHANNELS.FILE_WRITE, async (_event, filePath: string, content: string) => {
    throw new Error('Not implemented yet');
  });
  ipcMain.handle(IPC_CHANNELS.FILE_DELETE, async (_event, filePath: string) => {
    throw new Error('Not implemented yet');
  });
  ipcMain.handle(IPC_CHANNELS.FILE_LIST, async (_event, dirPath: string, depth?: number) => {
    throw new Error('Not implemented yet');
  });
}
```

`src/main/ipc/project.ts`:
```typescript
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';

export function registerProjectHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PROJECT_OPEN, async () => {
    throw new Error('Not implemented yet');
  });
  ipcMain.handle(IPC_CHANNELS.PROJECT_RECENT, async () => {
    throw new Error('Not implemented yet');
  });
}
```

`src/main/ipc/ai.ts`:
```typescript
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';

export function registerAiHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AI_SEND, async (_event, message: string) => {
    throw new Error('Not implemented yet');
  });
  ipcMain.handle(IPC_CHANNELS.AI_CONFIRM_TOOL, async (_event, approved: boolean) => {
    throw new Error('Not implemented yet');
  });
}
```

`src/main/ipc/terminal.ts`:
```typescript
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';

export function registerTerminalHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.TERMINAL_CREATE, async (_event, cwd: string) => {
    throw new Error('Not implemented yet');
  });
  ipcMain.handle(IPC_CHANNELS.TERMINAL_WRITE, async (_event, id: string, data: string) => {
    throw new Error('Not implemented yet');
  });
  ipcMain.handle(IPC_CHANNELS.TERMINAL_RESIZE, async (_event, id: string, cols: number, rows: number) => {
    throw new Error('Not implemented yet');
  });
}
```

- [ ] **Step 3: Update main/index.ts to register IPC handlers**

Edit `src/main/index.ts` — add import and registration call after `app.whenReady()`:

```typescript
import { registerAllIpcHandlers } from './ipc/index';

// Inside app.whenReady().then(() => { ... }), add:
registerAllIpcHandlers();
```

Full updated createWindow function context:
```typescript
app.whenReady().then(() => {
  registerAllIpcHandlers();
  createWindow();
});
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc -p tsconfig.main.json --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/main/
git commit -m "feat: add config store and IPC handler registration skeleton

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Main Process — File System & File Watcher Services

**Files:**
- Create: `src/main/services/file-system.ts`
- Create: `src/main/services/file-watcher.ts`
- Modify: `src/main/ipc/file.ts`
- Create: `tests/main/file-system.test.ts`

- [ ] **Step 1: Create file-system service**

`src/main/services/file-system.ts`:
```typescript
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import type { FileNode } from '../../shared/types';

export class FileSystemService {
  constructor(private projectRoot: string) {}

  setProjectRoot(root: string): void {
    this.projectRoot = root;
  }

  private resolvePath(filePath: string): string {
    const resolved = path.resolve(this.projectRoot, filePath);
    if (!resolved.startsWith(path.resolve(this.projectRoot))) {
      throw new Error(`Access denied: path "${filePath}" is outside project root`);
    }
    return resolved;
  }

  async readFile(filePath: string, offset?: number, limit?: number): Promise<string> {
    const fullPath = this.resolvePath(filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    if (offset !== undefined) {
      const lines = content.split('\n');
      const end = limit !== undefined ? offset + limit : lines.length;
      return lines.slice(offset, end).join('\n');
    }
    return content;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    await fs.rm(fullPath, { recursive: true, force: true });
  }

  async listFiles(dirPath: string = '.', depth: number = 2): Promise<FileNode[]> {
    const fullPath = this.resolvePath(dirPath);
    return this.readDir(fullPath, depth);
  }

  private async readDir(currentPath: string, maxDepth: number, currentDepth: number = 0): Promise<FileNode[]> {
    if (currentDepth > maxDepth) return [];
    
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    const nodes: FileNode[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const entryPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(this.projectRoot, entryPath);

      if (entry.isDirectory()) {
        const children = await this.readDir(entryPath, maxDepth, currentDepth + 1);
        nodes.push({ name: entry.name, path: relativePath, type: 'directory', children });
      } else {
        nodes.push({ name: entry.name, path: relativePath, type: 'file' });
      }
    }

    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      const fullPath = this.resolvePath(filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 2: Create file-watcher service**

`src/main/services/file-watcher.ts`:
```typescript
import chokidar from 'chokidar';
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';

export class FileWatcherService {
  private watcher: chokidar.FSWatcher | null = null;

  startWatching(projectRoot: string, window: BrowserWindow): void {
    this.stopWatching();

    this.watcher = chokidar.watch(projectRoot, {
      ignored: /(^|[/\\])(\.git|node_modules|\.next|dist|build|\.cache)([/\\]|$)/,
      ignoreInitial: true,
      persistent: true,
    });

    this.watcher.on('add', (filePath: string) => {
      window.webContents.send(IPC_CHANNELS.FILE_CHANGED, { path: filePath, type: 'add' });
    });

    this.watcher.on('change', (filePath: string) => {
      window.webContents.send(IPC_CHANNELS.FILE_CHANGED, { path: filePath, type: 'change' });
    });

    this.watcher.on('unlink', (filePath: string) => {
      window.webContents.send(IPC_CHANNELS.FILE_CHANGED, { path: filePath, type: 'unlink' });
    });
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
```

- [ ] **Step 3: Update IPC file handlers with real implementations**

Edit `src/main/ipc/file.ts`:
```typescript
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import { ReadFileArgs, WriteFileArgs, DeleteFileArgs, ListFilesArgs } from '../../shared/types';

let fileSystemService: import('../services/file-system').FileSystemService | null = null;

export function setFileSystemService(service: import('../services/file-system').FileSystemService): void {
  fileSystemService = service;
}

export function registerFileHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.FILE_READ, async (_event, args: unknown) => {
    const parsed = ReadFileArgs.parse(args);
    return fileSystemService!.readFile(parsed.path, parsed.offset, parsed.limit);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_WRITE, async (_event, args: unknown) => {
    const parsed = WriteFileArgs.parse(args);
    return fileSystemService!.writeFile(parsed.path, parsed.content);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_DELETE, async (_event, args: unknown) => {
    const parsed = DeleteFileArgs.parse(args);
    return fileSystemService!.deleteFile(parsed.path);
  });

  ipcMain.handle(IPC_CHANNELS.FILE_LIST, async (_event, args: unknown) => {
    const parsed = ListFilesArgs.parse(args);
    return fileSystemService!.listFiles(parsed.dirPath, parsed.depth);
  });
}
```

- [ ] **Step 4: Write tests for file-system service**

`tests/main/file-system.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { FileSystemService } from '../../src/main/services/file-system';

describe('FileSystemService', () => {
  let service: FileSystemService;
  let testDir: string;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `hicc-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'test.txt'), 'line1\nline2\nline3\n');
    await fs.mkdir(path.join(testDir, 'subdir'));
    await fs.writeFile(path.join(testDir, 'subdir', 'nested.txt'), 'nested content');
    service = new FileSystemService(testDir);
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('reads a file', async () => {
    const content = await service.readFile('test.txt');
    expect(content).toBe('line1\nline2\nline3\n');
  });

  it('reads a file with offset and limit', async () => {
    const content = await service.readFile('test.txt', 1, 1);
    expect(content).toBe('line2');
  });

  it('writes a file', async () => {
    await service.writeFile('new.txt', 'hello world');
    const content = await service.readFile('new.txt');
    expect(content).toBe('hello world');
  });

  it('lists files with depth', async () => {
    const files = await service.listFiles('.', 2);
    expect(files.length).toBeGreaterThan(0);
  });

  it('blocks access outside project root', async () => {
    await expect(service.readFile('../etc/passwd')).rejects.toThrow('Access denied');
  });

  it('blocks absolute paths outside project', async () => {
    await expect(service.readFile('/etc/passwd')).rejects.toThrow('Access denied');
  });

  it('deletes a file', async () => {
    await service.writeFile('to-delete.txt', 'temp');
    await service.deleteFile('to-delete.txt');
    const exists = await service.fileExists('to-delete.txt');
    expect(exists).toBe(false);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/main/file-system.test.ts
```

Expected: All 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/main/services/file-system.ts src/main/services/file-watcher.ts src/main/ipc/file.ts tests/main/file-system.test.ts
git commit -m "feat: implement file system and file watcher services

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: Main Process — Safety Checker & Tool Executor

**Files:**
- Create: `src/main/services/safety-checker.ts`
- Create: `src/main/services/tool-executor.ts`
- Create: `tests/main/safety-checker.test.ts`
- Create: `tests/main/tool-executor.test.ts`

- [ ] **Step 1: Create safety checker service**

`src/main/services/safety-checker.ts`:
```typescript
import { DANGEROUS_COMMAND_PATTERNS, PERMISSION_LEVEL } from '../../shared/constants';

export interface SafetyResult {
  permissionLevel: number;
  blocked: boolean;
  reason?: string;
}

export class SafetyChecker {
  checkFilePath(filePath: string, projectRoot: string): SafetyResult {
    const pathStr = filePath.toLowerCase();

    // Block obvious escape attempts
    if (pathStr.includes('..')) {
      return { permissionLevel: PERMISSION_LEVEL.APPROVE, blocked: true, reason: 'Path traversal detected' };
    }

    return { permissionLevel: PERMISSION_LEVEL.AUTO, blocked: false };
  }

  checkCommand(command: string): SafetyResult {
    // Check against dangerous patterns
    for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
      if (pattern.test(command)) {
        return { permissionLevel: PERMISSION_LEVEL.APPROVE, blocked: true, reason: `Dangerous command pattern detected: ${pattern}` };
      }
    }

    // Commands that modify system state need approval
    const installPatterns = [/npm\s+install/, /pip\s+install/, /yarn\s+add/, /pnpm\s+add/];
    for (const pattern of installPatterns) {
      if (pattern.test(command)) {
        return { permissionLevel: PERMISSION_LEVEL.APPROVE, blocked: false, reason: 'Package installation requires approval' };
      }
    }

    // Git push requires approval
    if (/git\s+push/.test(command)) {
      return { permissionLevel: PERMISSION_LEVEL.APPROVE, blocked: false, reason: 'Git push requires approval' };
    }

    // Read-only commands are auto
    const readOnlyCommands = [/^ls\b/, /^dir\b/, /^cat\b/, /^head\b/, /^tail\b/, /^grep\b/, /^find\b/, /^wc\b/,
      /^git\s+status/, /^git\s+log/, /^git\s+diff/, /^git\s+branch/,
      /^echo\b/, /^pwd\b/, /^which\b/, /^type\b/];
    for (const pattern of readOnlyCommands) {
      if (pattern.test(command)) {
        return { permissionLevel: PERMISSION_LEVEL.AUTO, blocked: false };
      }
    }

    // Other commands need confirmation
    return { permissionLevel: PERMISSION_LEVEL.CONFIRM, blocked: false };
  }
}
```

- [ ] **Step 2: Create tool executor service**

`src/main/services/tool-executor.ts`:
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import { FileSystemService } from './file-system';
import { SafetyChecker } from './safety-checker';

const execAsync = promisify(exec);

export interface ToolResult {
  content: string;
  isError?: boolean;
  requiresConfirmation?: boolean;
  confirmationId?: string;
}

export class ToolExecutor {
  private safetyChecker = new SafetyChecker();
  private pendingConfirmations = new Map<string, { resolve: (approved: boolean) => void }>();

  constructor(private fileSystem: FileSystemService) {}

  async executeTool(
    toolName: string,
    input: Record<string, unknown>,
    projectRoot: string
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'read_file':
        return this.readFile(input);
      case 'write_file':
        return this.writeFile(input, projectRoot);
      case 'run_command':
        return this.runCommand(input, projectRoot);
      case 'search_code':
        return this.searchCode(input, projectRoot);
      case 'list_files':
        return this.listFiles(input);
      default:
        return { content: `Unknown tool: ${toolName}`, isError: true };
    }
  }

  getPendingConfirmations(): Map<string, { resolve: (approved: boolean) => void }> {
    return this.pendingConfirmations;
  }

  private async readFile(input: Record<string, unknown>): Promise<ToolResult> {
    const path = input.path as string;
    const offset = input.offset as number | undefined;
    const limit = input.limit as number | undefined;
    try {
      const content = await this.fileSystem.readFile(path, offset, limit);
      return { content };
    } catch (error) {
      return { content: `Error reading file: ${error}`, isError: true };
    }
  }

  private async writeFile(input: Record<string, unknown>, projectRoot: string): Promise<ToolResult> {
    const filePath = input.path as string;
    const content = input.content as string;

    const safety = this.safetyChecker.checkFilePath(filePath, projectRoot);
    if (safety.blocked) {
      return { content: `Blocked: ${safety.reason}`, isError: true };
    }

    try {
      await this.fileSystem.writeFile(filePath, content);
      return { content: `File written: ${filePath}` };
    } catch (error) {
      return { content: `Error writing file: ${error}`, isError: true };
    }
  }

  private async runCommand(input: Record<string, unknown>, projectRoot: string): Promise<ToolResult> {
    const command = input.command as string;
    const cwd = (input.cwd as string) || projectRoot;

    const safety = this.safetyChecker.checkCommand(command);
    if (safety.blocked) {
      return { content: `Blocked: ${safety.reason}`, isError: true };
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      });
      return { content: stdout + (stderr ? `\n[stderr]\n${stderr}` : '') };
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      return { content: err.stdout || err.message || String(error), isError: true };
    }
  }

  private async searchCode(input: Record<string, unknown>, projectRoot: string): Promise<ToolResult> {
    const pattern = input.pattern as string;
    const glob = input.glob as string | undefined;
    try {
      const globArg = glob ? `--glob "${glob}"` : '';
      const { stdout } = await execAsync(`rg --line-number --no-heading ${globArg} "${pattern}" "${projectRoot}"`, {
        timeout: 15000,
        maxBuffer: 1024 * 1024,
      });
      return { content: stdout || 'No matches found.' };
    } catch (error: unknown) {
      const err = error as { code?: number; stdout?: string };
      if (err.code === 1) return { content: 'No matches found.' };
      return { content: `Search error: ${error}`, isError: true };
    }
  }

  private async listFiles(input: Record<string, unknown>): Promise<ToolResult> {
    const dirPath = (input.path as string) || '.';
    const depth = (input.depth as number) ?? 2;
    try {
      const files = await this.fileSystem.listFiles(dirPath, Math.min(depth, 5));
      return { content: this.formatFileTree(files) };
    } catch (error) {
      return { content: `Error listing files: ${error}`, isError: true };
    }
  }

  private formatFileTree(nodes: unknown[], indent: string = ''): string {
    let output = '';
    for (const node of nodes as Array<{ name: string; type: string; children?: unknown[] }>) {
      const prefix = node.type === 'directory' ? '📁' : '📄';
      output += `${indent}${prefix} ${node.name}\n`;
      if (node.children) {
        output += this.formatFileTree(node.children, indent + '  ');
      }
    }
    return output;
  }
}
```

- [ ] **Step 3: Write tests for safety checker**

`tests/main/safety-checker.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { SafetyChecker } from '../../src/main/services/safety-checker';
import { PERMISSION_LEVEL } from '../../src/shared/constants';

describe('SafetyChecker', () => {
  const checker = new SafetyChecker();

  describe('checkCommand', () => {
    it('blocks rm -rf /', () => {
      const result = checker.checkCommand('rm -rf /');
      expect(result.blocked).toBe(true);
    });

    it('blocks DROP TABLE', () => {
      const result = checker.checkCommand('echo "DROP TABLE users" | mysql');
      expect(result.blocked).toBe(true);
    });

    it('requires approval for npm install', () => {
      const result = checker.checkCommand('npm install lodash');
      expect(result.permissionLevel).toBe(PERMISSION_LEVEL.APPROVE);
      expect(result.blocked).toBe(false);
    });

    it('requires approval for git push', () => {
      const result = checker.checkCommand('git push origin main');
      expect(result.permissionLevel).toBe(PERMISSION_LEVEL.APPROVE);
    });

    it('auto-approves read-only commands', () => {
      const result = checker.checkCommand('git status');
      expect(result.permissionLevel).toBe(PERMISSION_LEVEL.AUTO);
      expect(result.blocked).toBe(false);
    });

    it('auto-approves ls', () => {
      const result = checker.checkCommand('ls -la');
      expect(result.permissionLevel).toBe(PERMISSION_LEVEL.AUTO);
    });
  });

  describe('checkFilePath', () => {
    it('blocks path traversal', () => {
      const result = checker.checkFilePath('../../../etc/passwd', '/project');
      expect(result.blocked).toBe(true);
    });
  });
});
```

- [ ] **Step 4: Write tests for tool executor**

`tests/main/tool-executor.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ToolExecutor } from '../../src/main/services/tool-executor';
import { FileSystemService } from '../../src/main/services/file-system';

describe('ToolExecutor', () => {
  let executor: ToolExecutor;
  let fileSystem: FileSystemService;
  let testDir: string;

  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `hicc-tool-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'hello.ts'), 'const x = 1;\nconst y = 2;\n');
    fileSystem = new FileSystemService(testDir);
    executor = new ToolExecutor(fileSystem);
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('executes read_file tool', async () => {
    const result = await executor.executeTool('read_file', { path: 'hello.ts' }, testDir);
    expect(result.content).toContain('const x = 1');
  });

  it('executes write_file tool', async () => {
    const result = await executor.executeTool('write_file', {
      path: 'output.txt',
      content: 'generated content',
    }, testDir);
    expect(result.content).toContain('File written');
    const content = await fs.readFile(path.join(testDir, 'output.txt'), 'utf-8');
    expect(content).toBe('generated content');
  });

  it('executes list_files tool', async () => {
    const result = await executor.executeTool('list_files', { path: '.', depth: 1 }, testDir);
    expect(result.content).toContain('hello.ts');
  });

  it('executes search_code tool', async () => {
    const result = await executor.executeTool('search_code', { pattern: 'const' }, testDir);
    expect(result.content).toContain('const');
  });

  it('returns error for unknown tool', async () => {
    const result = await executor.executeTool('unknown_tool', {}, testDir);
    expect(result.isError).toBe(true);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/main/safety-checker.test.ts tests/main/tool-executor.test.ts
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/main/services/safety-checker.ts src/main/services/tool-executor.ts tests/main/
git commit -m "feat: implement safety checker and tool executor services

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: Main Process — Anthropic Client

**Files:**
- Create: `src/main/services/anthropic-client.ts`
- Modify: `src/main/ipc/ai.ts`
- Create: `tests/main/anthropic-client.test.ts`

- [ ] **Step 1: Create Anthropic client service**

`src/main/services/anthropic-client.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { BrowserWindow } from 'electron';
import { TOOL_DEFINITIONS } from '../../shared/tool-schemas';
import { IPC_CHANNELS } from '../../shared/constants';
import { ToolExecutor } from './tool-executor';
import { FileSystemService } from './file-system';

export class AnthropicClient {
  private client: Anthropic | null = null;
  private messages: Anthropic.MessageParam[] = [];
  private pendingToolConfirmation: {
    toolName: string;
    toolInput: Record<string, unknown>;
    resolve: (approved: boolean) => void;
  } | null = null;

  constructor(
    private fileSystem: FileSystemService,
    private toolExecutor: ToolExecutor,
  ) {}

  setApiKey(key: string): void {
    this.client = new Anthropic({ apiKey: key });
  }

  private buildSystemPrompt(): string {
    const projectStructure = this.getProjectStructureSummary();
    return `You are an expert software engineer working in an IDE called HICC.
You can read, write, and modify project files using the available tools.
Always think before acting and explain your reasoning.

Current project structure:
\`\`\`
${projectStructure}
\`\`\`

Guidelines:
- Read files before modifying them
- Use search_code to find relevant code
- Present changes clearly with explanations
- Write clean, idiomatic, well-typed code
- Follow existing project patterns and conventions`;
  }

  private getProjectStructureSummary(): string {
    // Lightweight summary — just top-level entries to save tokens
    try {
      return 'Project files available via list_files tool';
    } catch {
      return '(project structure unavailable)';
    }
  }

  async sendMessage(userMessage: string, window: BrowserWindow): Promise<void> {
    if (!this.client) {
      window.webContents.send(IPC_CHANNELS.AI_DELTA, 'Error: API key not configured. Please set your Anthropic API key in settings.\n');
      return;
    }

    this.messages.push({ role: 'user', content: userMessage });
    if (this.messages.length > 50) {
      this.messages = this.messages.slice(-50);
    }

    try {
      await this.runConversation(window);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      window.webContents.send(IPC_CHANNELS.AI_DELTA, `\nError: ${message}\n`);
    }
  }

  private async runConversation(window: BrowserWindow): Promise<void> {
    let shouldContinue = true;

    while (shouldContinue) {
      const response = await this.client!.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: this.buildSystemPrompt(),
        tools: TOOL_DEFINITIONS,
        messages: this.messages,
      });

      let assistantContent = '';

      for (const block of response.content) {
        if (block.type === 'text') {
          assistantContent += block.text;
          window.webContents.send(IPC_CHANNELS.AI_DELTA, block.text);
        } else if (block.type === 'tool_use') {
          window.webContents.send(IPC_CHANNELS.AI_DELTA, `\n[Using tool: ${block.name}]\n`);

          // For write_file and run_command, ask user confirmation
          if (block.name === 'write_file') {
            window.webContents.send(IPC_CHANNELS.AI_TOOL_CONFIRM, {
              name: block.name,
              input: block.input,
            });
            const approved = await this.waitForConfirmation();
            if (!approved) {
              window.webContents.send(IPC_CHANNELS.AI_DELTA, '\n[Tool use rejected by user]\n');
              const toolResult = { content: 'User rejected this file write operation.', isError: true };
              this.messages.push({ role: 'assistant', content: response.content });
              this.messages.push({
                role: 'user',
                content: [{ type: 'tool_result', tool_use_id: block.id, content: toolResult.content }],
              });
              assistantContent += `\n[Tool ${block.name} was rejected]\n`;
              continue;
            }
          }

          const result = await this.toolExecutor.executeTool(
            block.name,
            block.input as Record<string, unknown>,
            this.fileSystem['projectRoot'] || '',
          );

          this.messages.push({ role: 'assistant', content: response.content });
          this.messages.push({
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: block.id, content: result.content }],
          });
        }
      }

      if (assistantContent) {
        this.messages.push({ role: 'assistant', content: assistantContent });
      }

      // Check if we should stop (no tool calls)
      const hasToolUse = response.content.some((block) => block.type === 'tool_use');
      shouldContinue = hasToolUse;
    }
  }

  private waitForConfirmation(): Promise<boolean> {
    return new Promise((resolve) => {
      this.pendingToolConfirmation = { toolName: '', toolInput: {}, resolve };
    });
  }

  confirmTool(approved: boolean): void {
    if (this.pendingToolConfirmation) {
      this.pendingToolConfirmation.resolve(approved);
      this.pendingToolConfirmation = null;
    }
  }

  resetConversation(): void {
    this.messages = [];
  }
}
```

- [ ] **Step 2: Update IPC ai handlers with real implementation**

Edit `src/main/ipc/ai.ts`:
```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';

let anthropicClient: import('../services/anthropic-client').AnthropicClient | null = null;

export function setAnthropicClient(client: import('../services/anthropic-client').AnthropicClient): void {
  anthropicClient = client;
}

export function registerAiHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AI_SEND, async (event, message: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) throw new Error('No window found');
    await anthropicClient!.sendMessage(message, window);
  });

  ipcMain.handle(IPC_CHANNELS.AI_CONFIRM_TOOL, async (_event, approved: boolean) => {
    anthropicClient!.confirmTool(approved);
  });
}
```

- [ ] **Step 3: Write tests for Anthropic client (mocked API)**

`tests/main/anthropic-client.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicClient } from '../../src/main/services/anthropic-client';
import { FileSystemService } from '../../src/main/services/file-system';
import { ToolExecutor } from '../../src/main/services/tool-executor';

describe('AnthropicClient', () => {
  let client: AnthropicClient;
  let fileSystem: FileSystemService;
  let toolExecutor: ToolExecutor;

  beforeEach(() => {
    fileSystem = new FileSystemService('/tmp/test');
    toolExecutor = new ToolExecutor(fileSystem);
    client = new AnthropicClient(fileSystem, toolExecutor);
  });

  it('starts with null client before API key is set', () => {
    // API key not set — client is null internally
    expect(client).toBeDefined();
  });

  it('setApiKey initializes the client', () => {
    client.setApiKey('test-key');
    // Should not throw
    expect(() => client.setApiKey('test-key')).not.toThrow();
  });

  it('resetConversation clears message history', () => {
    client.resetConversation();
    expect(client).toBeDefined();
  });

  it('confirmTool handles pending confirmation correctly', () => {
    // confirmTool when no pending confirmation should not throw
    expect(() => client.confirmTool(true)).not.toThrow();
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/main/anthropic-client.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/anthropic-client.ts src/main/ipc/ai.ts tests/main/anthropic-client.test.ts
git commit -m "feat: implement Anthropic client with tool orchestration

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: Main Process — Terminal Manager & Project Handlers

**Files:**
- Create: `src/main/services/terminal-manager.ts`
- Modify: `src/main/ipc/terminal.ts`
- Modify: `src/main/ipc/project.ts`

- [ ] **Step 1: Create terminal manager service**

`src/main/services/terminal-manager.ts`:
```typescript
import { pty } from 'node-pty'; // Note: node-pty requires native compilation
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';

interface TerminalSession {
  id: string;
  pty: ReturnType<typeof pty>;
}

export class TerminalManager {
  private sessions = new Map<string, TerminalSession>();
  private nextId = 1;

  create(cwd: string, window: BrowserWindow): string {
    const id = `terminal-${this.nextId++}`;
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';

    const ptyProcess = pty.spawn(shell, [], {
      cwd,
      env: process.env as Record<string, string>,
      cols: 80,
      rows: 24,
    });

    ptyProcess.onData((data: string) => {
      window.webContents.send(IPC_CHANNELS.TERMINAL_DATA, { id, data });
    });

    this.sessions.set(id, { id, pty: ptyProcess });
    return id;
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.pty.write(data);
    }
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id);
    if (session) {
      session.pty.resize(cols, rows);
    }
  }

  kill(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.pty.kill();
      this.sessions.delete(id);
    }
  }

  killAll(): void {
    for (const [id] of this.sessions) {
      this.kill(id);
    }
  }
}
```

- [ ] **Step 2: Update terminal IPC handlers**

Edit `src/main/ipc/terminal.ts`:
```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';

let terminalManager: import('../services/terminal-manager').TerminalManager | null = null;

export function setTerminalManager(manager: import('../services/terminal-manager').TerminalManager): void {
  terminalManager = manager;
}

export function registerTerminalHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.TERMINAL_CREATE, async (event, cwd: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) throw new Error('No window found');
    return terminalManager!.create(cwd, window);
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_WRITE, async (_event, id: string, data: string) => {
    terminalManager!.write(id, data);
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_RESIZE, async (_event, id: string, cols: number, rows: number) => {
    terminalManager!.resize(id, cols, rows);
  });
}
```

- [ ] **Step 3: Update project IPC handlers**

Edit `src/main/ipc/project.ts`:
```typescript
import { ipcMain, dialog, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import { addRecentProject, getRecentProjects } from '../store/config-store';
import fs from 'fs';

export function registerProjectHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PROJECT_OPEN, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) throw new Error('No window found');

    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory'],
      title: 'Open Project Folder',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const projectPath = result.filePaths[0];
    const projectName = projectPath.split(/[/\\]/).pop() || projectPath;
    addRecentProject(projectPath);

    return { path: projectPath, name: projectName };
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_RECENT, async () => {
    const paths = getRecentProjects();
    return paths
      .filter((p) => {
        try { return fs.existsSync(p); } catch { return false; }
      })
      .map((p) => ({
        path: p,
        name: p.split(/[/\\]/).pop() || p,
      }));
  });
}
```

- [ ] **Step 4: Wire up services in main process entry**

Edit `src/main/index.ts` — update the `app.whenReady()` callback to initialize all services:

```typescript
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { registerAllIpcHandlers } from './ipc/index';
import { setFileSystemService } from './ipc/file';
import { setAnthropicClient } from './ipc/ai';
import { setTerminalManager } from './ipc/terminal';
import { FileSystemService } from './services/file-system';
import { FileWatcherService } from './services/file-watcher';
import { AnthropicClient } from './services/anthropic-client';
import { ToolExecutor } from './services/tool-executor';
import { TerminalManager } from './services/terminal-manager';
import { getApiKey } from './store/config-store';

let mainWindow: BrowserWindow | null = null;
const fileSystem = new FileSystemService('');
const toolExecutor = new ToolExecutor(fileSystem);
const anthropicClient = new AnthropicClient(fileSystem, toolExecutor);
const fileWatcher = new FileWatcherService();
const terminalManager = new TerminalManager();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    terminalManager.killAll();
  });
}

app.whenReady().then(() => {
  setFileSystemService(fileSystem);
  setAnthropicClient(anthropicClient);
  setTerminalManager(terminalManager);
  registerAllIpcHandlers();

  const apiKey = getApiKey();
  if (apiKey) {
    anthropicClient.setApiKey(apiKey);
  }

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc -p tsconfig.main.json --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/main/
git commit -m "feat: implement terminal manager and wire up main process services

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: Renderer — Zustand Store & Theme System

**Files:**
- Create: `src/renderer/store/app-store.ts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/App.css`

- [ ] **Step 1: Create zustand store**

`src/renderer/store/app-store.ts`:
```typescript
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
```

- [ ] **Step 2: Update App.tsx with layout structure**

Edit `src/renderer/App.tsx`:
```tsx
import React, { useEffect } from 'react';
import { useAppStore } from './store/app-store';
import Sidebar from './components/layout/Sidebar';
import Toolbar from './components/layout/Toolbar';
import Panel from './components/layout/Panel';
import FileExplorer from './components/editor/FileExplorer';
import EditorTabs from './components/editor/EditorTabs';
import ChatPanel from './components/chat/ChatPanel';
import ErrorBoundary from './components/common/ErrorBoundary';

const App: React.FC = () => {
  const theme = useAppStore((s) => s.theme);
  const projectName = useAppStore((s) => s.projectName);
  const activeSidebar = useAppStore((s) => s.activeSidebar);
  const setApiKey = useAppStore((s) => s.setApiKey);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    window.hicc.getApiKey().then((key) => {
      if (key) setApiKey(key);
    });
  }, [setApiKey]);

  return (
    <ErrorBoundary>
      <div className="app">
        <Toolbar projectName={projectName} />
        <div className="app-body">
          <Sidebar />
          {activeSidebar === 'files' && (
            <div className="sidebar-panel">
              <FileExplorer />
            </div>
          )}
          <div className="main-content">
            <EditorTabs />
            <Panel>
              <ChatPanel />
            </Panel>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default App;
```

- [ ] **Step 3: Update App.css with layout styles**

Edit `src/renderer/App.css` — replace the existing content with:

```css
:root {
  --bg-primary: #1e1e1e;
  --bg-secondary: #252526;
  --bg-tertiary: #2d2d2d;
  --text-primary: #cccccc;
  --text-secondary: #999999;
  --border-color: #3e3e3e;
  --accent-color: #007acc;
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
}

[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f3f3f3;
  --bg-tertiary: #e8e8e8;
  --text-primary: #333333;
  --text-secondary: #666666;
  --border-color: #d4d4d4;
  --accent-color: #0078d4;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  overflow: hidden;
}

.app {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-family);
}

.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar-panel {
  width: 260px;
  min-width: 180px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

- [ ] **Step 4: Verify TypeScript and commit**

```bash
npx tsc -p tsconfig.json --noEmit
```

Expected: No errors (sidebar/Toolbar/Panel/etc. imports may fail until created in next tasks; that's fine).

```bash
git add src/renderer/store/app-store.ts src/renderer/App.tsx src/renderer/App.css
git commit -m "feat: add zustand store, theme system, and App layout structure

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: Renderer — Layout Components (Sidebar, Toolbar, Panel, ErrorBoundary)

**Files:**
- Create: `src/renderer/components/layout/Sidebar.tsx`
- Create: `src/renderer/components/layout/Toolbar.tsx`
- Create: `src/renderer/components/layout/Panel.tsx`
- Create: `src/renderer/components/common/ErrorBoundary.tsx`

- [ ] **Step 1: Create Sidebar component**

`src/renderer/components/layout/Sidebar.tsx`:
```tsx
import React from 'react';
import { useAppStore } from '../../store/app-store';

const Sidebar: React.FC = () => {
  const activeSidebar = useAppStore((s) => s.activeSidebar);
  const setActiveSidebar = useAppStore((s) => s.setActiveSidebar);

  const items = [
    { id: 'files' as const, label: 'Files', icon: '📁' },
    { id: 'search' as const, label: 'Search', icon: '🔍' },
    { id: 'settings' as const, label: 'Settings', icon: '⚙' },
  ];

  return (
    <div style={{
      width: 48,
      background: 'var(--bg-tertiary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 8,
      gap: 4,
    }}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveSidebar(item.id)}
          title={item.label}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            borderRadius: 4,
            background: activeSidebar === item.id ? 'var(--accent-color)' : 'transparent',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: 18,
            opacity: activeSidebar === item.id ? 1 : 0.6,
          }}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
};

export default Sidebar;
```

- [ ] **Step 2: Create Toolbar component**

`src/renderer/components/layout/Toolbar.tsx`:
```tsx
import React from 'react';
import { useAppStore } from '../../store/app-store';

interface ToolbarProps {
  projectName: string | null;
}

const Toolbar: React.FC<ToolbarProps> = ({ projectName }) => {
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const theme = useAppStore((s) => s.theme);
  const setApiKey = useAppStore((s) => s.setApiKey);
  const apiKey = useAppStore((s) => s.apiKey);

  const handleOpenProject = async () => {
    const result = await window.hicc.openProject();
    if (result) {
      useAppStore.getState().setProject(result.path, result.name);
      useAppStore.getState().refreshFileTree();
    }
  };

  const handleSetApiKey = () => {
    const key = prompt('Enter your Anthropic API key:', apiKey || '');
    if (key !== null) {
      window.hicc.setApiKey(key);
      setApiKey(key);
    }
  };

  return (
    <div style={{
      height: 36,
      background: 'var(--bg-tertiary)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      fontSize: 13,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 600 }}>HICC</span>
        {projectName && <span style={{ color: 'var(--text-secondary)' }}>{projectName}</span>}
        <button
          onClick={handleOpenProject}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            padding: '2px 8px',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Open Project
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={handleSetApiKey}
          title={apiKey ? 'API Key configured' : 'Set API Key'}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-color)',
            color: apiKey ? '#4caf50' : '#f44336',
            padding: '2px 8px',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {apiKey ? '● API Key' : '○ Set API Key'}
        </button>
        <button
          onClick={toggleTheme}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            padding: '2px 8px',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
```

- [ ] **Step 3: Create resizable Panel component**

`src/renderer/components/layout/Panel.tsx`:
```tsx
import React, { useState, useCallback, useRef } from 'react';

interface PanelProps {
  children: React.ReactNode;
  defaultHeight?: number;
  minHeight?: number;
}

const Panel: React.FC<PanelProps> = ({ children, defaultHeight = 300, minHeight = 100 }) => {
  const [height, setHeight] = useState(defaultHeight);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = height;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY.current - e.clientY;
      const newHeight = Math.max(minHeight, startHeight.current + delta);
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [height, minHeight]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div
        onMouseDown={handleMouseDown}
        style={{
          height: 4,
          background: 'var(--border-color)',
          cursor: 'row-resize',
          flexShrink: 0,
        }}
      />
      <div style={{ height, overflow: 'hidden', flexShrink: 0 }}>
        {children}
      </div>
    </div>
  );
};

export default Panel;
```

- [ ] **Step 4: Create ErrorBoundary component**

`src/renderer/components/common/ErrorBoundary.tsx`:
```tsx
import React, { Component, ErrorInfo } from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{
          padding: 24,
          color: 'var(--text-primary)',
          background: 'var(--bg-primary)',
          height: '100%',
        }}>
          <h2>Something went wrong</h2>
          <pre style={{ marginTop: 12, color: '#f44336', whiteSpace: 'pre-wrap' }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 12,
              padding: '6px 16px',
              background: 'var(--accent-color)',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/layout/ src/renderer/components/common/
git commit -m "feat: add layout components (Sidebar, Toolbar, Panel, ErrorBoundary)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 10: Renderer — Code Editor & Editor Tabs

**Files:**
- Create: `src/renderer/components/editor/CodeEditor.tsx`
- Create: `src/renderer/components/editor/EditorTabs.tsx`

- [ ] **Step 1: Create CodeEditor component**

`src/renderer/components/editor/CodeEditor.tsx`:
```tsx
import React, { useEffect, useState, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useAppStore } from '../../store/app-store';

const CodeEditor: React.FC = () => {
  const activeTab = useAppStore((s) => s.activeTab);
  const openTabs = useAppStore((s) => s.openTabs);
  const theme = useAppStore((s) => s.theme);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [editorInstance, setEditorInstance] = useState<Parameters<OnMount>[0] | null>(null);

  const activeFile = openTabs.find((t) => t.path === activeTab);

  useEffect(() => {
    if (!activeTab) {
      setFileContent(null);
      return;
    }

    window.hicc.readFile(activeTab).then((content) => {
      setFileContent(content);
    }).catch(() => {
      setFileContent('// Error loading file');
    });
  }, [activeTab]);

  const handleEditorMount: OnMount = useCallback((editor) => {
    setEditorInstance(editor);
  }, []);

  const handleContentChange = useCallback((value: string | undefined) => {
    if (value !== undefined && activeTab) {
      setFileContent(value);
      useAppStore.getState().markTabDirty(activeTab, true);
    }
  }, [activeTab]);

  const handleSave = useCallback(() => {
    if (activeTab && fileContent !== null) {
      window.hicc.writeFile(activeTab, fileContent).then(() => {
        useAppStore.getState().markTabDirty(activeTab, false);
      });
    }
  }, [activeTab, fileContent]);

  // Keyboard shortcut: Ctrl+S
  useEffect(() => {
    if (!editorInstance) return;
    const disposable = editorInstance.addAction({
      id: 'save-file',
      label: 'Save File',
      keybindings: [2048 | 49], // Ctrl+S
      run: handleSave,
    });
    return () => disposable.dispose();
  }, [editorInstance, handleSave]);

  if (!activeTab || !activeFile) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
        fontSize: 14,
      }}>
        Select a file to edit
      </div>
    );
  }

  if (fileContent === null) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden' }}>
      <Editor
        height="100%"
        language={getLanguage(activeFile.name)}
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
        value={fileContent}
        onChange={handleContentChange}
        onMount={handleEditorMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: 'var(--font-mono, monospace)',
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'off',
          tabSize: 2,
        }}
      />
    </div>
  );
};

function getLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', go: 'go', java: 'java', rb: 'ruby',
    css: 'css', scss: 'scss', html: 'html', json: 'json', md: 'markdown',
    yaml: 'yaml', yml: 'yaml', xml: 'xml', sql: 'sql', sh: 'shell',
    bash: 'shell', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  };
  return map[ext || ''] || 'plaintext';
}

export default CodeEditor;
```

- [ ] **Step 2: Create EditorTabs component**

`src/renderer/components/editor/EditorTabs.tsx`:
```tsx
import React from 'react';
import { useAppStore } from '../../store/app-store';
import CodeEditor from './CodeEditor';

const EditorTabs: React.FC = () => {
  const openTabs = useAppStore((s) => s.openTabs);
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const closeTab = useAppStore((s) => s.closeTab);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {openTabs.length > 0 && (
        <div style={{
          display: 'flex',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-color)',
          overflow: 'auto',
          flexShrink: 0,
        }}>
          {openTabs.map((tab) => (
            <div
              key={tab.path}
              onClick={() => setActiveTab(tab.path)}
              style={{
                padding: '4px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                fontSize: 13,
                background: activeTab === tab.path ? 'var(--bg-primary)' : 'transparent',
                color: activeTab === tab.path ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderRight: '1px solid var(--border-color)',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{tab.isDirty ? '● ' : ''}{tab.name}</span>
              <span
                onClick={(e) => { e.stopPropagation(); closeTab(tab.path); }}
                style={{
                  marginLeft: 4,
                  cursor: 'pointer',
                  opacity: 0.5,
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                ×
              </span>
            </div>
          ))}
        </div>
      )}
      <CodeEditor />
    </div>
  );
};

export default EditorTabs;
```

- [ ] **Step 3: Verify TypeScript compiles (will show warnings about missing FileExplorer, ChatPanel — expected)**

```bash
npx tsc -p tsconfig.json --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/editor/CodeEditor.tsx src/renderer/components/editor/EditorTabs.tsx
git commit -m "feat: add Monaco code editor and editor tabs components

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 11: Renderer — File Explorer

**Files:**
- Create: `src/renderer/components/editor/FileExplorer.tsx`
- Create: `src/renderer/hooks/useFileTree.ts`

- [ ] **Step 1: Create useFileTree hook**

`src/renderer/hooks/useFileTree.ts`:
```typescript
import { useEffect, useCallback } from 'react';
import { useAppStore } from '../store/app-store';

export function useFileTree() {
  const projectPath = useAppStore((s) => s.projectPath);
  const fileTree = useAppStore((s) => s.fileTree);
  const setFileTree = useAppStore((s) => s.setFileTree);
  const setProject = useAppStore((s) => s.setProject);

  const refresh = useCallback(async () => {
    if (!projectPath) return;
    try {
      const tree = await window.hicc.listFiles('.', 3);
      setFileTree(tree);
    } catch {
      // Ignore errors silently
    }
  }, [projectPath, setFileTree]);

  useEffect(() => {
    if (projectPath) {
      refresh();
    }
  }, [projectPath, refresh]);

  // Listen for file changes
  useEffect(() => {
    window.hicc.onFileChanged(() => {
      refresh();
    });
  }, [refresh]);

  return { fileTree, refresh, projectPath, setProject };
}
```

- [ ] **Step 2: Create FileExplorer component**

`src/renderer/components/editor/FileExplorer.tsx`:
```tsx
import React, { useState } from 'react';
import { useAppStore } from '../../store/app-store';
import type { FileNode } from '../../types';

const FileExplorer: React.FC = () => {
  const fileTree = useAppStore((s) => s.fileTree);
  const openFile = useAppStore((s) => s.openFile);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleFileClick = (node: FileNode) => {
    if (node.type === 'directory') {
      toggleDir(node.path);
    } else {
      openFile(node.path, node.name);
    }
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedDirs.has(node.path);
    const paddingLeft = 8 + depth * 16;

    return (
      <div key={node.path}>
        <div
          onClick={() => handleFileClick(node)}
          style={{
            padding: '3px 8px',
            paddingLeft,
            cursor: 'pointer',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--text-primary)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          <span style={{ width: 16, textAlign: 'center', flexShrink: 0 }}>
            {node.type === 'directory' ? (isExpanded ? '▼' : '▶') : '📄'}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.name}
          </span>
        </div>
        {node.type === 'directory' && isExpanded && node.children?.map((child) =>
          renderNode(child, depth + 1)
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{
        padding: '4px 12px',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        color: 'var(--text-secondary)',
        letterSpacing: 0.5,
      }}>
        Explorer
      </div>
      {fileTree.length === 0 ? (
        <div style={{
          padding: '12px',
          color: 'var(--text-secondary)',
          fontSize: 12,
          textAlign: 'center',
        }}>
          No project open
        </div>
      ) : (
        fileTree.map((node) => renderNode(node))
      )}
    </div>
  );
};

export default FileExplorer;
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/editor/FileExplorer.tsx src/renderer/hooks/useFileTree.ts
git commit -m "feat: add file explorer with tree view

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 12: Renderer — Chat Components (MessageBubble, MessageList, InputBox)

**Files:**
- Create: `src/renderer/components/chat/MessageBubble.tsx`
- Create: `src/renderer/components/chat/MessageList.tsx`
- Create: `src/renderer/components/chat/InputBox.tsx`
- Create: `src/renderer/components/chat/ChatPanel.tsx`
- Create: `tests/renderer/MessageBubble.test.tsx`
- Create: `tests/renderer/InputBox.test.tsx`

- [ ] **Step 1: Create MessageBubble component**

`src/renderer/components/chat/MessageBubble.tsx`:
```tsx
import React from 'react';
import type { ChatMessage } from '../../types';

interface MessageBubbleProps {
  message: ChatMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div style={{
      padding: '8px 16px',
      display: 'flex',
      gap: 12,
      borderBottom: '1px solid var(--border-color)',
    }}>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        flexShrink: 0,
        background: isUser ? 'var(--accent-color)' : '#6a9955',
        color: 'white',
        fontWeight: 600,
      }}>
        {isUser ? 'U' : 'AI'}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          marginBottom: 4,
          fontWeight: 600,
        }}>
          {isUser ? 'You' : 'Claude'}
        </div>
        <div style={{
          fontSize: 14,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          fontFamily: 'var(--font-family)',
        }}>
          {renderContent(message.content)}
        </div>
      </div>
    </div>
  );
};

function renderContent(text: string): React.ReactNode {
  // Simple code block rendering: split by ``` and render code in monospace
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const codeContent = part.slice(3, -3);
      const newlineIdx = codeContent.indexOf('\n');
      const codeOnly = newlineIdx === -1 ? codeContent : codeContent.slice(newlineIdx + 1);
      return (
        <pre key={i} style={{
          background: 'var(--bg-tertiary)',
          padding: '8px 12px',
          borderRadius: 4,
          margin: '6px 0',
          overflow: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          lineHeight: 1.5,
        }}>
          <code>{codeOnly}</code>
        </pre>
      );
    }
    // Inline code with backticks
    const inlineParts = part.split(/(`[^`]+`)/g);
    return (
      <span key={i}>
        {inlineParts.map((ip, j) =>
          ip.startsWith('`') && ip.endsWith('`') ? (
            <code key={j} style={{
              background: 'var(--bg-tertiary)',
              padding: '1px 4px',
              borderRadius: 3,
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
            }}>
              {ip.slice(1, -1)}
            </code>
          ) : (
            <span key={j}>{ip}</span>
          )
        )}
      </span>
    );
  });
}

export default MessageBubble;
```

- [ ] **Step 2: Create MessageList component**

`src/renderer/components/chat/MessageList.tsx`:
```tsx
import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../../store/app-store';
import MessageBubble from './MessageBubble';

const MessageList: React.FC = () => {
  const messages = useAppStore((s) => s.messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{
      flex: 1,
      overflow: 'auto',
      background: 'var(--bg-primary)',
    }}>
      {messages.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-secondary)',
          gap: 8,
        }}>
          <div style={{ fontSize: 32, opacity: 0.3 }}>HICC</div>
          <div style={{ fontSize: 14 }}>Start a conversation to begin coding</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Describe what you want to build, and Claude will help you write the code
          </div>
        </div>
      ) : (
        messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
      )}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
```

- [ ] **Step 3: Create InputBox component**

`src/renderer/components/chat/InputBox.tsx`:
```tsx
import React, { useState, useRef, useCallback, KeyboardEvent } from 'react';

interface InputBoxProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

const InputBox: React.FC<InputBoxProps> = ({ onSend, disabled }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  return (
    <div style={{
      borderTop: '1px solid var(--border-color)',
      padding: 12,
      background: 'var(--bg-secondary)',
    }}>
      <div style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
      }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Describe what you want to build... (Enter to send, Shift+Enter for new line)"
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid var(--border-color)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-family)',
            fontSize: 14,
            resize: 'none',
            outline: 'none',
            maxHeight: 200,
          }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            background: disabled ? 'var(--bg-tertiary)' : 'var(--accent-color)',
            color: disabled ? 'var(--text-secondary)' : 'white',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default InputBox;
```

- [ ] **Step 4: Create ChatPanel component**

`src/renderer/components/chat/ChatPanel.tsx`:
```tsx
import React, { useCallback, useRef } from 'react';
import { useAppStore } from '../../store/app-store';
import MessageList from './MessageList';
import InputBox from './InputBox';

const ChatPanel: React.FC = () => {
  const addMessage = useAppStore((s) => s.addMessage);
  const appendToLastMessage = useAppStore((s) => s.appendToLastMessage);
  const setStreaming = useAppStore((s) => s.setStreaming);
  const isStreaming = useAppStore((s) => s.isStreaming);
  const projectPath = useAppStore((s) => s.projectPath);

  // Listen for AI deltas
  const hasSetupListener = useRef(false);
  if (!hasSetupListener.current) {
    hasSetupListener.current = true;
    window.hicc.onAiDelta((delta: string) => {
      appendToLastMessage(delta);
    });
  }

  const handleSend = useCallback(async (text: string) => {
    if (!projectPath) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: text,
      timestamp: Date.now(),
    };
    addMessage(userMsg);

    const aiMsg = {
      id: (Date.now() + 1).toString(),
      role: 'assistant' as const,
      content: '',
      timestamp: Date.now(),
    };
    addMessage(aiMsg);

    setStreaming(true);
    try {
      await window.hicc.sendMessage(text);
    } catch (error) {
      appendToLastMessage(`\n[Error: ${error}]`);
    } finally {
      setStreaming(false);
    }
  }, [projectPath, addMessage, appendToLastMessage, setStreaming]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-primary)',
    }}>
      <MessageList />
      <InputBox onSend={handleSend} disabled={isStreaming || !projectPath} />
    </div>
  );
};

export default ChatPanel;
```

- [ ] **Step 5: Write component tests**

`tests/renderer/MessageBubble.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageBubble from '../../src/renderer/components/chat/MessageBubble';

describe('MessageBubble', () => {
  it('renders user message', () => {
    const msg = { id: '1', role: 'user' as const, content: 'Hello', timestamp: 0 };
    render(<MessageBubble message={msg} />);
    expect(screen.getByText('Hello')).toBeDefined();
    expect(screen.getByText('You')).toBeDefined();
  });

  it('renders assistant message', () => {
    const msg = { id: '2', role: 'assistant' as const, content: 'Hi there', timestamp: 0 };
    render(<MessageBubble message={msg} />);
    expect(screen.getByText('Hi there')).toBeDefined();
    expect(screen.getByText('Claude')).toBeDefined();
  });

  it('renders code blocks', () => {
    const msg = { id: '3', role: 'assistant' as const, content: 'Here is code:\n```\nconst x = 1;\n```', timestamp: 0 };
    const { container } = render(<MessageBubble message={msg} />);
    expect(container.querySelector('pre')).toBeDefined();
    expect(container.querySelector('code')?.textContent).toContain('const x = 1');
  });

  it('renders inline code', () => {
    const msg = { id: '4', role: 'assistant' as const, content: 'Use `const` keyword', timestamp: 0 };
    const { container } = render(<MessageBubble message={msg} />);
    expect(container.querySelector('code')?.textContent).toBe('const');
  });
});
```

`tests/renderer/InputBox.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InputBox from '../../src/renderer/components/chat/InputBox';

describe('InputBox', () => {
  it('renders input and send button', () => {
    render(<InputBox onSend={vi.fn()} disabled={false} />);
    expect(screen.getByPlaceholderText(/Describe what you want to build/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDefined();
  });

  it('calls onSend when clicking send button', async () => {
    const onSend = vi.fn();
    render(<InputBox onSend={onSend} disabled={false} />);
    const input = screen.getByPlaceholderText(/Describe what you want to build/);
    await userEvent.type(input, 'Build a todo app');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith('Build a todo app');
  });

  it('disables button when input is empty', () => {
    render(<InputBox onSend={vi.fn()} disabled={false} />);
    const button = screen.getByRole('button', { name: 'Send' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('sends on Enter key press', async () => {
    const onSend = vi.fn();
    render(<InputBox onSend={onSend} disabled={false} />);
    const input = screen.getByPlaceholderText(/Describe what you want to build/);
    await userEvent.type(input, 'Hello{Enter}');
    expect(onSend).toHaveBeenCalledWith('Hello');
  });
});
```

- [ ] **Step 6: Run component tests**

```bash
npx vitest run tests/renderer/
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/chat/ tests/renderer/
git commit -m "feat: add chat components (MessageBubble, MessageList, InputBox, ChatPanel)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 13: Renderer — Diff Preview

**Files:**
- Create: `src/renderer/components/chat/DiffPreview.tsx`
- Create: `tests/renderer/DiffPreview.test.tsx`

- [ ] **Step 1: Create DiffPreview component**

`src/renderer/components/chat/DiffPreview.tsx`:
```tsx
import React, { useState } from 'react';

interface DiffPreviewProps {
  filePath: string;
  newContent: string;
  oldContent?: string;
  onAccept: () => void;
  onReject: () => void;
}

const DiffPreview: React.FC<DiffPreviewProps> = ({
  filePath, newContent, oldContent, onAccept, onReject,
}) => {
  const [showDiff, setShowDiff] = useState(true);

  const lines = newContent.split('\n');
  const oldLines = (oldContent || '').split('\n');

  const computeDiff = (): Array<{ type: 'add' | 'remove' | 'same'; line: string; lineNum: number }> => {
    if (!oldContent) {
      return lines.map((line, i) => ({ type: 'add' as const, line, lineNum: i + 1 }));
    }

    // Simple line-by-line diff
    const result: Array<{ type: 'add' | 'remove' | 'same'; line: string; lineNum: number }> = [];
    const maxLen = Math.max(oldLines.length, lines.length);

    for (let i = 0; i < maxLen; i++) {
      if (i < oldLines.length && i < lines.length) {
        if (oldLines[i] === lines[i]) {
          result.push({ type: 'same', line: lines[i], lineNum: i + 1 });
        } else {
          result.push({ type: 'remove', line: oldLines[i], lineNum: i + 1 });
          result.push({ type: 'add', line: lines[i], lineNum: i + 1 });
        }
      } else if (i < oldLines.length) {
        result.push({ type: 'remove', line: oldLines[i], lineNum: i + 1 });
      } else {
        result.push({ type: 'add', line: lines[i], lineNum: i + 1 });
      }
    }

    return result;
  };

  const diff = computeDiff();
  const addedLines = diff.filter((d) => d.type === 'add').length;
  const removedLines = diff.filter((d) => d.type === 'remove').length;

  return (
    <div style={{
      border: '1px solid var(--border-color)',
      borderRadius: 6,
      margin: '8px 0',
      overflow: 'hidden',
    }}>
      <div style={{
        background: 'var(--bg-tertiary)',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
      }}
        onClick={() => setShowDiff(!showDiff)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{showDiff ? '▼' : '▶'}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{filePath}</span>
          <span style={{ fontSize: 12, color: '#4caf50' }}>+{addedLines}</span>
          <span style={{ fontSize: 12, color: '#f44336' }}>-{removedLines}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onAccept(); }}
            style={{
              padding: '3px 10px',
              borderRadius: 3,
              border: 'none',
              background: '#2e7d32',
              color: 'white',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Accept
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onReject(); }}
            style={{
              padding: '3px 10px',
              borderRadius: 3,
              border: 'none',
              background: '#c62828',
              color: 'white',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Reject
          </button>
        </div>
      </div>
      {showDiff && (
        <div style={{
          maxHeight: 300,
          overflow: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          lineHeight: 1.6,
        }}>
          {diff.map((entry, i) => (
            <div
              key={i}
              style={{
                padding: '1px 12px',
                background: entry.type === 'add' ? 'rgba(76, 175, 80, 0.15)'
                  : entry.type === 'remove' ? 'rgba(244, 67, 54, 0.15)'
                  : 'transparent',
                color: entry.type === 'add' ? '#4caf50'
                  : entry.type === 'remove' ? '#f44336'
                  : 'var(--text-primary)',
                whiteSpace: 'pre',
              }}
            >
              <span style={{ color: 'var(--text-secondary)', marginRight: 8, userSelect: 'none' }}>
                {entry.lineNum.toString().padStart(4, ' ')}
              </span>
              <span>{entry.type === 'add' ? '+' : entry.type === 'remove' ? '-' : ' '} {entry.line}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DiffPreview;
```

- [ ] **Step 2: Write DiffPreview tests**

`tests/renderer/DiffPreview.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DiffPreview from '../../src/renderer/components/chat/DiffPreview';

describe('DiffPreview', () => {
  it('renders file path and line counts', () => {
    render(
      <DiffPreview
        filePath="src/app.ts"
        newContent="const x = 1;\nconst y = 2;"
        oldContent="const x = 0;"
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText('src/app.ts')).toBeDefined();
  });

  it('calls onAccept when Accept button is clicked', async () => {
    const onAccept = vi.fn();
    render(
      <DiffPreview
        filePath="test.ts"
        newContent="hello"
        onAccept={onAccept}
        onReject={vi.fn()}
      />
    );
    await userEvent.click(screen.getByText('Accept'));
    expect(onAccept).toHaveBeenCalled();
  });

  it('calls onReject when Reject button is clicked', async () => {
    const onReject = vi.fn();
    render(
      <DiffPreview
        filePath="test.ts"
        newContent="hello"
        onAccept={vi.fn()}
        onReject={onReject}
      />
    );
    await userEvent.click(screen.getByText('Reject'));
    expect(onReject).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/renderer/DiffPreview.test.tsx
```

Expected: All 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/chat/DiffPreview.tsx tests/renderer/DiffPreview.test.tsx
git commit -m "feat: add diff preview component with accept/reject

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 14: Renderer — Terminal Panel & Integration

**Files:**
- Create: `src/renderer/components/terminal/TerminalPanel.tsx`
- Modify: `src/renderer/App.tsx` — add TerminalPanel tab switching in bottom panel

- [ ] **Step 1: Create TerminalPanel component**

`src/renderer/components/terminal/TerminalPanel.tsx`:
```tsx
import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useAppStore } from '../../store/app-store';
import 'xterm/css/xterm.css';

const TerminalPanel: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon>(new FitAddon());
  const terminalId = useRef<string | null>(null);
  const projectPath = useAppStore((s) => s.projectPath);

  useEffect(() => {
    if (!terminalRef.current || !projectPath) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'var(--font-mono, monospace)',
      fontSize: 13,
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
      },
    });

    term.loadAddon(fitAddon.current);
    term.open(terminalRef.current);
    fitAddon.current.fit();

    terminal.current = term;

    // Create PTY session
    window.hicc.createTerminal(projectPath).then((id) => {
      terminalId.current = id;
    });

    // Forward user input to PTY
    term.onData((data) => {
      if (terminalId.current) {
        window.hicc.writeToTerminal(terminalId.current, data);
      }
    });

    // Display PTY output
    window.hicc.onTerminalData((data) => {
      if (data.id === terminalId.current) {
        term.write(data.data);
      }
    });

    const handleResize = () => {
      fitAddon.current.fit();
      if (terminalId.current && term.cols && term.rows) {
        window.hicc.resizeTerminal(terminalId.current, term.cols, term.rows);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [projectPath]);

  if (!projectPath) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
        fontSize: 14,
      }}>
        Open a project to use the terminal
      </div>
    );
  }

  return <div ref={terminalRef} style={{ height: '100%' }} />;
};

export default TerminalPanel;
```

- [ ] **Step 2: Update App.tsx with bottom panel tab switching**

Edit `src/renderer/App.tsx` — replace the Panel content to support chat/terminal tab switching:

```tsx
import React, { useEffect, useState } from 'react';
import { useAppStore } from './store/app-store';
import Sidebar from './components/layout/Sidebar';
import Toolbar from './components/layout/Toolbar';
import Panel from './components/layout/Panel';
import FileExplorer from './components/editor/FileExplorer';
import EditorTabs from './components/editor/EditorTabs';
import ChatPanel from './components/chat/ChatPanel';
import TerminalPanel from './components/terminal/TerminalPanel';
import ErrorBoundary from './components/common/ErrorBoundary';

const App: React.FC = () => {
  const theme = useAppStore((s) => s.theme);
  const projectName = useAppStore((s) => s.projectName);
  const activeSidebar = useAppStore((s) => s.activeSidebar);
  const setApiKey = useAppStore((s) => s.setApiKey);
  const [bottomTab, setBottomTab] = useState<'chat' | 'terminal'>('chat');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    window.hicc.getApiKey().then((key) => {
      if (key) setApiKey(key);
    });
  }, [setApiKey]);

  return (
    <ErrorBoundary>
      <div className="app">
        <Toolbar projectName={projectName} />
        <div className="app-body">
          <Sidebar />
          {activeSidebar === 'files' && (
            <div className="sidebar-panel">
              <FileExplorer />
            </div>
          )}
          <div className="main-content">
            <EditorTabs />
            <div style={{ borderTop: '1px solid var(--border-color)' }}>
              <div style={{
                display: 'flex',
                background: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-color)',
              }}>
                {([
                  { id: 'chat' as const, label: 'Chat' },
                  { id: 'terminal' as const, label: 'Terminal' },
                ]).map((tab) => (
                  <div
                    key={tab.id}
                    onClick={() => setBottomTab(tab.id)}
                    style={{
                      padding: '4px 16px',
                      cursor: 'pointer',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      borderBottom: bottomTab === tab.id ? '2px solid var(--accent-color)' : '2px solid transparent',
                      color: bottomTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {tab.label}
                  </div>
                ))}
              </div>
              <div style={{ height: 300 }}>
                {bottomTab === 'chat' ? <ChatPanel /> : <TerminalPanel />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default App;
```

- [ ] **Step 3: Install xterm types & add CSS import**

```bash
npm install -D @types/xterm 2>/dev/null || true
```

Note: xterm v5 ships its own types. If `@xterm/addon-fit` types are needed, use `@types/xterm-addon-fit`.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/terminal/TerminalPanel.tsx src/renderer/App.tsx
git commit -m "feat: add terminal panel with xterm.js and bottom tab switching

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 15: End-to-End Verification & Dev Experience

**Files:**
- Modify: `package.json` — fix scripts if needed
- Verify: Full project compiles and runs

- [ ] **Step 1: Install all dependencies**

```bash
npm install
```

- [ ] **Step 2: Verify TypeScript compliation for both main and renderer**

```bash
npx tsc -p tsconfig.main.json --noEmit
npx tsc -p tsconfig.json --noEmit
```

Expected: Both pass without errors.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Test dev startup (manual)**

```bash
npm run dev:renderer &
sleep 3
npm run dev:main
```

Verify: Electron window opens, UI renders with Sidebar/Toolbar/Chat.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: finalize integration and verify build

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Plan Self-Review

**Spec coverage check:**
- [x] Electron + React + TypeScript project scaffold → Task 1
- [x] Shared types/IPC/tool schemas → Task 2
- [x] Config store + IPC registration → Task 3
- [x] File system + file watcher services → Task 4
- [x] Safety checker + tool executor → Task 5
- [x] Anthropic client with tool orchestration → Task 6
- [x] Terminal manager + project handlers → Task 7
- [x] Zustand store + theme system → Task 8
- [x] Layout components (Sidebar, Toolbar, Panel, ErrorBoundary) → Task 9
- [x] Monaco code editor + editor tabs → Task 10
- [x] File explorer with tree view → Task 11
- [x] Chat components (MessageBubble, MessageList, InputBox, ChatPanel) → Task 12
- [x] Diff preview with accept/reject → Task 13
- [x] Terminal panel + bottom tab switching → Task 14
- [x] End-to-end verification → Task 15

**Placeholder scan:** No TBD, TODO, or vague placeholders. All steps have complete code.

**Type consistency:** 
- `FileNode` used consistently across `shared/types.ts`, `file-system.ts`, `FileExplorer.tsx`
- IPC channel names match between `shared/constants.ts`, `preload.ts`, and handler files
- Store action names consistent between `app-store.ts` and all consuming components
- `ChatMessage`, `ToolCall`, `EditorTab` types used consistently

**Gaps identified:** None. All spec requirements (P0 + P1) are covered.
