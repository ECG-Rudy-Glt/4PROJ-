import { Response, NextFunction } from 'express';
import { Plan, Role } from '@prisma/client';
import { UserService } from '../services/userService';
import { AuthRequest } from '../types';
import { BillingService } from '../services/billingService';
import { clampLimit, sanitizeQuery } from '../utils/validators';

export class UserController {
  /**
   * Rechercher des utilisateurs par email (autocomplete)
   */
  static async searchUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, limit } = req.query;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
      }

      const users = await UserService.searchUsersByEmail(
        sanitizeQuery(query),
        clampLimit(limit, 10, 1, 50)
      );

      res.status(200).json({ users });
    } catch (error) { next(error); }
  }

  /**
   * Obtenir les informations basiques d'un utilisateur
   */
  static async getUserInfo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;

      const user = await UserService.getUserBasicInfo(userId);

      res.status(200).json({ user });
    } catch (error) { next(error); }
  }

  static async updatePlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const rawPlan = req.body.plan;
      const plan = typeof rawPlan === 'string' ? rawPlan.toUpperCase() as Plan : null;

      if (!plan || !['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'].includes(plan)) {
        res.status(400).json({ error: 'Invalid plan' });
        return;
      }

      const isAdmin = req.user?.role === Role.ADMIN;

      if (isAdmin) {
        await BillingService.overridePlanWithoutStripe(userId, userId, plan);
        res.status(200).json({
          message: `Plan updated to ${plan} (admin bypass)`,
          plan,
          bypassStripe: true,
        });
        return;
      }

      if (plan !== 'FREE') {
        res.status(403).json({
          error: 'Paid plan upgrades must go through Stripe Checkout',
          code: 'STRIPE_CHECKOUT_REQUIRED',
        });
        return;
      }

      await BillingService.downgradeToFree(userId);
      res.status(200).json({ message: 'Plan downgraded to FREE', plan: 'FREE' });
    } catch (error) { next(error); }
  }
}
