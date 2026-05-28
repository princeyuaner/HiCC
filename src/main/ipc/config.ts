import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import { getApiKey, setApiKey } from '../store/config-store';

export function registerConfigHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET_API_KEY, () => {
    return getApiKey();
  });

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET_API_KEY, (_event, key: string) => {
    setApiKey(key);
  });
}
