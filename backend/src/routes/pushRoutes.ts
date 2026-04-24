import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { WebPushService } from '../services/webPushService';
import { AuthRequest } from '../types';
import { Response } from 'express';

const router = Router();

// Récupérer la clé publique VAPID
router.get('/vapid-public-key', (_req, res) => {
  res.json({ publicKey: WebPushService.getPublicKey() });
});

// Enregistrer une subscription push
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

// Supprimer une subscription push
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

export default router;
