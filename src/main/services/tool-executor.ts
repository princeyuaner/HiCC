import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { FileSystemService } from './file-system';
import { SafetyChecker } from './safety-checker';

const execAsync = promisify(exec);

let rgPath = 'rg';
try {
  rgPath = execSync('where rg 2>nul || which rg 2>/dev/null || echo rg', {
    encoding: 'utf-8',
    shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
  }).trim().split('\n')[0].trim();
  if (!rgPath) rgPath = 'rg';
} catch {
  // fallback to 'rg' in PATH
}

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
      const { stdout } = await execAsync(`${rgPath} --line-number --no-heading ${globArg} "${pattern}" "${projectRoot}"`, {
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
