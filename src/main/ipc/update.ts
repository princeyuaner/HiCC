import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import { checkForUpdates, downloadUpdate, installUpdate } from '../services/update-service';
import { getAutoCheckUpdates, setAutoCheckUpdates } from '../store/config-store';

export function registerUpdateHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async () => {
    await checkForUpdates();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_DOWNLOAD, async () => {
    await downloadUpdate();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_INSTALL, () => {
    installUpdate();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_GET_CONFIG, () => {
    return { autoCheck: getAutoCheckUpdates() };
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_SET_CONFIG, (_event, config: { autoCheck: boolean }) => {
    setAutoCheckUpdates(config.autoCheck);
  });
}
