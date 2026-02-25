export type PlanId = 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';

export const PLAN_STORAGE_LABELS: Record<PlanId, string> = {
  FREE: '30 Go',
  PRO: '200 Go',
  BUSINESS: '2 To',
  ENTERPRISE: '10 To',
};

export const isVaultAvailableForPlan = (plan?: PlanId | null): boolean => {
  if (!plan) return false;
  return plan !== 'FREE';
};
