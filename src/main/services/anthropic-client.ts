import Anthropic from '@anthropic-ai/sdk';
import { BrowserWindow } from 'electron';
import { TOOL_DEFINITIONS } from '../../shared/tool-schemas';
import { IPC_CHANNELS } from '../../shared/constants';
import { ToolExecutor } from './tool-executor';
import { FileSystemService } from './file-system';

export class AnthropicClient {
  private client: Anthropic | null = null;
  private messages: Anthropic.MessageParam[] = [];
  private pendingToolConfirmation: {
    toolName: string;
    toolInput: Record<string, unknown>;
    resolve: (approved: boolean) => void;
  } | null = null;

  constructor(
    private fileSystem: FileSystemService,
    private toolExecutor: ToolExecutor,
  ) {}

  setApiKey(key: string): void {
    this.client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
  }

  private buildSystemPrompt(): string {
    const projectStructure = this.getProjectStructureSummary();
    return `You are an expert software engineer working in an IDE called HICC.
You can read, write, and modify project files using the available tools.
Always think before acting and explain your reasoning.

Current project structure:
\`\`\`
${projectStructure}
\`\`\`

Guidelines:
- Read files before modifying them
- Use search_code to find relevant code
- Present changes clearly with explanations
- Write clean, idiomatic, well-typed code
- Follow existing project patterns and conventions`;
  }

  private getProjectStructureSummary(): string {
    // Lightweight summary — just top-level entries to save tokens
    try {
      return 'Project files available via list_files tool';
    } catch {
      return '(project structure unavailable)';
    }
  }

  async sendMessage(userMessage: string, window: BrowserWindow): Promise<void> {
    if (!this.client) {
      window.webContents.send(IPC_CHANNELS.AI_DELTA, 'Error: API key not configured. Please set your Anthropic API key in settings.\n');
      return;
    }

    this.messages.push({ role: 'user', content: userMessage });
    if (this.messages.length > 50) {
      this.messages = this.messages.slice(-50);
    }

    try {
      await this.runConversation(window);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      window.webContents.send(IPC_CHANNELS.AI_DELTA, `\nError: ${message}\n`);
    }
  }

  private async runConversation(window: BrowserWindow): Promise<void> {
    let shouldContinue = true;

    while (shouldContinue) {
      const response = await this.client!.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: this.buildSystemPrompt(),
        tools: TOOL_DEFINITIONS,
        messages: this.messages,
      });

      let assistantContent = '';

      for (const block of response.content) {
        if (block.type === 'text') {
          assistantContent += block.text;
          window.webContents.send(IPC_CHANNELS.AI_DELTA, block.text);
        } else if (block.type === 'tool_use') {
          window.webContents.send(IPC_CHANNELS.AI_DELTA, `\n[Using tool: ${block.name}]\n`);

          // For write_file and run_command, ask user confirmation
          if (block.name === 'write_file') {
            window.webContents.send(IPC_CHANNELS.AI_TOOL_CONFIRM, {
              name: block.name,
              input: block.input,
            });
            const approved = await this.waitForConfirmation();
            if (!approved) {
              window.webContents.send(IPC_CHANNELS.AI_DELTA, '\n[Tool use rejected by user]\n');
              const toolResult = { content: 'User rejected this file write operation.', isError: true };
              this.messages.push({ role: 'assistant', content: response.content });
              this.messages.push({
                role: 'user',
                content: [{ type: 'tool_result', tool_use_id: block.id, content: toolResult.content }],
              });
              assistantContent += `\n[Tool ${block.name} was rejected]\n`;
              continue;
            }
          }

          const result = await this.toolExecutor.executeTool(
            block.name,
            block.input as Record<string, unknown>,
            this.fileSystem['projectRoot'] || '',
          );

          this.messages.push({ role: 'assistant', content: response.content });
          this.messages.push({
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: block.id, content: result.content }],
          });
        }
      }

      if (assistantContent) {
        this.messages.push({ role: 'assistant', content: assistantContent });
      }

      // Check if we should stop (no tool calls)
      const hasToolUse = response.content.some((block) => block.type === 'tool_use');
      shouldContinue = hasToolUse;
    }
  }

  private waitForConfirmation(): Promise<boolean> {
    return new Promise((resolve) => {
      this.pendingToolConfirmation = { toolName: '', toolInput: {}, resolve };
    });
  }

  confirmTool(approved: boolean): void {
    if (this.pendingToolConfirmation) {
      this.pendingToolConfirmation.resolve(approved);
      this.pendingToolConfirmation = null;
    }
  }

  resetConversation(): void {
    this.messages = [];
  }
}
