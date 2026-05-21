import { Response, NextFunction, Request } from 'express';
import { ShareService } from '../services/shareService';
import { AuthRequest } from '../types';
import { SocketService } from '../services/socketService';
import { NotificationService } from '../services/notificationService';
import fs from 'fs';
import { EncryptionService } from '../services/encryptionService';
import { ShareKeyService } from '../services/shareKeyService';
import { StorageService } from '../services/storageService';
import logger from '../config/logger';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { Readable } from 'stream';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getShareAccessSecret } from '../config/secrets';
import { AppError } from '../middlewares/errorHandler';
import { vaultShareForbiddenError } from '../constants/shareErrors';

const ENCRYPTION_OVERHEAD_BYTES = 32;
const SHARE_ACCESS_HEADER = 'x-share-access-token';
const SHARE_ACCESS_PURPOSE = 'share-password-access';

function getShareAccessToken(req: Request): string | undefined {
  const value = typeof req.get === 'function'
    ? req.get(SHARE_ACCESS_HEADER)
    : req.headers?.[SHARE_ACCESS_HEADER];
  return Array.isArray(value) ? value[0] : value;
}

function getPasswordFingerprint(passwordHash: string): string {
  return passwordHash.slice(-16);
}

function verifyPublicShareAccessToken(accessToken: string, shareLink: any, token: string): void {
  const decoded = jwt.verify(accessToken, getShareAccessSecret()) as any;
  if (
    decoded.purpose !== SHARE_ACCESS_PURPOSE ||
    decoded.kind !== 'public-link' ||
    decoded.token !== token ||
    decoded.linkId !== shareLink.id ||
    decoded.fingerprint !== getPasswordFingerprint(shareLink.password)
  ) {
    throw new Error('Invalid share access token');
  }
}

function assertPublicShareLinkAvailable(shareLink: any, bundle = false): void {
  if (!shareLink) {
    throw new AppError(
      404,
      'Lien de partage introuvable ou révoqué.',
      'SHARE_LINK_NOT_FOUND'
    );
  }
  if (shareLink.user?.accountStatus !== 'ACTIVE') {
    throw new AppError(404, 'Lien de partage introuvable ou révoqué.', 'SHARE_LINK_NOT_FOUND');
  }
  if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
    throw new AppError(410, 'Ce lien de partage a expiré.', 'SHARE_LINK_EXPIRED');
  }
  if (shareLink.maxDownloads && shareLink.downloads >= shareLink.maxDownloads) {
    throw new AppError(410, 'Le nombre maximum de téléchargements a été atteint.', 'SHARE_LINK_LIMIT_REACHED');
  }

  if (bundle) {
    if (!shareLink.bundleFileIds) {
      throw new AppError(404, 'Lien de partage introuvable ou révoqué.', 'SHARE_LINK_NOT_FOUND');
    }
    return;
  }

  if (shareLink.folderId || !shareLink.file) {
    throw new AppError(404, 'Lien de partage introuvable ou révoqué.', 'SHARE_LINK_NOT_FOUND');
  }
  if (shareLink.file.isDeleted) {
    throw new AppError(410, 'Ce fichier n\'est plus disponible.', 'SHARE_FILE_UNAVAILABLE');
  }
  if (shareLink.file.isVault) throw vaultShareForbiddenError();
}

function sendSharePasswordRequired(res: Response): void {
  res.status(423).json({ error: 'SHARE_PASSWORD_REQUIRED', message: 'Mot de passe requis' });
}

function sendSharePasswordInvalid(res: Response): void {
  res.status(403).json({ error: 'SHARE_PASSWORD_INVALID', message: 'Mot de passe invalide ou expiré' });
}

async function getStoredEncryptedSize(storagePath: string): Promise<number | null> {
  if (StorageService.isS3Key(storagePath)) {
    try {
      return await StorageService.getObjectSize(storagePath);
    } catch (error) {
      logger.error({ error, storagePath }, '[shareController] stored S3 object unavailable');
      return null;
    }
  }

  if (!fs.existsSync(storagePath)) {
    return null;
  }

  return fs.statSync(storagePath).size;
}

function sendStoredFileNotFound(res: Response, storagePath: string): void {
  const message = StorageService.isS3Key(storagePath)
    ? 'File not found in storage'
    : 'File not found on disk';
  sendError(res, message, 404);
}

