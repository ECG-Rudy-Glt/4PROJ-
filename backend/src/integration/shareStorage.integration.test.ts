import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { Writable } from 'stream';
import { ShareController } from '../controllers/shareController';
import { FileUploadService } from '../services/fileUploadService';
import {
  cleanIntegrationDb,
  createIntegrationUser,
  disconnectIntegrationDb,
  prisma,
} from '../test/integrationDb';
import {
  cleanupIntegrationStorage,
  trackIntegrationObject,
} from '../test/integrationStorage';

class CaptureResponse extends Writable {
  statusCode = 200;
  headersSent = false;
  writeHeadCalled = false;
  jsonBody: unknown;
  private readonly headers = new Map<string, unknown>();
  private readonly chunks: Buffer[] = [];
  readonly finished: Promise<void>;

  constructor() {
    super();
    this.finished = new Promise((resolve, reject) => {
      this.on('finish', resolve);
      this.on('error', reject);
    });
  }

  _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.headersSent = true;
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    callback();
  }

  setHeader(name: string, value: unknown): this {
    this.headers.set(name.toLowerCase(), value);
    return this;
  }

  getHeader(name: string): unknown {
    return this.headers.get(name.toLowerCase());
  }

  writeHead(statusCode: number, headers?: Record<string, unknown>): this {
    this.statusCode = statusCode;
    this.headersSent = true;
    this.writeHeadCalled = true;
    if (headers) {
      Object.entries(headers).forEach(([name, value]) => this.setHeader(name, value));
    }
    return this;
  }

  status(statusCode: number): this {
    this.statusCode = statusCode;
    return this;
  }

  json(body: unknown): this {
    this.jsonBody = body;
    this.headersSent = true;
    this.end();
    return this;
  }

  body(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

const tempFiles = new Set<string>();

async function writeTempUpload(content: Buffer, filename: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'supfile-itest-'));
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, content);
  tempFiles.add(filePath);
  return filePath;
}

async function cleanupTempFiles(): Promise<void> {
  await Promise.all([...tempFiles].map(async (filePath) => {
    await fs.rm(path.dirname(filePath), { recursive: true, force: true });
    tempFiles.delete(filePath);
  }));
}

async function createOwnerS3File(content: Buffer, userId: string, filename = 'shared-file.bin') {
  const tempPath = await writeTempUpload(content, filename);
  const file = await FileUploadService.createFile(
    userId,
    filename,
    filename,
    'application/octet-stream',
    content.length,
    tempPath
  );

  trackIntegrationObject(file.storagePath);
  return file;
}

function publicShareRequest(token: string) {
  return {
    params: { token },
    query: {},
  } as any;
}

function sharedFileRequest(userId: string, fileId: string) {
  return {
    user: { id: userId, encryptedDek: null },
    params: { fileId },
    headers: {},
  } as any;
}

async function createSharedFile(fileId: string, ownerId: string, sharedWithId: string, accepted: boolean) {
  return prisma.sharedFile.create({
    data: {
      fileId,
      sharedById: ownerId,
      sharedWithId,
      accepted,
      canRead: true,
      canWrite: false,
      canDelete: false,
      canShare: false,
    },
  });
}

describe('shared S3 file access integration', () => {
  beforeEach(async () => {
    await cleanIntegrationDb();
  });

  afterEach(async () => {
    await cleanupIntegrationStorage();
    await cleanupTempFiles();
    await cleanIntegrationDb();
  });

  afterAll(async () => {
    await cleanupIntegrationStorage();
    await cleanupTempFiles();
    await disconnectIntegrationDb();
  });

  it('downloads and decrypts a public S3 share link and increments downloads', async () => {
    const owner = await createIntegrationUser();
    const content = Buffer.from('public share S3 content');
    const file = await createOwnerS3File(content, owner.id, 'public-share.bin');
    const shareLink = await prisma.sharedLink.create({
      data: {
        token: `itest-token-${Date.now()}`,
        fileId: file.id,
        userId: owner.id,
      },
    });
    const res = new CaptureResponse();
    const next = jest.fn();

    await ShareController.downloadSharedFile(publicShareRequest(shareLink.token), res as any, next);
    await res.finished;

    const updatedLink = await prisma.sharedLink.findUnique({ where: { id: shareLink.id } });
    expect(next).not.toHaveBeenCalled();
    expect(res.body().toString()).toBe(content.toString());
    expect(res.getHeader('Content-Type')).toBe('application/octet-stream');
    expect(String(res.getHeader('Content-Disposition'))).toContain(file.name);
    expect(updatedLink?.downloads).toBe(1);
  });

  it('downloads and decrypts an accepted direct shared S3 file', async () => {
    const owner = await createIntegrationUser();
    const sharedUser = await createIntegrationUser();
    const content = Buffer.from('accepted shared download content');
    const file = await createOwnerS3File(content, owner.id, 'accepted-download.bin');
    await createSharedFile(file.id, owner.id, sharedUser.id, true);
    const res = new CaptureResponse();
    const next = jest.fn();

    await ShareController.downloadSharedFileAuth(sharedFileRequest(sharedUser.id, file.id), res as any, next);
    await res.finished;

    expect(next).not.toHaveBeenCalled();
    expect(res.body().toString()).toBe(content.toString());
    expect(res.getHeader('Content-Type')).toBe('application/octet-stream');
    expect(String(res.getHeader('Content-Disposition'))).toContain(file.name);
  });

  it('streams and decrypts an accepted direct shared S3 file', async () => {
    const owner = await createIntegrationUser();
    const sharedUser = await createIntegrationUser();
    const content = Buffer.from('accepted shared stream content');
    const file = await createOwnerS3File(content, owner.id, 'accepted-stream.bin');
    await createSharedFile(file.id, owner.id, sharedUser.id, true);
    const res = new CaptureResponse();
    const next = jest.fn();

    await ShareController.streamSharedFile(sharedFileRequest(sharedUser.id, file.id), res as any, next);
    await res.finished;

    expect(next).not.toHaveBeenCalled();
    expect(res.writeHeadCalled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.getHeader('Content-Length')).toBe(content.length);
    expect(res.getHeader('Content-Type')).toBe('application/octet-stream');
    expect(res.body().toString()).toBe(content.toString());
  });

  it('refuses a pending direct share without streaming content', async () => {
    const owner = await createIntegrationUser();
    const sharedUser = await createIntegrationUser();
    const content = Buffer.from('pending shared content');
    const file = await createOwnerS3File(content, owner.id, 'pending-share.bin');
    await createSharedFile(file.id, owner.id, sharedUser.id, false);
    const res = new CaptureResponse();
    const next = jest.fn();

    await ShareController.downloadSharedFileAuth(sharedFileRequest(sharedUser.id, file.id), res as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.writeHeadCalled).toBe(false);
    expect(res.body()).toHaveLength(0);
  });

  it('refuses an unrelated user without streaming content', async () => {
    const owner = await createIntegrationUser();
    const sharedUser = await createIntegrationUser();
    const unrelatedUser = await createIntegrationUser();
    const content = Buffer.from('unrelated user should not read this');
    const file = await createOwnerS3File(content, owner.id, 'unrelated-share.bin');
    await createSharedFile(file.id, owner.id, sharedUser.id, true);
    const res = new CaptureResponse();
    const next = jest.fn();

    await ShareController.streamSharedFile(sharedFileRequest(unrelatedUser.id, file.id), res as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.writeHeadCalled).toBe(false);
    expect(res.body()).toHaveLength(0);
  });
});
