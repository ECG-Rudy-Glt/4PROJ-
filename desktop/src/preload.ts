import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi, MfaSetupPayload, SyncStatus } from './shared/types';

const api: DesktopApi = {
  getStatus: () => ipcRenderer.invoke('status:get'),
  login: (payload) => ipcRenderer.invoke('auth:login', payload),
  setupMfa: () => ipcRenderer.invoke('auth:mfa-setup'),
  verifyMfaSetup: (payload: MfaSetupPayload) => ipcRenderer.invoke('auth:mfa-verify-setup', payload),
  verifyMfa: (payload) => ipcRenderer.invoke('auth:mfa-verify', payload),
  verifyBackupCode: (payload) => ipcRenderer.invoke('auth:mfa-backup', payload),
  chooseFolder: () => ipcRenderer.invoke('sync:choose-folder'),
  startSync: () => ipcRenderer.invoke('sync:start'),
  syncNow: () => ipcRenderer.invoke('sync:now'),
  pause: () => ipcRenderer.invoke('sync:pause'),
  resume: () => ipcRenderer.invoke('sync:resume'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  onStatus: (callback: (status: SyncStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: SyncStatus) => callback(status);
    ipcRenderer.on('status:changed', listener);
    return () => ipcRenderer.off('status:changed', listener);
  },
  onLog: (callback: (message: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string) => callback(message);
    ipcRenderer.on('sync:log', listener);
    return () => ipcRenderer.off('sync:log', listener);
  },
};

contextBridge.exposeInMainWorld('supfile', api);
