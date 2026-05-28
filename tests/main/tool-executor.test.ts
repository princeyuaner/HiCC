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
