import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import { FileSystemService } from './file-system';
import { PushableAsyncIterable } from './pushable-async-iterable';
import { getMcpServers } from '../store/config-store';
import type { ApiProfile } from '../../shared/types';
import type {
  Query,
  SDKMessage,
  SDKAssistantMessage,
  SDKResultMessage,
  SDKPartialAssistantMessage,
  SDKUserMessage,
  SDKToolProgressMessage,
  SDKToolUseSummaryMessage,
  SDKStatusMessage,
  SDKSystemMessage,
  CanUseTool,
  PermissionResult,
  PermissionDecisionClassification,
} from '@anthropic-ai/claude-agent-sdk';

export class AnthropicClient {
  private baseUrl: string = '';
  private sonnetModel: string = 'claude-sonnet-4-6';
  private opusModel: string = 'claude-sonnet-4-6';
  private smallFastModel: string = 'claude-sonnet-4-6';
  private apiKey: string = '';
  private systemPrompt: string | undefined;

  private currentQuery: Query | null = null;
  private pushableIterable: PushableAsyncIterable<SDKUserMessage> | null = null;
  private isRunning = false;

  // Track emitted content for deduplication with includePartialMessages: true
  private lastEmittedText = '';
  private lastEmittedThinking = '';
  private textBlockStarted = false;
  private thinkingBlockStarted = false;

  private pendingToolConfirmation: {
    toolName: string;
    toolInput: Record<string, unknown>;
    toolUseID: string;
    resolve: (result: PermissionResult) => void;
  } | null = null;

  private permissionMode = 'default';
  private sessionAllowedTools = new Set<string>();

  private temperature?: number;
  private maxTokens?: number;
  private thinkingEnabled?: boolean;
  private thinkingBudget?: number;

  constructor(private fileSystem: FileSystemService) {}

  applyProfile(profile: ApiProfile | null | undefined, systemPrompt?: string): void {
    if (profile?.apiKey) {
      this.baseUrl = profile.baseUrl || '';
      this.sonnetModel = profile.sonnetModel || profile.model || 'claude-sonnet-4-6';
      this.opusModel = profile.opusModel || profile.model || 'claude-sonnet-4-6';
      this.smallFastModel = profile.smallFastModel || profile.model || 'claude-sonnet-4-6';
      this.apiKey = profile.apiKey;
      this.systemPrompt = systemPrompt || profile.systemPrompt;
      this.temperature = profile.temperature;
      this.maxTokens = profile.maxTokens;
      this.thinkingEnabled = profile.thinkingEnabled;
      this.thinkingBudget = profile.thinkingBudget;
      console.log('[AnthropicClient] applyProfile:', { baseUrl: this.baseUrl, sonnetModel: this.sonnetModel, opusModel: this.opusModel, smallFastModel: this.smallFastModel, hasSystemPrompt: !!this.systemPrompt, temperature: this.temperature, maxTokens: this.maxTokens });
    } else {
      console.log('[AnthropicClient] applyProfile: clearing client (no apiKey)');
      this.apiKey = '';
      this.baseUrl = '';
      this.sonnetModel = 'claude-sonnet-4-6';
      this.opusModel = 'claude-sonnet-4-6';
      this.smallFastModel = 'claude-sonnet-4-6';
      this.systemPrompt = undefined;
    }
  }

