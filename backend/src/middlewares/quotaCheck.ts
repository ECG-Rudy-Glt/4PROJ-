import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { PlanService } from '../services/planService';
import logger from '../config/logger';
import { deleteFile } from '../utils/fileUtils';

type UploadRequest = AuthRequest & {
  file?: Express.Multer.File;
  files?: Express.Multer.File[];
};

function getUploadedFiles(req: AuthRequest): Express.Multer.File[] {
  const uploadReq = req as UploadRequest;
  return Array.isArray(uploadReq.files)
    ? uploadReq.files
    : uploadReq.file
      ? [uploadReq.file]
      : [];
}

/**
 * Middleware qui vérifie le quota après multer, avant le traitement métier.
 * Les remplacements délèguent leur quota à VersionService pour permettre le cleanup des versions.
 */
export const checkQuotaBeforeUpload = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    const replaceFileId = req.body?.replaceFileId;
    const isReplacement = Array.isArray(replaceFileId)
      ? replaceFileId.some(Boolean)
      : Boolean(replaceFileId);

    if (isReplacement) {
      next();
      return;
    }

    const uploadedFiles = getUploadedFiles(req);

    const incomingSize = uploadedFiles.reduce((total, file) => total + (file.size || 0), 0);

    if (incomingSize <= 0) {
      next();
      return;
    }

    // Vérifier si l'utilisateur a assez d'espace
    const hasSpace = await PlanService.checkQuota(userId, incomingSize);

    if (!hasSpace) {
      await Promise.all(uploadedFiles.map((file) => deleteFile(file.path).catch(() => undefined)));
      res.status(413).json({
        error: 'Quota dépassé',
        message: 'L\'espace de stockage disponible est insuffisant pour ce fichier. Veuillez libérer de l\'espace ou passer à un plan supérieur.',
        code: 'QUOTA_EXCEEDED'
      });
      return;
    }

    next();
  } catch (error) {
    const uploadedFiles = getUploadedFiles(req);
    await Promise.all(uploadedFiles.map((file) => deleteFile(file.path).catch(() => undefined)));
    logger.error({ err: error }, 'Erreur lors de la vérification du quota:');
    res.status(500).json({ error: 'Erreur lors de la vérification du quota' });
  }
};
