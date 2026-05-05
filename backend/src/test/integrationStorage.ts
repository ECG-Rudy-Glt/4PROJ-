import './integrationEnv';
import { Readable } from 'stream';
import { StorageService } from '../services/storageService';

const createdKeys = new Set<string>();

export async function putIntegrationObject(key: string, content: Buffer | string): Promise<void> {
  const body = Buffer.isBuffer(content) ? content : Buffer.from(content);
  await StorageService.upload(key, Readable.from(body), body.length);
  createdKeys.add(key);
}

export async function readIntegrationObject(key: string): Promise<Buffer> {
  return StorageService.getBuffer(key);
}

export async function deleteIntegrationObject(key: string): Promise<void> {
  await StorageService.delete(key).catch(() => undefined);
  createdKeys.delete(key);
}

export async function cleanupIntegrationStorage(): Promise<void> {
  await Promise.all([...createdKeys].map((key) => deleteIntegrationObject(key)));
}
