import { Response, NextFunction } from 'express';
import { Plan, Role } from '@prisma/client';
import { UserService } from '../services/userService';
import { AuthRequest } from '../types';
import { BillingService } from '../services/billingService';
import { clampLimit, sanitizeQuery } from '../utils/validators';
import { sendSuccess, sendError } from '../utils/response';

export class UserController {
  /**
   * Rechercher des utilisateurs par email (autocomplete)
   */
  static async searchUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, limit } = req.query;

      if (!query || typeof query !== 'string') {
        sendError(res, 'Query parameter is required', 400);
        return;
      }

      const users = await UserService.searchUsersByEmail(
        sanitizeQuery(query),
        clampLimit(limit, 10, 1, 50)
      );

      sendSuccess(res, { users });
    } catch (error) { next(error); }
  }

  /**
   * Obtenir les informations basiques d'un utilisateur
   */
  static async getUserInfo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;

      const user = await UserService.getUserBasicInfo(userId);
      sendSuccess(res, { user });
    } catch (error) { next(error); }
  }

  static async updatePlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const rawPlan = req.body.plan;
      const plan = typeof rawPlan === 'string' ? rawPlan.toUpperCase() as Plan : null;

      if (!plan || !['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'].includes(plan)) {
        sendError(res, 'Invalid plan', 400);
        return;
      }

      const isAdmin = req.user?.role === Role.ADMIN;

      if (isAdmin) {
        await BillingService.overridePlanWithoutStripe(userId, userId, plan);
        sendSuccess(res, { message: `Plan updated to ${plan} (admin bypass)`, plan, bypassStripe: true });
        return;
      }

      if (plan !== 'FREE') {
        sendError(res, 'Paid plan upgrades must go through Stripe Checkout', 403, 'STRIPE_CHECKOUT_REQUIRED');
        return;
      }

      await BillingService.downgradeToFree(userId);
      sendSuccess(res, { message: 'Plan downgraded to FREE', plan: 'FREE' });
    } catch (error) { next(error); }
  }
}
