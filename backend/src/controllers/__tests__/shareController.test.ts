import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ShareController } from '../shareController';
import { ShareService } from '../../services/shareService';
import { StorageService } from '../../services/storageService';
import { EncryptionService } from '../../services/encryptionService';
import prisma from '../../config/database';

jest.mock('fs', () => {
  const fsMock = {
    existsSync: jest.fn(),
    statSync: jest.fn(),
  };

  return {
    __esModule: true,
    default: fsMock,
    ...fsMock,
  };
});

jest.mock('../../services/shareService', () => ({
  ShareService: {
    getShareLink: jest.fn(),
    incrementDownloadCount: jest.fn(),
    getSharedFileAccess: jest.fn(),
  },
}));

jest.mock('../../services/storageService', () => ({
  StorageService: {
    isS3Key: jest.fn(),
    getObjectSize: jest.fn(),
  },
}));

jest.mock('../../services/encryptionService', () => ({
  EncryptionService: {
    getDecryptStreamAuto: jest.fn(),
  },
}));

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    sharedLink: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../config/secrets', () => ({
  getShareAccessSecret: () => 'test-share-access-secret',
}));

jest.mock('../../services/shareInvitationService', () => ({
  ShareInvitationService: {},
}));

jest.mock('../../services/shareKeyService', () => ({
  ShareKeyService: {
    unwrapOwnerDek: jest.fn().mockReturnValue(undefined),
    wrapOwnerDek: jest.fn().mockReturnValue(undefined),
    backfillOwnerShareKeys: jest.fn(),
  },
}));

jest.mock('../../services/socketService', () => ({
  SocketService: {},
}));

