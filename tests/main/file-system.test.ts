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
