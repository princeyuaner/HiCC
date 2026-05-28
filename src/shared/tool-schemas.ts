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