  async startSession(window: BrowserWindow, modelKey: string = 'sonnet', permissionMode: string = 'default', effortLevel: string = 'high'): Promise<void> {
    if (this.isRunning) {
      console.log('[AnthropicClient] Session already running');
      return;
    }

    if (!this.apiKey) {
      window.webContents.send(IPC_CHANNELS.AI_ERROR, 'Error: API key not configured. Please set your API key in settings.');
      return;
    }

    this.pushableIterable = new PushableAsyncIterable<SDKUserMessage>();
    this.permissionMode = permissionMode;

    const cwd = this.fileSystem.getProjectRoot() || process.cwd();

    const env: Record<string, string | undefined> = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    env.ANTHROPIC_AUTH_TOKEN = this.apiKey;
    env.ANTHROPIC_BASE_URL = this.baseUrl || undefined;
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = this.sonnetModel;
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = this.opusModel;
    env.ANTHROPIC_SMALL_FAST_MODEL = this.smallFastModel;
    env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';

    const canUseTool = this.createCanUseTool(window);

    try {
      console.log('[AnthropicClient] Dynamically importing @anthropic-ai/claude-agent-sdk...');
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      const { query } = sdk;

      const mcpServers = getMcpServers();
      console.log('[AnthropicClient] MCP servers configured:', Object.keys(mcpServers));
      const options: Record<string, unknown> = {
        model: modelKey,
        cwd,
        env,
        canUseTool,
        includePartialMessages: true,
        maxTurns: 50,
        effort: effortLevel as 'low' | 'medium' | 'high',
        mcpServers,
        stderr: (data: string) => {
          console.error('[Claude CLI stderr]', data);
        },
      };

      if (this.temperature !== undefined) {
        options.temperature = this.temperature;
      }
      if (this.maxTokens !== undefined && this.maxTokens > 0) {
        options.maxTokens = this.maxTokens;
      }
      if (this.thinkingEnabled === false) {
        options.thinking = { type: 'disabled' as const };
      } else if (this.thinkingBudget !== undefined && this.thinkingBudget > 0) {
        options.thinking = { type: 'enabled' as const, budgetTokens: this.thinkingBudget };
      } else {
        options.thinking = { type: 'adaptive' as const };
      }

      // Always include instruction to summarize after tool use.
      const toolSummaryInstruction =
        '\n\n**CRITICAL INSTRUCTION - READ CAREFULLY:** ' +
        'After you use any tool (Bash, Read, Write, Edit, Glob, Grep, etc.) and receive its results, ' +
        'you MUST ALWAYS respond with a text message. This is non-negotiable. ' +
        'Summarize what tool you ran, what the results show, and answer the user\'s question. ' +
        'A tool result is NEVER a complete response on its own. ' +
        'Even a one-sentence summary of the tool output is required. ' +
        'If you forget to respond after a tool use, the conversation will appear broken to the user.';
      const append = this.systemPrompt
        ? this.systemPrompt + toolSummaryInstruction
        : toolSummaryInstruction;

      options.systemPrompt = {
        type: 'preset',
        preset: 'claude_code',
        append,
      };

      console.log('[AnthropicClient] Starting query session...');
      this.currentQuery = query({
        prompt: this.pushableIterable,
        options: options as Parameters<typeof query>[0]['options'],
      });

      this.isRunning = true;
      window.webContents.send(IPC_CHANNELS.AI_INIT, { sessionId: '', model: this.sonnetModel });

      this.processMessages(window).catch((err) => {
        console.error('[AnthropicClient] processMessages error:', err);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[AnthropicClient] Failed to start session:', message);
      window.webContents.send(IPC_CHANNELS.AI_ERROR, `\nError starting session: ${message}\n`);
    }
  }

  sendUserMessage(text: string): void {
    if (!this.pushableIterable) {
      console.error('[SDK MSG] sendUserMessage: no active session!');
      return;
    }
    console.log('[SDK MSG] sendUserMessage (text len=' + text.length + '):', text.slice(0, 300));
    // Reset per-turn dedup trackers
    this.lastEmittedText = '';
    this.lastEmittedThinking = '';
    this.textBlockStarted = false;
    this.thinkingBlockStarted = false;
    const userMsg: SDKUserMessage = {
      type: 'user',
      message: { role: 'user', content: text },
      parent_tool_use_id: null,
    } as SDKUserMessage;
    this.pushableIterable.push(userMsg);
  }

  sendToolResult(toolUseId: string, answer: string): void {
    if (!this.pushableIterable) {
      console.error('[SDK MSG] sendToolResult: no active session!');
      return;
    }
    console.log('[SDK MSG] sendToolResult:', { toolUseId, answer: answer.slice(0, 200) });
    const msg: SDKUserMessage = {
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolUseId, content: answer }],
      },
      parent_tool_use_id: null,
    } as SDKUserMessage;
    this.pushableIterable.push(msg);
  }

  async cancelCurrentResponse(): Promise<void> {
    if (this.currentQuery) {
      try {
        await this.currentQuery.interrupt();
      } catch (e) {
        // ignore
      }
    }
    this.isRunning = false;
  }

  async getContextUsage(): Promise<{ totalTokens: number; maxTokens: number; percentage: number; memoryFiles: Array<{ path: string; type: string; tokens: number }> } | null> {
    if (!this.currentQuery) return null;
    try {
      const usage = await this.currentQuery.getContextUsage();
      return {
        totalTokens: usage.totalTokens,
        maxTokens: usage.maxTokens,
        percentage: usage.percentage,
        memoryFiles: usage.memoryFiles || [],
      };
    } catch (err) {
      console.error('[AnthropicClient] Failed to get context usage:', err);
      return null;
    }
  }

  async interruptSession(): Promise<void> {
    if (this.currentQuery) {
      try {
        await this.currentQuery.interrupt();
      } catch (e) {
        // ignore
      }
    }
    this.cleanup();
  }

  confirmTool(approved: boolean, toolUseID?: string, alwaysAllow?: boolean): void {
    console.log('[SDK MSG] confirmTool:', { approved, toolUseID, hasPending: !!this.pendingToolConfirmation });
    if (this.pendingToolConfirmation) {
      if (alwaysAllow) {
        this.sessionAllowedTools.add(this.pendingToolConfirmation.toolName);
      }
      if (approved) {
        this.pendingToolConfirmation.resolve({
          behavior: 'allow',
          toolUseID: this.pendingToolConfirmation.toolUseID,
          updatedInput: this.pendingToolConfirmation.toolInput as Record<string, unknown>,
          decisionClassification: 'user_temporary' as PermissionDecisionClassification,
        });
      } else {
        this.pendingToolConfirmation.resolve({
          behavior: 'deny',
          message: 'User rejected this operation.',
        });
      }
      this.pendingToolConfirmation = null;
    } else {
      console.log('[AnthropicClient] confirmTool: no pending confirmation!');
    }
  }

  async getSupportedCommands(): Promise<Array<{ name: string; description: string; argumentHint: string; aliases?: string[] }>> {
    if (!this.currentQuery) return [];
    try {
      return await this.currentQuery.supportedCommands();
    } catch (err) {
      console.error('[AnthropicClient] getSupportedCommands error:', err);
      return [];
    }
  }

  private async fetchAndSendCommands(window: BrowserWindow): Promise<void> {
    if (!this.currentQuery) return;
    try {
      const commands = await this.currentQuery.supportedCommands();
      window.webContents.send(IPC_CHANNELS.AI_COMMANDS_LOADED, commands);
    } catch (err) {
      console.error('[AnthropicClient] Failed to fetch commands:', err);
    }
  }

  private async processMessages(window: BrowserWindow): Promise<void> {
    if (!this.currentQuery) return;

    let hasToolUseInCurrentTurn = false;
    let hasTextInCurrentTurn = false;

    try {
      for await (const message of this.currentQuery) {
        if (!this.isRunning) break;

        // Full verbose log of every message
        const msgSummary = this.summarizeMessage(message);
        console.log('[SDK MSG]', msgSummary);

        // Track tool use vs text presence in the current turn
        if (message.type === 'assistant') {
          const amsg = message as SDKAssistantMessage;
          for (const block of amsg.message.content) {
            if (block.type === 'tool_use') hasToolUseInCurrentTurn = true;
            if (block.type === 'text' && block.text.trim().length > 0) hasTextInCurrentTurn = true;
          }
        }
        if (message.type === 'stream_event') {
          const sev = (message as SDKPartialAssistantMessage).event;
          if (sev?.type === 'content_block_delta' && sev.delta?.type === 'text_delta' && sev.delta.text.trim().length > 0) {
            hasTextInCurrentTurn = true;
          }
        }

        this.routeMessage(message, window);

        // After a result (turn end), check if we had tool use without text
        if (message.type === 'result') {
          if (hasToolUseInCurrentTurn && !hasTextInCurrentTurn) {
            console.log('[SDK MSG] ⚠️ Turn ended with tool use but NO text response!');
            window.webContents.send(IPC_CHANNELS.AI_STATUS, { status: 'tool_completed_no_text' });
          }
          // Reset for next turn
          hasToolUseInCurrentTurn = false;
          hasTextInCurrentTurn = false;
        }
      }
      console.log('[SDK MSG] Query iterable ended (done)');
    } catch (error) {
      if (this.isRunning) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[AnthropicClient] processMessages error:', msg);
        window.webContents.send(IPC_CHANNELS.AI_ERROR, `\nError: ${msg}\n`);
      }
    } finally {
      this.cleanup();
    }
  }

  private routeMessage(message: SDKMessage, window: BrowserWindow): void {
    switch (message.type) {
      case 'stream_event':
        this.routeStreamEvent(message as SDKPartialAssistantMessage, window);
        break;
      case 'assistant':
        this.routeAssistantMessage(message as SDKAssistantMessage, window);
        break;
      case 'tool_progress':
        this.routeToolProgress(message as SDKToolProgressMessage, window);
        break;
      case 'tool_use_summary':
        this.routeToolUseSummary(message as SDKToolUseSummaryMessage, window);
        break;
      case 'system': {
        const sysMsg = message as SDKStatusMessage;
        if (sysMsg.subtype === 'status') {
          console.log('[SDK MSG] system status → AI_STATUS:', sysMsg.status);
          window.webContents.send(IPC_CHANNELS.AI_STATUS, { status: sysMsg.status || 'idle' });
        } else if (sysMsg.subtype === 'init') {
          const initMsg = message as SDKSystemMessage;
          console.log('[SDK MSG] system init → AI_INIT:', {
            sessionId: initMsg.session_id,
            model: initMsg.model,
            slashCommandsCount: initMsg.slash_commands?.length || 0,
            skillsCount: initMsg.skills?.length || 0,
          });
          const builtIn = [
            { name: 'compact', description: 'Compact conversation context', argumentHint: '' },
            { name: 'config', description: 'Configure Claude Code settings', argumentHint: '<key> <value>' },
            { name: 'cost', description: 'Show token usage and cost', argumentHint: '' },
            { name: 'init', description: 'Initialize CLAUDE.md for the project', argumentHint: '' },
            { name: 'login', description: 'Log in to Anthropic', argumentHint: '' },
            { name: 'logout', description: 'Log out of Anthropic', argumentHint: '' },
            { name: 'memory', description: 'Manage persistent memory', argumentHint: '' },
            { name: 'mcp', description: 'Manage MCP servers', argumentHint: '' },
            { name: 'output-style', description: 'Change output style', argumentHint: '<style>' },
            { name: 'permissions', description: 'Manage tool permissions', argumentHint: '' },
            { name: 'pr-comments', description: 'View PR comments', argumentHint: '' },
            { name: 'release-notes', description: 'Generate release notes', argumentHint: '' },
            { name: 'review', description: 'Review a pull request', argumentHint: '[pr-url]' },
            { name: 'security-review', description: 'Review for security issues', argumentHint: '' },
            { name: 'statusline', description: 'Configure status line', argumentHint: '' },
            { name: 'terminal-setup', description: 'Set up terminal integration', argumentHint: '' },
            { name: 'update', description: 'Update Claude Code', argumentHint: '' },
            { name: 'upgrade', description: 'Upgrade Claude Code', argumentHint: '' },
            { name: 'ide', description: 'IDE integration', argumentHint: '' },
            { name: 'plugin', description: 'Manage plugins', argumentHint: '' },
            { name: 'add-dir', description: 'Add directory to context', argumentHint: '<dir>' },
            { name: 'doctor', description: 'Check system setup', argumentHint: '' },
            { name: 'context', description: 'Show context usage', argumentHint: '' },
            { name: 'bashes', description: 'List running background shells', argumentHint: '' },
            { name: 'tasks', description: 'List active tasks', argumentHint: '' },
            { name: 'todos', description: 'Manage todo list', argumentHint: '' },
            { name: 'vim', description: 'Toggle vim mode', argumentHint: '' },
            { name: 'fix', description: 'Fix errors in selected file', argumentHint: '' },
            { name: 'explain', description: 'Explain selected code', argumentHint: '' },
            { name: 'refactor', description: 'Refactor selected code', argumentHint: '' },
            { name: 'test', description: 'Write tests for selected code', argumentHint: '' },
            { name: 'docs', description: 'Generate documentation', argumentHint: '' },
          ];
          window.webContents.send(IPC_CHANNELS.AI_INIT, {
            sessionId: initMsg.session_id || '',
            model: initMsg.model || this.sonnetModel,
            slashCommands: initMsg.slash_commands,
            skills: initMsg.skills,
          });
          // Send built-in commands immediately; supportedCommands() enriches later
          window.webContents.send(IPC_CHANNELS.AI_COMMANDS_LOADED, builtIn);
          this.fetchAndSendCommands(window).catch(err =>
            console.error('[AnthropicClient] fetchAndSendCommands error:', err)
          );
        }
        break;
      }
      case 'result': {
        const result = message as SDKResultMessage;
        console.log('[SDK MSG] result → FULL:', JSON.stringify({
          subtype: result.subtype,
          errors: (result as Record<string, unknown>).errors,
          num_turns: (result as Record<string, unknown>).num_turns,
          total_cost_usd: (result as Record<string, unknown>).total_cost_usd,
          usage: (result as Record<string, unknown>).usage,
          uuid: (result as Record<string, unknown>).uuid,
        }, null, 2));
        window.webContents.send(IPC_CHANNELS.AI_RESULT, {
          subtype: result.subtype,
          errors: 'errors' in result ? result.errors : [],
        });
        window.webContents.send(IPC_CHANNELS.AI_TURN_COMPLETE, {
          uuid: (result as Record<string, unknown>).uuid || '',
          usage: (result as Record<string, unknown>).usage,
          total_cost_usd: (result as Record<string, unknown>).total_cost_usd,
        });
        // Reset dedup trackers for next turn
        this.lastEmittedText = '';
        this.lastEmittedThinking = '';
        this.textBlockStarted = false;
        this.thinkingBlockStarted = false;
        break;
      }
      case 'user': {
        const userMsg = message as SDKUserMessage;
        console.log('[SDK MSG] user → tool_result:', {
          hasToolUseResult: !!userMsg.tool_use_result,
          result: userMsg.tool_use_result ? JSON.stringify(userMsg.tool_use_result).slice(0, 300) : 'none',
          parent_tool_use_id: userMsg.parent_tool_use_id,
        });
        const content = (userMsg.message?.content);
        if (Array.isArray(content)) {
          for (const block of content) {
            const b = block as unknown as Record<string, unknown>;
            if (b.type === 'tool_result') {
              const toolUseId = b.tool_use_id as string;
              if (toolUseId) {
                const result = userMsg.tool_use_result as Record<string, unknown> | undefined;
                console.log('[SDK MSG] user → AI_TOOL_RESULT:', { toolUseId, hasStdout: !!result?.stdout, hasStderr: !!result?.stderr });
                window.webContents.send(IPC_CHANNELS.AI_TOOL_RESULT, {
                  toolUseId,
                  stdout: result?.stdout,
                  stderr: result?.stderr,
                  interrupted: result?.interrupted,
                  isImage: result?.isImage,
                });
              }
            }
          }
        }
        break;
      }
    }
  }

  private routeStreamEvent(msg: SDKPartialAssistantMessage, window: BrowserWindow): void {
    const ev = msg.event;
    switch (ev.type) {
      case 'content_block_start': {
        const block = ev.content_block;
        const blockType = block.type === 'thinking' ? 'thinking' : 'text';
        if (blockType === 'text') this.textBlockStarted = true;
        else this.thinkingBlockStarted = true;
        window.webContents.send(IPC_CHANNELS.AI_CONTENT_BLOCK_START, {
          blockIndex: ev.index,
          type: blockType,
        });
        break;
      }
      case 'content_block_delta': {
        const delta = ev.delta;
        if (delta.type === 'text_delta') {
          this.lastEmittedText += delta.text;
          window.webContents.send(IPC_CHANNELS.AI_TEXT_DELTA, {
            text: delta.text,
            blockIndex: ev.index,
          });
        } else if (delta.type === 'thinking_delta') {
          this.lastEmittedThinking += delta.thinking;
          window.webContents.send(IPC_CHANNELS.AI_THINKING_DELTA, {
            blockIndex: ev.index,
            thinking: delta.thinking,
          });
        }
        break;
      }
      case 'content_block_stop':
        window.webContents.send(IPC_CHANNELS.AI_CONTENT_BLOCK_STOP, {
          blockIndex: ev.index,
        });
        break;
    }
  }

  private routeAssistantMessage(msg: SDKAssistantMessage, window: BrowserWindow): void {
    if (msg.error) {
      // Log the FULL assistant message to understand what the SDK sends on error
      console.log('[SDK MSG] assistant ERROR — full message:', JSON.stringify({
        error: msg.error,
        model: (msg as Record<string, unknown>).model,
        stop_reason: (msg as Record<string, unknown>).stop_reason,
        content_blocks: msg.message.content.map((b) => ({
          type: b.type,
          ...(b.type === 'text' ? { text: (b as unknown as { text: string }).text?.slice(0, 300) } : {}),
          ...(b.type === 'tool_use' ? { name: (b as unknown as { name: string }).name } : {}),
        })),
        usage: (msg as Record<string, unknown>).usage,
      }, null, 2));
      window.webContents.send(IPC_CHANNELS.AI_ERROR, `\n[API Error: ${msg.error}]\n`);
      // Still try to render any content blocks that might be present
      if (msg.message.content.length > 0) {
        console.log('[SDK MSG] assistant ERROR but has content blocks, rendering them anyway');
      } else {
        return;
      }
    }

    for (const block of msg.message.content) {
      if (block.type === 'tool_use') {
        const raw = block as unknown as Record<string, unknown>;
        const description = (raw.description as string) || this.describeTool(block.name, block.input as Record<string, unknown>);
        console.log('[SDK MSG] assistant → AI_TOOL_USE:', { id: block.id, name: block.name, input: JSON.stringify(block.input).slice(0, 200) });
        window.webContents.send(IPC_CHANNELS.AI_TOOL_USE, {
          id: block.id,
          name: block.name,
          input: block.input,
          description,
        });
      } else if (block.type === 'text') {
        const delta = block.text.slice(this.lastEmittedText.length);
        if (delta.length > 0) {
          if (!this.textBlockStarted) {
            window.webContents.send(IPC_CHANNELS.AI_CONTENT_BLOCK_START, { blockIndex: 1000, type: 'text' });
            this.textBlockStarted = true;
          }
          console.log('[SDK MSG] assistant → AI_TEXT_DELTA (delta=' + delta.length + '):', delta.slice(0, 200));
          window.webContents.send(IPC_CHANNELS.AI_TEXT_DELTA, { text: delta, blockIndex: 1000 });
          this.lastEmittedText = block.text;
        }
      } else if (block.type === 'thinking') {
        const delta = block.thinking.slice(this.lastEmittedThinking.length);
        if (delta.length > 0) {
          if (!this.thinkingBlockStarted) {
            window.webContents.send(IPC_CHANNELS.AI_CONTENT_BLOCK_START, { blockIndex: 2000, type: 'thinking' });
            this.thinkingBlockStarted = true;
          }
          console.log('[SDK MSG] assistant → AI_THINKING_DELTA (delta=' + delta.length + ')');
          window.webContents.send(IPC_CHANNELS.AI_THINKING_DELTA, { blockIndex: 2000, thinking: delta });
          this.lastEmittedThinking = block.thinking;
        }
      }
    }
  }

  private routeToolProgress(msg: SDKToolProgressMessage, window: BrowserWindow): void {
    window.webContents.send(IPC_CHANNELS.AI_TOOL_PROGRESS, {
      toolUseId: msg.tool_use_id,
      toolName: msg.tool_name,
      elapsedSeconds: msg.elapsed_time_seconds || 0,
    });
  }

  private routeToolUseSummary(msg: SDKToolUseSummaryMessage, window: BrowserWindow): void {
    window.webContents.send(IPC_CHANNELS.AI_TOOL_USE_SUMMARY, {
      summary: msg.summary,
      toolUseIds: msg.preceding_tool_use_ids || [],
    });
  }

  private createCanUseTool(window: BrowserWindow): CanUseTool {
    return async (toolName, input, options): Promise<PermissionResult> => {
      console.log('[SDK MSG] canUseTool:', { toolName, toolUseID: options.toolUseID, desc: (options.description || '').slice(0, 120) });

      // Send description update — canUseTool has access to options.description
      if (options.description) {
        window.webContents.send(IPC_CHANNELS.AI_TOOL_DESCRIPTION, {
          toolUseId: options.toolUseID,
          description: options.description,
        });
      }

      if (toolName === 'Write' || toolName === 'Edit' || toolName === 'Bash' || toolName === 'AskUserQuestion') {
        // Check permission mode — skip confirmation if bypassing
        if (this.permissionMode === 'bypassPermissions') {
          console.log('[AnthropicClient] canUseTool: bypassPermissions — auto-allowing', toolName);
          return { behavior: 'allow', updatedInput: input as Record<string, unknown> };
        }
        // acceptEdits — auto-allow Write/Edit, still confirm Bash
        if (this.permissionMode === 'acceptEdits' && (toolName === 'Write' || toolName === 'Edit')) {
          console.log('[AnthropicClient] canUseTool: acceptEdits — auto-allowing', toolName);
          return { behavior: 'allow', updatedInput: input as Record<string, unknown> };
        }
        // plan mode — auto-deny Write/Edit
        if (this.permissionMode === 'plan' && (toolName === 'Write' || toolName === 'Edit')) {
          console.log('[AnthropicClient] canUseTool: plan — rejecting', toolName);
          return { behavior: 'deny', message: 'Plan mode: write operations are disabled.' };
        }
        // Session-allowed — user previously clicked "Always Allow"
        if (this.sessionAllowedTools.has(toolName)) {
          console.log('[AnthropicClient] canUseTool: session-allowed — auto-allowing', toolName);
          return { behavior: 'allow', updatedInput: input as Record<string, unknown> };
        }
        let originalContent: string | undefined;
        if (toolName === 'Write' || toolName === 'Edit') {
          const filePath = (input as Record<string, unknown>).file_path as string | undefined;
          if (filePath) {
            try { originalContent = await this.fileSystem.readFile(filePath); } catch { originalContent = ''; }
          }
        }
        console.log('[AnthropicClient] canUseTool: sending AI_TOOL_CONFIRM to renderer');
        window.webContents.send(IPC_CHANNELS.AI_TOOL_CONFIRM, {
          toolName,
          input,
          toolUseID: options.toolUseID,
          title: options.title,
          displayName: options.displayName,
          description: options.description,
          originalContent,
        });
        console.log('[AnthropicClient] canUseTool: AI_TOOL_CONFIRM sent, waiting for confirmation...');

        const signal = options.signal;
        const result = await this.waitForConfirmation(toolName, input, options.toolUseID, signal);
        console.log('[AnthropicClient] canUseTool confirmation result:', { toolName, result });
        return {
          ...result,
          toolUseID: options.toolUseID,
        };
      }

      console.log('[AnthropicClient] canUseTool: auto-allowing', toolName);
      return { behavior: 'allow', updatedInput: input as Record<string, unknown> };
    };
  }

  private waitForConfirmation(
    toolName: string,
    toolInput: Record<string, unknown>,
    toolUseID: string,
    signal: AbortSignal,
  ): Promise<PermissionResult> {
    return new Promise((resolve) => {
      const onAbort = () => {
        console.log('[AnthropicClient] tool confirmation aborted:', toolUseID);
        if (this.pendingToolConfirmation) {
          this.pendingToolConfirmation = null;
        }
        resolve({ behavior: 'deny', message: 'Cancelled', toolUseID });
      };

      signal.addEventListener('abort', onAbort, { once: true });

      this.pendingToolConfirmation = {
        toolName,
        toolInput,
        toolUseID,
        resolve: (result: PermissionResult) => {
          signal.removeEventListener('abort', onAbort);
          resolve(result);
        },
      };
    });
  }

  private cleanup(): void {
    this.isRunning = false;
    this.currentQuery = null;
    this.pushableIterable = null;
    this.pendingToolConfirmation = null;
  }

  /** Summarize an SDK message for verbose logging. */
  private summarizeMessage(msg: SDKMessage): string {
    const base = `type=${msg.type}`;
    switch (msg.type) {
      case 'stream_event': {
        const se = (msg as SDKPartialAssistantMessage).event;
        if (se.type === 'content_block_start') {
          return `${base} stream_event=content_block_start index=${se.index} block_type=${se.content_block.type}`;
        }
        if (se.type === 'content_block_delta') {
          const text = se.delta.type === 'text_delta' ? se.delta.text.slice(0, 200) : '';
          return `${base} stream_event=content_block_delta index=${se.index} delta_type=${se.delta.type} text_preview="${text}"`;
        }
        if (se.type === 'content_block_stop') {
          return `${base} stream_event=content_block_stop index=${se.index}`;
        }
        return `${base} stream_event=${se.type}`;
      }
      case 'assistant': {
        const am = msg as SDKAssistantMessage;
        const blocks = am.message.content.map((b) => {
          const r = b as unknown as Record<string, unknown>;
          if (b.type === 'text') return `text[${(b.text || '').slice(0, 80)}]`;
          if (b.type === 'tool_use') return `tool_use[${r.name} id=${r.id}]`;
          if (b.type === 'thinking') return `thinking[${(b.thinking || '').slice(0, 80)}]`;
          return b.type;
        }).join(', ');
        return `${base} content=[${blocks}] error=${am.error || 'none'}`;
      }
      case 'tool_progress': {
        const tp = msg as SDKToolProgressMessage;
        return `${base} tool=${tp.tool_name} id=${tp.tool_use_id} elapsed=${tp.elapsed_time_seconds}s`;
      }
      case 'tool_use_summary': {
        const ts = msg as SDKToolUseSummaryMessage;
        return `${base} ids=[${ts.preceding_tool_use_ids?.join(',')}] summary="${(ts.summary || '').slice(0, 120)}"`;
      }
      case 'user': {
        const um = msg as SDKUserMessage;
        const hasResult = !!um.tool_use_result;
        return `${base} hasToolResult=${hasResult} parentId=${um.parent_tool_use_id || 'none'} isSynthetic=${um.isSynthetic || false}`;
      }
      case 'system': {
        const sm = msg as SDKStatusMessage;
        return `${base} subtype=${sm.subtype} status=${sm.status || 'none'}`;
      }
      case 'result': {
        const rm = msg as SDKResultMessage;
        return `${base} subtype=${rm.subtype} errors=${JSON.stringify((rm as Record<string, unknown>).errors || [])}`;
      }
      default:
        return base;
    }
  }

  /** Generate a human-readable description from tool input as a fallback. */
  private describeTool(name: string, input: Record<string, unknown>): string {
    switch (name) {
      case 'Bash': {
        const cmd = (input.command as string) || '';
        return cmd.length > 120 ? cmd.slice(0, 117) + '...' : cmd;
      }
      case 'Write':
        return `Write file: ${input.file_path || '(unknown)'}`;
      case 'Edit':
        return `Edit file: ${input.file_path || '(unknown)'}`;
      case 'Read':
        return `Read file: ${input.file_path || '(unknown)'}`;
      case 'Glob':
        return `Find files: ${input.pattern || '(unknown)'}`;
      case 'Grep':
        return `Search: ${input.pattern || '(unknown)'}`;
      case 'BashOutput':
        return `Read output: ${input.block_id || ''}`;
      case 'Task':
        return `Task: ${input.subagent_type || input.description || ''}`;
      default:
        return '';
    }
  }
}
