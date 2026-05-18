import { Plan } from '../types';

export type PlanFeature = 'aiChat' | 'vault' | 'onlyoffice' | 'auditLogs';

export const isFeatureAvailableForPlan = (plan: Plan | undefined | null, feature: PlanFeature): boolean => {
  if (!plan) return false;
  if (['aiChat', 'vault', 'onlyoffice', 'auditLogs'].includes(feature)) {
    return plan !== 'FREE';
  }
  return true;
};
