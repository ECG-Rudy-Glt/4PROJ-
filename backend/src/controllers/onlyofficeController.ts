import { Response, NextFunction, Request } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { OnlyOfficeService } from '../services/onlyofficeService';
import prisma from '../config/database';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { EncryptionService } from '../services/encryptionService';
import { VaultService } from '../services/vaultService';
import logger from '../config/logger';
import { sendSuccess, sendError } from '../utils/response';

export class OnlyOfficeController {
  /**
   * Sert un fichier à OnlyOffice (avec token d'accès)
   */
  static async serveFileToOnlyOffice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fileId } = req.params;
      const accessToken = req.query.access_token as string;

      if (!accessToken) {
        sendError(res, 'Access token required', 401);
        return;
      }

      const tokenData = OnlyOfficeService.verifyFileAccessToken(accessToken);
      if (!tokenData || tokenData.fileId !== fileId) {
        sendError(res, 'Invalid access token', 403);
        return;
      }

      const file = await prisma.file.findUnique({ where: { id: fileId } });

      if (!file) {
        sendError(res, 'File not found', 404);
        return;
      }

      await VaultService.assertUnlockedIfVault(tokenData.userId, file.isVault);

      let filePath: string;
      if (file.storagePath.startsWith('/')) {
        filePath = file.storagePath;
      } else {
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        filePath = path.join(uploadDir, file.storagePath);
      }

      logger.info({ fileId, filePath, storagePath: file.storagePath }, 'Serving file to OnlyOffice:');

      try {
        await fs.access(filePath);
      } catch (err) {
        logger.error({ filePath, err }, 'File not found on disk:');
        sendError(res, 'File not found on disk', 404);
        return;
      }

      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);

      const decryptStream = EncryptionService.getDecryptStream(filePath);
      decryptStream.pipe(res);
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

      const file = await prisma.file.findFirst({
        where: {
          id: fileId,
          OR: [
            { userId },
            { sharedWith: { some: { sharedWithId: userId } } },
          ],
          isDeleted: false,
        },
        include: {
          sharedWith: { where: { sharedWithId: userId } },
        },
      });

      if (!file) {
        sendError(res, 'Fichier non trouvé', 404);
        return;
      }

      await VaultService.assertUnlockedIfVault(userId, file.isVault);

      // 422 : le fichier existe mais son type n'est pas éditable
      if (!OnlyOfficeService.canEdit(file.mimeType)) {
        sendError(res, 'Ce type de fichier ne peut pas être édité', 422);
        return;
      }

      const isOwner = file.userId === userId;
      const share = file.sharedWith[0];
      const canEdit = isOwner || (share && share.canWrite);
      const editMode = mode === 'view' || !canEdit ? 'view' : 'edit';

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, lastName: true },
      });

      if (!user) {
        sendError(res, 'Utilisateur non trouvé', 404);
        return;
      }

      const config = await OnlyOfficeService.generateConfig(file, userId, user, editMode);
      sendSuccess(res, config);
    } catch (error) { next(error); }
  }

  /**
   * Callback OnlyOffice pour sauvegarder les modifications
   * Note: OnlyOffice attend toujours un status 200 avec { error: 0|1 } — ce format est imposé par le protocole.
   */
  static async handleCallback(req: AuthRequest, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { fileId } = req.params;
      const callbackData = req.body;

      logger.info({ fileId, status: callbackData.status }, 'OnlyOffice callback received:');

      const file = await prisma.file.findUnique({ where: { id: fileId } });

      if (!file) {
        res.status(200).json({ error: 0 }); // OnlyOffice protocol: always 200
        return;
      }

      const result = await OnlyOfficeService.processCallback(fileId, callbackData);

      if (result.shouldSave && result.downloadUrl) {
        try {
          const response = await axios.get(result.downloadUrl, { responseType: 'arraybuffer' });

          const uploadDir = process.env.UPLOAD_DIR || './uploads';
          const filename = `${Date.now()}-${file.name}`;
          const filepath = path.join(uploadDir, filename);

          await fs.writeFile(filepath, response.data);

          await OnlyOfficeService.createFileVersion(
            fileId,
            file.userId,
            filepath,
            file.name,
            response.data.byteLength,
            file.mimeType
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

      const file = await prisma.file.findFirst({
        where: {
          id: fileId,
          OR: [
            { userId },
            { sharedWith: { some: { sharedWithId: userId } } },
          ],
          isDeleted: false,
        },
        include: {
          sharedWith: { where: { sharedWithId: userId } },
        },
      });

      if (!file) {
        sendError(res, 'Fichier non trouvé', 404);
        return;
      }

      const canEdit = OnlyOfficeService.canEdit(file.mimeType);
      const isOwner = file.userId === userId;
      const share = file.sharedWith[0];
      const hasEditPermission = isOwner || (share && share.canWrite);

      sendSuccess(res, {
        canEdit,
        hasPermission: hasEditPermission,
        mode: canEdit && hasEditPermission ? 'edit' : 'view',
      });
    } catch (error) { next(error); }
  }
}
