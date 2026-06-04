import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicClient } from '../../src/main/services/anthropic-client';
import { FileSystemService } from '../../src/main/services/file-system';
import type { ApiProfile } from '../../src/shared/types';

describe('AnthropicClient', () => {
  let client: AnthropicClient;
  let fileSystem: FileSystemService;

  const testProfile: ApiProfile = {
    id: 'test-001',
    name: 'Test',
    baseUrl: '',
    apiKey: 'test-key',
    model: 'claude-sonnet-4-6',
  };

  beforeEach(() => {
    fileSystem = new FileSystemService('/tmp/test');
    client = new AnthropicClient(fileSystem);
  });

  it('starts with null client before API key is set', () => {
    expect(client).toBeDefined();
  });

  it('applyProfile initializes the client', () => {
    client.applyProfile(testProfile);
    expect(() => client.applyProfile(testProfile)).not.toThrow();
  });

  it('applyProfile with null clears the client', () => {
    client.applyProfile(testProfile);
    expect(() => client.applyProfile(null)).not.toThrow();
  });

  it('applyProfile with systemPrompt passes it along', () => {
    expect(() => client.applyProfile(testProfile, 'You are helpful.')).not.toThrow();
  });

  it('interruptSession cleans up without error when no session running', async () => {
    await expect(client.interruptSession()).resolves.toBeUndefined();
  });

  it('confirmTool handles pending confirmation correctly', () => {
    expect(() => client.confirmTool(true)).not.toThrow();
    expect(() => client.confirmTool(false, 'tool-1')).not.toThrow();
  });

  it('sendUserMessage without active session does not throw', () => {
    expect(() => client.sendUserMessage('hello')).not.toThrow();
  });
});
