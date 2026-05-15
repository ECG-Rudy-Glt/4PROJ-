import { NextFunction, Response } from 'express';
import { AuthRequest } from '../types';
import {
  PlanFeature,
  PlanService,
  PlanUpgradeRequiredError,
  PLAN_UPGRADE_REQUIRED_CODE,
} from '../services/planService';
import { sendError } from '../utils/response';

const UPGRADE_MESSAGE = 'Cette fonctionnalité nécessite le plan PRO ou supérieur.';

export const sendPlanUpgradeRequired = (res: Response, feature: PlanFeature): void => {
  sendError(res, UPGRADE_MESSAGE, 403, PLAN_UPGRADE_REQUIRED_CODE, PlanService.getUpgradeRequirement(feature));
};

export const requirePlanFeature = (feature: PlanFeature) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      await PlanService.assertFeature(userId, feature);
      next();
    } catch (error) {
      if (error instanceof PlanUpgradeRequiredError) {
        sendPlanUpgradeRequired(res, error.feature);
        return;
      }

      next(error);
    }
  };
};
