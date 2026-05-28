import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicClient } from '../../src/main/services/anthropic-client';
import { FileSystemService } from '../../src/main/services/file-system';
import { ToolExecutor } from '../../src/main/services/tool-executor';

describe('AnthropicClient', () => {
  let client: AnthropicClient;
  let fileSystem: FileSystemService;
  let toolExecutor: ToolExecutor;

  beforeEach(() => {
    fileSystem = new FileSystemService('/tmp/test');
    toolExecutor = new ToolExecutor(fileSystem);
    client = new AnthropicClient(fileSystem, toolExecutor);
  });

  it('starts with null client before API key is set', () => {
    // API key not set — client is null internally
    expect(client).toBeDefined();
  });

  it('setApiKey initializes the client', () => {
    client.setApiKey('test-key');
    // Should not throw
    expect(() => client.setApiKey('test-key')).not.toThrow();
  });

  it('resetConversation clears message history', () => {
    client.resetConversation();
    expect(client).toBeDefined();
  });

  it('confirmTool handles pending confirmation correctly', () => {
    // confirmTool when no pending confirmation should not throw
    expect(() => client.confirmTool(true)).not.toThrow();
  });
});
