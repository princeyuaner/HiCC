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
