import { Response, NextFunction, Request } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { OnlyOfficeService } from '../services/onlyofficeService';
import prisma from '../config/database';
import axios from 'axios';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { EncryptionService } from '../services/encryptionService';
import { VaultService } from '../services/vaultService';
import logger from '../config/logger';

export class OnlyOfficeController {
  /**
   * Sert un fichier à OnlyOffice (avec token d'accès)
   * Cette route n'utilise pas l'authentification standard - elle utilise un token d'accès spécial
   */
  static async serveFileToOnlyOffice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fileId } = req.params;
      const accessToken = req.query.access_token as string;

      if (!accessToken) {
        res.status(401).json({ error: 'Access token required' });
        return;
      }

      // Vérifier le token d'accès
      const tokenData = OnlyOfficeService.verifyFileAccessToken(accessToken);
      if (!tokenData || tokenData.fileId !== fileId) {
        res.status(403).json({ error: 'Invalid access token' });
        return;
      }

      // Récupérer le fichier
      const file = await prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      await VaultService.assertUnlockedIfVault(tokenData.userId, file.isVault);

      // file.storagePath contient soit un chemin absolu comme /app/uploads/xxx.docx
      // soit juste le nom du fichier
      let filePath: string;
      if (file.storagePath.startsWith('/')) {
        filePath = file.storagePath;
      } else {
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        filePath = path.join(uploadDir, file.storagePath);
      }

      logger.info('Serving file to OnlyOffice:', { fileId, filePath, storagePath: file.storagePath });

      // Vérifier que le fichier existe
      try {
        await fs.access(filePath);
      } catch (err) {
        logger.error('File not found on disk:', filePath, err);
        res.status(404).json({ error: 'File not found on disk', path: filePath });
        return;
      }

      // Envoyer le fichier déchiffré vers OnlyOffice
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

      // Récupérer le fichier
      const file = await prisma.file.findFirst({
        where: {
          id: fileId,
          OR: [
            { userId }, // Propriétaire
            {
              // Ou fichier partagé avec l'utilisateur
              sharedWith: {
                some: {
                  sharedWithId: userId,
                },
              },
            },
          ],
          isDeleted: false,
        },
        include: {
          sharedWith: {
            where: {
              sharedWithId: userId,
            },
          },
        },
      });

      if (!file) {
        res.status(404).json({ error: 'Fichier non trouvé' });
        return;
      }

      await VaultService.assertUnlockedIfVault(userId, file.isVault);

      // Vérifier si le fichier peut être édité
      if (!OnlyOfficeService.canEdit(file.mimeType)) {
        res.status(400).json({ error: 'Ce type de fichier ne peut pas être édité' });
        return;
      }

      // Vérifier les permissions
      const isOwner = file.userId === userId;
      const share = file.sharedWith[0];
      const canEdit = isOwner || (share && share.canWrite);

      const editMode = mode === 'view' || !canEdit ? 'view' : 'edit';

      // Récupérer les informations de l'utilisateur
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      if (!user) {
        res.status(404).json({ error: 'Utilisateur non trouvé' });
        return;
      }

      // Générer la configuration OnlyOffice
      const config = await OnlyOfficeService.generateConfig(
        file,
        userId,
        user,
        editMode
      );

      res.status(200).json(config);
    } catch (error) { next(error); }
  }

  /**
   * Callback OnlyOffice pour sauvegarder les modifications
   */
  static async handleCallback(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fileId } = req.params;
      const callbackData = req.body;

      logger.info('OnlyOffice callback received:', { fileId, status: callbackData.status });

      const file = await prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        res.status(404).json({ error: 0 }); // OnlyOffice expects error: 0 even for 404
        return;
      }

      const result = await OnlyOfficeService.processCallback(fileId, callbackData);

      // Si le document doit être sauvegardé
      if (result.shouldSave && result.downloadUrl) {
        try {
          // Télécharger le fichier modifié
          const response = await axios.get(result.downloadUrl, {
            responseType: 'arraybuffer',
          });

          const uploadDir = process.env.UPLOAD_DIR || './uploads';
          const filename = `${Date.now()}-${file.name}`;
          const filepath = path.join(uploadDir, filename);

          // Sauvegarder le fichier
          await fs.writeFile(filepath, response.data);

          // Créer une nouvelle version (chiffrement + limites plan gérés côté service)
          await OnlyOfficeService.createFileVersion(
            fileId,
            file.userId, // On utilise l'owner du fichier pour la version
            filepath,
            file.name,
            response.data.byteLength,
            file.mimeType
          );

          logger.info('File saved successfully:', filepath);
        } catch (saveError) {
          logger.error('Error saving file:', saveError);
          res.status(200).json({ error: 1 });
          return;
        }
      }

      res.status(200).json({ error: result.error || 0 });
    } catch (error) {
      logger.error({ err: error }, 'Error in OnlyOffice callback');
      res.status(200).json({ error: 1 }); // OnlyOffice expects error code
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
            {
              sharedWith: {
                some: {
                  sharedWithId: userId,
                },
              },
            },
          ],
          isDeleted: false,
        },
        include: {
          sharedWith: {
            where: {
              sharedWithId: userId,
            },
          },
        },
      });

      if (!file) {
        res.status(404).json({ error: 'Fichier non trouvé' });
        return;
      }

      const canEdit = OnlyOfficeService.canEdit(file.mimeType);
      const isOwner = file.userId === userId;
      const share = file.sharedWith[0];
      const hasEditPermission = isOwner || (share && share.canWrite);

      res.status(200).json({
        canEdit,
        hasPermission: hasEditPermission,
        mode: canEdit && hasEditPermission ? 'edit' : 'view',
      });
    } catch (error) { next(error); }
  }
}
