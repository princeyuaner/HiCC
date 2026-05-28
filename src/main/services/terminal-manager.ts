import { spawn, IPty } from 'node-pty';
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';

interface TerminalSession {
  id: string;
  pty: IPty;
}

export class TerminalManager {
  private sessions = new Map<string, TerminalSession>();
  private nextId = 1;

  create(cwd: string, window: BrowserWindow): string {
    const id = `terminal-${this.nextId++}`;
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';

    const ptyProcess = spawn(shell, [], {
      cwd,
      env: process.env as Record<string, string>,
      cols: 80,
      rows: 24,
    });

    ptyProcess.onData((data: string) => {
      window.webContents.send(IPC_CHANNELS.TERMINAL_DATA, { id, data });
    });

    this.sessions.set(id, { id, pty: ptyProcess });
    return id;
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.pty.write(data);
    }
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id);
    if (session) {
      session.pty.resize(cols, rows);
    }
  }

  kill(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.pty.kill();
      this.sessions.delete(id);
    }
  }

  killAll(): void {
    for (const [id] of this.sessions) {
      this.kill(id);
    }
  }
}
