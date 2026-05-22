import { EventEmitter } from 'events';
import fs from 'fs/promises';
import { createHash } from 'crypto';
import path from 'path';
import os from 'os';
import { createWriteStream } from 'fs';
import { existsSync } from 'fs';
import chokidar, { FSWatcher } from 'chokidar';
import { shell } from 'electron';
import { io, Socket } from 'socket.io-client';
import { AuthClient } from './authClient';
import { SecureStore } from './secureStore';
import type { DesktopConfig, SyncStatus } from '../shared/types';

type EntryType = 'file' | 'folder';

type ManifestEntry = {
  type: EntryType;
  relativePath: string;
  remoteId: string;
  checksum?: string | null;
  size?: number;
  mtimeMs?: number;
  remoteUpdatedAt?: string;
};

type Manifest = Record<string, ManifestEntry>;

type LocalFile = {
  relativePath: string;
  absolutePath: string;
  checksum: string;
  size: number;
  mtimeMs: number;
};

type LocalFolder = {
  relativePath: string;
  absolutePath: string;
  stableAt: number;
};

type LocalSnapshot = {
  files: Map<string, LocalFile>;
  folders: Map<string, LocalFolder>;
};

type RemoteFile = {
  id: string;
  name: string;
  relativePath: string;
  folderId: string;
  checksum?: string | null;
  size: number;
  mimeType: string;
  updatedAt: string;
};

type RemoteFolder = {
  id: string;
  name: string;
  relativePath: string;
  parentId: string | null;
  updatedAt: string;
};

type RemoteSnapshot = {
  rootId: string;
  files: Map<string, RemoteFile>;
  folders: Map<string, RemoteFolder>;
};

const INTERNAL_DIR = '.supfile-sync';
const POLL_INTERVAL_MS = 60_000;
const WATCH_DEBOUNCE_MS = 900;
const FOLDER_SETTLE_MS = 5_000;
const PENDING_FOLDER_NAME_SETTLE_MS = 30_000;

function toRelativeKey(relativePath: string) {
  return relativePath.split(path.sep).join('/').replace(/^\/+/, '');
}

function assertPathInsideBase(baseDir: string, targetPath: string) {
  const root = path.resolve(baseDir);
  const target = path.resolve(targetPath);
  const relative = path.relative(root, target);
  if (relative && (relative.startsWith('..') || path.isAbsolute(relative))) {
    throw new Error(`Chemin hors du dossier SupFile Sync: ${targetPath}`);
  }
  return target;
}

function localPath(baseDir: string, relativePath: string) {
  const normalized = path.posix.normalize(relativePath.replace(/\\/g, '/'));
  if (normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    throw new Error(`Chemin distant invalide: ${relativePath}`);
  }
  return assertPathInsideBase(baseDir, path.join(baseDir, ...normalized.split('/')));
}

function isExcludedName(name: string) {
  return name === INTERNAL_DIR
    || name === 'desktop.ini'
    || name.startsWith('~$')
    || name.startsWith('.supfile-')
    || name.endsWith('.tmp');
}

function folderSettleDelay(relativePath: string, stableAt: number) {
  const name = path.posix.basename(relativePath);
  const isPendingExplorerName = /^(Nouveau dossier|New folder)( \(\d+\))?$/i.test(name);
  const settleMs = isPendingExplorerName ? PENDING_FOLDER_NAME_SETTLE_MS : FOLDER_SETTLE_MS;
  return Math.max(0, stableAt + settleMs - Date.now());
}

function isInsideRelativeFolder(relativePath: string, folderPath: string) {
  return relativePath === folderPath || relativePath.startsWith(`${folderPath}/`);
}

function isInsideAnyFolder(relativePath: string, folders: string[]) {
  return folders.some((folder) => isInsideRelativeFolder(relativePath, folder));
}

async function exists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function checksumFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const handle = await fs.open(filePath, 'r');
  try {
    const stream = handle.createReadStream();
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  } finally {
    await handle.close();
  }
  return hash.digest('hex');
}

async function writeStreamAtomic(stream: NodeJS.ReadableStream, destination: string) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const tempPath = path.join(path.dirname(destination), `.supfile-${Date.now()}-${path.basename(destination)}.tmp`);
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(tempPath);
    stream.pipe(output);
    stream.on('error', reject);
    output.on('error', reject);
    output.on('finish', resolve);
  });
  await fs.rename(tempPath, destination);
}

