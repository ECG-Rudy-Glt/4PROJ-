import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { MailService } from './mailService';
import { AuditService } from './auditService';
import { SocketService } from './socketService';
import { PlanService } from './planService';
import { VaultService } from './vaultService';

export class ShareService {
  private static async assertShareLimit(userId: string) {
    const now = new Date();
    const [linksCount, sharedFilesCount, sharedFoldersCount] = await Promise.all([
      prisma.sharedLink.count({
        where: {
          userId,
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: now } },
          ],
        },
      }),
      prisma.sharedFile.count({ where: { sharedById: userId } }),
      prisma.sharedFolder.count({ where: { sharedById: userId } }),
    ]);

    const currentCount = linksCount + sharedFilesCount + sharedFoldersCount;
    await PlanService.assertLimit(userId, 'maxShares', currentCount);
  }

  static async createShareLink(
    userId: string,
    fileId: string,
    options?: {
      password?: string;
      expiresAt?: Date;
      maxDownloads?: number;
    }
  ) {
    // Verify file belongs to user
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
        isDeleted: false,
      },
    });

    if (!file) {
      throw new Error('File not found');
    }

    if (file.isVault) {
      throw new Error('Le partage public est interdit pour les fichiers du coffre-fort');
    }

    await this.assertShareLimit(userId);

    // Hash password if provided
    let hashedPassword: string | undefined;
    if (options?.password) {
      hashedPassword = await bcrypt.hash(options.password, 10);
    }

    const shareLink = await prisma.sharedLink.create({
      data: {
        token: uuidv4(),
        fileId,
        userId,
        password: hashedPassword,
        expiresAt: options?.expiresAt,
        maxDownloads: options?.maxDownloads,
      },
      include: {
        file: true,
      },
    });

    // Audit log
    AuditService.createLog(userId, 'SHARE', {
      fileName: file.name,
      fileId,
      shareToken: shareLink.token,
    }).catch(console.error);

    return shareLink;
  }

  static async getShareLink(token: string, password?: string) {
    const shareLink = await prisma.sharedLink.findUnique({
      where: { token },
      include: {
        file: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!shareLink) {
      throw new Error('Share link not found');
    }

    if (shareLink.file?.isVault) {
      throw new Error('Le partage public est interdit pour les fichiers du coffre-fort');
    }

    // Check expiration
    if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
      throw new Error('Share link has expired');
    }

    // Check max downloads
    if (shareLink.maxDownloads && shareLink.downloads >= shareLink.maxDownloads) {
      throw new Error('Share link download limit reached');
    }

    // Check password
    if (shareLink.password) {
      if (!password) {
        throw new Error('Password required');
      }
      const isValid = await bcrypt.compare(password, shareLink.password);
      if (!isValid) {
        throw new Error('Invalid password');
      }
    }

    return shareLink;
  }

  static async incrementDownloadCount(token: string) {
    await prisma.sharedLink.update({
      where: { token },
      data: {
        downloads: {
          increment: 1,
        },
      },
    });
  }

  static async listUserShareLinks(userId: string) {
    return await prisma.sharedLink.findMany({
      where: { userId },
      include: {
        file: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  static async deleteShareLink(linkId: string, userId: string) {
    const shareLink = await prisma.sharedLink.findFirst({
      where: {
        id: linkId,
        userId,
      },
    });

    if (!shareLink) {
      throw new Error('Share link not found');
    }

    await prisma.sharedLink.delete({
      where: { id: linkId },
    });

    return { message: 'Share link deleted successfully' };
  }

  static async shareFolder(
    userId: string,
    folderId: string,
    targetUserId: string,
    permissions: {
      canRead?: boolean;
      canWrite?: boolean;
      canDelete?: boolean;
      canShare?: boolean;
    } = {}
  ) {
    // Verify folder belongs to user
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    if (folder.isVault) {
      throw new Error('Le partage est interdit pour les dossiers du coffre-fort');
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // Check if already shared
    const existing = await prisma.sharedFolder.findFirst({
      where: {
        folderId,
        sharedWithId: targetUserId,
      },
    });

    if (existing) {
      throw new Error('Folder already shared with this user');
    }

    await this.assertShareLimit(userId);

    const sharedFolder = await prisma.sharedFolder.create({
      data: {
        folderId,
        sharedById: userId,
        sharedWithId: targetUserId,
        canRead: permissions.canRead !== undefined ? permissions.canRead : true,
        canWrite: permissions.canWrite !== undefined ? permissions.canWrite : false,
        canDelete: permissions.canDelete !== undefined ? permissions.canDelete : false,
        canShare: permissions.canShare !== undefined ? permissions.canShare : false,
      },
      include: {
        folder: true,
        sharedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        sharedWith: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Send email notification
    try {
      await MailService.sendShareNotification(
        targetUser.email,
        (await prisma.user.findUnique({ where: { id: userId } }))?.email || 'Un utilisateur',
        folder.name,
        'folder'
      );
    } catch (error) {
      console.error('Error sending share notification:', error);
    }

    // Audit log
    AuditService.createLog(userId, 'SHARE', {
      folderName: folder.name,
      folderId,
    }).catch(console.error);

    // Socket notification
    SocketService.emitToUser(targetUserId, 'share_received', { type: 'folder', folderName: folder.name });

    return sharedFolder;
  }

  static async listSharedWithMe(userId: string) {
    return await prisma.sharedFolder.findMany({
      where: {
        sharedWithId: userId,
      },
      include: {
        sharedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  static async listSharedByMe(userId: string) {
    return await prisma.sharedFolder.findMany({
      where: {
        sharedById: userId,
      },
      include: {
        sharedWith: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  static async updateSharedFolderPermissions(
    shareId: string,
    userId: string,
    permissions: {
      canRead?: boolean;
      canWrite?: boolean;
      canDelete?: boolean;
      canShare?: boolean;
    }
  ) {
    const sharedFolder = await prisma.sharedFolder.findFirst({
      where: {
        id: shareId,
        sharedById: userId,
      },
    });

    if (!sharedFolder) {
      throw new Error('Shared folder not found');
    }

    return await prisma.sharedFolder.update({
      where: { id: shareId },
      data: {
        canRead: permissions.canRead !== undefined ? permissions.canRead : sharedFolder.canRead,
        canWrite: permissions.canWrite !== undefined ? permissions.canWrite : sharedFolder.canWrite,
        canDelete: permissions.canDelete !== undefined ? permissions.canDelete : sharedFolder.canDelete,
        canShare: permissions.canShare !== undefined ? permissions.canShare : sharedFolder.canShare,
      },
      include: {
        folder: true,
        sharedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        sharedWith: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  static async removeSharedFolder(shareId: string, userId: string) {
    const sharedFolder = await prisma.sharedFolder.findFirst({
      where: {
        id: shareId,
        sharedById: userId,
      },
    });

    if (!sharedFolder) {
      throw new Error('Shared folder not found');
    }

    await prisma.sharedFolder.delete({
      where: { id: shareId },
    });

    return { message: 'Shared folder removed successfully' };
  }

  // File sharing methods
  static async shareFile(
    userId: string,
    fileId: string,
    targetUserId: string,
    permissions: {
      canRead?: boolean;
      canWrite?: boolean;
      canDelete?: boolean;
      canShare?: boolean;
    } = {}
  ) {
    // Verify file belongs to user
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
        isDeleted: false,
      },
    });

    if (!file) {
      throw new Error('File not found');
    }

    if (file.isVault) {
      throw new Error('Le partage est interdit pour les fichiers du coffre-fort');
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // Check if already shared
    const existing = await prisma.sharedFile.findFirst({
      where: {
        fileId,
        sharedWithId: targetUserId,
      },
    });

    if (existing) {
      throw new Error('File already shared with this user');
    }

    await this.assertShareLimit(userId);

    const sharedFile = await prisma.sharedFile.create({
      data: {
        fileId,
        sharedById: userId,
        sharedWithId: targetUserId,
        canRead: permissions.canRead !== undefined ? permissions.canRead : true,
        canWrite: permissions.canWrite !== undefined ? permissions.canWrite : false,
        canDelete: permissions.canDelete !== undefined ? permissions.canDelete : false,
        canShare: permissions.canShare !== undefined ? permissions.canShare : false,
      },
      include: {
        file: true,
        sharedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        sharedWith: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Send email notification
    try {
      await MailService.sendShareNotification(
        targetUser.email,
        (await prisma.user.findUnique({ where: { id: userId } }))?.email || 'Un utilisateur',
        file.name,
        'file'
      );
    } catch (error) {
      console.error('Error sending share notification:', error);
    }

    // Audit log
    AuditService.createLog(userId, 'SHARE', {
      fileName: file.name,
      fileId,
    }).catch(console.error);

    // Socket notification
    SocketService.emitToUser(targetUserId, 'share_received', { type: 'file', fileName: file.name });

    return sharedFile;
  }

  static async listFilesSharedWithMe(userId: string) {
    return await prisma.sharedFile.findMany({
      where: {
        sharedWithId: userId,
      },
      include: {
        file: true,
        sharedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  static async listFilesSharedByMe(userId: string) {
    return await prisma.sharedFile.findMany({
      where: {
        sharedById: userId,
      },
      include: {
        file: true,
        sharedWith: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  static async getFileShares(fileId: string, userId: string) {
    // Verify user owns the file
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
        isDeleted: false,
      },
    });

    if (!file) {
      throw new Error('File not found');
    }

    return await prisma.sharedFile.findMany({
      where: {
        fileId,
      },
      include: {
        sharedWith: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });
  }

  static async updateSharedFilePermissions(
    shareId: string,
    userId: string,
    permissions: {
      canRead?: boolean;
      canWrite?: boolean;
      canDelete?: boolean;
      canShare?: boolean;
    }
  ) {
    const sharedFile = await prisma.sharedFile.findFirst({
      where: {
        id: shareId,
        sharedById: userId,
      },
    });

    if (!sharedFile) {
      throw new Error('Shared file not found');
    }

    return await prisma.sharedFile.update({
      where: { id: shareId },
      data: {
        canRead: permissions.canRead !== undefined ? permissions.canRead : sharedFile.canRead,
        canWrite: permissions.canWrite !== undefined ? permissions.canWrite : sharedFile.canWrite,
        canDelete: permissions.canDelete !== undefined ? permissions.canDelete : sharedFile.canDelete,
        canShare: permissions.canShare !== undefined ? permissions.canShare : sharedFile.canShare,
      },
      include: {
        file: true,
        sharedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        sharedWith: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  static async removeSharedFile(shareId: string, userId: string) {
    const sharedFile = await prisma.sharedFile.findFirst({
      where: {
        id: shareId,
        sharedById: userId,
      },
    });

    if (!sharedFile) {
      throw new Error('Shared file not found');
    }

    await prisma.sharedFile.delete({
      where: { id: shareId },
    });

    return { message: 'Shared file removed successfully' };
  }

  // Get shared file access (verify user has permission to access)
  static async getSharedFileAccess(fileId: string, userId: string) {
    // First check if file is directly shared with user
    const sharedFile = await prisma.sharedFile.findFirst({
      where: {
        fileId,
        sharedWithId: userId,
        canRead: true,
      },
      include: {
        file: true,
      },
    });

    if (sharedFile) {
      if (sharedFile.file.isVault) {
        throw new Error('Ce fichier appartient au coffre-fort et ne peut pas être partagé');
      }
      return sharedFile;
    }

    // If not directly shared, check if file is in a folder shared with user
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        folder: true,
      },
    });

    if (!file) {
      throw new Error('File not found');
    }

    // Check if the folder is shared with user
    if (file.folderId) {
      if (file.isVault) {
        throw new Error('Ce fichier appartient au coffre-fort et ne peut pas être partagé');
      }
      const sharedFolder = await prisma.sharedFolder.findFirst({
        where: {
          folderId: file.folderId,
          sharedWithId: userId,
          canRead: true,
        },
      });

      if (sharedFolder) {
        return {
          file,
          canRead: sharedFolder.canRead,
          canWrite: sharedFolder.canWrite,
          canDelete: sharedFolder.canDelete,
          canShare: sharedFolder.canShare,
        };
      }
    }

    throw new Error('File not shared with you or you do not have read access');
  }

  // Get pending shares for a user
  static async getPendingShares(userId: string) {
    const [pendingFiles, pendingFolders] = await Promise.all([
      prisma.sharedFile.findMany({
        where: {
          sharedWithId: userId,
          accepted: false,
        },
        include: {
          file: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
          sharedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      }),
      prisma.sharedFolder.findMany({
        where: {
          sharedWithId: userId,
          accepted: false,
        },
        include: {
          folder: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
          sharedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      }),
    ]);

    return {
      files: pendingFiles,
      folders: pendingFolders,
      total: pendingFiles.length + pendingFolders.length,
    };
  }

  // Accept a shared folder
  static async acceptSharedFolder(shareId: string, userId: string) {
    const sharedFolder = await prisma.sharedFolder.findUnique({
      where: { id: shareId },
    });

    if (!sharedFolder || sharedFolder.sharedWithId !== userId) {
      throw new Error('Shared folder not found or not shared with you');
    }

    return await prisma.sharedFolder.update({
      where: { id: shareId },
      data: { accepted: true },
      include: {
        folder: true,
        sharedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  // Accept a shared file
  static async acceptSharedFile(shareId: string, userId: string) {
    const sharedFile = await prisma.sharedFile.findUnique({
      where: { id: shareId },
    });

    if (!sharedFile || sharedFile.sharedWithId !== userId) {
      throw new Error('Shared file not found or not shared with you');
    }

    return await prisma.sharedFile.update({
      where: { id: shareId },
      data: { accepted: true },
      include: {
        file: true,
        sharedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  // Reject a shared folder
  static async rejectSharedFolder(shareId: string, userId: string) {
    const sharedFolder = await prisma.sharedFolder.findUnique({
      where: { id: shareId },
    });

    if (!sharedFolder || sharedFolder.sharedWithId !== userId) {
      throw new Error('Shared folder not found or not shared with you');
    }

    return await prisma.sharedFolder.delete({
      where: { id: shareId },
    });
  }

  // Reject a shared file
  static async rejectSharedFile(shareId: string, userId: string) {
    const sharedFile = await prisma.sharedFile.findUnique({
      where: { id: shareId },
    });

    if (!sharedFile || sharedFile.sharedWithId !== userId) {
      throw new Error('Shared file not found or not shared with you');
    }

    return await prisma.sharedFile.delete({
      where: { id: shareId },
    });
  }
}
