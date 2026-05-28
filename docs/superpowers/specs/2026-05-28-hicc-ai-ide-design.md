# HICC — AI-Powered Coding IDE Design Spec

**Date:** 2026-05-28
**Status:** Approved

## Overview

HICC is an Electron desktop IDE that integrates Claude Code via the Anthropic API as its core programming experience. It combines AI-driven code generation with essential IDE capabilities (file management, code editor, terminal) in a panel-based layout.

### Goals

- Provide an AI-first coding experience where Claude can read, write, and modify project files
- Offer basic IDE features (file tree, editor, terminal) without competing with full IDEs
- Ship as a distributable desktop app for developer teams
- Maintain clear safety boundaries between AI autonomy and user control

### Non-Goals (v1)

- Plugin/extension system
- Multi-user collaboration
- Git GUI integration (terminal-based git only)
- Debugger integration

---

## Architecture

```
Electron App
├── Main Process (Node.js)
│   ├── File System Manager     — file ops, chokidar watching
│   ├── Anthropic API Client    — conversation, tool use orchestration
│   ├── Tool Executor           — executes AI tool calls, enforces safety rules
│   ├── Terminal Manager        — node-pty sessions
│   └── Project Store           — better-sqlite3 for sessions, electron-store for config
│
├── Renderer Process (React + TypeScript)
│   ├── Chat Panel              — streaming message list, input box, diff preview
│   ├── Code Editor (Monaco)    — syntax highlighting, multi-tab, basic completions
│   ├── File Explorer           — project tree with CRUD operations
│   ├── Terminal Panel (xterm)  — embedded shell
│   └── Sidebar / Layout        — draggable panel containers
│
├── Shared Types                — IPC channel definitions, tool schemas
└── Resources                   — icons, app assets
```

### Component Tree

```
App.tsx
├── Sidebar.tsx              — left icon bar (files, search, git, settings)
├── Panel.tsx (resizable)
│   ├── EditorTabs.tsx       — open file tabs
│   │   └── CodeEditor.tsx   — Monaco editor wrapper
│   └── (bottom panel)
│       ├── ChatPanel.tsx
│       │   ├── MessageList.tsx
│       │   │   └── MessageBubble.tsx (with code block rendering)
│       │   ├── InputBox.tsx
│       │   └── DiffPreview.tsx
│       └── TerminalPanel.tsx (xterm.js)
├── FileExplorer.tsx         — file tree in sidebar panel
└── Toolbar.tsx              — top bar with project name, actions
```

### State Management

- **Renderer**: zustand for global state (active file, open tabs, chat messages, panel layout)
- **Main**: Service classes with no global state manager (each service is self-contained)
- **IPC**: All AI calls proxied through main process; renderer never touches API keys directly

---

## AI Integration

### Anthropic API Client

- Direct integration with `@anthropic-ai/sdk`
- System prompt auto-injects current project file tree summary (token-efficient context)
- Streaming text deltas forwarded to renderer via IPC
- Tool use interception: main process executes, results injected back to API conversation

### Tool Set (5 tools)

| Tool | Parameters | Behavior |
|------|-----------|----------|
| `read_file` | `path`, `offset?`, `limit?` | Read project files, supports partial reads |
| `write_file` | `path`, `content` | Write/overwrite files, requires user confirmation |
| `run_command` | `command`, `cwd?` | Execute shell commands, dangerous ones require approval |
| `search_code` | `pattern`, `glob?` | Code search backed by ripgrep |
| `list_files` | `path?`, `depth?` | List directory structure |

### Safety: Three-Level Permission System

| Level | Scope | Examples |
|-------|-------|----------|
| **0 — Auto** | Read-only, safe | `read_file`, `list_files`, `search_code` |
| **1 — Confirm** | Mutations | `write_file`, create, delete files |
| **2 — Approve** | High-risk | `npm install`, `git push`, `rm -rf` |

### Risk Detection Rules

- Commands containing `rm -rf /`, `git push --force`, `DROP TABLE` → blocked
- File paths with `..` or absolute paths outside project → blocked
- Rapid-fire `write_file` calls → rate-limited with user notification

---

## Core Features

