import { Plan } from '@prisma/client';
import prisma from '../../config/database';
import { PLAN_LIMITS, PlanService, PLAN_UPGRADE_REQUIRED_CODE } from '../planService';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('PlanService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkQuota', () => {
    it('should allow upload when remaining quota is enough', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        quotaUsed: BigInt(100),
        quotaLimit: BigInt(200),
      });

      const allowed = await PlanService.checkQuota('user-1', 100);
      expect(allowed).toBe(true);
    });

    it('should block upload when quota would be exceeded', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        quotaUsed: BigInt(180),
        quotaLimit: BigInt(200),
      });

      const allowed = await PlanService.checkQuota('user-1', 30);
      expect(allowed).toBe(false);
    });
  });

  describe('checkFileSize', () => {
    it('should enforce max file size based on plan', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ plan: Plan.FREE });

      const allowedSize = PLAN_LIMITS[Plan.FREE].maxFileSize;
      const blockedSize = allowedSize + BigInt(1);

      await expect(PlanService.checkFileSize('user-1', allowedSize)).resolves.toBe(true);
      await expect(PlanService.checkFileSize('user-1', blockedSize)).resolves.toBe(false);
    });
  });

  describe('limits (shares/versions/tags)', () => {
    it('should enforce maxShares for FREE plan', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ plan: Plan.FREE });
      const maxShares = PLAN_LIMITS[Plan.FREE].maxShares;

      await expect(PlanService.checkLimit('user-1', 'maxShares', maxShares - 1)).resolves.toBe(true);
      await expect(PlanService.checkLimit('user-1', 'maxShares', maxShares)).resolves.toBe(false);
    });

    it('should enforce maxVersions for FREE plan', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ plan: Plan.FREE });

      await expect(PlanService.checkLimit('user-1', 'maxVersions', 2)).resolves.toBe(true);
      await expect(PlanService.checkLimit('user-1', 'maxVersions', 3)).resolves.toBe(false);
    });

    it('should enforce maxTags for FREE plan', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ plan: Plan.FREE });

      await expect(PlanService.checkLimit('user-1', 'maxTags', 9)).resolves.toBe(true);
      await expect(PlanService.checkLimit('user-1', 'maxTags', 10)).resolves.toBe(false);
    });

    it('should keep limits unlimited for ENTERPRISE', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ plan: Plan.ENTERPRISE });

      await expect(PlanService.checkLimit('user-1', 'maxShares', 1_000_000)).resolves.toBe(true);
      await expect(PlanService.checkLimit('user-1', 'maxVersions', 1_000_000)).resolves.toBe(true);
      await expect(PlanService.checkLimit('user-1', 'maxTags', 1_000_000)).resolves.toBe(true);
      await expect(PlanService.getNumericLimit('user-1', 'maxShares')).resolves.toBeNull();
    });

    it('should throw clear business error when a limit is reached', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ plan: Plan.FREE });
      const maxShares = PLAN_LIMITS[Plan.FREE].maxShares;

      await expect(PlanService.assertLimit('user-1', 'maxShares', maxShares)).rejects.toThrow(
        `Limite de ${maxShares} partages atteinte pour votre plan`
      );
    });
  });

  describe('features', () => {
    it('should reject AI access for FREE plan with an upgrade error', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ plan: Plan.FREE });

      await expect(PlanService.assertFeature('user-1', 'aiChat')).rejects.toMatchObject({
        code: PLAN_UPGRADE_REQUIRED_CODE,
        feature: 'aiChat',
        requiredPlan: Plan.PRO,
        upgradePath: '/plans',
      });
    });

    it('should allow premium features from PRO plan', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ plan: Plan.PRO });

      await expect(PlanService.assertFeature('user-1', 'aiChat')).resolves.toBeUndefined();
      await expect(PlanService.assertFeature('user-1', 'onlyoffice')).resolves.toBeUndefined();
      await expect(PlanService.assertFeature('user-1', 'auditLogs')).resolves.toBeUndefined();
    });
  });
});
