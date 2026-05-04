import prisma from '../../config/database';
import { CommentService } from '../commentService';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    file: {
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
    (prisma.file.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(CommentService.createComment('file-1', 'shared-user', 'hello')).rejects.toThrow(
      'Fichier non trouvé ou accès refusé'
    );
    expect(prisma.file.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'file-1',
        OR: [
          { userId: 'shared-user' },
          {
            folder: {
              sharedWith: {
                some: {
                  sharedWithId: 'shared-user',
                  accepted: true,
                  canRead: true,
                },
              },
            },
          },
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
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });
});
