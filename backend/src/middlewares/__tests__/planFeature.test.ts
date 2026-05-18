import { requirePlanFeature } from '../planFeature';
import { PlanService, PlanUpgradeRequiredError } from '../../services/planService';

jest.mock('../../services/planService', () => {
  const actual = jest.requireActual('../../services/planService');
  return {
    ...actual,
    PlanService: {
      assertFeature: jest.fn(),
      getUpgradeRequirement: actual.PlanService.getUpgradeRequirement,
    },
  };
});

const createRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('requirePlanFeature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('continues when the feature is available', async () => {
    (PlanService.assertFeature as jest.Mock).mockResolvedValue(undefined);
    const req: any = { user: { id: 'user-1' } };
    const res = createRes();
    const next = jest.fn();

    await requirePlanFeature('aiChat')(req, res, next);

    expect(PlanService.assertFeature).toHaveBeenCalledWith('user-1', 'aiChat');
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns PLAN_UPGRADE_REQUIRED when the plan is insufficient', async () => {
    (PlanService.assertFeature as jest.Mock).mockRejectedValue(new PlanUpgradeRequiredError('aiChat'));
    const req: any = { user: { id: 'user-free' } };
    const res = createRes();
    const next = jest.fn();

    await requirePlanFeature('aiChat')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Cette fonctionnalité nécessite le plan PRO ou supérieur.',
      code: 'PLAN_UPGRADE_REQUIRED',
      feature: 'aiChat',
      requiredPlan: 'PRO',
      upgradePath: '/plans',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
