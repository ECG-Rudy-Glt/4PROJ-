export type PlanId = 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
export type PlanFeature = 'aiChat' | 'vault' | 'onlyoffice' | 'auditLogs' | 'versioning';

export const PLAN_STORAGE_LABELS: Record<PlanId, string> = {
  FREE: '30 Go',
  PRO: '1 To',
  BUSINESS: '10 To',
  ENTERPRISE: '10 To',
};

export const isFeatureAvailableForPlan = (plan: PlanId | undefined | null, feature: PlanFeature): boolean => {
  if (!plan) return false;
  if (['aiChat', 'vault', 'onlyoffice', 'auditLogs', 'versioning'].includes(feature)) {
    return plan !== 'FREE';
  }
  return true;
};

export const isVaultAvailableForPlan = (plan?: PlanId | null): boolean => {
  return isFeatureAvailableForPlan(plan, 'vault');
};
