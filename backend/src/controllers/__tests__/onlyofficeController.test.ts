import axios from 'axios';
import fs from 'fs/promises';
import prisma from '../../config/database';
import { OnlyOfficeController } from '../onlyofficeController';
import { OnlyOfficeService } from '../../services/onlyofficeService';
import { KekService } from '../../services/kekService';
import { EncryptionService } from '../../services/encryptionService';
import { PlanService } from '../../services/planService';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
}));

jest.mock('../../middlewares/auth', () => ({}));

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    file: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    folder: {
      findUnique: jest.fn(),
    },
    sharedFolder: {
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../services/onlyofficeService', () => ({
  OnlyOfficeService: {
    verifyFileAccessToken: jest.fn(),
    verifyCallbackRequest: jest.fn(),
    verifyCallbackToken: jest.fn(),
    assertSafeDownloadUrl: jest.fn((url) => url),
    processCallback: jest.fn(),
    createFileVersion: jest.fn(),
    canEdit: jest.fn(),
    generateConfig: jest.fn(),
  },
}));

jest.mock('../../services/encryptionService', () => ({
  EncryptionService: {
    getDecryptStreamAuto: jest.fn(),
  },
}));

jest.mock('../../services/vaultService', () => ({
  VaultService: {
    assertUnlockedIfVault: jest.fn(),
  },
}));

jest.mock('../../services/kekService', () => ({
  KekService: {
    unwrapDek: jest.fn(),
    wrapDek: jest.fn(),
  },
}));

