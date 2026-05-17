import { Router, NextFunction, Response } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { BillingController } from '../controllers/billingController';

const router = Router();

const requireNonDelegatedSession = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.authContext?.authType === 'DELEGATION') {
    res.status(403).json({ error: 'Action interdite pendant une session déléguée' });
    return;
  }
  next();
};

router.post('/webhook', BillingController.handleWebhook);
router.post('/checkout-session', authenticate, requireNonDelegatedSession, BillingController.createCheckoutSession);
router.post('/portal-session', authenticate, requireNonDelegatedSession, BillingController.createPortalSession);
router.post('/downgrade-free', authenticate, requireNonDelegatedSession, BillingController.changePlanFree);

export default router;
