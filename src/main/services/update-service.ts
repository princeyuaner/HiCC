import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { UpdateStatus } from '../../shared/types';
import { getAutoCheckUpdates, setAutoCheckUpdates } from '../store/config-store';

let currentStatus: UpdateStatus = { stage: 'idle' };

function sendStatus(status: UpdateStatus): void {
  currentStatus = status;
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC_CHANNELS.UPDATE_STATUS_CHANGED, status);
  }
}

export function getCurrentUpdateStatus(): UpdateStatus {
  return currentStatus;
}

export function initUpdateService(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    sendStatus({ stage: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    sendStatus({
      stage: 'available',
      version: info.version,
      releaseNotes: Array.isArray(info.releaseNotes)
        ? info.releaseNotes.map((n) => n.note || n.version || '').join('\n')
        : typeof info.releaseNotes === 'string'
          ? info.releaseNotes
          : undefined,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on('update-not-available', () => {
    sendStatus({ stage: 'idle' });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendStatus({ stage: 'downloading', progress: progress.percent });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendStatus({ stage: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    sendStatus({ stage: 'error', message: err.message || 'Unknown update error' });
  });
}

export async function checkForUpdates(): Promise<void> {
  try {
    await autoUpdater.checkForUpdates();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    sendStatus({ stage: 'error', message });
  }
}

export async function downloadUpdate(): Promise<void> {
  try {
    await autoUpdater.downloadUpdate();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    sendStatus({ stage: 'error', message });
  }
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true);
}

export function startBackgroundCheck(): void {
  if (getAutoCheckUpdates()) {
    checkForUpdates();
  }

  // Re-check every 4 hours
  setInterval(() => {
    if (getAutoCheckUpdates()) {
      checkForUpdates();
    }
  }, 4 * 60 * 60 * 1000);
}
