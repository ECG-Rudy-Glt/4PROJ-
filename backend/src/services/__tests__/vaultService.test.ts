import prisma from '../../config/database';
import { PlanService } from '../planService';
import { VaultService } from '../vaultService';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    folder: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../planService', () => ({
  PlanService: {
    checkFeature: jest.fn(),
    assertFeature: jest.fn(),
  },
}));

describe('VaultService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('assertUnlockedIfVault', () => {
    it('should reject access for FREE plan when vault feature is unavailable', async () => {
      (PlanService.assertFeature as jest.Mock).mockRejectedValue(
        new Error('Cette fonctionnalité nécessite le plan PRO ou supérieur.')
      );

      await expect(VaultService.assertUnlockedIfVault('user-free', true)).rejects.toThrow(
        'Cette fonctionnalité nécessite le plan PRO ou supérieur.'
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should reject access when vault is locked', async () => {
      (PlanService.assertFeature as jest.Mock).mockResolvedValue(undefined);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        vaultEnabled: true,
        vaultUnlockUntil: new Date(Date.now() - 60_000),
      });

      await expect(VaultService.assertUnlockedIfVault('user-pro', true)).rejects.toThrow(
        'Coffre-fort verrouillé. Déverrouillez-le pour accéder à ce contenu.'
      );
    });

    it('should allow access when vault is unlocked', async () => {
      (PlanService.assertFeature as jest.Mock).mockResolvedValue(undefined);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        vaultEnabled: true,
        vaultUnlockUntil: new Date(Date.now() + 60_000),
      });

      await expect(VaultService.assertUnlockedIfVault('user-pro', true)).resolves.toBeUndefined();
    });
  });
});
