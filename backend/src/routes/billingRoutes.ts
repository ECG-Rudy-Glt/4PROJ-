import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { BillingController } from '../controllers/billingController';

const router = Router();

router.post('/webhook', BillingController.handleWebhook);
router.post('/checkout-session', authenticate, BillingController.createCheckoutSession);
router.post('/portal-session', authenticate, BillingController.createPortalSession);

export default router;
