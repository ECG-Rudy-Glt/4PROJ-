import { Response, NextFunction, Request } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { OnlyOfficeService } from '../services/onlyofficeService';
import prisma from '../config/database';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { EncryptionService } from '../services/encryptionService';
import { VaultService } from '../services/vaultService';
import { KekService } from '../services/kekService';
import { PlanService } from '../services/planService';
import logger from '../config/logger';
import { sendSuccess, sendError } from '../utils/response';
import { sendPlanUpgradeRequired } from '../middlewares/planFeature';
import { DEK_UNLOCK_REQUIRED, ensureDekUnlocked } from '../utils/dekGuard';
import {
  acceptedShareBaseWhere,
  acceptedSharePermissionWhere,
  findSharedFolderAccessRoot,
} from '../middlewares/permissions';

const fileAccessWhere = (fileId: string, userId: string, permission: 'read' | 'write') => ({
  id: fileId,
  isDeleted: false,
  OR: [
    { userId },
    { sharedWith: { some: acceptedSharePermissionWhere(userId, permission) } },
  ],
});

async function findOnlyOfficeAccessibleFile(
  fileId: string,
  userId: string,
  permission: 'read' | 'write',
  includeShares = false
) {
  const access = await findOnlyOfficeAccess(fileId, userId, permission, includeShares);
  return access?.file || null;
}

async function findOnlyOfficeAccess(
  fileId: string,
  userId: string,
  permission: 'read' | 'write',
  includeShares = false
) {
  const directFile = await prisma.file.findFirst({
    where: fileAccessWhere(fileId, userId, permission),
    ...(includeShares ? { include: { sharedWith: { where: acceptedShareBaseWhere(userId) } } } : {}),
  });

  if (directFile) {
    const directShare = ((directFile as any).sharedWith || [])[0];
    return {
      file: directFile,
      ownerWrappedDek: directFile.userId === userId ? undefined : directShare?.ownerWrappedDek,
      directShare,
      folderShare: null,
      isOwner: directFile.userId === userId,
    };
  }

  const file = await prisma.file.findFirst({
    where: { id: fileId, isDeleted: false },
    ...(includeShares ? { include: { sharedWith: { where: acceptedShareBaseWhere(userId) } } } : {}),
  });

  if (!file?.folderId) {
    return null;
  }

  const folderShare = await findSharedFolderAccessRoot(userId, file.folderId, permission);
  return folderShare
    ? {
      file,
      ownerWrappedDek: folderShare.ownerWrappedDek,
      directShare: null,
      folderShare,
      isOwner: false,
    }
    : null;
}

