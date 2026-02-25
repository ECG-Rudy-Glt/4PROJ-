import { Response } from 'express';
import { UserService } from '../services/userService';
import { AuthRequest } from '../types';
import prisma from '../config/database';
import { PlanService } from '../services/planService';

export class UserController {
  /**
   * Rechercher des utilisateurs par email (autocomplete)
   */
  static async searchUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { query, limit } = req.query;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
      }

      const users = await UserService.searchUsersByEmail(
        query,
        limit ? parseInt(String(limit)) : 10
      );

      res.status(200).json({ users });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtenir les informations basiques d'un utilisateur
   */
  static async getUserInfo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const user = await UserService.getUserBasicInfo(userId);

      res.status(200).json({ user });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }

  static async updatePlan(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { plan } = req.body;

      if (!['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'].includes(plan)) {
        res.status(400).json({ error: 'Invalid plan' });
        return;
      }

      // Mettre à jour le plan de l'utilisateur
      await prisma.user.update({
        where: { id: userId },
        data: { plan },
      });

      // Synchroniser les quotas
      await PlanService.syncUserQuotaLimit(userId);

      res.status(200).json({ message: 'Plan updated successfully', plan });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