jest.mock('../../services/planService', () => ({
  PLAN_UPGRADE_REQUIRED_CODE: 'PLAN_UPGRADE_REQUIRED',
  PlanService: {
    checkFeature: jest.fn(),
    getUpgradeRequirement: jest.fn((feature) => ({
      feature,
      requiredPlan: 'PRO',
      upgradePath: '/plans',
    })),
  },
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const createRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

const file = {
  id: 'file-1',
  userId: 'owner-1',
  name: 'document.docx',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  storagePath: 'files/document.docx',
  isVault: false,
};

describe('OnlyOfficeController.handleCallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (PlanService.checkFeature as jest.Mock).mockResolvedValue(true);
    (prisma.file.findUnique as jest.Mock).mockResolvedValue(file);
    (prisma.file.findFirst as jest.Mock).mockResolvedValue(file);
    (OnlyOfficeService.verifyCallbackRequest as jest.Mock).mockReturnValue(true);
    (OnlyOfficeService.verifyCallbackToken as jest.Mock).mockReturnValue({
      fileId: 'file-1',
      userId: 'owner-1',
    });
    (OnlyOfficeService.assertSafeDownloadUrl as jest.Mock).mockImplementation((url) => url);
    (OnlyOfficeService.processCallback as jest.Mock).mockResolvedValue({
      shouldSave: true,
      downloadUrl: 'http://onlyoffice/download',
      error: 0,
    });
  });

  it.each([
    ['absent', undefined, undefined],
    ['invalid', 'bad-wrapped-dek', null],
  ])(
    'should reject encrypted accounts before download when wrappedDek is %s',
    async (_caseName, wrappedDek, unwrappedDek) => {
      (OnlyOfficeService.verifyCallbackToken as jest.Mock).mockReturnValue({
        fileId: 'file-1',
        userId: 'user-1',
        ...(wrappedDek ? { wrappedDek } : {}),
      });
      (KekService.unwrapDek as jest.Mock).mockReturnValue(unwrappedDek);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ encryptedDek: 'encrypted-dek' });

      const req: any = {
        params: { fileId: 'file-1', callbackToken: 'callback-token' },
        body: { status: 2 },
        query: {},
      };
      const res = createRes();

      await OnlyOfficeController.handleCallback(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ error: 1, code: 'DEK_UNLOCK_REQUIRED' });
      expect(axios.get).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(OnlyOfficeService.createFileVersion).not.toHaveBeenCalled();
    }
  );

  it('should keep callback save behavior for accounts without encrypted DEK', async () => {
    const content = Buffer.from('updated document');
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ encryptedDek: null });
    (axios.get as jest.Mock).mockResolvedValue({ data: content });
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (OnlyOfficeService.createFileVersion as jest.Mock).mockResolvedValue(undefined);

    const req: any = {
      params: { fileId: 'file-1', callbackToken: 'callback-token' },
      body: { status: 2 },
      query: {},
    };
    const res = createRes();

    await OnlyOfficeController.handleCallback(req, res, jest.fn());

    expect(axios.get).toHaveBeenCalledWith('http://onlyoffice/download', {
      responseType: 'arraybuffer',
      maxRedirects: 0,
      timeout: 30000,
    });
    expect(fs.writeFile).toHaveBeenCalledWith(expect.any(String), content);
    expect(OnlyOfficeService.createFileVersion).toHaveBeenCalledWith(
      'file-1',
      'owner-1',
      expect.any(String),
      'document.docx',
      content.byteLength,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      undefined
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ error: 0 });
  });

  it('should reject callback before download when current write access is not accepted', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ encryptedDek: null });
    (prisma.file.findFirst as jest.Mock).mockResolvedValue(null);
    (OnlyOfficeService.verifyCallbackToken as jest.Mock).mockReturnValue({
      fileId: 'file-1',
      userId: 'shared-user',
    });

    const req: any = {
      params: { fileId: 'file-1', callbackToken: 'callback-token' },
      body: { status: 2 },
      query: {},
    };
    const res = createRes();

    await OnlyOfficeController.handleCallback(req, res, jest.fn());

    expect(prisma.file.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'file-1',
        isDeleted: false,
        OR: [
          { userId: 'shared-user' },
          {
            sharedWith: {
              some: {
                sharedWithId: 'shared-user',
                accepted: true,
                canWrite: true,
              },
            },
          },
        ],
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ error: 1, code: 'FORBIDDEN' });
    expect(axios.get).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(OnlyOfficeService.createFileVersion).not.toHaveBeenCalled();
  });

  it('should reject callback save when OnlyOffice is not available for the current plan', async () => {
    (PlanService.checkFeature as jest.Mock).mockResolvedValue(false);

    const req: any = {
      params: { fileId: 'file-1', callbackToken: 'callback-token' },
      body: { status: 2 },
      query: {},
    };
    const res = createRes();

    await OnlyOfficeController.handleCallback(req, res, jest.fn());

    expect(PlanService.checkFeature).toHaveBeenCalledWith('owner-1', 'onlyoffice');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ error: 1, code: 'PLAN_UPGRADE_REQUIRED' });
    expect(axios.get).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(OnlyOfficeService.createFileVersion).not.toHaveBeenCalled();
  });

  it('should allow callback save for accepted write shares', async () => {
    const content = Buffer.from('updated document');
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ encryptedDek: null });
    (prisma.file.findFirst as jest.Mock).mockResolvedValue(file);
    (axios.get as jest.Mock).mockResolvedValue({ data: content });
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (OnlyOfficeService.createFileVersion as jest.Mock).mockResolvedValue(undefined);
    (OnlyOfficeService.verifyCallbackToken as jest.Mock).mockReturnValue({
      fileId: 'file-1',
      userId: 'shared-user',
    });

    const req: any = {
      params: { fileId: 'file-1', callbackToken: 'callback-token' },
      body: { status: 2 },
      query: {},
    };
    const res = createRes();

    await OnlyOfficeController.handleCallback(req, res, jest.fn());

    expect(prisma.file.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'file-1',
        isDeleted: false,
        OR: [
          { userId: 'shared-user' },
          {
            sharedWith: {
              some: {
                sharedWithId: 'shared-user',
                accepted: true,
                canWrite: true,
              },
            },
          },
        ],
      },
    });
    expect(axios.get).toHaveBeenCalledWith('http://onlyoffice/download', {
      responseType: 'arraybuffer',
      maxRedirects: 0,
      timeout: 30000,
    });
    expect(OnlyOfficeService.createFileVersion).toHaveBeenCalledWith(
      'file-1',
      'shared-user',
      expect.any(String),
      'document.docx',
      content.byteLength,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      undefined
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ error: 0 });
  });
});

