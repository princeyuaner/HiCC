import { ipcMain } from 'electron';
import * as prettier from 'prettier';
import * as path from 'path';
import { spawn } from 'child_process';
import { IPC_CHANNELS } from '../../shared/constants';

function runBlack(filePath: string, content: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('black', ['--stdin-filename', filePath, '--quiet', '-'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `Black exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Black formatter not found. Install with: pip install black (${err.message})`));
    });

    proc.stdin?.write(content);
    proc.stdin?.end();
  });
}

export function registerFormatHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CONFIG_FORMAT_DOCUMENT, async (_event, filePath: string, content: string) => {
    try {
      const ext = path.extname(filePath).toLowerCase();

      // Python files use Black
      if (ext === '.py' || ext === '.pyw') {
        const formatted = await runBlack(filePath, content);
        return { formatted };
      }

      // All other files use Prettier
      const config = await prettier.resolveConfig(filePath, {
        editorconfig: true,
      });

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
