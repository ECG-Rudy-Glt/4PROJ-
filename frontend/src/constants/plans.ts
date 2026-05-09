export type PlanId = 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';

export const PLAN_STORAGE_LABELS: Record<PlanId, string> = {
  FREE: '30 Go',
  PRO: '100 Go',
  BUSINESS: '500 Go',
  ENTERPRISE: 'Sur devis',
};

export const isVaultAvailableForPlan = (plan?: PlanId | null): boolean => {
  if (!plan) return false;
  return plan !== 'FREE';
};
