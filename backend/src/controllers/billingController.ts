import { Request, Response, NextFunction } from 'express';
import { Plan } from '@prisma/client';
import { AuthRequest } from '../types';
import { BillingService } from '../services/billingService';
import logger from '../config/logger';
import { sendSuccess, sendError } from '../utils/response';

type PaidPlan = 'PRO' | 'BUSINESS' | 'ENTERPRISE';
const PAID_PLANS = new Set<PaidPlan>(['PRO', 'BUSINESS', 'ENTERPRISE']);

export class BillingController {
  static async createCheckoutSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const plan = typeof req.body.plan === 'string' ? req.body.plan.toUpperCase() as PaidPlan : undefined;

      if (!plan || !PAID_PLANS.has(plan)) {
        sendError(res, 'Invalid paid plan', 400);
        return;
      }

      if (!process.env.STRIPE_SECRET_KEY) {
        sendError(res, 'Stripe test is not configured', 503, 'BILLING_NOT_CONFIGURED');
        return;
      }

      const priceEnvName = `STRIPE_PRICE_${plan}_MONTHLY`;
      if (!process.env[priceEnvName]) {
        sendError(res, `Stripe price is not configured for plan ${plan}`, 503, 'BILLING_PRICE_NOT_CONFIGURED');
        return;
      }

      const session = await BillingService.createCheckoutSession(userId, plan as Plan);
      sendSuccess(res, session);
    } catch (error) { next(error); }
  }

  static async changePlanFree(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      await BillingService.downgradeToFree(userId);
      sendSuccess(res);
    } catch (error) { next(error); }
  }

  static async createPortalSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const session = await BillingService.createBillingPortalSession(userId);
      sendSuccess(res, session);
    } catch (error) { next(error); }
  }

  static async handleWebhook(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'];
      const normalizedSignature = Array.isArray(signature) ? signature[0] : signature;

      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
      const event = BillingService.constructWebhookEvent(rawBody, normalizedSignature);

      await BillingService.handleWebhookEvent(event);
      sendSuccess(res, { received: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: error }, 'Stripe webhook error');
      sendError(res, `Webhook Error: ${msg}`, 400);
    }
  }
}
