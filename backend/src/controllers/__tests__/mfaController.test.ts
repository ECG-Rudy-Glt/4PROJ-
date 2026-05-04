import { MFAController } from '../mfaController';
import { mfaService } from '../../services/mfaService';
import { trustedDeviceService } from '../../services/trustedDeviceService';
import prisma from '../../config/database';
import { generateToken } from '../../utils/jwt';

jest.mock('../../services/mfaService', () => ({
  mfaService: {
    verifyTOTPCode: jest.fn(),
    verifyUserTOTPCode: jest.fn(),
    verifyBackupCode: jest.fn(),
    enableMFA: jest.fn(),
    getRemainingBackupCodesCount: jest.fn(),
  },
}));

jest.mock('../../services/trustedDeviceService', () => ({
  trustedDeviceService: {
    createTrustedDevice: jest.fn(),
  },
}));

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../utils/jwt', () => ({
  generateToken: jest.fn(),
}));

const createRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const user = {
  id: 'user-1',
  email: 'user@example.com',
  firstName: 'User',
  lastName: 'One',
  avatar: null,
  theme: 'light',
  quotaUsed: BigInt(0),
  quotaLimit: BigInt(1024),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  tokenVersion: 4,
};

describe('MFAController token issuance', () => {
  const controller = new MFAController();

  beforeEach(() => {
    jest.clearAllMocks();
    (generateToken as jest.Mock).mockReturnValue('auth-token');
  });

  it('should preserve wrappedDek after MFA setup verification', async () => {
    (mfaService.verifyTOTPCode as jest.Mock).mockReturnValue(true);
    (mfaService.enableMFA as jest.Mock).mockResolvedValue(undefined);

    const req: any = {
      user,
      wrappedDek: 'wrapped-dek',
      body: { token: '123456', secret: 'secret', backupCodes: ['code'] },
    };
    const res = createRes();

    await controller.verifySetup(req, res, jest.fn());

    expect(generateToken).toHaveBeenCalledWith('user-1', 'user@example.com', 4, {
      wrappedDek: 'wrapped-dek',
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { message: 'MFA activé avec succès', token: 'auth-token' },
    });
  });

  it('should preserve wrappedDek after TOTP verification', async () => {
    (mfaService.verifyUserTOTPCode as jest.Mock).mockResolvedValue(true);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

    const req: any = {
      user: { id: 'user-1' },
      wrappedDek: 'wrapped-dek',
      body: { token: '123456' },
    };
    const res = createRes();

    await controller.verifyMFA(req, res, jest.fn());

    expect(generateToken).toHaveBeenCalledWith('user-1', 'user@example.com', 4, {
      wrappedDek: 'wrapped-dek',
    });
  });

  it('should preserve wrappedDek after backup code verification', async () => {
    (mfaService.verifyBackupCode as jest.Mock).mockResolvedValue(true);
    (mfaService.getRemainingBackupCodesCount as jest.Mock).mockResolvedValue(5);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

    const req: any = {
      user: { id: 'user-1' },
      wrappedDek: 'wrapped-dek',
      body: { backupCode: 'backup-code' },
    };
    const res = createRes();

    await controller.verifyBackupCode(req, res, jest.fn());

    expect(generateToken).toHaveBeenCalledWith('user-1', 'user@example.com', 4, {
      wrappedDek: 'wrapped-dek',
    });
  });
});
