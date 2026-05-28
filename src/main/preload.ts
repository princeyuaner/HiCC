import { contextBridge, ipcRenderer } from 'electron';

const api = {
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('file:write', filePath, content),
  deleteFile: (filePath: string) => ipcRenderer.invoke('file:delete', filePath),
  listFiles: (dirPath: string, depth?: number) => ipcRenderer.invoke('file:list', dirPath, depth),
  onFileChanged: (callback: (event: { path: string; type: string }) => void) => {
    ipcRenderer.on('file:changed', (_event, data) => callback(data));
  },
  openProject: () => ipcRenderer.invoke('project:open'),
  getRecentProjects: () => ipcRenderer.invoke('project:recent'),
  sendMessage: (message: string) => ipcRenderer.invoke('ai:send', message),
  onAiDelta: (callback: (delta: string) => void) => {
    ipcRenderer.on('ai:delta', (_event, delta) => callback(delta));
  },
  onAiToolConfirm: (callback: (toolCall: unknown) => void) => {
    ipcRenderer.on('ai:tool-confirm', (_event, toolCall) => callback(toolCall));
  },
  confirmTool: (approved: boolean) => ipcRenderer.invoke('ai:confirm-tool', approved),
  createTerminal: (cwd: string) => ipcRenderer.invoke('terminal:create', cwd),
  writeToTerminal: (id: string, data: string) => ipcRenderer.invoke('terminal:write', id, data),
  resizeTerminal: (id: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
  onTerminalData: (callback: (data: { id: string; data: string }) => void) => {
    ipcRenderer.on('terminal:data', (_event, data) => callback(data));
  },
  getApiKey: () => ipcRenderer.invoke('config:get-api-key'),
  setApiKey: (key: string) => ipcRenderer.invoke('config:set-api-key', key),
};

contextBridge.exposeInMainWorld('hicc', api);
