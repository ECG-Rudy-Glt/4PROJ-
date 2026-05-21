export type AuthUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

export type LoginResult =
  | { state: 'authenticated'; user: AuthUser }
  | { state: 'mfa-required'; userId: string }
  | { state: 'mfa-setup-required'; userId: string; qrCodeDataUrl?: string; backupCodes?: string[] };

export type SyncState = 'signed-out' | 'setup' | 'idle' | 'syncing' | 'paused' | 'offline' | 'error' | 'conflict';

export type SyncStatus = {
  state: SyncState;
  message: string;
  localDir?: string;
  remoteRootId?: string;
  serverUrl?: string;
  lastSyncAt?: string;
  pending: number;
  lastError?: string;
};

export type DesktopConfig = {
  serverUrl: string;
  localDir?: string;
  remoteRootId?: string;
  paused?: boolean;
  lastSyncAt?: string;
};

export type MfaSetupPayload = {
  token: string;
  secret: string;
  backupCodes: string[];
  rememberDevice: boolean;
};

export type DesktopApi = {
  getStatus: () => Promise<SyncStatus>;
  login: (payload: { serverUrl: string; email: string; password: string }) => Promise<LoginResult>;
  setupMfa: () => Promise<{ secret: string; qrCodeDataUrl: string; backupCodes: string[] }>;
  verifyMfaSetup: (payload: MfaSetupPayload) => Promise<LoginResult>;
  verifyMfa: (payload: { token: string; rememberDevice: boolean }) => Promise<LoginResult>;
  verifyBackupCode: (payload: { backupCode: string; rememberDevice: boolean }) => Promise<LoginResult>;
  chooseFolder: () => Promise<string | null>;
  startSync: () => Promise<SyncStatus>;
  syncNow: () => Promise<SyncStatus>;
  pause: () => Promise<SyncStatus>;
  resume: () => Promise<SyncStatus>;
  logout: () => Promise<SyncStatus>;
  onStatus: (callback: (status: SyncStatus) => void) => () => void;
  onLog: (callback: (message: string) => void) => () => void;
};
