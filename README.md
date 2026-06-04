# HiCC - AI-Powered Coding IDE

[中文版](README_ZH.md)

An intelligent desktop IDE built with **Electron + React + TypeScript**, integrating **Claude AI** for code generation, review, and assistance.

## ✨ Features

### 🤖 AI Integration
- **Chat-based coding assistant** powered by Anthropic Claude Agent SDK
- **Streaming responses** with real-time text/thinking deltas
- **Tool execution** — read, write, edit files, run bash commands
- **Code review workflow** — AI analyzes git/SVN diffs, finds bugs, suggests fixes
- **Tool confirmation** and permission management system
- **1M context window** support for large codebases

### 📝 Code Editor
- **Monaco Editor** — VS Code-powered editing experience
- **Syntax highlighting** for all major languages
- **Multi-tab editing** with file dirty state tracking
- **Diff preview** — accept/reject AI-generated changes inline

### 📁 File Management
- **Streaming file tree** — progressive loading like PyCharm indexing
- **Live file watching** — updates on external changes (chokidar)
- **SFTP/SSH remote filesystem** support

### 🔍 Global Search
- **Ripgrep-powered** content search
- **Filename + content** dual search
- **Filters**: case sensitive, whole word, regex, file type globs
- **Collapsible per-file groups** with match highlighting
- **Keyboard navigation** (↑↓ Enter Escape)

### 🔀 Version Control
- **Git panel** — status, diff, stage/unstage, commit, branch switch, pull/push
- **SVN panel** — status, diff, add, revert, commit, update

### 💻 Terminal
- **Embedded terminal** (xterm.js + node-pty)
- **Multiple sessions** support

### ⚙️ Configuration
- **Multiple API profiles** with per-model configuration
- **MCP server support** (stdio + SSE/HTTP)
- **Claude settings sync** — reads/writes `~/.claude/settings.json`
- **Dark/Light theme**

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18
- **Git** (optional, for version control features)
- **SVN** (optional, for SVN support)
- **ripgrep** (`rg`) (optional, for content search; falls back to Node.js grep)
- **Anthropic API key** (or compatible proxy)

### Install & Run

```bash
git clone https://github.com/princeyuaner/HiCC.git
cd HiCC
npm install
npm run dev
```

### Build

```bash
npm run build    # Build renderer + main
npm run package  # Build + package as desktop app
```

## 📂 Project Structure

```
HiCC/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # App entry, window creation
│   │   ├── preload.ts  # IPC bridge (contextBridge)
│   │   ├── ipc/        # IPC handlers (ai, file, git, svn, chat, config...)
│   │   ├── services/   # Business logic
│   │   │   ├── anthropic-client.ts  # Claude Agent SDK integration
│   │   │   ├── file-system.ts       # FS + search (ripgrep)
│   │   │   ├── git-service.ts       # SimpleGit wrapper
│   │   │   ├── svn-service.ts       # SVN CLI wrapper
│   │   │   ├── terminal-manager.ts  # node-pty sessions
│   │   │   └── file-watcher.ts      # chokidar wrapper
│   │   └── store/
│   │       └── config-store.ts      # electron-store (encrypted)
│   ├── renderer/       # React SPA
│   │   ├── App.tsx     # Root layout
│   │   ├── components/
│   │   │   ├── chat/       # ChatPanel, MessageList, InputBox...
│   │   │   ├── editor/     # CodeEditor, FileExplorer, SearchPanel, ReviewPanel...
│   │   │   ├── layout/     # Sidebar, Toolbar, StatusBar
│   │   │   ├── git/        # GitPanel
│   │   │   ├── terminal/   # TerminalPanel
│   │   │   └── common/     # Palette, ErrorBoundary
│   │   └── store/
│   │       └── app-store.ts  # Zustand global state
│   └── shared/         # Shared types, constants, Zod schemas
├── tests/              # Vitest test suite
├── scripts/            # Dev scripts (e2e, screenshots...)
└── screenshots/        # App screenshots
```

## 🔧 Configuration

### API Profile
Configure in Settings panel or directly via `~/.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-api-key",
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-6",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-8",
    "ANTHROPIC_SMALL_FAST_MODEL": "claude-haiku-4-5-20251001"
  }
}
```

### MCP Servers
Add MCP servers in Settings → MCP Servers. Supports:
- **stdio**: Local process (command + args)
- **SSE/HTTP**: Remote endpoint (URL + headers)

## 🧪 Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npx vitest run tests/path/to/test.test.ts  # Single file
```

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron |
| UI Framework | React 19 + TypeScript |
| State Management | Zustand |
| Code Editor | Monaco Editor |
| Terminal | xterm.js + node-pty |
| AI SDK | `@anthropic-ai/claude-agent-sdk` |
| File Search | ripgrep (with JS fallback) |
| Git | simple-git |
| CSS | CSS Modules with CSS variables |
| Build | Vite + tsc |
| Test | Vitest + Testing Library |
| Package | electron-builder |
