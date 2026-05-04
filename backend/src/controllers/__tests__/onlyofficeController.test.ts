import axios from 'axios';
import fs from 'fs/promises';
import prisma from '../../config/database';
import { OnlyOfficeController } from '../onlyofficeController';
import { OnlyOfficeService } from '../../services/onlyofficeService';
import { KekService } from '../../services/kekService';

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
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../services/onlyofficeService', () => ({
  OnlyOfficeService: {
    processCallback: jest.fn(),
    createFileVersion: jest.fn(),
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
  return res;
};

const file = {
  id: 'file-1',
  userId: 'owner-1',
  name: 'document.docx',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

describe('OnlyOfficeController.handleCallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.file.findUnique as jest.Mock).mockResolvedValue(file);
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
      (KekService.unwrapDek as jest.Mock).mockReturnValue(unwrappedDek);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ encryptedDek: 'encrypted-dek' });

      const req: any = {
        params: { fileId: 'file-1' },
        body: { status: 2 },
        query: {
          userId: 'user-1',
          ...(wrappedDek ? { wrappedDek } : {}),
        },
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
      params: { fileId: 'file-1' },
      body: { status: 2 },
      query: { userId: 'user-1' },
    };
    const res = createRes();

    await OnlyOfficeController.handleCallback(req, res, jest.fn());

    expect(axios.get).toHaveBeenCalledWith('http://onlyoffice/download', { responseType: 'arraybuffer' });
    expect(fs.writeFile).toHaveBeenCalledWith(expect.any(String), content);
    expect(OnlyOfficeService.createFileVersion).toHaveBeenCalledWith(
      'file-1',
      'user-1',
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
