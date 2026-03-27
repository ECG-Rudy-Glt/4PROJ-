import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import prisma from '../config/database';
import logger from '../config/logger';

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in ms

export const activityMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            return next();
        }

        const now = new Date();
        const lastActive = new Date(req.user.lastActiveAt);

        // Vérifier le timeout (30 min)
        if (now.getTime() - lastActive.getTime() > SESSION_TIMEOUT) {
            // Session expirée
            return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
        }

        // Mettre à jour lastActiveAt (avec un debounce de 1 minute pour éviter trop d'écritures DB)
        // On ne bloque pas la requête pour ça (fire and forget optimisé)
        const timeSinceLastUpdate = now.getTime() - lastActive.getTime();
        if (timeSinceLastUpdate > 60 * 1000) { // 1 minute
            prisma.user.update({
                where: { id: req.user.id },
                data: { lastActiveAt: now },
            }).catch(err => logger.error('Error updating lastActiveAt:', err));
        }

        next();
    } catch (error) {
        logger.error('Activity middleware error:', error);
        next();
    }
};
