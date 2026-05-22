import { app, safeStorage } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import type { DesktopConfig } from '../shared/types';

export type StoredSecrets = {
  token?: string;
  refreshToken?: string;
  tempToken?: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
};

const DEFAULT_CONFIG: DesktopConfig = {
  serverUrl: 'http://localhost:5001',
};

function paths() {
  const dir = app.getPath('userData');
  return {
    dir,
    configPath: path.join(dir, 'config.json'),
    secretsPath: path.join(dir, 'secrets.bin'),
    manifestPath: path.join(dir, 'manifest.json'),
  };
}

async function ensureDir() {
  await fs.mkdir(paths().dir, { recursive: true });
}

export class SecureStore {
  static paths = paths;

  static async loadConfig(): Promise<DesktopConfig> {
    try {
      const raw = await fs.readFile(paths().configPath, 'utf8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  static async saveConfig(config: DesktopConfig): Promise<void> {
    await ensureDir();
    await fs.writeFile(paths().configPath, JSON.stringify(config, null, 2), 'utf8');
  }

  static async loadSecrets(): Promise<StoredSecrets> {
    try {
      const encrypted = await fs.readFile(paths().secretsPath);
      if (!safeStorage.isEncryptionAvailable()) return {};
      return JSON.parse(safeStorage.decryptString(encrypted));
    } catch {
      return {};
    }
  }

  static async saveSecrets(secrets: StoredSecrets): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure storage is unavailable on this system');
    }
    await ensureDir();
    const raw = JSON.stringify(secrets);
    await fs.writeFile(paths().secretsPath, safeStorage.encryptString(raw));
  }

  static async clearSecrets(): Promise<void> {
    await fs.rm(paths().secretsPath, { force: true });
  }
}