jest.mock('../../services/notificationService', () => ({
  NotificationService: {
    create: jest.fn(),
  },
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

const createRes = () => {
  const res: any = {
    headersSent: false,
  };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.writeHead = jest.fn().mockReturnValue(res);
  res.destroy = jest.fn();
  return res;
};

const createDecryptStream = () => ({
  on: jest.fn().mockReturnThis(),
  pipe: jest.fn(),
});

const createFile = (storagePath: string) => ({
  id: 'file-1',
  name: 'shared.pdf',
  mimeType: 'application/pdf',
  storagePath,
});

describe('ShareController shared file storage streaming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (StorageService.isS3Key as jest.Mock).mockImplementation((path: string) => path.startsWith('files/'));
    (StorageService.getObjectSize as jest.Mock).mockResolvedValue(96);
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({ size: 96 });
    (ShareService.incrementDownloadCount as jest.Mock).mockResolvedValue(undefined);
  });

  it('downloads public S3 shares without treating the S3 key as a local path', async () => {
    const decryptStream = createDecryptStream();
    (ShareService.getShareLink as jest.Mock).mockResolvedValue({
      file: createFile('files/shared.enc'),
    });
    (EncryptionService.getDecryptStreamAuto as jest.Mock).mockResolvedValue(decryptStream);

    const req: any = { params: { token: 'public-token' }, query: {} };
    const res = createRes();

    await ShareController.downloadSharedFile(req, res, jest.fn());

    expect(StorageService.getObjectSize).toHaveBeenCalledWith('files/shared.enc');
    expect(fs.existsSync).not.toHaveBeenCalled();
    expect(fs.statSync).not.toHaveBeenCalled();
    expect(ShareService.incrementDownloadCount).toHaveBeenCalledWith('public-token');
    expect(EncryptionService.getDecryptStreamAuto).toHaveBeenCalledWith('files/shared.enc', undefined);
    expect(decryptStream.pipe).toHaveBeenCalledWith(res);
  });

  it('keeps local fallback for public shared downloads', async () => {
    const decryptStream = createDecryptStream();
    (ShareService.getShareLink as jest.Mock).mockResolvedValue({
      file: createFile('/data/uploads/shared.enc'),
    });
    (EncryptionService.getDecryptStreamAuto as jest.Mock).mockResolvedValue(decryptStream);

    const req: any = { params: { token: 'public-token' }, query: {} };
    const res = createRes();

    await ShareController.downloadSharedFile(req, res, jest.fn());

    expect(fs.existsSync).toHaveBeenCalledWith('/data/uploads/shared.enc');
    expect(fs.statSync).toHaveBeenCalledWith('/data/uploads/shared.enc');
    expect(StorageService.getObjectSize).not.toHaveBeenCalled();
    expect(EncryptionService.getDecryptStreamAuto).toHaveBeenCalledWith('/data/uploads/shared.enc', undefined);
    expect(decryptStream.pipe).toHaveBeenCalledWith(res);
  });

  it('downloads accepted auth shares from S3 through the storage abstraction', async () => {
    const decryptStream = createDecryptStream();
    const dekBuffer = Buffer.from('dek');
    (ShareService.getSharedFileAccess as jest.Mock).mockResolvedValue({
      file: { ...createFile('files/shared.enc'), userId: 'user-1' },
    });
    (EncryptionService.getDecryptStreamAuto as jest.Mock).mockResolvedValue(decryptStream);

    const req: any = { user: { id: 'user-1' }, dekBuffer, params: { fileId: 'file-1' } };
    const res = createRes();

    await ShareController.downloadSharedFileAuth(req, res, jest.fn());

    expect(ShareService.getSharedFileAccess).toHaveBeenCalledWith('file-1', 'user-1');
    expect(StorageService.getObjectSize).toHaveBeenCalledWith('files/shared.enc');
    expect(fs.existsSync).not.toHaveBeenCalled();
    expect(EncryptionService.getDecryptStreamAuto).toHaveBeenCalledWith('files/shared.enc', dekBuffer);
    expect(decryptStream.pipe).toHaveBeenCalledWith(res);
  });

  it('streams accepted auth shares from S3 with decrypted content length', async () => {
    const decryptStream = createDecryptStream();
    const dekBuffer = Buffer.from('dek');
    (StorageService.getObjectSize as jest.Mock).mockResolvedValue(132);
    (ShareService.getSharedFileAccess as jest.Mock).mockResolvedValue({
      file: { ...createFile('files/shared.enc'), userId: 'user-1' },
    });
    (EncryptionService.getDecryptStreamAuto as jest.Mock).mockResolvedValue(decryptStream);

    const req: any = { user: { id: 'user-1' }, dekBuffer, params: { fileId: 'file-1' } };
    const res = createRes();

    await ShareController.streamSharedFile(req, res, jest.fn());

    expect(StorageService.getObjectSize).toHaveBeenCalledWith('files/shared.enc');
    expect(fs.existsSync).not.toHaveBeenCalled();
    expect(fs.statSync).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(200, {
      'Content-Length': 100,
      'Content-Type': 'application/pdf',
    });
    expect(EncryptionService.getDecryptStreamAuto).toHaveBeenCalledWith('files/shared.enc', dekBuffer);
    expect(decryptStream.pipe).toHaveBeenCalledWith(res);
  });

  it('keeps local fallback stats for accepted auth share streams', async () => {
    const decryptStream = createDecryptStream();
    (ShareService.getSharedFileAccess as jest.Mock).mockResolvedValue({
      file: createFile('/data/uploads/shared.enc'),
    });
    (fs.statSync as jest.Mock).mockReturnValue({ size: 82 });
    (EncryptionService.getDecryptStreamAuto as jest.Mock).mockResolvedValue(decryptStream);

    const req: any = { user: { id: 'user-1' }, params: { fileId: 'file-1' } };
    const res = createRes();

    await ShareController.streamSharedFile(req, res, jest.fn());

    expect(fs.existsSync).toHaveBeenCalledWith('/data/uploads/shared.enc');
    expect(fs.statSync).toHaveBeenCalledWith('/data/uploads/shared.enc');
    expect(StorageService.getObjectSize).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(200, {
      'Content-Length': 50,
      'Content-Type': 'application/pdf',
    });
    expect(EncryptionService.getDecryptStreamAuto).toHaveBeenCalledWith('/data/uploads/shared.enc', undefined);
    expect(decryptStream.pipe).toHaveBeenCalledWith(res);
  });

  it('returns a clean error when the S3 object is missing or unreadable', async () => {
    (ShareService.getShareLink as jest.Mock).mockResolvedValue({
      file: createFile('files/missing.enc'),
    });
    (StorageService.getObjectSize as jest.Mock).mockRejectedValue(new Error('NoSuchKey'));

    const req: any = { params: { token: 'public-token' }, query: {} };
    const res = createRes();
    const next = jest.fn();

    await ShareController.downloadSharedFile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'File not found in storage',
    });
    expect(next).not.toHaveBeenCalled();
    expect(fs.existsSync).not.toHaveBeenCalled();
    expect(ShareService.incrementDownloadCount).not.toHaveBeenCalled();
    expect(EncryptionService.getDecryptStreamAuto).not.toHaveBeenCalled();
  });

  it('does not send shared stream headers if decrypt stream initialization fails', async () => {
    const decryptError = new Error('Decrypt init failed');
    (ShareService.getSharedFileAccess as jest.Mock).mockResolvedValue({
      file: createFile('files/shared.enc'),
    });
    (EncryptionService.getDecryptStreamAuto as jest.Mock).mockRejectedValue(decryptError);

    const req: any = { user: { id: 'user-1' }, params: { fileId: 'file-1' } };
    const res = createRes();
    const next = jest.fn();

    await ShareController.streamSharedFile(req, res, next);

    expect(StorageService.getObjectSize).toHaveBeenCalledWith('files/shared.enc');
    expect(res.writeHead).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(decryptError);
  });
});

describe('ShareController public share unlock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('unlocks password-protected public file links after reloading availability relations', async () => {
    const passwordHash = await bcrypt.hash('secret-password', 10);
    (prisma.sharedLink.findUnique as jest.Mock).mockResolvedValue({
      id: 'link-1',
      token: 'public-token',
      fileId: 'file-1',
      folderId: null,
      bundleFileIds: null,
      password: passwordHash,
      expiresAt: null,
      maxDownloads: null,
      downloads: 0,
      file: { id: 'file-1', isDeleted: false, isVault: false },
      user: { id: 'owner-1', accountStatus: 'ACTIVE' },
    });

    const req: any = {
      params: { token: 'public-token' },
      body: { password: 'secret-password' },
    };
    const res = createRes();

    await ShareController.unlockPublicShare(req, res, jest.fn());

    expect(prisma.sharedLink.findUnique).toHaveBeenCalledWith({
      where: { token: 'public-token' },
      include: {
        file: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true, accountStatus: true } },
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.data.shareAccessToken).toEqual(expect.any(String));
    expect(payload.data.expiresIn).toBe(3600);

    const decoded = jwt.verify(payload.data.shareAccessToken, 'test-share-access-secret') as any;
    expect(decoded).toEqual(expect.objectContaining({
      purpose: 'share-password-access',
      kind: 'public-link',
      linkId: 'link-1',
      token: 'public-token',
    }));
  });
});
