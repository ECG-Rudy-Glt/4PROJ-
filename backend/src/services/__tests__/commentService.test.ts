import prisma from '../../config/database';
import { CommentService } from '../commentService';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    file: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    sharedFile: {
      findFirst: jest.fn(),
    },
    folder: {
      findUnique: jest.fn(),
    },
    sharedFolder: {
      findFirst: jest.fn(),
    },
    comment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock('../socketService', () => ({
  SocketService: {
    emitToUser: jest.fn(),
  },
}));

jest.mock('../auditService', () => ({
  AuditService: {
    createLog: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

describe('CommentService share acceptance checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses comments through pending shares', async () => {
    (prisma.file.findUnique as jest.Mock).mockResolvedValue({
      id: 'file-1',
      userId: 'owner-1',
      isDeleted: false,
      folderId: null,
      folder: null,
    });
    (prisma.sharedFile.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(CommentService.createComment('file-1', 'shared-user', 'hello')).rejects.toThrow(
      'Fichier non trouvé ou accès refusé'
    );
    expect(prisma.sharedFile.findFirst).toHaveBeenCalledWith({
      where: {
        fileId: 'file-1',
        sharedWithId: 'shared-user',
        accepted: true,
        canRead: true,
        file: {
          is: {
            isDeleted: false,
          },
        },
      },
    });
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  it('allows comments through an accepted ancestor folder share', async () => {
    const createdComment = {
      id: 'comment-1',
      fileId: 'file-1',
      userId: 'shared-user',
      content: 'hello',
    };

    (prisma.file.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 'file-1',
        userId: 'owner-1',
        isDeleted: false,
        folderId: 'child-folder',
        folder: { id: 'child-folder', isDeleted: false },
      })
      .mockResolvedValueOnce({ name: 'document.docx' });
    (prisma.sharedFile.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.folder.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: 'child-folder', parentId: 'root-folder', isDeleted: false, isVault: false })
      .mockResolvedValueOnce({ id: 'root-folder', parentId: null, isDeleted: false, isVault: false });
    (prisma.sharedFolder.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'share-1',
        folderId: 'root-folder',
        sharedWithId: 'shared-user',
        accepted: true,
        canRead: true,
      });
    (prisma.comment.create as jest.Mock).mockResolvedValue(createdComment);

    await expect(CommentService.createComment('file-1', 'shared-user', 'hello')).resolves.toBe(createdComment);

    expect(prisma.comment.create).toHaveBeenCalledWith({
      data: {
        content: 'hello',
        fileId: 'file-1',
        userId: 'shared-user',
        parentId: null,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });
  });
});