function sendInvalidStoredFile(res: Response, storagePath: string, encryptedSize: number): void {
  logger.error({ storagePath, encryptedSize }, '[shareController] invalid encrypted file size');
  sendError(res, 'Stored file is invalid or corrupted', 500);
}

function pipeDecryptStream(decryptStream: Readable, res: Response, errorMessage: string): void {
  decryptStream.on('error', (error) => {
    logger.error({ err: error }, '[shareController] decrypt stream error');
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: errorMessage });
    } else {
      res.destroy();
    }
  });
  decryptStream.pipe(res);
}

function resolveSharedAccessDek(
  sharedFile: { file?: { userId?: string } | null; ownerWrappedDek?: string | null },
  userId?: string,
  requestDek?: Buffer
): Buffer | undefined {
  if (sharedFile.file?.userId && userId && sharedFile.file.userId === userId) {
    return requestDek;
  }

  return ShareKeyService.unwrapOwnerDek(sharedFile.ownerWrappedDek);
}

export class ShareController {
  static async createShareLink(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId, folderId, password, expiresAt, maxDownloads } = req.body;

      if (folderId || !fileId) {
        sendError(res, 'Le partage public de dossier n’est pas supporté', 400);
        return;
      }

      const shareLink = await ShareService.createShareLink(userId, fileId, {
        password,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        maxDownloads,
        ownerWrappedDek: ShareKeyService.wrapOwnerDek(req.dekBuffer),
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
      const accessToken = getShareAccessToken(req);

      let shareLink;
      try {
        shareLink = await ShareService.getShareLink(token);
      } catch (err: any) {
        if (err.message === 'Password required' && accessToken) {
          const prisma = (await import('../config/database')).default;
          shareLink = await prisma.sharedLink.findUnique({
            where: { token },
            include: { file: true, user: { select: { id: true, email: true, firstName: true, lastName: true, accountStatus: true } } },
          });

          try {
            assertPublicShareLinkAvailable(shareLink);
            verifyPublicShareAccessToken(accessToken, shareLink, token);
          } catch {
            sendSharePasswordInvalid(res);
            return;
          }
        } else if (err.message === 'Password required') {
          sendSharePasswordRequired(res);
          return;
        } else if (err.message === 'Invalid password') {
          sendSharePasswordInvalid(res);
          return;
        } else {
          throw err;
        }
      }

      // Bundle link: no single file, multiple files zipped on download
      if ((shareLink as any).bundleFileIds) {
        const fileIds: string[] = JSON.parse((shareLink as any).bundleFileIds);
        sendSuccess(res, {
          isBundle: true,
          fileCount: fileIds.length,
          downloadUrl: `/share/${token}/download-bundle`,
          sharedBy: shareLink.user,
        });
        return;
      }

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
      const accessToken = getShareAccessToken(req);

      let shareLink;
      try {
        shareLink = await ShareService.getShareLink(token);
      } catch (err: any) {
        if (err.message === 'Password required' && accessToken) {
          const prisma = (await import('../config/database')).default;
          shareLink = await prisma.sharedLink.findUnique({
            where: { token },
            include: { file: true, user: { select: { id: true, email: true, firstName: true, lastName: true, accountStatus: true } } },
          });

          try {
            assertPublicShareLinkAvailable(shareLink);
            verifyPublicShareAccessToken(accessToken, shareLink, token);
          } catch {
            sendSharePasswordInvalid(res);
            return;
          }
        } else if (err.message === 'Password required') {
          sendSharePasswordRequired(res);
          return;
        } else if (err.message === 'Invalid password') {
          sendSharePasswordInvalid(res);
          return;
        } else {
          throw err;
        }
      }

      const storagePath = shareLink.file!.storagePath;
      const encryptedSize = await getStoredEncryptedSize(storagePath);
      if (encryptedSize === null) {
        sendStoredFileNotFound(res, storagePath);
        return;
      }

      if (encryptedSize < ENCRYPTION_OVERHEAD_BYTES) {
        sendInvalidStoredFile(res, storagePath, encryptedSize);
        return;
      }

      await ShareService.incrementDownloadCount(token);

      const decryptStream = await EncryptionService.getDecryptStreamAuto(
        storagePath,
        ShareKeyService.unwrapOwnerDek(shareLink.ownerWrappedDek)
      );

      res.setHeader('Content-Disposition', `attachment; filename="${shareLink.file!.name}"`);
      res.setHeader('Content-Type', shareLink.file!.mimeType);

      pipeDecryptStream(decryptStream, res, 'Failed to download file');
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
      const { folderId, targetUserEmail, canRead, canWrite, canDelete, canShare, password } = req.body;

      const prisma = (await import('../config/database')).default;
      const targetUser = await prisma.user.findUnique({
        where: { email: targetUserEmail },
      });

      if (!targetUser) {
        sendError(res, 'Utilisateur destinataire introuvable', 404);
        return;
      }

      const sharedFolder = await ShareService.shareFolder(
        userId,
        folderId,
        targetUser.id,
        { canRead, canWrite, canDelete, canShare },
        ShareKeyService.wrapOwnerDek(req.dekBuffer),
        password
      );

      SocketService.emitToUser(targetUser.id, 'share_received', {
        type: 'folder',
        item: sharedFolder,
        sharedBy: req.user,
      });

      NotificationService.create(
        targetUser.id,
        'SHARE',
        'Nouveau dossier partagé',
        `${req.user!.firstName || req.user!.email} a partagé un dossier avec vous`,
        {
          folderId,
          sharedById: userId,
          userName: req.user!.firstName || req.user!.email,
          dedupeKey: `share:folder:${folderId}:${userId}`,
        }
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

      await ShareKeyService.backfillOwnerShareKeys(userId, ShareKeyService.wrapOwnerDek(req.dekBuffer));
      const sharedFolders = await ShareService.listSharedByMe(userId);
      sendSuccess(res, { sharedFolders });
    } catch (error) { next(error); }
  }

  static async updateSharedFolderPermissions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;
      const { canRead, canWrite, canDelete, canShare, password, clearPassword } = req.body;

      const sharedFolder = await ShareService.updateSharedFolderPermissions(
        shareId,
        userId,
        { canRead, canWrite, canDelete, canShare },
        { password, clearPassword }
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
      const { fileId, targetUserEmail, canRead, canWrite, canDelete, canShare, password } = req.body;

      const prisma = (await import('../config/database')).default;
      const targetUser = await prisma.user.findUnique({
        where: { email: targetUserEmail },
      });

      if (!targetUser) {
        sendError(res, 'Utilisateur destinataire introuvable', 404);
        return;
      }

      const sharedFile = await ShareService.shareFile(
        userId,
        fileId,
        targetUser.id,
        { canRead, canWrite, canDelete, canShare },
        ShareKeyService.wrapOwnerDek(req.dekBuffer),
        password
      );

      SocketService.emitToUser(targetUser.id, 'share_received', {
        type: 'file',
        item: sharedFile,
        sharedBy: req.user,
      });

      NotificationService.create(
        targetUser.id,
        'SHARE',
        'Nouveau fichier partagé',
        `${req.user!.firstName || req.user!.email} a partagé un fichier avec vous`,
        {
          fileId,
          sharedById: userId,
          userName: req.user!.firstName || req.user!.email,
          dedupeKey: `share:file:${fileId}:${userId}`,
        }
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

      await ShareKeyService.backfillOwnerShareKeys(userId, ShareKeyService.wrapOwnerDek(req.dekBuffer));
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
      const { canRead, canWrite, canDelete, canShare, password, clearPassword } = req.body;

      const sharedFile = await ShareService.updateSharedFilePermissions(
        shareId,
        userId,
        { canRead, canWrite, canDelete, canShare },
        { password, clearPassword }
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

      const storagePath = sharedFile.file!.storagePath;
      const encryptedSize = await getStoredEncryptedSize(storagePath);
      if (encryptedSize === null) {
        sendStoredFileNotFound(res, storagePath);
        return;
      }

      if (encryptedSize < ENCRYPTION_OVERHEAD_BYTES) {
        sendInvalidStoredFile(res, storagePath, encryptedSize);
        return;
      }

      const fileSize = encryptedSize - ENCRYPTION_OVERHEAD_BYTES;

      const decryptStream = await EncryptionService.getDecryptStreamAuto(
        storagePath,
        resolveSharedAccessDek(sharedFile, userId, req.dekBuffer)
      );

      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': sharedFile.file!.mimeType,
      });
      pipeDecryptStream(decryptStream, res, 'Failed to stream file');
    } catch (error) { next(error); }
  }

