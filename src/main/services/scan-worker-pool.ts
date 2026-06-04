import { Worker } from 'worker_threads';
import path from 'path';
import type { FileNode } from '../../shared/types';

interface ScanJob {
  rootPath: string;
  dirPath: string;
  depth: number;
  sessionId: number;
  stream: boolean;
  resolve: (tree: FileNode[]) => void;
  reject: (err: Error) => void;
  onProgress?: (count: number, currentFile?: string) => void;
  onEntry?: (entry: FileNode) => void; // Streamed entries callback
}

let nextSessionId = 0;

/**
 * Persistent scan worker pool — reuses a single Worker thread
 * to eliminate the ~100-300ms Worker creation overhead on each
 * listFiles call.
 */
class ScanWorkerPool {
  private worker: Worker | null = null;
  private currentJob: ScanJob | null = null;
  private queue: ScanJob[] = [];
  private workerPath: string;

  constructor() {
    // Worker path resolved relative to this file's location at runtime
    this.workerPath = path.join(__dirname, 'scan-worker.js');
  }

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(this.workerPath, { workerData: undefined });
      this.worker.on('message', this.handleMessage.bind(this));
      this.worker.on('error', this.handleError.bind(this));
    }
    return this.worker;
  }

  private handleMessage(
    msg: { type: string; tree?: FileNode[]; entry?: { name: string; path: string; type: 'file' | 'directory' }; count?: number; currentFile?: string; sessionId?: number; error?: string },
  ): void {
    const job = this.currentJob;
    if (!job) return;
    // SessionId routing — ignore messages from stale jobs
    if (msg.sessionId !== undefined && msg.sessionId !== job.sessionId) return;

    if (msg.type === 'progress' && msg.count !== undefined) {
      job.onProgress?.(msg.count, msg.currentFile);
    } else if (msg.type === 'entry' && msg.entry && job.onEntry) {
      job.onEntry({
        name: msg.entry.name,
        path: msg.entry.path,
        type: msg.entry.type,
        children: msg.entry.type === 'directory' ? [] : undefined,
      });
    } else if (msg.type === 'done' && job.stream) {
      // Streaming scan complete
      job.resolve([] as unknown as FileNode[]); // Dummy value — onEntry already handled all data
      this.currentJob = null;
      this.processQueue();
    } else if (msg.type === 'tree' && msg.tree) {
      job.resolve(msg.tree);
      this.currentJob = null;
      this.processQueue();
    } else if (msg.type === 'error') {
      // Worker may be in a bad state after an error — recreate it
      job.reject(new Error(msg.error || 'Scan failed'));
      this.currentJob = null;
      this.recycleWorker();
      this.processQueue();
    }
  }

  private handleError(err: Error): void {
    const job = this.currentJob;
    if (job) {
      job.reject(err);
      this.currentJob = null;
    }
    this.recycleWorker();
    this.processQueue();
  }

  private recycleWorker(): void {
    if (this.worker) {
      this.worker.removeAllListeners();
      this.worker.terminate().catch(() => {});
      this.worker = null;
    }
  }

  private startJob(job: ScanJob): void {
    this.currentJob = job;
    const worker = this.getWorker();
    worker.postMessage({
      rootPath: job.rootPath,
      dirPath: job.dirPath,
      depth: job.depth,
      sessionId: job.sessionId,
      stream: job.stream,
    });
  }

  private processQueue(): void {
    if (this.currentJob) return; // Worker is busy
    const next = this.queue.shift();
    if (next) this.startJob(next);
  }

  /**
   * Scan a directory and return the file tree.
   * Jobs are queued if the worker is busy — the previous job
   * always completes before the next one starts.
   */
  scan(
    rootPath: string,
    dirPath: string,
    depth: number,
    onProgress?: (count: number, currentFile?: string) => void,
  ): Promise<FileNode[]> {
    return new Promise((resolve, reject) => {
      const job: ScanJob = {
        rootPath,
        dirPath,
        depth,
        sessionId: ++nextSessionId,
        stream: false,
        resolve,
        reject,
        onProgress,
      };

      if (this.currentJob) {
        this.queue.push(job);
      } else {
        this.startJob(job);
      }
    });
  }

  /**
   * Stream-scan a directory — entries are sent to the callback as they
   * are discovered instead of being collected into a full tree.
   */
  scanStream(
    rootPath: string,
    dirPath: string,
    depth: number,
    onEntry: (entry: FileNode) => void,
    onProgress?: (count: number, currentFile?: string) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const job: ScanJob = {
        rootPath,
        dirPath,
        depth,
        sessionId: ++nextSessionId,
        stream: true,
        resolve: () => resolve(),
        reject,
        onProgress,
        onEntry,
      };

      if (this.currentJob) {
        this.queue.push(job);
      } else {
        this.startJob(job);
      }
    });
  }

  /**
   * Terminate the worker and clear all pending jobs.
   * Call on app shutdown.
   */
  destroy(): void {
    // Reject all queued jobs
    const err = new Error('Worker pool destroyed');
    for (const job of this.queue) job.reject(err);
    this.queue = [];
    if (this.currentJob) {
      this.currentJob.reject(err);
      this.currentJob = null;
    }
    this.recycleWorker();
  }
}

// Singleton — the whole main process shares one worker
export const scanWorkerPool = new ScanWorkerPool();
