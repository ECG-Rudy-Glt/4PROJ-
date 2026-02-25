import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { PlanService } from '../services/planService';

/**
 * Middleware qui vérifie le quota AVANT l'upload du fichier
 * Utilise l'en-tête Content-Length pour déterminer la taille du fichier entrant
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

    // Récupérer la taille du fichier depuis l'en-tête Content-Length
    const contentLength = req.headers['content-length'];

    if (!contentLength) {
      // Si pas de Content-Length, on laisse passer et la vérification se fera après
      // (certains clients peuvent ne pas envoyer cet en-tête)
      next();
      return;
    }

    const incomingSize = parseInt(contentLength, 10);

    if (isNaN(incomingSize) || incomingSize <= 0) {
      next();
      return;
    }

    // Vérifier si l'utilisateur a assez d'espace
    const hasSpace = await PlanService.checkQuota(userId, incomingSize);

    if (!hasSpace) {
      res.status(413).json({
        error: 'Quota dépassé',
        message: 'L\'espace de stockage disponible est insuffisant pour ce fichier. Veuillez libérer de l\'espace ou passer à un plan supérieur.',
        code: 'QUOTA_EXCEEDED'
      });
      return;
    }

    next();
  } catch (error: any) {
    console.error('Erreur lors de la vérification du quota:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification du quota' });
  }
};
