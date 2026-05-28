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
