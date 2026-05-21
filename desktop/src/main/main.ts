import path from 'path';
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell, Tray } from 'electron';
import fs from 'fs/promises';
import { AuthClient } from './authClient';
import { SecureStore } from './secureStore';
import { SyncEngine } from './syncEngine';
import type { DesktopConfig, LoginResult, MfaSetupPayload, SyncStatus } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let config: DesktopConfig;
let authClient: AuthClient;
let syncEngine: SyncEngine;
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
let isQuitting = false;

function sendStatus(status: SyncStatus) {
  mainWindow?.webContents.send('status:changed', status);
}

function sendLog(message: string) {
  mainWindow?.webContents.send('sync:log', message);
}

async function writeDesktopLog(message: string) {
  try {
    const logPath = path.join(app.getPath('userData'), 'supfile-sync.log');
    await fs.appendFile(logPath, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
  } catch {
    // Logging must never break auth or sync flows.
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return JSON.stringify(error);
}

function normalizeServerUrl(input: string) {
  const trimmed = input.trim();
  const withoutApiSuffix = trimmed.replace(/\/api\/?$/, '').replace(/\/$/, '');
  const url = new URL(withoutApiSuffix);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('URL serveur invalide: protocole HTTP ou HTTPS requis');
  }
  if (url.username || url.password) {
    throw new Error('URL serveur invalide: identifiants interdits dans l URL');
  }
  if (url.search || url.hash) {
    throw new Error('URL serveur invalide: query string et fragment interdits');
  }
  if (url.pathname !== '/') {
    throw new Error('URL serveur invalide: utilisez uniquement l origine du serveur SupFile');
  }

  return url.origin;
}

function desktopAssetPath(fileName: string) {
  return path.join(__dirname, '../../build', fileName);
}

function currentStatus(): SyncStatus {
  if (!authClient?.getTokens().token) {
    return {
      ...syncEngine.getStatus(),
      state: 'signed-out',
      message: 'Connectez-vous',
    };
  }
  return syncEngine.getStatus();
}

function trayImage() {
  const image = nativeImage.createFromPath(desktopAssetPath('icon.png'));
  if (!image.isEmpty()) {
    return image.resize({ width: 16, height: 16 });
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="7" fill="#2563eb"/>
      <path d="M8 17.5c0-3 2.5-5.5 5.6-5.5 1.9 0 3.5.8 4.5 2.2.5-.2 1-.3 1.6-.3 2.4 0 4.3 1.9 4.3 4.2S22.1 22 19.7 22H12c-2.2 0-4-2-4-4.5z" fill="white"/>
    </svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

function updateTray() {
  if (!tray) return;
  const status = syncEngine.getStatus();
  tray.setToolTip(`SupFile Sync - ${status.message}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Ouvrir SupFile Sync', click: () => mainWindow?.show() },
    { label: 'Ouvrir le dossier local', enabled: Boolean(config.localDir), click: () => { if (config.localDir) void shell.openPath(config.localDir); } },
    {
      label: 'Ouvrir SupFile web',
      click: () => {
        try {
          const url = new URL(config.serverUrl);
          if (url.protocol === 'http:' || url.protocol === 'https:') {
            void shell.openExternal(url.toString());
          }
        } catch {
          sendLog('URL SupFile invalide');
        }
      },
    },
    { label: status.state === 'paused' ? 'Reprendre' : 'Pause', click: () => status.state === 'paused' ? syncEngine.resume() : syncEngine.pause() },
    { label: 'Synchroniser maintenant', click: () => syncEngine.syncNow('tray') },
    { label: 'Paramètres', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quitter', click: () => app.quit() },
  ]));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 820,
    minHeight: 600,
    icon: desktopAssetPath('icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../../dist-renderer/index.html'));
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function mapAuthenticatedResult(result: any): LoginResult {
  return { state: 'authenticated', user: result.user };
}

async function saveAuthenticated(result: any) {
  let user = result.user;
  if (!user) {
    const profile = await authClient.getProfile();
    user = profile.user;
  }
  const tokens = authClient.getTokens();
  await SecureStore.saveSecrets({
    token: tokens.token,
    refreshToken: tokens.refreshToken,
    user,
  });
}

function wireTokenPersistence(client: AuthClient) {
  client.setTokenChangeHandler(async (tokens) => {
    const existing = await SecureStore.loadSecrets();
    await SecureStore.saveSecrets({
      ...existing,
      token: tokens.token,
      refreshToken: tokens.refreshToken,
    });
  });
}

function wireEngine(engine: SyncEngine) {
  engine.on('status', (status) => {
    sendStatus(status);
    updateTray();
  });
  engine.on('log', (message) => {
    sendLog(message);
    void writeDesktopLog(message);
  });
}

async function bootstrap() {
  try {
    config = await SecureStore.loadConfig();
    try {
      config.serverUrl = normalizeServerUrl(config.serverUrl);
    } catch {
      config.serverUrl = 'http://localhost:5001';
      await SecureStore.saveConfig(config);
    }
    const secrets = await SecureStore.loadSecrets();
    authClient = new AuthClient(config.serverUrl);
    wireTokenPersistence(authClient);
    authClient.setTokens({ token: secrets.token, refreshToken: secrets.refreshToken });
    syncEngine = new SyncEngine(config, authClient);
    wireEngine(syncEngine);

    if (secrets.token && config.localDir) {
      void syncEngine.start();
    }
  } catch (error) {
    await writeDesktopLog(`Bootstrap error: ${errorMessage(error)}`);
    throw error;
  }
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.whenReady().then(async () => {
  await bootstrap();
  createWindow();
  tray = new Tray(trayImage());
  updateTray();
});

app.on('window-all-closed', () => undefined);

ipcMain.handle('status:get', () => currentStatus());

ipcMain.handle('auth:login', async (_event, payload: { serverUrl: string; email: string; password: string }) => {
  try {
    config.serverUrl = normalizeServerUrl(payload.serverUrl);
    config.paused = false;
    await SecureStore.saveConfig(config);
    authClient.setServerUrl(config.serverUrl);
    const result = await authClient.login(payload.email, payload.password);

    if (result.mfaRequired) {
      await SecureStore.saveSecrets({ tempToken: authClient.getTokens().tempToken });
      await writeDesktopLog(`Login requires MFA for userId=${result.userId}`);
      return { state: 'mfa-required', userId: result.userId } satisfies LoginResult;
    }

    if (result.mfaSetupRequired) {
      await SecureStore.saveSecrets({ tempToken: authClient.getTokens().tempToken });
      await writeDesktopLog(`Login requires MFA setup for userId=${result.userId}`);
      return { state: 'mfa-setup-required', userId: result.userId } satisfies LoginResult;
    }

    await saveAuthenticated(result);
    await syncEngine.setConfig(config);
    await writeDesktopLog('Login authenticated');
    return mapAuthenticatedResult(result);
  } catch (error) {
    await writeDesktopLog(`Login error: ${errorMessage(error)}`);
    throw error;
  }
});

ipcMain.handle('auth:mfa-setup', async () => authClient.setupMfa());

ipcMain.handle('auth:mfa-verify-setup', async (_event, payload: MfaSetupPayload) => {
  const result = await authClient.verifyMfaSetup(payload);
  await saveAuthenticated(result);
  config.paused = false;
  await syncEngine.setConfig(config);
  await writeDesktopLog('MFA setup verified');
  return mapAuthenticatedResult(result);
});

ipcMain.handle('auth:mfa-verify', async (_event, payload: { token: string; rememberDevice: boolean }) => {
  const result = await authClient.verifyMfa(payload.token, payload.rememberDevice);
  await saveAuthenticated(result);
  config.paused = false;
  await syncEngine.setConfig(config);
  await writeDesktopLog('MFA verified');
  return mapAuthenticatedResult(result);
});

ipcMain.handle('auth:mfa-backup', async (_event, payload: { backupCode: string; rememberDevice: boolean }) => {
  const result = await authClient.verifyBackupCode(payload.backupCode, payload.rememberDevice);
  await saveAuthenticated(result);
  config.paused = false;
  await syncEngine.setConfig(config);
  await writeDesktopLog('MFA backup code verified');
  return mapAuthenticatedResult(result);
});

ipcMain.handle('sync:choose-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choisir le dossier SupFile Sync',
  });
  if (result.canceled || !result.filePaths[0]) return null;
  await syncEngine.chooseFolder(result.filePaths[0]);
  return result.filePaths[0];
});

ipcMain.handle('sync:start', () => syncEngine.start());
ipcMain.handle('sync:now', () => syncEngine.syncNow('manual'));
ipcMain.handle('sync:pause', () => syncEngine.pause());
ipcMain.handle('sync:resume', () => syncEngine.resume());

ipcMain.handle('auth:logout', async () => {
  await syncEngine.stop();
  await authClient.logout();
  authClient.setTokens({ token: undefined, refreshToken: undefined, tempToken: undefined });
  await SecureStore.clearSecrets();
  config.paused = true;
  await SecureStore.saveConfig(config);
  syncEngine = new SyncEngine(config, authClient);
  wireEngine(syncEngine);
  sendStatus(currentStatus());
  return currentStatus();
});
