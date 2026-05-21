import prisma from '../../config/database';
import { SharedLinkService } from '../sharedLinkService';
import { VAULT_SHARE_FORBIDDEN_CODE } from '../../constants/shareErrors';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    sharedLink: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    sharedFile: {
      count: jest.fn(),
    },
    sharedFolder: {
      count: jest.fn(),
    },
    file: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../auditService', () => ({
  AuditService: {
    createLog: jest.fn(),
  },
}));

jest.mock('../planService', () => ({
  PlanService: {
    assertLimit: jest.fn(),
  },
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

const activeOwner = {
  id: 'owner-user',
  email: 'owner@example.com',
  firstName: 'Owner',
  lastName: 'User',
  accountStatus: 'ACTIVE',
};

describe('SharedLinkService public link guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses public file links owned by suspended accounts', async () => {
    (prisma.sharedLink.findUnique as jest.Mock).mockResolvedValue({
      token: 'public-token',
      file: { id: 'file-1', isDeleted: false, isVault: false },
      user: { ...activeOwner, accountStatus: 'SUSPENDED' },
    });

    await expect(SharedLinkService.getShareLink('public-token')).rejects.toThrow('Lien de partage introuvable ou révoqué.');
  });

  it('refuses public file links when the file was deleted', async () => {
    (prisma.sharedLink.findUnique as jest.Mock).mockResolvedValue({
      token: 'public-token',
      file: { id: 'file-1', isDeleted: true, isVault: false },
      user: activeOwner,
    });

    await expect(SharedLinkService.getShareLink('public-token')).rejects.toThrow('Ce fichier n\'est plus disponible.');
  });

  it('refuses public file links for vault files with a clear 403', async () => {
    (prisma.sharedLink.findUnique as jest.Mock).mockResolvedValue({
      token: 'public-token',
      file: { id: 'file-1', isDeleted: false, isVault: true },
      user: activeOwner,
    });

    await expect(SharedLinkService.getShareLink('public-token')).rejects.toMatchObject({
      statusCode: 403,
      code: VAULT_SHARE_FORBIDDEN_CODE,
    });
  });

  it('refuses creating public links for vault files before writing a link', async () => {
    (prisma.file.findFirst as jest.Mock).mockResolvedValue({
      id: 'file-1',
      userId: 'owner-user',
      isDeleted: false,
      isVault: true,
    });

    await expect(
      SharedLinkService.createShareLink('owner-user', 'file-1')
    ).rejects.toMatchObject({
      statusCode: 403,
      code: VAULT_SHARE_FORBIDDEN_CODE,
    });

    expect(prisma.sharedLink.create).not.toHaveBeenCalled();
  });

  it('rejects persisted folder public links with a clear error', async () => {
    (prisma.sharedLink.findUnique as jest.Mock).mockResolvedValue({
      token: 'folder-token',
      folderId: 'folder-1',
      file: null,
      user: activeOwner,
    });

    await expect(SharedLinkService.getShareLink('folder-token')).rejects.toThrow(
      'Lien de partage introuvable ou révoqué.'
    );
  });

  it('refuses bundle links if any shared file disappeared', async () => {
    (prisma.sharedLink.findUnique as jest.Mock).mockResolvedValue({
      token: 'bundle-token',
      bundleFileIds: JSON.stringify(['file-1', 'file-2']),
      user: activeOwner,
    });
    (prisma.file.findMany as jest.Mock).mockResolvedValue([{ id: 'file-1', isDeleted: false, isVault: false }]);

    await expect(SharedLinkService.getBundleShareLink('bundle-token')).rejects.toThrow(
      'One or more shared files are no longer available'
    );
  });
});
