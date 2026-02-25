import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { BillingService } from '../services/billingService';

type PaidPlan = 'PRO' | 'BUSINESS' | 'ENTERPRISE';
const PAID_PLANS = new Set<PaidPlan>(['PRO', 'BUSINESS', 'ENTERPRISE']);

export class BillingController {
  static async createCheckoutSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const plan = typeof req.body.plan === 'string' ? req.body.plan.toUpperCase() as PaidPlan : undefined;

      if (!plan || !PAID_PLANS.has(plan)) {
        res.status(400).json({ error: 'Invalid paid plan' });
        return;
      }

      const session = await BillingService.createCheckoutSession(userId, plan);
      res.status(200).json(session);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async createPortalSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const session = await BillingService.createBillingPortalSession(userId);
      res.status(200).json(session);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'];
      const normalizedSignature = Array.isArray(signature) ? signature[0] : signature;

      const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
      const event = BillingService.constructWebhookEvent(rawBody, normalizedSignature);

      await BillingService.handleWebhookEvent(event);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Stripe webhook error:', error.message);
      res.status(400).json({ error: `Webhook Error: ${error.message}` });
    }
  }
}
