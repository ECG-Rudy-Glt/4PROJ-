import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { Writable } from 'stream';
import { FileController } from '../controllers/fileController';
import { FileUploadService } from '../services/fileUploadService';
import {
  cleanIntegrationDb,
  createIntegrationUser,
  disconnectIntegrationDb,
  prisma,
} from '../test/integrationDb';
import {
  cleanupIntegrationStorage,
  deleteIntegrationObject,
  integrationObjectExists,
  trackIntegrationObject,
} from '../test/integrationStorage';

class CaptureResponse extends Writable {
  statusCode = 200;
  headersSent = false;
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

async function expectMissingLocalFile(filePath: string): Promise<void> {
  await expect(fs.access(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
}

function createAuthRequest(userId: string, fileId: string) {
  return {
    user: { id: userId, encryptedDek: null },
    params: { fileId },
    headers: {},
  } as any;
}

async function uploadOwnerFile(content: Buffer, userId: string, filename = 'owner-file.bin') {
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
  return { file, tempPath };
}

describe('owner file storage integration', () => {
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

  it('creates a File row, stores an S3 object and increments quotaUsed', async () => {
    const user = await createIntegrationUser();
    const content = Buffer.from('owner upload integration content');

    const { file, tempPath } = await uploadOwnerFile(content, user.id);

    const storedFile = await prisma.file.findUnique({ where: { id: file.id } });
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { quotaUsed: true },
    });

    expect(storedFile).toMatchObject({
      id: file.id,
      userId: user.id,
      storagePath: file.storagePath,
      mimeType: 'application/octet-stream',
    });
    expect(file.storagePath).toMatch(new RegExp(`^files/${user.id}/`));
    expect(await integrationObjectExists(file.storagePath)).toBe(true);
    expect(updatedUser?.quotaUsed).toBe(BigInt(content.length));
    await expectMissingLocalFile(tempPath);
  });

  it('downloads and decrypts an owner S3 file through FileController.downloadFile', async () => {
    const user = await createIntegrationUser();
    const content = Buffer.from('download me from encrypted S3');
    const { file } = await uploadOwnerFile(content, user.id, 'download.bin');
    const res = new CaptureResponse();
    const next = jest.fn();

    await FileController.downloadFile(createAuthRequest(user.id, file.id), res as any, next);
    await res.finished;

    expect(next).not.toHaveBeenCalled();
    expect(res.body().toString()).toBe(content.toString());
    expect(res.getHeader('Content-Type')).toBe('application/octet-stream');
    expect(String(res.getHeader('Content-Disposition'))).toContain(encodeURIComponent(file.name));
  });

  it('streams and decrypts an owner S3 file through FileController.streamFile', async () => {
    const user = await createIntegrationUser();
    const content = Buffer.from('stream me from encrypted S3');
    const { file } = await uploadOwnerFile(content, user.id, 'stream.bin');
    const res = new CaptureResponse();
    const next = jest.fn();

    await FileController.streamFile(createAuthRequest(user.id, file.id), res as any, next);
    await res.finished;

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body().toString()).toBe(content.toString());
    expect(res.getHeader('Content-Type')).toBe('application/octet-stream');
    expect(res.getHeader('Content-Length')).toBe(content.length);
  });

  it('returns a controlled error when the S3 object is missing', async () => {
    const user = await createIntegrationUser();
    const content = Buffer.from('this object will disappear');
    const { file } = await uploadOwnerFile(content, user.id, 'missing.bin');
    const res = new CaptureResponse();
    const next = jest.fn();

    await deleteIntegrationObject(file.storagePath);

    await FileController.downloadFile(createAuthRequest(user.id, file.id), res as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.body()).toHaveLength(0);
  });
});
