import { Request, Response, NextFunction } from 'express';
import { Plan, Role } from '@prisma/client';
import { AuthRequest } from '../types';
import { BillingService } from '../services/billingService';
import { PlanService } from '../services/planService';
import prisma from '../config/database';
import logger from '../config/logger';

type PaidPlan = 'PRO' | 'BUSINESS' | 'ENTERPRISE';
const PAID_PLANS = new Set<PaidPlan>(['PRO', 'BUSINESS', 'ENTERPRISE']);
const ALL_PLANS = new Set(['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE']);

export class BillingController {
  static async createCheckoutSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const plan = typeof req.body.plan === 'string' ? req.body.plan.toUpperCase() as PaidPlan : undefined;

      if (!plan || !PAID_PLANS.has(plan)) {
        res.status(400).json({ error: 'Invalid paid plan' });
        return;
      }

      // Simulation si Stripe n'est pas configuré (admins uniquement)
      if (!process.env.STRIPE_SECRET_KEY) {
        if (req.user!.role !== Role.ADMIN) {
          res.status(503).json({ error: 'Stripe non configuré' });
          return;
        }

        logger.info(`Simulated Stripe Checkout for user ${userId} and plan ${plan}`);

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
    } catch (error) { next(error); }
  }

  static async changePlanFree(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const newLimit = PlanService.getStorageLimit(Plan.FREE);
      await prisma.user.update({
        where: { id: userId },
        data: { plan: Plan.FREE, quotaLimit: newLimit },
      });
      res.status(200).json({ success: true });
    } catch (error) { next(error); }
  }

  static async createPortalSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const session = await BillingService.createBillingPortalSession(userId);
      res.status(200).json(session);
    } catch (error) { next(error); }
  }

  static async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'];
      const normalizedSignature = Array.isArray(signature) ? signature[0] : signature;

      const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
      const event = BillingService.constructWebhookEvent(rawBody, normalizedSignature);

      await BillingService.handleWebhookEvent(event);
      res.status(200).json({ received: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: error }, 'Stripe webhook error');
      res.status(400).json({ error: `Webhook Error: ${msg}` });
    }
  }
}
