import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { AnthropicClient } from '../services/anthropic-client';
import type { ReviewResult } from '../../shared/types';
import fs from 'fs';
import path from 'path';

let anthropicClient: AnthropicClient | null = null;

export function setAnthropicClient(client: AnthropicClient): void {
  anthropicClient = client;
}

export function registerAiHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AI_START_SESSION, async (event, modelKey?: string, permissionMode?: string, effortLevel?: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) throw new Error('No window found');
    if (!anthropicClient) throw new Error('AnthropicClient not initialized');
    await anthropicClient.startSession(window, modelKey || 'sonnet', permissionMode || 'default', effortLevel || 'high');
  });

  ipcMain.handle(IPC_CHANNELS.AI_SEND, async (_event, message: string) => {
    if (!anthropicClient) throw new Error('AnthropicClient not initialized');
    anthropicClient.sendUserMessage(message);
  });

  ipcMain.handle(IPC_CHANNELS.AI_INTERRUPT, async () => {
    if (!anthropicClient) throw new Error('AnthropicClient not initialized');
    await anthropicClient.interruptSession();
  });

  ipcMain.handle(IPC_CHANNELS.AI_CANCEL, async () => {
    if (!anthropicClient) throw new Error('AnthropicClient not initialized');
    await anthropicClient.cancelCurrentResponse();
  });

  ipcMain.handle(IPC_CHANNELS.AI_GET_CONTEXT_USAGE, async () => {
    if (!anthropicClient) throw new Error('AnthropicClient not initialized');
    return anthropicClient.getContextUsage();
  });

  ipcMain.handle(IPC_CHANNELS.AI_CONFIRM_TOOL, async (_event, approved: boolean, toolUseID?: string, alwaysAllow?: boolean) => {
    if (!anthropicClient) throw new Error('AnthropicClient not initialized');
    console.log('[AI IPC] confirm-tool received:', { approved, toolUseID, alwaysAllow });
    anthropicClient.confirmTool(approved, toolUseID, alwaysAllow);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.AI_ANSWER_QUESTION, async (_event, toolUseId: string, answer: string) => {
    if (!anthropicClient) throw new Error('AnthropicClient not initialized');
    console.log('[AI IPC] answer-question received:', { toolUseId, answer: answer.slice(0, 100) });
    anthropicClient.sendToolResult(toolUseId, answer);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.AI_GET_COMMANDS, async () => {
    if (!anthropicClient) throw new Error('AnthropicClient not initialized');
    return anthropicClient.getSupportedCommands();
  });

  ipcMain.handle(IPC_CHANNELS.AI_INLINE_COMPLETE, async (_event, params: { codeBefore: string; codeAfter: string; language: string; filePath: string }) => {
    const { getActiveProfile } = await import('../store/config-store');
    const profile = getActiveProfile();
    if (!profile?.apiKey) return { text: null };

    const model = profile.smallFastModel || profile.model || 'claude-haiku-4-5-20250515';
    const baseUrl = profile.baseUrl || 'https://api.anthropic.com';

    const prompt = `${
      params.codeBefore
    }`
    const system = `You are a code completion engine. Return ONLY the code that should follow at the cursor position. No explanations, no markdown formatting, no backticks. Just the code. Keep it short — typically 1-3 lines. Match the indentation and style of the surrounding code.

File: ${params.filePath}
Language: ${params.language}${
      params.codeAfter ? `\n\nCode after cursor:\n${params.codeAfter}` : ''
    }`;

    try {
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': profile.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 64,
          temperature: 0.1,
          system,
          stop_sequences: ['\n\n'],
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) return { text: null };
      const data = await response.json() as Record<string, unknown>;
      const content = (data as { content?: Array<{ type: string; text?: string }> }).content;
      const text = content?.find((c) => c.type === 'text')?.text?.trim() || null;
      return { text };
    } catch {
      return { text: null };
    }
  });

  // Code review — one-shot API call, not agent SDK
  ipcMain.handle(IPC_CHANNELS.AI_REVIEW_CODE, async (_event, scope: string, commitHash?: string) => {
    const { getActiveProfile } = await import('../store/config-store');
    const profile = getActiveProfile();
    if (!profile?.apiKey) throw new Error('No API key configured');

    const diag: string[] = [];
    const log = (msg: string) => { console.log(msg); diag.push(msg); };
    const makeResult = (findings: ReviewResult['findings'], summary: string): ReviewResult =>
      ({ findings, summary, diagnostics: diag.join('\n') });

    let diffText = '';
    let filesList = '';

    // Try git
    const { getGitService } = await import('./git');
    const git = getGitService();
    if (git) {
      try {
        if (scope === 'working') {
          const d = await git.diff();
          const s = await git.diffStaged();
          diffText = (s.trim() ? s + '\n' : '') + d;
          const status = await git.getStatus();
          filesList = status.files.map(f => `${f.status}: ${f.path}`).join('\n');
        } else if (scope === 'staged') {
          diffText = await git.diffStaged();
          const status = await git.getStatus();
          filesList = status.files.filter(f => f.status === 'staged').map(f => f.path).join('\n');
        } else if (scope === 'head') {
          diffText = await git.diffBase('HEAD~1');
        } else if (scope === 'commit' && commitHash) {
          diffText = await git.diffBase(commitHash);
        }
        log(`Git: diff=${diffText.length}chars scope=${scope}`);
      } catch (e) { log(`Git error: ${e}`); }
    } else { log('Git service not initialized'); }

    // If git had no changes, try svn
    if (!diffText.trim()) {
      log('Git diff empty, trying SVN...');
      const { getSvnService } = await import('./svn');
      const svn = getSvnService();
      log(`SVN service: ${!!svn}`);
      if (svn) {
        try {
          if (scope === 'working' || scope === 'staged') {
            const status = await svn.getStatus();
            log(`SVN status: files=${status.files.length} rev=${status.revision}`);
            for (const f of status.files) {
              log(`  SVN: ${f.status} ${f.path}`);
            }
            const rawDiff = await svn.diff();
            log(`SVN raw diff chars: ${rawDiff.length}`);

            if (!rawDiff.trim() && status.files.length > 0) {
              log('SVN diff empty, reading files from disk...');
              const { getProjectRoot } = await import('./project');
              const root = getProjectRoot();
              log(`Project root: ${root || '(empty)'}`);
              const parts: string[] = [];
              for (const f of status.files.slice(0, 30)) {
                parts.push(`\n--- ${f.path} (${f.status}) ---`);
                if (f.status === 'deleted') {
                  parts.push('[File deleted]');
                } else {
                  try {
                    const absPath = path.join(root, f.path);
                    const content = fs.readFileSync(absPath, 'utf-8');
                    parts.push(content.slice(0, 2000));
                  } catch (err) { log(`  read ${f.path} FAILED: ${err}`); parts.push('[Read error]'); }
                }
              }
              diffText = parts.join('\n');
              log(`Constructed diff from files: ${diffText.length} chars`);
            }
            if (rawDiff.trim()) diffText = rawDiff;
            const svnFiles = status.files.map(f => `${f.status}: ${f.path}`).join('\n');
            if (svnFiles) filesList = svnFiles;
          } else if (scope === 'head') {
            diffText = await svn.diffPrevHead();
            log(`SVN prevHead diff: ${diffText.length} chars`);
          } else if (scope === 'commit' && commitHash) {
            diffText = await svn.diffRevision(commitHash);
            log(`SVN rev ${commitHash} diff: ${diffText.length} chars`);
          }
        } catch (e) { log(`SVN error: ${e}`); }
      }
    } else { log('Using git diff'); }

    if (!diffText.trim()) {
      return makeResult([], 'No changes to review.');
    }

    // Truncate diff to avoid token limits
    const MAX_DIFF = 60000;
    const truncatedDiff = diffText.length > MAX_DIFF
      ? diffText.slice(0, MAX_DIFF) + '\n\n... (diff truncated)'
      : diffText;

    // Clean ANSI escape codes from model name (terminal formatting artifact)
    const cleanModelName = (name: string): string =>
      name.replace(/\x1b\[[0-9;]*m/g, '').replace(/\[\d+m\]?/g, '').trim();
    const model = cleanModelName(profile.sonnetModel || profile.opusModel || profile.model || 'claude-sonnet-4-6');
    const baseUrl = profile.baseUrl || 'https://api.anthropic.com';

    const systemPrompt = `You are a senior code reviewer. Analyze the code diff provided and return a structured JSON review.

Follow these rules:
1. Focus on REAL issues, not nitpicks. Skip trivial style preferences.
2. For each finding, identify: file path, approximate line number (from diff headers or file content), severity, category, a concise title, detailed description, and actionable suggestion.
3. Severity levels: "critical" (security/data loss), "high" (likely bug), "medium" (code smell/maintainability), "low" (minor improvement), "info" (observation).
4. Categories: "security", "bug", "performance", "style", "maintainability".
5. Be specific — reference exact variable names, function names, and patterns.
6. Write in Chinese if the code comments/variables are in Chinese, otherwise English.

Return VALID JSON ONLY in this exact format:
{
  "summary": "overall assessment in 1-2 sentences",
  "findings": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "high",
      "category": "bug",
      "title": "short title",
      "description": "detailed explanation",
      "suggestion": "how to fix it"
    }
  ]
}`;

    const userMessage = filesList
      ? `Review the following diff:\n\nChanged files:\n${filesList}\n\nDiff:\n${truncatedDiff}`
      : `Review the following diff:\n\n${truncatedDiff}`;

    try {
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': profile.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          temperature: 0.3,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`API error ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json() as Record<string, unknown>;
      const content = (data as { content?: Array<{ type: string; text?: string }> }).content;
      const text = content?.find((c) => c.type === 'text')?.text?.trim();

      if (!text) throw new Error('Empty response from API');

      // Extract JSON from response (may have markdown code fences)
      const jsonMatch = text.match(/\{[\s\S]*"findings"[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No valid JSON found in response');

      const result = JSON.parse(jsonMatch[0]) as {
        summary: string;
        findings: Array<{
          file: string; line: number; severity: string; category: string;
          title: string; description: string; suggestion: string;
        }>;
      };

      // Validate and sanitize findings
      const validSeverities = new Set(['critical', 'high', 'medium', 'low', 'info']);
      const validCategories = new Set(['security', 'bug', 'performance', 'style', 'maintainability']);

      return makeResult(
        (result.findings || []).map((f) => ({
          file: String(f.file || ''),
          line: Math.max(1, parseInt(String(f.line), 10) || 1),
          severity: (validSeverities.has(f.severity) ? f.severity : 'medium') as ReviewResult['findings'][number]['severity'],
          category: (validCategories.has(f.category) ? f.category : 'maintainability') as ReviewResult['findings'][number]['category'],
          title: String(f.title || ''),
          description: String(f.description || ''),
          suggestion: String(f.suggestion || ''),
        })),
        result.summary || '',
      );
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(`Failed to parse review response: ${err.message}`);
      }
      throw err;
    }
  });
}
