import { Request, Response } from 'express';
import { Plan, Role } from '@prisma/client';
import { AuthRequest } from '../types';
import { BillingService } from '../services/billingService';
import { PlanService } from '../services/planService';
import prisma from '../config/database';

type PaidPlan = 'PRO' | 'BUSINESS' | 'ENTERPRISE';
const PAID_PLANS = new Set<PaidPlan>(['PRO', 'BUSINESS', 'ENTERPRISE']);
const ALL_PLANS = new Set(['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE']);

export class BillingController {
  static async createCheckoutSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const plan = typeof req.body.plan === 'string' ? req.body.plan.toUpperCase() as PaidPlan : undefined;

      if (!plan || !PAID_PLANS.has(plan)) {
        res.status(400).json({ error: 'Invalid paid plan' });
        return;
      }

      // Bypass Stripe uniquement pour les comptes ADMIN (mode dev / secours)
      if (!process.env.STRIPE_SECRET_KEY) {
        if (req.user?.role !== Role.ADMIN) {
          res.status(503).json({
            error: 'Stripe non configuré',
            message: 'Paiement indisponible temporairement. Contactez un administrateur.',
          });
          return;
        }

        const newLimit = PlanService.getStorageLimit(plan as Plan);
        await prisma.user.update({
          where: { id: userId },
          data: { plan: plan as Plan, quotaLimit: newLimit },
        });
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.status(200).json({ url: `${frontendUrl}/plans?checkout=success` });
        return;
      }

      const session = await BillingService.createCheckoutSession(userId, plan);
      res.status(200).json(session);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async changePlanFree(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const newLimit = PlanService.getStorageLimit(Plan.FREE);
      await prisma.user.update({
        where: { id: userId },
        data: { plan: Plan.FREE, quotaLimit: newLimit },
      });
      res.status(200).json({ success: true });
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
