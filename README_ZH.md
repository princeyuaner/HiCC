# HiCC - AI 智能编程 IDE

基于 **Electron + React + TypeScript** 构建的智能桌面 IDE，集成 **Claude AI** 实现代码生成、审查和辅助编程。

## ✨ 功能特性

### 🤖 AI 集成
- **对话式编程助手**，基于 Anthropic Claude Agent SDK
- **流式响应**，实时文本/思考增量输出
- **工具执行** — 读取、写入、编辑文件，运行 Bash 命令
- **代码审查工作流** — AI 分析 git/SVN 差异，发现 Bug 并提供修复建议
- **工具确认**与权限管理系统
- **1M 上下文窗口**支持，轻松处理大型代码库

### 📝 代码编辑器
- **Monaco Editor** — VS Code 级别的编辑体验
- **语法高亮**，支持所有主流语言
- **多标签页编辑**，文件脏状态追踪
- **差异预览** — 行内接受/拒绝 AI 生成的修改

### 📁 文件管理
- **流式文件树** — 类似 PyCharm 的渐进式加载索引
- **实时文件监听** — 外部变更自动更新（基于 chokidar）
- **SFTP/SSH 远程文件系统**支持

### 🔍 全局搜索
- **Ripgrep 驱动**的内容搜索
- **文件名 + 内容**双重搜索
- **过滤器**：大小写敏感、全词匹配、正则表达式、文件类型通配符
- **可折叠分组结果**，高亮匹配内容
- **键盘导航**（↑↓ Enter Escape）

### 🔀 版本控制
- **Git 面板** — 状态查看、差异对比、暂存/取消暂存、提交、分支切换、拉取/推送
- **SVN 面板** — 状态查看、差异对比、添加、还原、提交、更新

### 💻 终端
- **嵌入式终端**（xterm.js + node-pty）
- **多会话**支持

### ⚙️ 配置
- **多 API 配置文件**，支持按模型独立配置
- **MCP 服务器支持**（stdio + SSE/HTTP）
- **Claude 设置同步** — 读写 `~/.claude/settings.json`
- **深色/浅色主题**

## 🚀 快速开始

### 环境要求
- **Node.js** ≥ 18
- **Git**（可选，用于版本控制功能）
- **SVN**（可选，用于 SVN 支持）
- **ripgrep**（`rg`）（可选，用于内容搜索；无此工具时回退到 Node.js grep）
- **Anthropic API 密钥**（或兼容代理）

### 安装与运行

```bash
git clone https://github.com/princeyuaner/HiCC.git
cd HiCC
npm install
npm run dev
```

### 构建

```bash
npm run build    # 构建渲染进程 + 主进程
npm run package  # 构建并打包为桌面应用
```

## 📂 项目结构

```
HiCC/
├── src/
│   ├── main/           # Electron 主进程
│   │   ├── index.ts    # 应用入口，窗口创建
│   │   ├── preload.ts  # IPC 桥接（contextBridge）
│   │   ├── ipc/        # IPC 处理器（ai、file、git、svn、chat、config...）
│   │   ├── services/   # 业务逻辑
│   │   │   ├── anthropic-client.ts  # Claude Agent SDK 集成
│   │   │   ├── file-system.ts       # 文件系统 + 搜索（ripgrep）
│   │   │   ├── git-service.ts       # SimpleGit 封装
│   │   │   ├── svn-service.ts       # SVN CLI 封装
│   │   │   ├── terminal-manager.ts  # node-pty 会话管理
│   │   │   └── file-watcher.ts      # chokidar 封装
│   │   └── store/
│   │       └── config-store.ts      # electron-store（加密存储）
│   ├── renderer/       # React 单页应用
│   │   ├── App.tsx     # 根布局
│   │   ├── components/
│   │   │   ├── chat/       # ChatPanel、MessageList、InputBox...
│   │   │   ├── editor/     # CodeEditor、FileExplorer、SearchPanel、ReviewPanel...
│   │   │   ├── layout/     # Sidebar、Toolbar、StatusBar
│   │   │   ├── git/        # GitPanel
│   │   │   ├── terminal/   # TerminalPanel
│   │   │   └── common/     # Palette、ErrorBoundary
│   │   └── store/
│   │       └── app-store.ts  # Zustand 全局状态
│   └── shared/         # 共享类型、常量、Zod Schema
├── tests/              # Vitest 测试套件
├── scripts/            # 开发脚本（e2e、截图...）
└── screenshots/        # 应用截图
```

## 🔧 配置

### API 配置文件
在设置面板中配置，或直接编辑 `~/.claude/settings.json`：

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

### MCP 服务器
在 设置 → MCP 服务器 中添加。支持：
- **stdio**：本地进程（命令 + 参数）
- **SSE/HTTP**：远程端点（URL + 请求头）

## 🧪 测试

```bash
npm test              # 运行全部测试
npm run test:watch    # 监听模式
npx vitest run tests/path/to/test.test.ts  # 运行单个测试文件
```

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron |
| UI 框架 | React 19 + TypeScript |
| 状态管理 | Zustand |
| 代码编辑器 | Monaco Editor |
| 终端 | xterm.js + node-pty |
| AI SDK | `@anthropic-ai/claude-agent-sdk` |
| 文件搜索 | ripgrep（含 JS 回退方案） |
| Git | simple-git |
| CSS | CSS Modules + CSS 变量 |
| 构建 | Vite + tsc |
| 测试 | Vitest + Testing Library |
| 打包 | electron-builder |
