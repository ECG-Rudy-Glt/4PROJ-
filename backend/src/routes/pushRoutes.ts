import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { WebPushService } from '../services/webPushService';
import { AuthRequest } from '../types';
import { Response } from 'express';
import prisma from '../config/database';

const router = Router();

// Récupérer la clé publique VAPID
router.get('/vapid-public-key', (_req, res) => {
  res.json({ publicKey: WebPushService.getPublicKey() });
});

// Enregistrer une subscription push (web)
router.post('/subscribe', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { subscription } = req.body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      res.status(400).json({ error: 'Subscription invalide' });
      return;
    }

    await WebPushService.subscribe(userId, subscription);
    res.json({ message: 'Subscription enregistrée' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: msg });
  }
});

// Supprimer une subscription push (web)
router.post('/unsubscribe', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { endpoint } = req.body;

    await WebPushService.unsubscribe(userId, endpoint);
    res.json({ message: 'Subscription supprimée' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: msg });
  }
});

// Enregistrer un token Expo (mobile)
router.post('/expo/subscribe', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { token, platform } = req.body as { token: string; platform: string };

    if (!token) {
      res.status(400).json({ error: 'Token manquant' });
      return;
    }

    await prisma.expoPushToken.upsert({
      where: { token },
      update: { userId, platform },
      create: { userId, token, platform },
    });

    res.json({ message: 'Token enregistré' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: msg });
  }
});

// Supprimer un token Expo (mobile)
router.post('/expo/unsubscribe', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { token } = req.body as { token: string };

    await prisma.expoPushToken.deleteMany({ where: { userId, token } });
    res.json({ message: 'Token supprimé' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: msg });
  }
});

export default router;