| Module | Feature | Priority |
|--------|---------|----------|
| **AI Chat** | Multi-turn conversation, streaming output, code syntax highlighting | P0 |
| **AI Tools** | File read/write, command execution, code search | P0 |
| **Diff Preview** | Before/after comparison, per-change accept/reject | P0 |
| **Code Editor** | Monaco editor, syntax highlighting, multi-tab, basic completions | P0 |
| **File Tree** | Project directory browsing, create/delete/rename | P0 |
| **Terminal** | Embedded terminal (xterm.js + node-pty) | P1 |
| **Project Mgmt** | Open/switch projects, recent project list | P1 |
| **Theme** | Light/dark theme toggle | P1 |
| **Session History** | Save/restore conversation history | P2 |

---

## Data Flow

### Primary Flow: AI Coding Request

```
User input → ChatPanel → useChat hook → IPC (ai.ts)
                                              │
                                         Main Process
                                              │
                                        anthropic-client
                                        (with project context)
                                              │
                                        Anthropic API
                                              │
                                        Response (may include tool_use)
                                              │
                                        tool-executor
                                        (execute file ops / commands)
                                              │
                                        Results back to API
                                              │
                                        Final response
                                              │
              Renderer ←── IPC ←── (diff / code blocks)
                   │
             DiffPreview renders changes
              User accept / reject
                   │
            Files written to disk
```

---

## Error Handling

### Renderer Layer (React Error Boundaries)

- Chat message render failure → degraded text fallback
- Monaco editor exception → fallback textarea
- Panel crash → isolated error boundary, other panels unaffected

### IPC Layer

- Timeout (30s) → single retry + user notification
- Serialization failure → fallback to plain text
- Connection lost → auto-reconnect + state recovery

### API Layer

- Network error → exponential backoff (3 retries)
- Rate limit (429) → wait + countdown display
- Token limit exceeded → auto-trim context + retry
- Invalid API key → guide user to settings

### File Operations

- Permission denied → notification with suggested fix
- External file modification → conflict detection + diff merge prompt
- Disk full → cleanup suggestion

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Desktop Shell | Electron |
| Frontend | React 18 + TypeScript 5 |
| Code Editor | Monaco Editor (`@monaco-editor/react`) |
| Terminal | xterm.js + node-pty |
| State (Renderer) | zustand |
| State (Main) | Service classes (no global store) |
| Database | better-sqlite3 (sessions), electron-store (config) |
| File Watching | chokidar |
| AI SDK | `@anthropic-ai/sdk` |
| IPC Validation | zod (runtime type checking on IPC boundaries) |
| Testing | Vitest + React Testing Library + Playwright |
| Packaging | electron-builder |

---

## Testing Strategy

| Level | Tool | Focus |
|-------|------|-------|
| Unit | Vitest | `anthropic-client`, `tool-executor`, `file-system` services |
| Component | React Testing Library | `MessageBubble`, `DiffPreview`, `InputBox` core interactions |
| IPC | Vitest + mocks | IPC channel type safety, serialization correctness |
| E2E | Playwright | Critical paths: open project → chat → AI edits file → preview → confirm |

Focus on correctness of core modules over arbitrary coverage targets.

---

## Project Structure

```
HICC/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts
│   │   ├── ipc/
│   │   │   ├── file.ts
│   │   │   ├── project.ts
│   │   │   ├── terminal.ts
│   │   │   └── ai.ts
│   │   ├── services/
│   │   │   ├── file-watcher.ts
│   │   │   ├── file-system.ts
│   │   │   ├── anthropic-client.ts
│   │   │   ├── tool-executor.ts
│   │   │   └── terminal.ts
│   │   └── store/
│   │       └── project-store.ts
│   ├── renderer/                # React app
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── layout/          (Sidebar, Panel, Toolbar)
│   │   │   ├── chat/            (ChatPanel, MessageList, MessageBubble, InputBox, DiffPreview)
│   │   │   ├── editor/          (CodeEditor, EditorTabs, FileExplorer)
│   │   │   ├── terminal/        (TerminalPanel)
│   │   │   └── common/          (Dialog, ContextMenu)
│   │   ├── hooks/               (useChat, useFileTree, useTheme)
│   │   ├── store/               (app-store.ts, zustand)
│   │   └── types/
│   └── shared/                  # Shared between main & renderer
│       ├── types.ts             # IPC channel types
│       └── constants.ts
├── resources/                   # Icons, static assets
├── package.json
├── tsconfig.json
└── electron-builder.yml
```
