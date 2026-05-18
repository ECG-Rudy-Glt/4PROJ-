import prisma from '../../config/database';
import { deleteFile } from '../../utils/fileUtils';
import { FileUploadService } from '../fileUploadService';
import { VersionService } from '../versionService';
import { PlanService } from '../planService';
import { EncryptionService } from '../encryptionService';
import { ShareKeyService } from '../shareKeyService';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    file: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    folder: {
      findUnique: jest.fn(),
    },
    sharedFolder: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../utils/fileUtils', () => ({
  deleteFile: jest.fn(),
}));

jest.mock('../versionService', () => ({
  VersionService: {
    createVersion: jest.fn(),
  },
}));

jest.mock('../auditService', () => ({
  AuditService: {
    createLog: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../socketService', () => ({
  SocketService: {
    emitToUser: jest.fn(),
  },
}));

jest.mock('../encryptionService', () => ({
  EncryptionService: {
    encryptFileToS3: jest.fn(),
  },
}));

jest.mock('../planService', () => ({
  PlanService: {
    checkFileSize: jest.fn(),
    checkQuota: jest.fn(),
    updateQuotaUsed: jest.fn(),
  },
}));

jest.mock('../vaultService', () => ({
  VaultService: {
    isVaultFolder: jest.fn().mockResolvedValue(false),
    assertUnlockedIfVault: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../fileIndexService', () => ({
  FileIndexService: {
    indexFileAsync: jest.fn(),
  },
}));

jest.mock('../shareKeyService', () => ({
  ShareKeyService: {
    unwrapOwnerDek: jest.fn(),
  },
}));

describe('FileUploadService quota checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (deleteFile as jest.Mock).mockResolvedValue(undefined);
    (PlanService.checkFileSize as jest.Mock).mockResolvedValue(true);
    (PlanService.checkQuota as jest.Mock).mockResolvedValue(true);
    (PlanService.updateQuotaUsed as jest.Mock).mockResolvedValue(undefined);
    (EncryptionService.encryptFileToS3 as jest.Mock).mockResolvedValue(undefined);
    (prisma.file.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.file.findUnique as jest.Mock).mockResolvedValue({
      id: 'file-1',
      userId: 'user-1',
      isDeleted: false,
    });
    (prisma.folder.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.sharedFolder.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.file.create as jest.Mock).mockResolvedValue({
      id: 'new-file',
      name: 'new.docx',
      storagePath: 'files/user-1/upload.tmp',
    });
    (VersionService.createVersion as jest.Mock).mockResolvedValue(undefined);
    (ShareKeyService.unwrapOwnerDek as jest.Mock).mockReturnValue(Buffer.from('owner-dek'));
  });

  it('keeps quota check behavior for normal uploads', async () => {
    await FileUploadService.createFile(
      'user-1',
      'new.docx',
      'new.docx',
      'application/docx',
      25,
      '/tmp/upload.tmp'
    );

    expect(PlanService.checkFileSize).toHaveBeenCalledWith('user-1', 25);
    expect(PlanService.checkQuota).toHaveBeenCalledWith('user-1', 25);
    expect(EncryptionService.encryptFileToS3).toHaveBeenCalledWith(
      '/tmp/upload.tmp',
      'files/user-1/upload.tmp',
      undefined
    );
    expect(VersionService.createVersion).not.toHaveBeenCalled();
  });

  it('skips fileUploadService quota precheck for replacements and delegates to VersionService', async () => {
    (prisma.file.findUnique as jest.Mock).mockResolvedValue({
      id: 'file-1',
      userId: 'user-1',
      isDeleted: false,
    });

    await FileUploadService.createFile(
      'user-1',
      'replacement.docx',
      'replacement.docx',
      'application/docx',
      25,
      '/tmp/replacement.tmp',
      undefined,
      undefined,
      'file-1'
    );

    expect(PlanService.checkFileSize).toHaveBeenCalledWith('user-1', 25);
    expect(PlanService.checkQuota).not.toHaveBeenCalled();
    expect(VersionService.createVersion).toHaveBeenCalledWith(
      'file-1',
      'user-1',
      '/tmp/replacement.tmp',
      'replacement.docx',
      25,
      'application/docx',
      undefined
    );
    expect(deleteFile).toHaveBeenCalledWith('/tmp/replacement.tmp');
  });

  it('does not precheck the actor quota before shared replacements', async () => {
    (prisma.file.findUnique as jest.Mock).mockResolvedValue({
      id: 'file-1',
      userId: 'owner-1',
      isDeleted: false,
    });

    await FileUploadService.createFile(
      'shared-user',
      'replacement.docx',
      'replacement.docx',
      'application/docx',
      25,
      '/tmp/replacement.tmp',
      undefined,
      undefined,
      'file-1'
    );

    expect(PlanService.checkFileSize).toHaveBeenCalledWith('owner-1', 25);
    expect(PlanService.checkQuota).not.toHaveBeenCalled();
    expect(VersionService.createVersion).toHaveBeenCalledWith(
      'file-1',
      'shared-user',
      '/tmp/replacement.tmp',
      'replacement.docx',
      25,
      'application/docx',
      undefined
    );
  });

  it('uploads new files in shared folders with the folder owner DEK and quota owner', async () => {
    const ownerDek = Buffer.from('folder-owner-dek');
    (ShareKeyService.unwrapOwnerDek as jest.Mock).mockReturnValue(ownerDek);
    (prisma.folder.findUnique as jest.Mock).mockResolvedValue({
      id: 'folder-1',
      userId: 'owner-1',
      isDeleted: false,
    });
    (prisma.sharedFolder.findFirst as jest.Mock).mockResolvedValue({
      id: 'share-1',
      folderId: 'folder-1',
      ownerWrappedDek: 'owner-wrapped-dek',
      canWrite: true,
    });

    await FileUploadService.createFile(
      'shared-user',
      'new.docx',
      'new.docx',
      'application/docx',
      25,
      '/tmp/upload.tmp',
      'folder-1',
      Buffer.from('recipient-dek')
    );

    expect(PlanService.checkFileSize).toHaveBeenCalledWith('owner-1', 25);
    expect(PlanService.checkQuota).toHaveBeenCalledWith('owner-1', 25);
    expect(EncryptionService.encryptFileToS3).toHaveBeenCalledWith(
      '/tmp/upload.tmp',
      'files/owner-1/upload.tmp',
      ownerDek
    );
    expect(prisma.file.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'owner-1',
        folderId: 'folder-1',
      }),
    }));
  });

  it('cleans up the temporary replacement file when VersionService fails', async () => {
    const versionError = new Error('Quota exceeded');
    (VersionService.createVersion as jest.Mock).mockRejectedValue(versionError);

    await expect(
      FileUploadService.createFile(
        'user-1',
        'replacement.docx',
        'replacement.docx',
        'application/docx',
        25,
        '/tmp/replacement.tmp',
        undefined,
        undefined,
        'file-1'
      )
    ).rejects.toThrow('Quota exceeded');

    expect(PlanService.checkFileSize).toHaveBeenCalledWith('user-1', 25);
    expect(PlanService.checkQuota).not.toHaveBeenCalled();
    expect(deleteFile).toHaveBeenCalledWith('/tmp/replacement.tmp');
  });
});