function uniqueConflictPath(baseDir: string, relativePath: string) {
  const parsed = path.posix.parse(relativePath);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const device = os.hostname().replace(/[^a-z0-9-]/gi, '').slice(0, 20) || 'device';
  let candidate = path.posix.join(parsed.dir, `${parsed.name} (conflit ${device} ${stamp})${parsed.ext}`);
  let index = 2;
  while (existsSync(localPath(baseDir, candidate))) {
    candidate = path.posix.join(parsed.dir, `${parsed.name} (conflit ${device} ${stamp} ${index})${parsed.ext}`);
    index += 1;
  }
  return candidate;
}

function sameRemoteTimestamp(entry?: ManifestEntry, remote?: { updatedAt: string }) {
  if (!entry?.remoteUpdatedAt || !remote?.updatedAt) return false;
  return new Date(entry.remoteUpdatedAt).getTime() === new Date(remote.updatedAt).getTime();
}

function mapStatus(config: DesktopConfig, status: Partial<SyncStatus>): SyncStatus {
  return {
    state: status.state || (config.localDir ? 'idle' : 'setup'),
    message: status.message || '',
    localDir: config.localDir,
    remoteRootId: config.remoteRootId,
    serverUrl: config.serverUrl,
    lastSyncAt: config.lastSyncAt,
    pending: status.pending ?? 0,
    lastError: status.lastError,
  };
}

export class SyncEngine extends EventEmitter {
  private config: DesktopConfig;
  private auth: AuthClient;
  private manifest: Manifest = {};
  private watcher: FSWatcher | null = null;
  private socket: Socket | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private delayedSyncTimer: NodeJS.Timeout | null = null;
  private running = false;
  private conflictCount = 0;
  private status: SyncStatus;

  constructor(config: DesktopConfig, auth: AuthClient) {
    super();
    this.config = config;
    this.auth = auth;
    this.status = mapStatus(config, {
      state: config.paused ? 'paused' : config.localDir ? 'idle' : 'setup',
      message: config.paused ? 'Synchronisation en pause' : 'Prêt',
    });
  }

  getStatus() {
    return this.status;
  }

  async setConfig(config: DesktopConfig) {
    this.config = config;
    await SecureStore.saveConfig(config);
    this.setStatus({
      state: config.paused ? 'paused' : config.localDir ? 'idle' : 'setup',
      message: config.localDir ? 'Prêt' : 'Choisissez un dossier local',
    });
  }

  async loadManifest() {
    try {
      const raw = await fs.readFile(SecureStore.paths().manifestPath, 'utf8');
      this.manifest = JSON.parse(raw);
    } catch {
      this.manifest = {};
    }
  }

