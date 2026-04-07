import prisma from '../config/database';
import { MailService } from './mailService';
import { AuditService } from './auditService';
import { SocketService } from './socketService';
import { SharedLinkService } from './sharedLinkService';
import logger from '../config/logger';

type Permissions = {
  canRead?: boolean;
  canWrite?: boolean;
  canDelete?: boolean;
  canShare?: boolean;
};

const sharedBySelect = { select: { id: true, email: true, firstName: true, lastName: true } };
const sharedWithSelect = { select: { id: true, email: true, firstName: true, lastName: true } };

export class SharedFileService {
  static async shareFile(
    userId: string,
    fileId: string,
    targetUserId: string,
    permissions: Permissions = {}
  ) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId, isDeleted: false } });
    if (!file) throw new Error('File not found');
    if (file.isVault) throw new Error('Le partage est interdit pour les fichiers du coffre-fort');

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) throw new Error('Target user not found');

    const existing = await prisma.sharedFile.findFirst({ where: { fileId, sharedWithId: targetUserId } });
    if (existing) throw new Error('File already shared with this user');

    await SharedLinkService.assertShareLimit(userId);

    const sharedFile = await prisma.sharedFile.create({
      data: {
        fileId,
        sharedById: userId,
        sharedWithId: targetUserId,
        canRead: permissions.canRead ?? true,
        canWrite: permissions.canWrite ?? false,
        canDelete: permissions.canDelete ?? false,
        canShare: permissions.canShare ?? false,
      },
      include: { file: true, sharedBy: sharedBySelect, sharedWith: sharedWithSelect },
    });

    try {
      const owner = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      await MailService.sendShareNotification(targetUser.email, owner?.email || 'Un utilisateur', file.name, 'file');
    } catch (error) {
      logger.error({ err: error }, 'Error sending file share notification');
    }

    AuditService.createLog(userId, 'SHARE', { fileName: file.name, fileId }).catch((e) => logger.error(e));
    SocketService.emitToUser(targetUserId, 'share_received', { type: 'file', fileName: file.name });

    return sharedFile;
  }

  static async listFilesSharedWithMe(userId: string) {
    return prisma.sharedFile.findMany({
      where: { sharedWithId: userId, accepted: true },
      include: { file: true, sharedBy: sharedBySelect },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async listFilesSharedByMe(userId: string) {
    return prisma.sharedFile.findMany({
      where: { sharedById: userId },
      include: { file: true, sharedWith: sharedWithSelect },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getFileShares(fileId: string, userId: string) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId, isDeleted: false } });
    if (!file) throw new Error('File not found');

    return prisma.sharedFile.findMany({
      where: { fileId },
      include: { sharedWith: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } } },
    });
  }

  static async updatePermissions(shareId: string, userId: string, permissions: Permissions) {
    const sharedFile = await prisma.sharedFile.findFirst({ where: { id: shareId, sharedById: userId } });
    if (!sharedFile) throw new Error('Shared file not found');

    return prisma.sharedFile.update({
      where: { id: shareId },
      data: {
        canRead: permissions.canRead ?? sharedFile.canRead,
        canWrite: permissions.canWrite ?? sharedFile.canWrite,
        canDelete: permissions.canDelete ?? sharedFile.canDelete,
        canShare: permissions.canShare ?? sharedFile.canShare,
      },
      include: { file: true, sharedBy: sharedBySelect, sharedWith: sharedWithSelect },
    });
  }

  static async removeSharedFile(shareId: string, userId: string) {
    const sharedFile = await prisma.sharedFile.findFirst({ where: { id: shareId, sharedById: userId } });
    if (!sharedFile) throw new Error('Shared file not found');

    await prisma.sharedFile.delete({ where: { id: shareId } });
    return { message: 'Shared file removed successfully' };
  }

  static async getSharedFileAccess(fileId: string, userId: string) {
    const sharedFile = await prisma.sharedFile.findFirst({
      where: { fileId, sharedWithId: userId, canRead: true },
      include: { file: true },
    });

    if (sharedFile) {
      if (sharedFile.file.isVault) throw new Error('Ce fichier appartient au coffre-fort et ne peut pas être partagé');
      return sharedFile;
    }

    const file = await prisma.file.findUnique({ where: { id: fileId }, include: { folder: true } });
    if (!file) throw new Error('File not found');

    if (file.folderId) {
      if (file.isVault) throw new Error('Ce fichier appartient au coffre-fort et ne peut pas être partagé');
      const sharedFolder = await prisma.sharedFolder.findFirst({
        where: { folderId: file.folderId, sharedWithId: userId, canRead: true },
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

  static async getPendingFiles(userId: string) {
    return prisma.sharedFile.findMany({
      where: { sharedWithId: userId, accepted: false },
      include: {
        file: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } } } },
        sharedBy: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
      },
    });
  }

  static async acceptSharedFile(shareId: string, userId: string) {
    const sharedFile = await prisma.sharedFile.findUnique({ where: { id: shareId } });
    if (!sharedFile || sharedFile.sharedWithId !== userId) throw new Error('Shared file not found or not shared with you');

    return prisma.sharedFile.update({
      where: { id: shareId },
      data: { accepted: true },
      include: { file: true, sharedBy: sharedBySelect },
    });
  }

  static async rejectSharedFile(shareId: string, userId: string) {
    const sharedFile = await prisma.sharedFile.findUnique({ where: { id: shareId } });
    if (!sharedFile || sharedFile.sharedWithId !== userId) throw new Error('Shared file not found or not shared with you');

    return prisma.sharedFile.delete({ where: { id: shareId } });
  }

  static async getAcceptedSharedFiles(userId: string, vaultUnlocked: boolean) {
    return prisma.sharedFile.findMany({
      where: {
        sharedWithId: userId,
        accepted: true,
        ...(vaultUnlocked ? {} : { file: { isVault: false } }),
      },
      include: {
        file: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
            tags: { include: { tag: true } },
          },
        },
        sharedBy: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
      },
    });
  }
}