describe('OnlyOfficeController.serveFileToOnlyOffice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (PlanService.checkFeature as jest.Mock).mockResolvedValue(true);
  });

  it('should reject stale or non-accepted access tokens before decryption', async () => {
    (OnlyOfficeService.verifyFileAccessToken as jest.Mock).mockReturnValue({
      fileId: 'file-1',
      userId: 'shared-user',
    });
    (prisma.file.findFirst as jest.Mock).mockResolvedValue(null);

    const req: any = {
      params: { fileId: 'file-1' },
      query: { access_token: 'token' },
    };
    const res = createRes();

    await OnlyOfficeController.serveFileToOnlyOffice(req, res, jest.fn());

    expect(prisma.file.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'file-1',
        isDeleted: false,
        OR: [
          { userId: 'shared-user' },
          {
            sharedWith: {
              some: {
                sharedWithId: 'shared-user',
                accepted: true,
                canRead: true,
              },
            },
          },
        ],
      },
    });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'File not found or access denied',
    });
    expect(EncryptionService.getDecryptStreamAuto).not.toHaveBeenCalled();
  });

  it('should reject file serving when OnlyOffice is not available for the current plan', async () => {
    (OnlyOfficeService.verifyFileAccessToken as jest.Mock).mockReturnValue({
      fileId: 'file-1',
      userId: 'owner-1',
    });
    (PlanService.checkFeature as jest.Mock).mockResolvedValue(false);

    const req: any = {
      params: { fileId: 'file-1' },
      query: { access_token: 'token' },
    };
    const res = createRes();

    await OnlyOfficeController.serveFileToOnlyOffice(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Cette fonctionnalité nécessite le plan PRO ou supérieur.',
      code: 'PLAN_UPGRADE_REQUIRED',
      feature: 'onlyoffice',
      requiredPlan: 'PRO',
      upgradePath: '/plans',
    });
    expect(prisma.file.findFirst).not.toHaveBeenCalled();
    expect(EncryptionService.getDecryptStreamAuto).not.toHaveBeenCalled();
  });

  it('should keep owner file serving behavior', async () => {
    const decryptStream = { on: jest.fn(), pipe: jest.fn() };
    (OnlyOfficeService.verifyFileAccessToken as jest.Mock).mockReturnValue({
      fileId: 'file-1',
      userId: 'owner-1',
    });
    (prisma.file.findFirst as jest.Mock).mockResolvedValue(file);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ encryptedDek: null });
    (EncryptionService.getDecryptStreamAuto as jest.Mock).mockResolvedValue(decryptStream);

    const req: any = {
      params: { fileId: 'file-1' },
      query: { access_token: 'token' },
    };
    const res = createRes();

    await OnlyOfficeController.serveFileToOnlyOffice(req, res, jest.fn());

    expect(prisma.file.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'file-1',
        isDeleted: false,
        OR: [
          { userId: 'owner-1' },
          {
            sharedWith: {
              some: {
                sharedWithId: 'owner-1',
                accepted: true,
                canRead: true,
              },
            },
          },
        ],
      },
    });
    expect(EncryptionService.getDecryptStreamAuto).toHaveBeenCalledWith('files/document.docx', undefined);
    expect(decryptStream.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(decryptStream.pipe).toHaveBeenCalledWith(res);
  });

  it('should allow accepted read shares to serve files', async () => {
    const decryptStream = { on: jest.fn(), pipe: jest.fn() };
    (OnlyOfficeService.verifyFileAccessToken as jest.Mock).mockReturnValue({
      fileId: 'file-1',
      userId: 'shared-user',
    });
    (prisma.file.findFirst as jest.Mock).mockResolvedValue(file);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ encryptedDek: null });
    (EncryptionService.getDecryptStreamAuto as jest.Mock).mockResolvedValue(decryptStream);

    const req: any = {
      params: { fileId: 'file-1' },
      query: { access_token: 'token' },
    };
    const res = createRes();

    await OnlyOfficeController.serveFileToOnlyOffice(req, res, jest.fn());

    expect(prisma.file.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'file-1',
        isDeleted: false,
        OR: [
          { userId: 'shared-user' },
          {
            sharedWith: {
              some: {
                sharedWithId: 'shared-user',
                accepted: true,
                canRead: true,
              },
            },
          },
        ],
      },
    });
    expect(EncryptionService.getDecryptStreamAuto).toHaveBeenCalledWith('files/document.docx', undefined);
    expect(decryptStream.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(decryptStream.pipe).toHaveBeenCalledWith(res);
  });
});

