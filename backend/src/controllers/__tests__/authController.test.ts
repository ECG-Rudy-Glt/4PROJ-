import { AuthController } from '../authController';
import { AuthService } from '../../services/authService';
import { mfaService } from '../../services/mfaService';
import { trustedDeviceService } from '../../services/trustedDeviceService';
import { generateTempToken } from '../mfaController';
import { AuditService } from '../../services/auditService';
import { generateToken } from '../../utils/jwt';
import { AccountDeletionService } from '../../services/accountDeletionService';

jest.mock('../../services/authService', () => ({
  AuthService: {
    register: jest.fn(),
    login: jest.fn(),
    createRefreshToken: jest.fn(),
    rotateRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
    logoutGlobal: jest.fn(),
  },
}));

jest.mock('../../services/accountDeletionService', () => ({
  AccountDeletionService: {
    deleteAccount: jest.fn(),
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

jest.mock('../userProfileController', () => ({
  UserProfileController: {},
}));

jest.mock('../dataExportController', () => ({
  DataExportController: {},
}));

jest.mock('../../utils/cookies', () => ({
  clearSwitchSessionCookie: jest.fn(),
}));

jest.mock('../../utils/jwt', () => ({
  generateToken: jest.fn(),
}));

const createRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res;
};

const baseLoginResult = {
  token: 'jwt-token',
  wrappedDek: 'wrapped-dek',
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
  const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
  const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const originalGithubClientId = process.env.GITHUB_CLIENT_ID;
  const originalGithubClientSecret = process.env.GITHUB_CLIENT_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
  });

  afterAll(() => {
    if (originalGoogleClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
    if (originalGoogleClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret;
    if (originalGithubClientId === undefined) delete process.env.GITHUB_CLIENT_ID;
    else process.env.GITHUB_CLIENT_ID = originalGithubClientId;
    if (originalGithubClientSecret === undefined) delete process.env.GITHUB_CLIENT_SECRET;
    else process.env.GITHUB_CLIENT_SECRET = originalGithubClientSecret;
  });

  describe('getOAuthProviders', () => {
    it('should expose only configured OAuth providers', async () => {
      process.env.GOOGLE_CLIENT_ID = 'google-client';
      process.env.GOOGLE_CLIENT_SECRET = 'google-secret';

      const res = createRes();

      await AuthController.getOAuthProviders({} as any, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          google: true,
          github: false,
        },
      });
    });
  });

  describe('register', () => {
    it('should return MFA setup temp token without creating a refresh token', async () => {
      (AuthService.register as jest.Mock).mockResolvedValue(baseLoginResult);
      (generateTempToken as jest.Mock).mockReturnValue('temp-token-register');

      const req: any = {
        body: {
          email: 'user@example.com',
          password: 'Password123!',
          firstName: 'User',
          lastName: 'One',
        },
      };
      const res = createRes();

      await AuthController.register(req, res, jest.fn());

      expect(generateTempToken).toHaveBeenCalledWith('user-1', 'wrapped-dek');
      expect(AuthService.createRefreshToken).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          mfaSetupRequired: true,
          tempToken: 'temp-token-register',
          userId: 'user-1',
          user: {
            email: 'user@example.com',
            firstName: 'User',
            lastName: 'One',
          },
        },
      });
    });
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

      expect(generateTempToken).toHaveBeenCalledWith('user-1', 'wrapped-dek');
      expect(AuthService.createRefreshToken).not.toHaveBeenCalled();
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

      expect(generateTempToken).toHaveBeenCalledWith('user-1', 'wrapped-dek');
      expect(AuthService.createRefreshToken).not.toHaveBeenCalled();
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

    it('should not expose wrappedDek in trusted-device login responses', async () => {
      (AuthService.login as jest.Mock).mockResolvedValue(baseLoginResult);
      (AuthService.createRefreshToken as jest.Mock).mockResolvedValue('refresh-token');
      (mfaService.isMFAEnabled as jest.Mock).mockResolvedValue(true);
      (trustedDeviceService.isTrustedDeviceFromRequest as jest.Mock).mockResolvedValue(true);
      (AuditService.createLog as jest.Mock).mockResolvedValue(undefined);

      const req: any = {
        body: { email: 'user@example.com', password: 'password123' },
        ip: '127.0.0.1',
        get: jest.fn(),
      };
      const res = createRes();

      await AuthController.login(req, res, jest.fn());

      expect(AuthService.createRefreshToken).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          token: 'jwt-token',
          refreshToken: 'refresh-token',
          user: baseLoginResult.user,
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

  describe('refresh', () => {
    it('should rotate refresh token with optional access token context', async () => {
      (AuthService.rotateRefreshToken as jest.Mock).mockResolvedValue({
        token: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      const req: any = {
        body: { refreshToken: 'old-refresh-token' },
        headers: { authorization: 'Bearer old-access-token' },
      };
      const res = createRes();

      await AuthController.refresh(req, res, jest.fn());

      expect(AuthService.rotateRefreshToken).toHaveBeenCalledWith('old-refresh-token', 'old-access-token');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          token: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      });
    });

    it('should reject missing refresh token', async () => {
      const req: any = { body: {}, headers: {} };
      const res = createRes();

      await AuthController.refresh(req, res, jest.fn());

      expect(AuthService.rotateRefreshToken).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Refresh token requis',
      });
    });
  });

  describe('logout', () => {
    it('should revoke only the provided refresh token', async () => {
      (AuthService.revokeRefreshToken as jest.Mock).mockResolvedValue({ message: 'Déconnecté' });

      const req: any = { body: { refreshToken: 'refresh-token' } };
      const res = createRes();

      await AuthController.logout(req, res, jest.fn());

      expect(AuthService.revokeRefreshToken).toHaveBeenCalledWith('refresh-token');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Déconnecté' },
      });
    });
  });

  describe('logoutAll', () => {
    it('should globally logout and clear switch session cookie', async () => {
      (AuthService.logoutGlobal as jest.Mock).mockResolvedValue({ message: 'Déconnecté de tous les appareils' });

      const req: any = {
        user: { id: 'user-1' },
        ip: '127.0.0.1',
        get: jest.fn(),
      };
      const res = createRes();

      await AuthController.logoutAll(req, res, jest.fn());

      expect(AuthService.logoutGlobal).toHaveBeenCalledWith('user-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Déconnecté de tous les appareils' },
      });
    });
  });

  describe('deleteAccount', () => {
    it('should delete the current account with confirmation data', async () => {
      (AccountDeletionService.deleteAccount as jest.Mock).mockResolvedValue({ message: 'Compte supprimé avec succès' });

      const req: any = {
        user: { id: 'user-1' },
        body: {
          confirmationEmail: 'user@example.com',
          currentPassword: 'password',
          mfaCode: '123456',
        },
      };
      const res = createRes();

      await AuthController.deleteAccount(req, res, jest.fn());

      expect(AccountDeletionService.deleteAccount).toHaveBeenCalledWith('user-1', {
        confirmationEmail: 'user@example.com',
        currentPassword: 'password',
        mfaCode: '123456',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Compte supprimé avec succès' },
      });
    });
  });

  describe('oauthCallback', () => {
    it('should issue OAuth token with current tokenVersion', async () => {
      (generateToken as jest.Mock).mockReturnValue('oauth-token');
      const req: any = {
        user: {
          id: 'oauth-user',
          email: 'oauth@example.com',
          tokenVersion: 9,
        },
      };
      const res = createRes();

      await AuthController.oauthCallback(req, res, jest.fn());

      expect(generateToken).toHaveBeenCalledWith('oauth-user', 'oauth@example.com', 9);
      expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/auth/callback#token=oauth-token');
    });
  });
});