  static async downloadSharedFileAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const sharedFile = await ShareService.getSharedFileAccess(fileId, userId);

      const storagePath = sharedFile.file!.storagePath;
      const encryptedSize = await getStoredEncryptedSize(storagePath);
      if (encryptedSize === null) {
        sendStoredFileNotFound(res, storagePath);
        return;
      }

      if (encryptedSize < ENCRYPTION_OVERHEAD_BYTES) {
        sendInvalidStoredFile(res, storagePath, encryptedSize);
        return;
      }

      const decryptStream = await EncryptionService.getDecryptStreamAuto(
        storagePath,
        resolveSharedAccessDek(sharedFile, userId, req.dekBuffer)
      );

      res.setHeader('Content-Disposition', `attachment; filename="${sharedFile.file!.name}"`);
      res.setHeader('Content-Type', sharedFile.file!.mimeType);

      pipeDecryptStream(decryptStream, res, 'Failed to download file');
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

  static async createBundleShareLink(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileIds, password, expiresAt, maxDownloads } = req.body;

      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        sendError(res, 'fileIds must be a non-empty array', 400);
        return;
      }

      const shareLink = await ShareService.createBundleShareLink(userId, fileIds, {
        password,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        maxDownloads,
        ownerWrappedDek: ShareKeyService.wrapOwnerDek(req.dekBuffer),
      });

      sendCreated(res, {
        shareLink: {
          id: shareLink.id,
          token: shareLink.token,
          fileIds,
          expiresAt: shareLink.expiresAt,
          maxDownloads: shareLink.maxDownloads,
          downloads: shareLink.downloads,
          url: `${process.env.FRONTEND_URL}/share/${shareLink.token}`,
        },
      });
    } catch (error) { next(error); }
  }

  static async downloadBundleShareLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;
      const accessToken = getShareAccessToken(req);

      let shareLinkResult;
      try {
        shareLinkResult = await ShareService.getBundleShareLink(token);
      } catch (err: any) {
        if (err.message === 'Password required' && accessToken) {
          const prisma = (await import('../config/database')).default;
          const shareLink = await prisma.sharedLink.findUnique({
            where: { token },
            include: { user: { select: { id: true, email: true, firstName: true, lastName: true, accountStatus: true } } },
          });

          try {
            assertPublicShareLinkAvailable(shareLink, true);
            verifyPublicShareAccessToken(accessToken, shareLink, token);
            const fileIds: string[] = JSON.parse(shareLink.bundleFileIds!);
            const files = await prisma.file.findMany({ where: { id: { in: fileIds }, isDeleted: false } });
            if (files.length !== fileIds.length || files.some((file) => file.isVault)) {
              throw new Error('Shared bundle is unavailable');
            }
            shareLinkResult = { shareLink, files };
          } catch {
            sendSharePasswordInvalid(res);
            return;
          }
        } else if (err.message === 'Password required') {
          sendSharePasswordRequired(res);
          return;
        } else if (err.message === 'Invalid password') {
          sendSharePasswordInvalid(res);
          return;
        } else {
          throw err;
        }
      }
      const { shareLink, files } = shareLinkResult;

      await ShareService.incrementDownloadCount(token);

      const archiver = (await import('archiver')).default;
      const { EncryptionService } = await import('../services/encryptionService');
      const ownerDek = ShareKeyService.unwrapOwnerDek(shareLink.ownerWrappedDek);

      res.setHeader('Content-Disposition', `attachment; filename="bundle-${shareLink.token.slice(0, 8)}.zip"`);
      res.setHeader('Content-Type', 'application/zip');

      const archive = archiver('zip', { zlib: { level: 6 } });
      archive.pipe(res);

      for (const file of files) {
        const stream = await EncryptionService.getDecryptStreamAuto(file.storagePath, ownerDek);
        archive.append(stream as any, { name: file.name });
      }

      await archive.finalize();
    } catch (error) { next(error); }
  }

  static async unlockDirectShare(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;
      const { password } = req.body;

      const prisma = (await import('../config/database')).default;
      const sharedFile = await prisma.sharedFile.findFirst({
        where: {
          id: shareId,
          sharedWithId: userId,
          accepted: true,
          file: { is: { isDeleted: false } },
        },
      });

      if (!sharedFile) {
        sendError(res, 'Partage introuvable', 404);
        return;
      }

      if (!sharedFile.passwordHash) {
        sendSuccess(res, { shareAccessToken: null, expiresIn: 0 });
        return;
      }

      if (!password) {
        sendError(res, 'Mot de passe requis', 400);
        return;
      }

      const isValid = await bcrypt.compare(password, sharedFile.passwordHash);
      if (!isValid) {
        res.status(403).json({ error: 'SHARE_PASSWORD_INVALID', message: 'Mot de passe invalide' });
        return;
      }

      const fingerprint = getPasswordFingerprint(sharedFile.passwordHash);
      const token = jwt.sign(
        {
          purpose: SHARE_ACCESS_PURPOSE,
          kind: 'shared-file',
          shareId,
          fileId: sharedFile.fileId,
          userId,
          fingerprint,
        },
        getShareAccessSecret(),
        { expiresIn: '1h' }
      );

      sendSuccess(res, { shareAccessToken: token, expiresIn: 3600 });
    } catch (error) { next(error); }
  }

  static async unlockDirectFolderShare(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;
      const { password } = req.body;

      const prisma = (await import('../config/database')).default;
      const sharedFolder = await prisma.sharedFolder.findFirst({
        where: {
          id: shareId,
          sharedWithId: userId,
          accepted: true,
          folder: { is: { isDeleted: false } },
        },
      });

      if (!sharedFolder) {
        sendError(res, 'Partage introuvable', 404);
        return;
      }

      if (!sharedFolder.passwordHash) {
        sendSuccess(res, { shareAccessToken: null, expiresIn: 0 });
        return;
      }

      if (!password) {
        sendError(res, 'Mot de passe requis', 400);
        return;
      }

      const isValid = await bcrypt.compare(password, sharedFolder.passwordHash);
      if (!isValid) {
        res.status(403).json({ error: 'SHARE_PASSWORD_INVALID', message: 'Mot de passe invalide' });
        return;
      }

      const fingerprint = getPasswordFingerprint(sharedFolder.passwordHash);
      const token = jwt.sign(
        {
          purpose: SHARE_ACCESS_PURPOSE,
          kind: 'shared-folder',
          shareId,
          folderId: sharedFolder.folderId,
          userId,
          fingerprint,
        },
        getShareAccessSecret(),
        { expiresIn: '1h' }
      );

      sendSuccess(res, { shareAccessToken: token, expiresIn: 3600 });
    } catch (error) { next(error); }
  }

  static async unlockPublicShare(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token: shareToken } = req.params;
      const { password } = req.body;

      const prisma = (await import('../config/database')).default;
      const shareLink = await prisma.sharedLink.findUnique({
        where: { token: shareToken },
        include: {
          file: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true, accountStatus: true } },
        },
      });

      if (!shareLink) {
        sendError(res, 'Lien de partage introuvable', 404);
        return;
      }

      try {
        assertPublicShareLinkAvailable(shareLink, Boolean(shareLink.bundleFileIds));
      } catch (error: any) {
        sendError(res, error.message || 'Lien de partage indisponible', 403);
        return;
      }

      if (!shareLink.password) {
        sendSuccess(res, { shareAccessToken: null, expiresIn: 0 });
        return;
      }

      if (!password) {
        sendError(res, 'Mot de passe requis', 400);
        return;
      }

      const isValid = await bcrypt.compare(password, shareLink.password);
      if (!isValid) {
        res.status(403).json({ error: 'SHARE_PASSWORD_INVALID', message: 'Mot de passe invalide' });
        return;
      }

      const fingerprint = getPasswordFingerprint(shareLink.password);
      const token = jwt.sign(
        {
          purpose: SHARE_ACCESS_PURPOSE,
          kind: 'public-link',
          linkId: shareLink.id,
          token: shareToken,
          fingerprint,
        },
        getShareAccessSecret(),
        { expiresIn: '1h' }
      );

      sendSuccess(res, { shareAccessToken: token, expiresIn: 3600 });
    } catch (error) { next(error); }
  }
}