export class OnlyOfficeController {
  /**
   * Sert un fichier à OnlyOffice (avec token d'accès)
   */
  static async serveFileToOnlyOffice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fileId } = req.params;
      const accessToken = req.params.accessToken || (req.query.access_token as string | undefined);

      if (!accessToken) {
        sendError(res, 'Access token required', 401);
        return;
      }

      const tokenData = OnlyOfficeService.verifyFileAccessToken(accessToken);
      if (!tokenData || tokenData.fileId !== fileId) {
        sendError(res, 'Invalid access token', 403);
        return;
      }

      if (!(await PlanService.checkFeature(tokenData.userId, 'onlyoffice'))) {
        sendPlanUpgradeRequired(res, 'onlyoffice');
        return;
      }

      const access = await findOnlyOfficeAccess(fileId, tokenData.userId, 'read');
      const file = access?.file;

      if (!file) {
        sendError(res, 'File not found or access denied', 403);
        return;
      }

      await VaultService.assertUnlockedIfVault(tokenData.userId, file.isVault);

      // Extract DEK from the access token for file decryption
      const dek = tokenData.wrappedDek ? KekService.unwrapDek(tokenData.wrappedDek) ?? undefined : undefined;
      const fileOwner = await prisma.user.findUnique({
        where: { id: file.userId },
        select: { encryptedDek: true },
      });

      if (fileOwner?.encryptedDek && !dek) {
        sendError(res, 'DEK unlock required for encrypted content', 401, DEK_UNLOCK_REQUIRED);
        return;
      }

      logger.info({ fileId, storagePath: file.storagePath }, 'Serving file to OnlyOffice:');

      try {
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);

        const decryptStream = await EncryptionService.getDecryptStreamAuto(file.storagePath, dek);
        decryptStream.on('error', (streamError) => {
          logger.error({ storagePath: file.storagePath, err: streamError }, 'OnlyOffice decrypt stream failed');
          if (!res.headersSent) {
            sendError(res, 'File not found or unreadable', 404);
            return;
          }
          res.destroy(streamError);
        });
        decryptStream.pipe(res);
      } catch (err) {
        logger.error({ storagePath: file.storagePath, err }, 'Failed to serve file to OnlyOffice:');
        sendError(res, 'File not found or unreadable', 404);
        return;
      }
    } catch (error) { next(error); }
  }

  /**
   * Génère la configuration OnlyOffice pour éditer un fichier
   */
  static async getEditorConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;
      const { mode = 'edit' } = req.query;

      const access = await findOnlyOfficeAccess(fileId, userId, 'read', true);
      const file = access?.file;

      if (!file) {
        sendError(res, 'Fichier non trouvé', 404);
        return;
      }

      await VaultService.assertUnlockedIfVault(userId, file.isVault);

      if (!ensureDekUnlocked(req, res)) return;

      // 422 : le fichier existe mais son type n'est pas éditable
      if (!OnlyOfficeService.canEdit(file.mimeType)) {
        sendError(res, 'Ce type de fichier ne peut pas être édité', 422);
        return;
      }

      const isOwner = file.userId === userId;
      const folderWriteAccess = !isOwner && file.folderId
        ? await findSharedFolderAccessRoot(userId, file.folderId, 'write')
        : null;
      const share = access?.directShare || ((file as any).sharedWith || [])[0];
      const canEdit = isOwner || Boolean(share?.canWrite) || Boolean(folderWriteAccess);
      const editMode = mode === 'view' || !canEdit ? 'view' : 'edit';

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, lastName: true },
      });

      if (!user) {
        sendError(res, 'Utilisateur non trouvé', 404);
        return;
      }

      // Shared files must be opened with the owner's DEK stored on the accepted share,
      // not with the recipient's account DEK.
      const wrappedDek = isOwner
        ? (req.dekBuffer ? KekService.wrapDek(req.dekBuffer) : undefined)
        : (access?.ownerWrappedDek || folderWriteAccess?.ownerWrappedDek || undefined);

      const config = await OnlyOfficeService.generateConfig(file, userId, user, editMode, wrappedDek);
      sendSuccess(res, config);
    } catch (error) { next(error); }
  }

  /**
   * Callback OnlyOffice pour sauvegarder les modifications
   * Note: OnlyOffice attend toujours un status 200 avec { error: 0|1 } — ce format est imposé par le protocole.
   */
  static async handleCallback(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { fileId } = req.params;
      const callbackData = req.body;

      const authorizationHeader = typeof req.get === 'function'
        ? req.get('authorization')
        : (req.headers?.authorization as string | undefined);
      if (!OnlyOfficeService.verifyCallbackRequest(callbackData, authorizationHeader)) {
        logger.warn({ fileId, status: callbackData.status }, 'OnlyOffice callback rejected: invalid signature');
        res.status(200).json({ error: 1, code: 'INVALID_CALLBACK_SIGNATURE' });
        return;
      }

      const callbackToken = req.params.callbackToken || (req.query.callbackToken as string | undefined);
      const session = OnlyOfficeService.verifyCallbackToken(callbackToken);
      if (!session || session.fileId !== fileId) {
        logger.warn({ fileId, status: callbackData.status }, 'OnlyOffice callback rejected: invalid session');
        res.status(200).json({ error: 1, code: 'INVALID_CALLBACK_SESSION' });
        return;
      }

      logger.info({ fileId, status: callbackData.status, userId: session.userId }, 'OnlyOffice callback received:');

      const file = await prisma.file.findUnique({ where: { id: fileId } });

      if (!file || file.isDeleted) {
        res.status(200).json({ error: 0 }); // OnlyOffice protocol: always 200
        return;
      }

      const result = await OnlyOfficeService.processCallback(fileId, callbackData);

      if (result.shouldSave && result.downloadUrl) {
        try {
          // Déchiffrer le DEK avant tout téléchargement/écriture disque.
          const dek = session.wrappedDek ? KekService.unwrapDek(session.wrappedDek) ?? undefined : undefined;
          const callbackUserId = session.userId;
          if (!(await PlanService.checkFeature(callbackUserId, 'onlyoffice'))) {
            logger.warn({ fileId, userId: callbackUserId }, 'OnlyOffice callback blocked by plan');
            res.status(200).json({ error: 1, code: 'PLAN_UPGRADE_REQUIRED' });
            return;
          }

          const fileOwner = await prisma.user.findUnique({
            where: { id: file.userId },
            select: { encryptedDek: true },
          });

          if (fileOwner?.encryptedDek && !dek) {
            logger.warn({ fileId, userId: callbackUserId, ownerId: file.userId }, DEK_UNLOCK_REQUIRED);
            res.status(200).json({ error: 1, code: DEK_UNLOCK_REQUIRED });
            return;
          }

          const accessibleFile = await findOnlyOfficeAccessibleFile(fileId, callbackUserId, 'write');

          if (!accessibleFile) {
            logger.warn({ fileId, userId: callbackUserId }, 'OnlyOffice callback write access denied');
            res.status(200).json({ error: 1, code: 'FORBIDDEN' });
            return;
          }

          const downloadUrl = OnlyOfficeService.assertSafeDownloadUrl(result.downloadUrl);
          const response = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            maxRedirects: 0,
            timeout: 30_000,
          });

          const uploadDir = process.env.UPLOAD_DIR || './uploads';
          const filename = `${Date.now()}-${file.name}`;
          const filepath = path.join(uploadDir, filename);

          await fs.writeFile(filepath, response.data);

          await OnlyOfficeService.createFileVersion(
            fileId,
            callbackUserId,
            filepath,
            file.name,
            response.data.byteLength,
            file.mimeType,
            dek
          );

          logger.info({ filepath }, 'File saved successfully:');
        } catch (saveError) {
          logger.error({ err: saveError }, 'Error saving file:');
          res.status(200).json({ error: 1 }); // OnlyOffice protocol: error code
          return;
        }
      }

      res.status(200).json({ error: result.error || 0 });
    } catch (error) {
      logger.error({ err: error }, 'Error in OnlyOffice callback');
      res.status(200).json({ error: 1 }); // OnlyOffice protocol: error code
    }
  }

  /**
   * Vérifie si un fichier peut être édité
   */
  static async canEdit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const file = await findOnlyOfficeAccessibleFile(fileId, userId, 'read', true);

      if (!file) {
        sendError(res, 'Fichier non trouvé', 404);
        return;
      }

      const canEdit = OnlyOfficeService.canEdit(file.mimeType);
      const isOwner = file.userId === userId;
      const share = ((file as any).sharedWith || [])[0];
      const folderWriteAccess = !isOwner && file.folderId
        ? await findSharedFolderAccessRoot(userId, file.folderId, 'write')
        : null;
      const hasEditPermission = isOwner || Boolean(share?.canWrite) || Boolean(folderWriteAccess);

      sendSuccess(res, {
        canEdit,
        hasPermission: hasEditPermission,
        mode: canEdit && hasEditPermission ? 'edit' : 'view',
      });
    } catch (error) { next(error); }
  }
}
