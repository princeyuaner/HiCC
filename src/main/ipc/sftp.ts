import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { SshConfig } from '../../shared/types';
import type { RemoteFileSystemService } from '../services/remote-file-system';

let remoteFileSystem: RemoteFileSystemService | null = null;
let remoteActive = false;

export function setRemoteFileSystemService(service: RemoteFileSystemService): void {
  remoteFileSystem = service;
}

export function isRemoteActive(): boolean {
  return remoteActive && (remoteFileSystem?.isConnected() ?? false);
}

export function getRemoteFileSystem(): RemoteFileSystemService | null {
  return isRemoteActive() ? remoteFileSystem : null;
}

export function registerSftpHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SFTP_CONNECT, async (_event, config: SshConfig) => {
    if (!remoteFileSystem) throw new Error('RemoteFileSystemService not initialized');
    await remoteFileSystem.connect(config);
    remoteActive = true;
  });

  ipcMain.handle(IPC_CHANNELS.SFTP_DISCONNECT, async () => {
    if (remoteFileSystem) {
      await remoteFileSystem.disconnect();
    }
    remoteActive = false;
  });

  ipcMain.handle(IPC_CHANNELS.SFTP_STATUS, () => {
    if (!remoteFileSystem || !remoteFileSystem.isConnected()) {
      return null;
    }
    return {
      connected: true,
      ...remoteFileSystem.getConnectionInfo(),
    };
  });
}
