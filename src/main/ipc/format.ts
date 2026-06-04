import { ipcMain } from 'electron';
import * as prettier from 'prettier';
import * as path from 'path';
import * as fs from 'fs';
import { IPC_CHANNELS } from '../../shared/constants';

export function registerFormatHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CONFIG_FORMAT_DOCUMENT, async (_event, filePath: string, content: string) => {
    try {
      // Resolve prettier config from the file's directory
      const dir = path.dirname(filePath);
      const config = await prettier.resolveConfig(filePath, {
        editorconfig: true,
      });

      const ext = path.extname(filePath).toLowerCase();
      const parser = inferParser(filePath, ext);

      const formatted = await prettier.format(content, {
        ...config,
        filepath: filePath,
        parser: parser || undefined,
      });

      return { formatted };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: `Format error: ${message}` };
    }
  });
}

function inferParser(filePath: string, ext: string): string | null {
  const parsers: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'babel',
    '.jsx': 'babel',
    '.json': 'json',
    '.css': 'css',
    '.scss': 'css',
    '.less': 'css',
    '.html': 'html',
    '.htm': 'html',
    '.md': 'markdown',
    '.markdown': 'markdown',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.vue': 'vue',
    '.svelte': 'html',
    '.graphql': 'graphql',
    '.gql': 'graphql',
  };

  if (parsers[ext]) return parsers[ext];

  // Try to detect by filename
  const basename = path.basename(filePath).toLowerCase();
  if (basename === '.prettierrc' || basename === '.prettierrc.json') return 'json';
  if (basename === 'dockerfile') return 'markdown';

  // Default to babel for unknown text files
  return null;
}