describe('OnlyOfficeController share acceptance checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (PlanService.checkFeature as jest.Mock).mockResolvedValue(true);
  });

  it('should reject pending shared files for editor config', async () => {
    (prisma.file.findFirst as jest.Mock).mockResolvedValue(null);

    const req: any = {
      user: { id: 'shared-user' },
      params: { fileId: 'file-1' },
      query: {},
    };
    const res = createRes();

    await OnlyOfficeController.getEditorConfig(req, res, jest.fn());

    expect(prisma.file.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'file-1',
        OR: [
          { userId: 'shared-user' },
          {
            sharedWith: {
              some: {
                sharedWithId: 'shared-user',
                accepted: true,
                canRead: true,
              },
            },
          },
        ],
        isDeleted: false,
      },
      include: {
        sharedWith: {
          where: {
            sharedWithId: 'shared-user',
            accepted: true,
          },
        },
      },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Fichier non trouvé' });
    expect(OnlyOfficeService.generateConfig).not.toHaveBeenCalled();
  });

  it('should keep owner editor config access unchanged', async () => {
    const ownerFile = {
      ...file,
      userId: 'owner-1',
      isDeleted: false,
      isVault: false,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      sharedWith: [],
    };
    (prisma.file.findFirst as jest.Mock).mockResolvedValue(ownerFile);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: 'owner@example.com',
      firstName: 'Owner',
      lastName: 'User',
    });
    (OnlyOfficeService.canEdit as jest.Mock).mockReturnValue(true);
    (OnlyOfficeService.generateConfig as jest.Mock).mockResolvedValue({ config: {}, token: 'token' });

    const req: any = {
      user: { id: 'owner-1' },
      params: { fileId: 'file-1' },
      query: {},
    };
    const res = createRes();

    await OnlyOfficeController.getEditorConfig(req, res, jest.fn());

    expect(OnlyOfficeService.generateConfig).toHaveBeenCalledWith(
      ownerFile,
      'owner-1',
      { email: 'owner@example.com', firstName: 'Owner', lastName: 'User' },
      'edit',
      undefined
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { config: {}, token: 'token' } });
  });

  it('should open accepted read-only shares in view mode', async () => {
    const readOnlyFile = {
      ...file,
      userId: 'owner-1',
      folderId: null,
      isDeleted: false,
      isVault: false,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      sharedWith: [{
        id: 'share-1',
        sharedWithId: 'shared-user',
        accepted: true,
        canRead: true,
        canWrite: false,
        ownerWrappedDek: 'owner-wrapped-dek',
      }],
    };
    (prisma.file.findFirst as jest.Mock).mockResolvedValue(readOnlyFile);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: 'shared@example.com',
      firstName: 'Shared',
      lastName: 'User',
    });
    (OnlyOfficeService.canEdit as jest.Mock).mockReturnValue(true);
    (OnlyOfficeService.generateConfig as jest.Mock).mockResolvedValue({ config: {}, token: 'token' });
    (KekService.wrapDek as jest.Mock).mockReturnValue('wrapped-recipient-dek');

    const req: any = {
      user: { id: 'shared-user' },
      params: { fileId: 'file-1' },
      query: {},
      dekBuffer: Buffer.from('dek'),
    };
    const res = createRes();

    await OnlyOfficeController.getEditorConfig(req, res, jest.fn());

    expect(OnlyOfficeService.generateConfig).toHaveBeenCalledWith(
      readOnlyFile,
      'shared-user',
      { email: 'shared@example.com', firstName: 'Shared', lastName: 'User' },
      'view',
      'owner-wrapped-dek'
    );
    expect(KekService.wrapDek).not.toHaveBeenCalled();
  });

  it('should use the shared folder owner DEK when opening a writable folder share', async () => {
    const folderSharedFile = {
      ...file,
      userId: 'owner-1',
      folderId: 'folder-1',
      isDeleted: false,
      isVault: false,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      sharedWith: [],
    };
    const folderShare = {
      id: 'folder-share-1',
      folderId: 'folder-1',
      sharedWithId: 'shared-user',
      accepted: true,
      canRead: true,
      canWrite: true,
      ownerWrappedDek: 'folder-owner-wrapped-dek',
    };

    (prisma.file.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(folderSharedFile);
    (prisma.folder.findUnique as jest.Mock).mockResolvedValue({
      id: 'folder-1',
      parentId: null,
      isDeleted: false,
      isVault: false,
    });
    (prisma.sharedFolder.findFirst as jest.Mock).mockResolvedValue(folderShare);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: 'shared@example.com',
      firstName: 'Shared',
      lastName: 'User',
    });
    (OnlyOfficeService.canEdit as jest.Mock).mockReturnValue(true);
    (OnlyOfficeService.generateConfig as jest.Mock).mockResolvedValue({ config: {}, token: 'token' });
    (KekService.wrapDek as jest.Mock).mockReturnValue('wrapped-recipient-dek');

    const req: any = {
      user: { id: 'shared-user' },
      params: { fileId: 'file-1' },
      query: {},
      dekBuffer: Buffer.from('recipient-dek'),
    };
    const res = createRes();

    await OnlyOfficeController.getEditorConfig(req, res, jest.fn());

    expect(OnlyOfficeService.generateConfig).toHaveBeenCalledWith(
      folderSharedFile,
      'shared-user',
      { email: 'shared@example.com', firstName: 'Shared', lastName: 'User' },
      'edit',
      'folder-owner-wrapped-dek'
    );
    expect(KekService.wrapDek).not.toHaveBeenCalled();
  });
});