  private async saveManifest() {
    await fs.mkdir(SecureStore.paths().dir, { recursive: true });
    await fs.writeFile(SecureStore.paths().manifestPath, JSON.stringify(this.manifest, null, 2), 'utf8');
  }

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = mapStatus(this.config, { ...this.status, ...patch });
    this.emit('status', this.status);
  }

  private log(message: string) {
    this.emit('log', `[${new Date().toLocaleTimeString()}] ${message}`);
  }

  async start() {
    await this.loadManifest();
    if (!this.config.localDir) {
      this.setStatus({ state: 'setup', message: 'Choisissez un dossier local' });
      return this.status;
    }

    await fs.mkdir(this.config.localDir, { recursive: true });
    await fs.mkdir(path.join(this.config.localDir, INTERNAL_DIR), { recursive: true });
    this.startWatcher();
    this.startSocket();
    this.startPolling();
    if (!this.config.paused) {
      await this.syncNow('startup');
    }
    return this.status;
  }

  async stop() {
    if (this.watcher) await this.watcher.close();
    this.watcher = null;
    this.socket?.disconnect();
    this.socket = null;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
    if (this.delayedSyncTimer) clearTimeout(this.delayedSyncTimer);
    this.delayedSyncTimer = null;
  }

  async pause() {
    this.config.paused = true;
    await SecureStore.saveConfig(this.config);
    this.setStatus({ state: 'paused', message: 'Synchronisation en pause' });
    return this.status;
  }

  async resume() {
    this.config.paused = false;
    await SecureStore.saveConfig(this.config);
    this.setStatus({ state: 'idle', message: 'Synchronisation active' });
    await this.syncNow('resume');
    return this.status;
  }

  async chooseFolder(localDir: string) {
    this.config.localDir = localDir;
    this.config.paused = false;
    await SecureStore.saveConfig(this.config);
    await this.start();
    return this.status;
  }

  private startWatcher() {
    if (!this.config.localDir || this.watcher) return;
    this.watcher = chokidar.watch(this.config.localDir, {
      ignored: (target) => target.split(path.sep).some(isExcludedName),
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 1200,
        pollInterval: 150,
      },
    });
    const schedule = () => this.scheduleSync('watch');
    this.watcher.on('add', schedule);
    this.watcher.on('change', schedule);
    this.watcher.on('unlink', schedule);
    this.watcher.on('addDir', schedule);
    this.watcher.on('unlinkDir', schedule);
  }

  private startPolling() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      this.scheduleSync('poll');
    }, POLL_INTERVAL_MS);
  }

  private startSocket() {
    if (this.socket) return;
    const token = this.auth.getTokens().token;
    if (!token) return;
    this.socket = io(this.config.serverUrl, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    this.socket.on('file_uploaded', () => this.scheduleSync('socket'));
    this.socket.on('file_updated', () => this.scheduleSync('socket'));
    this.socket.on('file_deleted', () => this.scheduleSync('socket'));
    this.socket.on('folder_created', () => this.scheduleSync('socket'));
    this.socket.on('folder_updated', () => this.scheduleSync('socket'));
    this.socket.on('folder_deleted', () => this.scheduleSync('socket'));
  }

  private scheduleSync(reason: string) {
    if (this.config.paused) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.syncNow(reason).catch((error) => {
        this.setStatus({ state: 'error', message: 'Erreur de synchronisation', lastError: error.message });
      });
    }, WATCH_DEBOUNCE_MS);
  }

  private scheduleDelayedSync(reason: string, delayMs: number) {
    if (this.config.paused) return;
    if (this.delayedSyncTimer) clearTimeout(this.delayedSyncTimer);
    this.delayedSyncTimer = setTimeout(() => {
      this.syncNow(reason).catch((error) => {
        this.setStatus({ state: 'error', message: 'Erreur de synchronisation', lastError: error.message });
      });
    }, Math.max(delayMs, WATCH_DEBOUNCE_MS));
  }

  async syncNow(reason = 'manual') {
    if (this.running) return this.status;
    if (this.config.paused) return this.status;
    if (!this.config.localDir) {
      this.setStatus({ state: 'setup', message: 'Choisissez un dossier local' });
      return this.status;
    }

    this.running = true;
    this.conflictCount = 0;
    this.setStatus({ state: 'syncing', message: `Synchronisation (${reason})...`, pending: 0, lastError: undefined });

    try {
      const root = await this.auth.request<{ folder: any }>({ method: 'GET', url: '/sync/root' });
      this.config.remoteRootId = root.folder.id;
      await SecureStore.saveConfig(this.config);

      const [local, remote] = await Promise.all([
        this.scanLocal(),
        this.fetchRemote(root.folder.id),
      ]);

      const folderChanges = await this.mergeFolders(local, remote);
      const refreshedRemote = await this.fetchRemote(root.folder.id);
      await this.mergeFiles(local, refreshedRemote, folderChanges);
      this.config.lastSyncAt = new Date().toISOString();
      await SecureStore.saveConfig(this.config);
      await this.saveManifest();
      if (this.conflictCount > 0) {
        this.setStatus({ state: 'conflict', message: `${this.conflictCount} conflit(s) conservé(s)`, pending: 0 });
      } else {
        this.setStatus({ state: 'idle', message: 'Synchronisé', pending: 0 });
      }
    } catch (error: any) {
      const offline = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'].includes(error.code);
      this.setStatus({
        state: offline ? 'offline' : 'error',
        message: offline ? 'Serveur indisponible, reprise automatique' : 'Erreur de synchronisation',
        lastError: error.response?.data?.error || error.message,
      });
    } finally {
      this.running = false;
    }

    return this.status;
  }

  private async scanLocal(): Promise<LocalSnapshot> {
    const files = new Map<string, LocalFile>();
    const folders = new Map<string, LocalFolder>();
    const root = this.config.localDir!;

    const walk = async (dir: string, prefix = '') => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (isExcludedName(entry.name) || entry.isSymbolicLink()) continue;
        const relativePath = toRelativeKey(path.join(prefix, entry.name));
        const absolutePath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const stat = await fs.stat(absolutePath);
          folders.set(relativePath, {
            relativePath,
            absolutePath,
            stableAt: Math.trunc(Math.max(stat.birthtimeMs, stat.ctimeMs, stat.mtimeMs)),
          });
          await walk(absolutePath, relativePath);
        } else if (entry.isFile()) {
          const stat = await fs.stat(absolutePath);
          files.set(relativePath, {
            relativePath,
            absolutePath,
            checksum: await checksumFile(absolutePath),
            size: stat.size,
            mtimeMs: Math.trunc(stat.mtimeMs),
          });
        }
      }
    };

    await walk(root);
    return { files, folders };
  }

  private async fetchRemote(rootId: string): Promise<RemoteSnapshot> {
    const { tree } = await this.auth.request<{ tree: any }>({
      method: 'GET',
      url: '/sync/tree',
      params: { rootFolderId: rootId },
    });
    const files = new Map<string, RemoteFile>();
    const folders = new Map<string, RemoteFolder>();

    const walk = (folder: any, prefix = '') => {
      for (const child of folder.folders || []) {
        const childPath = prefix ? `${prefix}/${child.name}` : child.name;
        folders.set(childPath, {
          id: child.id,
          name: child.name,
          relativePath: childPath,
          parentId: child.parentId,
          updatedAt: child.updatedAt,
        });
        walk(child, childPath);
      }
      for (const file of folder.files || []) {
        const filePath = prefix ? `${prefix}/${file.name}` : file.name;
        files.set(filePath, {
          id: file.id,
          name: file.name,
          relativePath: filePath,
          folderId: file.folderId,
          checksum: file.checksum,
          size: Number(file.size),
          mimeType: file.mimeType,
          updatedAt: file.updatedAt,
        });
      }
    };

    walk(tree);
    return { rootId, files, folders };
  }

  private async mergeFolders(local: LocalSnapshot, remote: RemoteSnapshot) {
    const remoteFolders = new Map(remote.folders);
    const localFolders = [...local.folders.values()].sort((a, b) => a.relativePath.split('/').length - b.relativePath.split('/').length);
    const remoteDeletedPrefixes: string[] = [];
    const localDeletedPrefixes: string[] = [];
    let nextFolderRetryMs: number | undefined;

    const manifestFolders = Object.values(this.manifest)
      .filter((entry) => entry.type === 'folder')
      .map((entry) => entry.relativePath)
      .sort((a, b) => a.split('/').length - b.split('/').length);

    for (const relativePath of manifestFolders) {
      if (isInsideAnyFolder(relativePath, [...remoteDeletedPrefixes, ...localDeletedPrefixes])) continue;
      const localFolder = local.folders.get(relativePath);
      const remoteFolder = remoteFolders.get(relativePath);
      const entry = this.manifest[`folder:${relativePath}`];

      if (localFolder && !remoteFolder && entry?.remoteId) {
        await this.trashLocal(localFolder.absolutePath);
        this.removeManifestSubtree(relativePath);
        remoteDeletedPrefixes.push(relativePath);
        this.log(`Suppression distante appliquée localement: ${relativePath}`);
      } else if (!localFolder && remoteFolder && entry?.remoteId) {
        await this.deleteRemoteFolder(remoteFolder.id);
        this.removeManifestSubtree(relativePath);
        remoteFolders.delete(relativePath);
        localDeletedPrefixes.push(relativePath);
        this.log(`Suppression locale appliquée côté SupFile: ${relativePath}`);
      } else if (!localFolder && !remoteFolder && entry?.remoteId) {
        this.removeManifestSubtree(relativePath);
      }
    }

    for (const folder of localFolders) {
      if (isInsideAnyFolder(folder.relativePath, remoteDeletedPrefixes)) continue;
      if (remoteFolders.has(folder.relativePath)) continue;
      const settleDelay = folderSettleDelay(folder.relativePath, folder.stableAt);
      if (settleDelay > 0) {
        nextFolderRetryMs = Math.min(nextFolderRetryMs ?? settleDelay, settleDelay);
        this.log(`Dossier local en attente de stabilisation: ${folder.relativePath}`);
        continue;
      }
      const parentPath = path.posix.dirname(folder.relativePath);
      const parentId = parentPath === '.'
        ? remote.rootId
        : remoteFolders.get(parentPath)?.id;
      if (!parentId) continue;
      const created = await this.auth.request<{ folder: any }>({
        method: 'POST',
        url: '/folders',
        data: { name: path.posix.basename(folder.relativePath), parentId },
      });
      remoteFolders.set(folder.relativePath, {
        id: created.folder.id,
        name: created.folder.name,
        relativePath: folder.relativePath,
        parentId,
        updatedAt: created.folder.updatedAt,
      });
      this.manifest[`folder:${folder.relativePath}`] = {
        type: 'folder',
        relativePath: folder.relativePath,
        remoteId: created.folder.id,
        remoteUpdatedAt: created.folder.updatedAt,
      };
      this.log(`Dossier distant créé: ${folder.relativePath}`);
    }

    if (nextFolderRetryMs !== undefined) {
      this.scheduleDelayedSync('folder-settle', nextFolderRetryMs);
    }

    for (const folder of remote.folders.values()) {
      if (isInsideAnyFolder(folder.relativePath, localDeletedPrefixes)) continue;
      const target = localPath(this.config.localDir!, folder.relativePath);
      if (!(await exists(target))) {
        await fs.mkdir(target, { recursive: true });
        this.log(`Dossier local créé: ${folder.relativePath}`);
      }
      this.manifest[`folder:${folder.relativePath}`] = {
        type: 'folder',
        relativePath: folder.relativePath,
        remoteId: folder.id,
        remoteUpdatedAt: folder.updatedAt,
      };
    }

    return { remoteDeletedPrefixes, localDeletedPrefixes };
  }

  private async mergeFiles(
    local: LocalSnapshot,
    remote: RemoteSnapshot,
    folderChanges: { remoteDeletedPrefixes: string[]; localDeletedPrefixes: string[] }
  ) {
    const allPaths = new Set<string>([
      ...local.files.keys(),
      ...remote.files.keys(),
      ...Object.values(this.manifest).filter((entry) => entry.type === 'file').map((entry) => entry.relativePath),
    ]);

    for (const relativePath of [...allPaths].sort()) {
      if (
        isInsideAnyFolder(relativePath, folderChanges.remoteDeletedPrefixes)
        || isInsideAnyFolder(relativePath, folderChanges.localDeletedPrefixes)
      ) {
        continue;
      }
      const localFile = local.files.get(relativePath);
      const remoteFile = remote.files.get(relativePath);
      const entry = this.manifest[`file:${relativePath}`];

      if (localFile && remoteFile) {
        const localChanged = !entry || localFile.checksum !== entry.checksum || localFile.size !== entry.size;
        const remoteChanged = !entry || !sameRemoteTimestamp(entry, remoteFile) || (remoteFile.checksum && remoteFile.checksum !== entry.checksum);

        if (localFile.checksum === remoteFile.checksum) {
          this.rememberFile(relativePath, localFile, remoteFile);
        } else if (localChanged && remoteChanged) {
          await this.resolveConflict(relativePath, localFile, remoteFile, remote);
        } else if (localChanged) {
          await this.uploadLocalFile(localFile, remoteFile, remote);
        } else if (remoteChanged) {
          await this.downloadRemoteFile(remoteFile);
        }
      } else if (localFile && !remoteFile) {
        if (entry?.remoteId && localFile.checksum === entry.checksum) {
          await this.trashLocal(localFile.absolutePath);
          delete this.manifest[`file:${relativePath}`];
          this.log(`Suppression distante appliquée localement: ${relativePath}`);
        } else {
          await this.uploadLocalFile(localFile, undefined, remote);
        }
      } else if (!localFile && remoteFile) {
        if (entry?.remoteId && sameRemoteTimestamp(entry, remoteFile)) {
          await this.deleteRemoteFile(remoteFile.id);
          delete this.manifest[`file:${relativePath}`];
          this.log(`Suppression locale appliquée côté SupFile: ${relativePath}`);
        } else {
          await this.downloadRemoteFile(remoteFile);
        }
      }
    }
  }

  private rememberFile(relativePath: string, localFile: LocalFile, remoteFile: RemoteFile) {
    this.manifest[`file:${relativePath}`] = {
      type: 'file',
      relativePath,
      remoteId: remoteFile.id,
      checksum: localFile.checksum,
      size: localFile.size,
      mtimeMs: localFile.mtimeMs,
      remoteUpdatedAt: remoteFile.updatedAt,
    };
  }

  private async uploadLocalFile(localFile: LocalFile, remoteFile: RemoteFile | undefined, remote: RemoteSnapshot) {
    const parentPath = path.posix.dirname(localFile.relativePath);
    const parentId = parentPath === '.'
      ? remote.rootId
      : remote.folders.get(parentPath)?.id;
    if (!parentId) throw new Error(`Dossier distant introuvable pour ${localFile.relativePath}`);

    try {
      const result = await this.auth.uploadFile(localFile.absolutePath, {
        rootFolderId: remote.rootId,
        folderId: parentId,
        remoteFileId: remoteFile?.id,
        baseRemoteUpdatedAt: remoteFile?.updatedAt,
        checksum: localFile.checksum,
        fileName: path.posix.basename(localFile.relativePath),
      });
      const uploaded = result.file;
      this.manifest[`file:${localFile.relativePath}`] = {
        type: 'file',
        relativePath: localFile.relativePath,
        remoteId: uploaded.id,
        checksum: uploaded.checksum || localFile.checksum,
        size: Number(uploaded.size),
        mtimeMs: localFile.mtimeMs,
        remoteUpdatedAt: uploaded.updatedAt,
      };
      this.log(`Upload: ${localFile.relativePath}`);
    } catch (error: any) {
      if (error.response?.status === 409 && remoteFile) {
        await this.resolveConflict(localFile.relativePath, localFile, remoteFile, remote);
        return;
      }
      throw error;
    }
  }

  private async downloadRemoteFile(remoteFile: RemoteFile) {
    const destination = localPath(this.config.localDir!, remoteFile.relativePath);
    const stream = await this.auth.downloadFile(remoteFile.id);
    await writeStreamAtomic(stream, destination);
    const stat = await fs.stat(destination);
    const checksum = remoteFile.checksum || await checksumFile(destination);
    this.manifest[`file:${remoteFile.relativePath}`] = {
      type: 'file',
      relativePath: remoteFile.relativePath,
      remoteId: remoteFile.id,
      checksum,
      size: stat.size,
      mtimeMs: Math.trunc(stat.mtimeMs),
      remoteUpdatedAt: remoteFile.updatedAt,
    };
    this.log(`Download: ${remoteFile.relativePath}`);
  }

  private async resolveConflict(relativePath: string, localFile: LocalFile, remoteFile: RemoteFile, remote: RemoteSnapshot) {
    this.conflictCount += 1;
    const conflictRelativePath = uniqueConflictPath(this.config.localDir!, relativePath);
    const conflictAbsolutePath = localPath(this.config.localDir!, conflictRelativePath);
    await fs.mkdir(path.dirname(conflictAbsolutePath), { recursive: true });
    await fs.rename(localFile.absolutePath, conflictAbsolutePath);

    await this.downloadRemoteFile(remoteFile);
    const stat = await fs.stat(conflictAbsolutePath);
    const conflictFile: LocalFile = {
      relativePath: conflictRelativePath,
      absolutePath: conflictAbsolutePath,
      checksum: await checksumFile(conflictAbsolutePath),
      size: stat.size,
      mtimeMs: Math.trunc(stat.mtimeMs),
    };
    await this.uploadLocalFile(conflictFile, undefined, remote);
    this.log(`Conflit conservé: ${conflictRelativePath}`);
  }

  private async deleteRemoteFile(remoteFileId: string) {
    await this.auth.request({ method: 'DELETE', url: `/files/${remoteFileId}` });
  }

  private async deleteRemoteFolder(remoteFolderId: string) {
    await this.auth.request({ method: 'DELETE', url: `/folders/${remoteFolderId}` });
  }

  private removeManifestSubtree(folderPath: string) {
    for (const key of Object.keys(this.manifest)) {
      const entry = this.manifest[key];
      if (
        entry.relativePath === folderPath
        || entry.relativePath.startsWith(`${folderPath}/`)
      ) {
        delete this.manifest[key];
      }
    }
  }

  private async trashLocal(targetPath: string) {
    const localDir = this.config.localDir;
    if (!localDir) throw new Error('Dossier local non configuré');
    const safeTarget = assertPathInsideBase(localDir, targetPath);

    try {
      await shell.trashItem(safeTarget);
    } catch {
      const relativePath = path.relative(path.resolve(localDir), safeTarget);
      const fallbackPath = path.join(
        localDir,
        INTERNAL_DIR,
        'trash',
        new Date().toISOString().replace(/[:.]/g, '-'),
        relativePath
      );
      await fs.mkdir(path.dirname(fallbackPath), { recursive: true });
      await fs.rename(safeTarget, fallbackPath);
      this.log(`Corbeille Windows indisponible, élément déplacé dans ${path.relative(localDir, fallbackPath)}`);
    }
  }
}
