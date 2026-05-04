import { Response, NextFunction, Request } from 'express';
import { ShareService } from '../services/shareService';
import { ShareInvitationService } from '../services/shareInvitationService';
import { AuthRequest } from '../types';
import { SocketService } from '../services/socketService';
import { NotificationService } from '../services/notificationService';
import fs from 'fs';
import { EncryptionService } from '../services/encryptionService';
import logger from '../config/logger';
import { sendSuccess, sendCreated, sendError } from '../utils/response';

export class ShareController {
  static async createShareLink(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId, password, expiresAt, maxDownloads } = req.body;

      const shareLink = await ShareService.createShareLink(userId, fileId, {
        password,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        maxDownloads,
      });

      sendCreated(res, {
        shareLink: {
          id: shareLink.id,
          token: shareLink.token,
          fileId: shareLink.fileId,
          expiresAt: shareLink.expiresAt,
          maxDownloads: shareLink.maxDownloads,
          downloads: shareLink.downloads,
          url: `${process.env.FRONTEND_URL}/share/${shareLink.token}`,
        },
      });
    } catch (error) { next(error); }
  }

  static async getSharedFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;
      const { password } = req.query;

      const shareLink = await ShareService.getShareLink(
        token,
        password ? String(password) : undefined
      );

      sendSuccess(res, {
        file: {
          id: shareLink.file!.id,
          name: shareLink.file!.name,
          mimeType: shareLink.file!.mimeType,
          size: Number(shareLink.file!.size),
          createdAt: shareLink.file!.createdAt,
        },
        sharedBy: shareLink.user,
      });
    } catch (error) { next(error); }
  }

  static async downloadSharedFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;
      const { password } = req.query;

      const shareLink = await ShareService.getShareLink(
        token,
        password ? String(password) : undefined
      );

      if (!fs.existsSync(shareLink.file!.storagePath)) {
        sendError(res, 'File not found on disk', 404);
        return;
      }

      // Increment download count
      await ShareService.incrementDownloadCount(token);

      res.setHeader('Content-Disposition', `attachment; filename="${shareLink.file!.name}"`);
      res.setHeader('Content-Type', shareLink.file!.mimeType);

      const decryptStream = EncryptionService.getDecryptStream(shareLink.file!.storagePath);
      decryptStream.pipe(res);
    } catch (error) { next(error); }
  }

  static async listUserShareLinks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const shareLinks = await ShareService.listUserShareLinks(userId);

      sendSuccess(res, {
        shareLinks: shareLinks.map((link) => ({
          id: link.id,
          token: link.token,
          fileId: link.fileId,
          fileName: link.file?.name,
          expiresAt: link.expiresAt,
          maxDownloads: link.maxDownloads,
          downloads: link.downloads,
          password: !!link.password,
          createdAt: link.createdAt,
          url: `${process.env.FRONTEND_URL}/share/${link.token}`,
        })),
      });
    } catch (error) { next(error); }
  }

  static async deleteShareLink(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { linkId } = req.params;

      const result = await ShareService.deleteShareLink(linkId, userId);
      sendSuccess(res, result);
    } catch (error) { next(error); }
  }

  static async shareFolder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId, targetUserEmail, canRead, canWrite, canDelete, canShare } = req.body;

      const prisma = (await import('../config/database')).default;
      const targetUser = await prisma.user.findUnique({
        where: { email: targetUserEmail },
      });

      if (!targetUser) {
        await ShareInvitationService.inviteByEmailToFolder({
          folderId,
          ownerId: userId,
          ownerName: req.user!.firstName || req.user!.email,
          targetEmail: targetUserEmail,
        });

        sendSuccess(res, {
          message: 'Invitation envoyée à créer un compte',
          isNewUser: true,
          sharedFolder: null,
        });
        return;
      }

      const sharedFolder = await ShareService.shareFolder(
        userId,
        folderId,
        targetUser.id,
        { canRead, canWrite, canDelete, canShare }
      );

      SocketService.emitToUser(targetUser.id, 'share_received', {
        type: 'folder',
        item: sharedFolder,
        sharedBy: req.user,
      });

      NotificationService.create(
        targetUser.id,
        'SHARE',
        'notifications.share.folder_received.title',
        'notifications.share.folder_received.message',
        { folderId, sharedById: userId, userName: req.user!.firstName || req.user!.email }
      ).catch((e) => logger.error(e));

      sendCreated(res, { sharedFolder });
    } catch (error) { next(error); }
  }

  static async listSharedWithMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const sharedFolders = await ShareService.listSharedWithMe(userId);
      sendSuccess(res, { sharedFolders });
    } catch (error) { next(error); }
  }

  static async listSharedByMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const sharedFolders = await ShareService.listSharedByMe(userId);
      sendSuccess(res, { sharedFolders });
    } catch (error) { next(error); }
  }

  static async updateSharedFolderPermissions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;
      const { canRead, canWrite, canDelete, canShare } = req.body;

      const sharedFolder = await ShareService.updateSharedFolderPermissions(
        shareId,
        userId,
        { canRead, canWrite, canDelete, canShare }
      );

      sendSuccess(res, { sharedFolder });
    } catch (error) { next(error); }
  }

  static async removeSharedFolder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;

      const result = await ShareService.removeSharedFolder(shareId, userId);
      sendSuccess(res, result);
    } catch (error) { next(error); }
  }

  static async shareFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId, targetUserEmail, canRead, canWrite, canDelete, canShare } = req.body;

      const prisma = (await import('../config/database')).default;
      const targetUser = await prisma.user.findUnique({
        where: { email: targetUserEmail },
      });

      if (!targetUser) {
        await ShareInvitationService.inviteByEmailToFile({
          fileId,
          ownerId: userId,
          ownerName: req.user!.firstName || req.user!.email,
          targetEmail: targetUserEmail,
        });

        sendSuccess(res, {
          message: 'Invitation envoyée avec succès',
          isNewUser: true,
          sharedFile: null,
        });
        return;
      }

      const sharedFile = await ShareService.shareFile(
        userId,
        fileId,
        targetUser.id,
        { canRead, canWrite, canDelete, canShare }
      );

      SocketService.emitToUser(targetUser.id, 'share_received', {
        type: 'file',
        item: sharedFile,
        sharedBy: req.user,
      });

      NotificationService.create(
        targetUser.id,
        'SHARE',
        'notifications.share.file_received.title',
        'notifications.share.file_received.message',
        { fileId, sharedById: userId, userName: req.user!.firstName || req.user!.email }
      ).catch((e) => logger.error(e));

      sendCreated(res, { sharedFile, isNewUser: false });
    } catch (error) { next(error); }
  }

  static async listFilesSharedWithMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const sharedFiles = await ShareService.listFilesSharedWithMe(userId);
      sendSuccess(res, { sharedFiles });
    } catch (error) { next(error); }
  }

  static async listFilesSharedByMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const sharedFiles = await ShareService.listFilesSharedByMe(userId);
      sendSuccess(res, { sharedFiles });
    } catch (error) { next(error); }
  }

  static async getFileShares(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const shares = await ShareService.getFileShares(fileId, userId);
      sendSuccess(res, { shares });
    } catch (error) { next(error); }
  }

  static async updateSharedFilePermissions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;
      const { canRead, canWrite, canDelete, canShare } = req.body;

      const sharedFile = await ShareService.updateSharedFilePermissions(
        shareId,
        userId,
        { canRead, canWrite, canDelete, canShare }
      );

      sendSuccess(res, { sharedFile });
    } catch (error) { next(error); }
  }

  static async removeSharedFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;

      const result = await ShareService.removeSharedFile(shareId, userId);
      sendSuccess(res, result);
    } catch (error) { next(error); }
  }

  static async streamSharedFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const sharedFile = await ShareService.getSharedFileAccess(fileId, userId);

      if (!fs.existsSync(sharedFile.file!.storagePath)) {
        sendError(res, 'File not found on disk', 404);
        return;
      }

      const stat = fs.statSync(sharedFile.file!.storagePath);
      const fileSize = stat.size - 32; // IV + auth tag AES-GCM

      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': sharedFile.file!.mimeType,
      });
      const decryptStream = EncryptionService.getDecryptStream(sharedFile.file!.storagePath);
      decryptStream.pipe(res);
    } catch (error) { next(error); }
  }

  static async downloadSharedFileAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const sharedFile = await ShareService.getSharedFileAccess(fileId, userId);

      if (!fs.existsSync(sharedFile.file!.storagePath)) {
        sendError(res, 'File not found on disk', 404);
        return;
      }

      res.setHeader('Content-Disposition', `attachment; filename="${sharedFile.file!.name}"`);
      res.setHeader('Content-Type', sharedFile.file!.mimeType);

      const decryptStream = EncryptionService.getDecryptStream(sharedFile.file!.storagePath);
      decryptStream.pipe(res);
    } catch (error) { next(error); }
  }

  static async getSharedFolderContents(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.params;
      const rootFolderId = req.query.rootFolderId as string | undefined;
      const contents = await ShareService.getSharedFolderContents(folderId, userId, rootFolderId);
      res.status(200).json(contents);
    } catch (error) { next(error); }
  }

  static async getPendingShares(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const pendingShares = await ShareService.getPendingShares(userId);
      sendSuccess(res, pendingShares);
    } catch (error) { next(error); }
  }

  static async acceptSharedFolder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;

      const sharedFolder = await ShareService.acceptSharedFolder(shareId, userId);

      if (sharedFolder.folder.userId) {
        SocketService.emitToUser(sharedFolder.folder.userId, 'share_accepted', {
          type: 'folder',
          item: sharedFolder,
          acceptedBy: req.user,
        });
      }

      sendSuccess(res, { message: 'Partage accepté', sharedFolder });
    } catch (error) { next(error); }
  }

  static async acceptSharedFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;

      const sharedFile = await ShareService.acceptSharedFile(shareId, userId);

      if (sharedFile.file.userId) {
        SocketService.emitToUser(sharedFile.file.userId, 'share_accepted', {
          type: 'file',
          item: sharedFile,
          acceptedBy: req.user,
        });
      }

      sendSuccess(res, { message: 'Partage accepté', sharedFile });
    } catch (error) { next(error); }
  }

  static async rejectSharedFolder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;

      await ShareService.rejectSharedFolder(shareId, userId);
      sendSuccess(res, { message: 'Partage rejeté' });
    } catch (error) { next(error); }
  }

  static async rejectSharedFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;

      await ShareService.rejectSharedFile(shareId, userId);
      sendSuccess(res, { message: 'Partage rejeté' });
    } catch (error) { next(error); }
  }
}
