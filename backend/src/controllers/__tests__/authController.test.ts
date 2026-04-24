import { AuthController } from '../authController';
import { AuthService } from '../../services/authService';
import { mfaService } from '../../services/mfaService';
import { trustedDeviceService } from '../../services/trustedDeviceService';
import { generateTempToken } from '../mfaController';
import { AuditService } from '../../services/auditService';

jest.mock('../../services/authService', () => ({
  AuthService: {
    login: jest.fn(),
  },
}));

jest.mock('../../services/mfaService', () => ({
  mfaService: {
    isMFAEnabled: jest.fn(),
  },
}));

jest.mock('../../services/trustedDeviceService', () => ({
  trustedDeviceService: {
    isTrustedDeviceFromRequest: jest.fn(),
  },
}));

jest.mock('../mfaController', () => ({
  generateTempToken: jest.fn(),
}));

jest.mock('../../services/auditService', () => ({
  AuditService: {
    createLog: jest.fn(),
  },
}));

jest.mock('../../utils/cookies', () => ({
  clearSwitchSessionCookie: jest.fn(),
}));

const createRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const baseLoginResult = {
  token: 'jwt-token',
  user: {
    id: 'user-1',
    email: 'user@example.com',
    firstName: 'User',
    lastName: 'One',
    avatar: null,
    role: 'USER',
    accountStatus: 'ACTIVE',
    plan: 'FREE',
    subscriptionStatus: 'ACTIVE',
    vaultEnabled: false,
    currentOrganizationId: null,
    quotaUsed: 0,
    quotaLimit: 123,
    theme: 'light',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
};

describe('AuthController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should require MFA when enabled and device is not trusted', async () => {
      (AuthService.login as jest.Mock).mockResolvedValue(baseLoginResult);
      (mfaService.isMFAEnabled as jest.Mock).mockResolvedValue(true);
      (trustedDeviceService.isTrustedDeviceFromRequest as jest.Mock).mockResolvedValue(false);
      (generateTempToken as jest.Mock).mockReturnValue('temp-token-1');

      const req: any = {
        body: { email: 'user@example.com', password: 'password123' },
        ip: '127.0.0.1',
        get: jest.fn(),
      };
      const res = createRes();

      await AuthController.login(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          mfaRequired: true,
          tempToken: 'temp-token-1',
          userId: 'user-1',
        },
      });
      expect(AuditService.createLog).not.toHaveBeenCalled();
    });

    it('should return setup flow when MFA is not enabled yet', async () => {
      (AuthService.login as jest.Mock).mockResolvedValue(baseLoginResult);
      (mfaService.isMFAEnabled as jest.Mock).mockResolvedValue(false);
      (generateTempToken as jest.Mock).mockReturnValue('temp-token-2');

      const req: any = {
        body: { email: 'user@example.com', password: 'password123' },
      };
      const res = createRes();

      await AuthController.login(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          mfaSetupRequired: true,
          tempToken: 'temp-token-2',
          userId: 'user-1',
          user: {
            email: 'user@example.com',
            firstName: 'User',
            lastName: 'One',
          },
        },
      });
    });

    it('should forward inactive account login error to error handler', async () => {
      const err = Object.assign(new Error('Account inactive or suspended'), { statusCode: 401 });
      (AuthService.login as jest.Mock).mockRejectedValue(err);

      const req: any = {
        body: { email: 'user@example.com', password: 'password123' },
      };
      const res = createRes();
      const next = jest.fn();

      await AuthController.login(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
