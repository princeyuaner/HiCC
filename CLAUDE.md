# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

HICC is an AI-powered coding IDE built as an Electron desktop app. It integrates the `@anthropic-ai/claude-agent-sdk` to provide Claude-driven coding assistance with tool execution (file operations, bash commands), a code editor (Monaco), and an embedded terminal (xterm + node-pty). The renderer is a React SPA using Zustand for state management.

## Commands

```bash
npm run dev              # Start both renderer dev server + Electron main process
npm run dev:renderer     # Vite dev server only (localhost:5173)
npm run dev:main         # Compile main process TS and launch Electron
npm run build            # Production build (renderer + main)
npm run build:renderer   # Vite build only
npm run build:main       # TypeScript compilation for main process only
npm run package          # Full build + electron-builder packaging
npm test                 # Run Vitest tests once
npm run test:watch       # Run tests in watch mode
npx vitest run tests/path/to/test.test.ts   # Run a single test file
```

## TypeScript config

Two separate tsconfig files because main and renderer target different module systems:

- **`tsconfig.json`** — renderer process. `module: "ESNext"`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`. Includes `src/renderer` and `src/shared`.
- **`tsconfig.main.json`** — main process. `module: "commonjs"`, `moduleResolution: "node"`. Includes `src/main` and `src/shared`.

Both use `@shared/*` → `src/shared/*` path alias.

Vite handles the renderer build (with `@vitejs/plugin-react`), serving from `src/renderer` as root. The `@shared` alias is also configured in `vite.config.ts` and `vitest.config.ts`.

## Architecture

### Process model

```
Main process (src/main/)               Renderer (src/renderer/)
├── index.ts         entry             ├── App.tsx           root layout
├── preload.ts       IPC bridge        ├── components/       React UI
├── ipc/             handlers          │   ├── chat/         ChatPanel, MessageList, etc.
│   ├── index.ts     registerAll       │   ├── editor/       CodeEditor, FileExplorer
│   ├── ai.ts        AI session/IPC    │   ├── layout/       Sidebar, Toolbar
│   ├── chat.ts      conversation CRUD │   └── terminal/     TerminalPanel
│   ├── config.ts    profiles/MCP      ├── store/
│   ├── file.ts      file operations   │   └── app-store.ts  Zustand (single store)
│   ├── project.ts   open/set project  └── types/
│   └── terminal.ts  terminal IPC
├── services/        business logic
│   ├── anthropic-client.ts   SDK integration
│   ├── file-system.ts        fs operations + search
│   ├── terminal-manager.ts   node-pty sessions
│   ├── file-watcher.ts       chokidar watcher
│   ├── claude-settings.ts    ~/.claude/settings.json R/W
│   └── pushable-async-iterable.ts
└── store/
    └── config-store.ts       electron-store (profiles, projects, MCP, session)
```

### IPC flow

The renderer calls `window.hicc.<method>()` (defined via `contextBridge.exposeInMainWorld` in preload.ts). Each method maps to an `ipcRenderer.invoke` call. Main-process handlers in `src/main/ipc/` register via `ipcMain.handle`. The shared type `HiccApi` in `src/shared/types.ts` defines the full contract.

Main→renderer events (e.g., streaming AI output) use `webContents.send` and are received via listeners registered in `preload.ts` that call `ipcRenderer.on`.

### Two persistent stores

The app uses two separate `electron-store` instances:

- **`config-store.ts`** — encrypted with `'hicc-config-v1'`. Stores API profiles, active profile, recent projects, theme, MCP server configs, and session state.
- **`chat.ts`** (IPC handler) — encrypted with `'hicc-chat-v1'`. Stores conversation history (up to 50 conversations). Separate from config so chat data doesn't bloat the config store.

### AI session lifecycle

1. `AnthropicClient.startSession(window, modelKey)` dynamically imports the SDK, creates a `query({ prompt: PushableAsyncIterable, options })`, and begins iterating messages in `processMessages()`.
2. `PushableAsyncIterable<T>` is a custom async iterable that blocks until `.push()` is called — this feeds user messages into the long-lived SDK query.
3. `routeMessage()` dispatches each `SDKMessage` by type: `stream_event` → text/thinking deltas; `assistant` → tool_use blocks; `tool_progress` / `tool_use_summary` → execution status; `system` → status/init; `result` → final outcome.
4. `sendUserMessage(text)` pushes a new `SDKUserMessage` into the async iterable to start the next turn.
5. `interruptSession()` calls `query.interrupt()` and runs `cleanup()`.

**Deduplication**: The SDK's `includePartialMessages: true` option causes content blocks to be re-emitted. `AnthropicClient` tracks `lastEmittedText`, `lastEmittedThinking`, and block-started flags to deduplicate before sending to the renderer.

### Tool confirmation flow

The SDK calls `canUseTool(toolName, input, options)` defined in `createCanUseTool()`. For Write/Edit/Bash tools, the main process sends `ai:tool-confirm` to the renderer, which shows `ToolConfirmDialog`. The user's choice flows back through `Store.confirmTool()` → `window.hicc.confirmTool()` → IPC `ai:confirm-tool` → `AnthropicClient.confirmTool()` → resolves the pending Promise with a `PermissionResult`.

**Permission levels** (in `src/shared/constants.ts`):
- `AUTO` (0) — auto-approve all tools
- `CONFIRM` (1) — prompt for dangerous operations
- `APPROVE` (2) — always ask for confirmation

`DANGEROUS_COMMAND_PATTERNS` includes patterns like `rm -rf /`, `git push --force`, `DROP TABLE`, `DELETE FROM`, and `sudo`.

### AskUserQuestion flow

When the SDK calls `AskUserQuestion`, the main process sends the question data to the renderer. The app-store stores it in `pendingAskUserQuestion`, which triggers `AskUserQuestionDialog`. The user's answers flow back through `answerAskUserQuestion()` → IPC `ai:answer-question`.

### Message editing and retry

Users can edit a previous user message and resend. The flow:

1. `editAndRetry(messageId, newContent)` finds the message index, trims all messages after it, then sends the edited text.
2. `retryFromMessage(messageId)` retries from the user message before the given assistant message ID.
3. `resendFromIndex(trimIndex, text)` truncates the message array at `trimIndex`, inserts a new user+assistant pair, and calls `window.hicc.sendMessage()`.

### Tool result race condition

The app-store has a `pendingToolResults` Map to handle out-of-order IPC messages — tool results can arrive before the corresponding `tool_use` content block is created. When `onToolResult` fires for an unknown `toolUseId`, the result is buffered; when `onToolUse` later creates the block, it checks the buffer.

### File watching

`FileWatcherService` wraps `chokidar`. On project open, it watches the project root (ignoring `.git`, `node_modules`, `dist`, `build`, `.next`, `.cache`). File add/change/unlink events are sent to the renderer via `file:changed` IPC.

### Terminal management

`TerminalManager` wraps `node-pty`. On Windows it spawns `powershell.exe`; on other platforms `bash`. Each session gets a unique ID (`terminal-N`). Data from the pty is forwarded to the renderer via `terminal:data` IPC; user input from the renderer is written to the pty via `terminal:write`.

### Claude settings integration

`claude-settings.ts` reads/writes `~/.claude/settings.json`. The `env` block maps model keys:
- `ANTHROPIC_DEFAULT_SONNET_MODEL` → `profile.sonnetModel`
- `ANTHROPIC_DEFAULT_OPUS_MODEL` → `profile.opusModel`
- `ANTHROPIC_SMALL_FAST_MODEL` → `profile.smallFastModel`

When a profile is saved or switched, `syncProfileToClaude()` writes back to Claude's settings.json preserving all other keys. The SDK is launched with per-model env vars so switching the model key (sonnet/opus/haiku) in the chat UI picks the right model.

### MCP server configuration

Two types of MCP servers are supported (defined in `src/shared/types.ts`):
- **stdio**: `{ type?: 'stdio', command, args?, env? }` — spawns a local process
- **network**: `{ type: 'sse' | 'http', url, headers? }` — connects to a remote endpoint

Stored in config-store under `mcpServers`.

### Persistent config

`config-store.ts` uses `electron-store` with encryption key `'hicc-config-v1'`. It stores API profiles (with per-model fields), active profile ID, recent projects, theme, MCP server configs, and session state. Profile fields include `sonnetModel`, `opusModel`, `smallFastModel`, and a legacy `model` field used as fallback.

### Message content model

Chat messages use `ContentBlock[]` in the renderer. Block types:
- `text` — streaming text with `complete` flag
- `thinking` — collapsible thinking content with `complete` flag
- `tool_use` — tool execution card with status (`pending` → `executing` → `executed` / `rejected`)

The store's `onTextDelta`, `onThinkingDelta`, `onContentBlockStart`, `onContentBlockStop`, `onToolUse`, `onToolProgress`, `onToolUseSummary`, `onTurnComplete` methods each target the last assistant message and mutate its content blocks immutably.

### Cost estimation

The app-store hardcodes per-model pricing (USD per 1M tokens):
- sonnet: $3 input / $15 output
- opus: $15 input / $75 output
- haiku: $0.80 input / $4 output

Cumulative tokens and cost are tracked across turns in `cumulativeInputTokens`, `cumulativeOutputTokens`, `cumulativeCost`.
