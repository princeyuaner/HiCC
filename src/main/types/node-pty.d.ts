declare module 'node-pty' {
  export interface IPty {
    pid: number;
    process: string;
    write(data: string): void;
    resize(cols: number, rows: number): void;
    kill(signal?: string): void;
    onData(callback: (data: string) => void): void;
    onExit(callback: (exitCode: number, signal?: number) => void): void;
  }

  export interface IPtyForkOptions {
    name?: string;
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: Record<string, string>;
    encoding?: string;
  }

  export interface IPtyOpenOptions {
    cols?: number;
    rows?: number;
    encoding?: string;
  }

  export function spawn(file: string, args: string | string[], options: IPtyForkOptions): IPty;
  export function fork(file: string, args: string | string[], options: IPtyForkOptions): IPty;
  export function createTerminal(file: string, args: string | string[], options: IPtyForkOptions): IPty;
  export function open(options: IPtyOpenOptions): IPty;
}
