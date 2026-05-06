import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/database';
import { AuthService } from '../authService';
import { generateToken } from '../../utils/jwt';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    passwordResetToken: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  }
}));

jest.mock('../planService', () => ({
  PlanService: {
    getStorageLimit: jest.fn().mockReturnValue(BigInt(104857600)),
  }
}));

jest.mock('bcryptjs', () => {
  return {
    compare: jest.fn(),
    hash: jest.fn(),
    genSalt: jest.fn(),
  };
});

jest.mock('../../utils/jwt', () => ({
  generateToken: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('../mailService', () => ({
  MailService: {
    sendWelcomeNotification: jest.fn(),
    sendPasswordChangeNotification: jest.fn()
  }
}));

jest.mock('../mfaService', () => ({
  mfaService: {
    verifyUserTOTPCode: jest.fn(),
    verifyBackupCode: jest.fn(),
  },
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const mockCreatedUser = {
      id: 'new-user-id',
      email: 'new@example.com',
      password: 'hashedpassword',
      firstName: 'John',
      lastName: 'Doe',
      avatar: null,
      role: 'USER',
      accountStatus: 'ACTIVE',
      plan: 'FREE',
      subscriptionStatus: 'ACTIVE',
      vaultEnabled: false,
      currentOrganizationId: null,
      quotaUsed: BigInt(0),
      quotaLimit: BigInt(104857600),
      theme: 'light',
      tokenVersion: 1,
      mfaEnabled: false,
      lastActiveAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should register a new user successfully', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      (prisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser);
      (generateToken as jest.Mock).mockReturnValue('mock-token');

      const result = await AuthService.register('new@example.com', 'password123', 'John', 'Doe');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'new@example.com' } });
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(prisma.user.create).toHaveBeenCalled();
      expect(result.token).toBe('mock-token');
      expect(result.user.email).toBe('new@example.com');
      expect(result.user.firstName).toBe('John');
      expect(result.user.lastName).toBe('Doe');
    });

    it('should throw an error if user already exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing-id', email: 'new@example.com' });

      await expect(AuthService.register('new@example.com', 'password123')).rejects.toThrow("Un compte avec cette adresse e-mail existe déjà.");
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should register without firstName and lastName', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword');
      (prisma.user.create as jest.Mock).mockResolvedValue({ ...mockCreatedUser, firstName: undefined, lastName: undefined });
      (generateToken as jest.Mock).mockReturnValue('mock-token');

      const result = await AuthService.register('new@example.com', 'password123');

      expect(result.token).toBe('mock-token');
      expect(result.user.email).toBe('new@example.com');
    });
  });

  describe('login', () => {
    it('should throw an error if user is not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(AuthService.login('test@example.com', 'password')).rejects.toThrow("Aucun compte n'existe avec cette adresse e-mail.");
    });

    it('should throw an error if account is inactive', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: 'hashedpassword',
        accountStatus: 'SUSPENDED',
        tokenVersion: 1,
        quotaUsed: BigInt(0),
        quotaLimit: BigInt(104857600),
      });

      await expect(AuthService.login('test@example.com', 'password')).rejects.toThrow("Ce compte est inactif ou a été suspendu.");
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashedpassword',
        accountStatus: 'ACTIVE',
        tokenVersion: 1,
        quotaUsed: BigInt(0),
        quotaLimit: BigInt(104857600),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (generateToken as jest.Mock).mockReturnValue('mock-token');

      const result = await AuthService.login('test@example.com', 'password');

      expect(result.token).toBe('mock-token');
      expect(result.user.email).toBe('test@example.com');
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  describe('refresh tokens', () => {
    const activeUser = {
      id: 'user-1',
      email: 'user@example.com',
      accountStatus: 'ACTIVE',
      tokenVersion: 3,
      encryptedDek: null,
    };

    it('should create a refresh token and only store its hash', async () => {
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const refreshToken = await AuthService.createRefreshToken('user-1');
      const storedToken = (prisma.refreshToken.create as jest.Mock).mock.calls[0][0].data.token;

      expect(refreshToken).toEqual(expect.any(String));
      expect(storedToken).toBe(AuthService.hashRefreshToken(refreshToken));
      expect(storedToken).not.toBe(refreshToken);
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          token: storedToken,
          userId: 'user-1',
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should rotate a valid refresh token and refuse reuse of the old token', async () => {
      const oldRefreshToken = 'old-refresh-token';
      const oldHash = AuthService.hashRefreshToken(oldRefreshToken);

      (prisma.refreshToken.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: 'refresh-1',
          token: oldHash,
          revoked: false,
          expiresAt: new Date(Date.now() + 60_000),
          user: activeUser,
        })
        .mockResolvedValueOnce({
          id: 'refresh-1',
          token: oldHash,
          revoked: true,
          expiresAt: new Date(Date.now() + 60_000),
          user: activeUser,
        });
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (generateToken as jest.Mock).mockReturnValue('new-access-token');

      const result = await AuthService.rotateRefreshToken(oldRefreshToken);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { token: oldHash, revoked: false },
        data: { revoked: true },
      });
      expect(result.token).toBe('new-access-token');
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.refreshToken).not.toBe(oldRefreshToken);
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);

      await expect(AuthService.rotateRefreshToken(oldRefreshToken)).rejects.toMatchObject({
        statusCode: 401,
        code: 'REFRESH_TOKEN_INVALID',
      });
    });

    it('should refuse expired refresh tokens', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'refresh-1',
        revoked: false,
        expiresAt: new Date(Date.now() - 60_000),
        user: activeUser,
      });

      await expect(AuthService.rotateRefreshToken('expired-refresh')).rejects.toMatchObject({
        statusCode: 401,
        code: 'REFRESH_TOKEN_EXPIRED',
      });
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('should refuse revoked refresh tokens', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'refresh-1',
        revoked: true,
        expiresAt: new Date(Date.now() + 60_000),
        user: activeUser,
      });

      await expect(AuthService.rotateRefreshToken('revoked-refresh')).rejects.toMatchObject({
        statusCode: 401,
        code: 'REFRESH_TOKEN_INVALID',
      });
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('should refuse refresh tokens for inactive users', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'refresh-1',
        revoked: false,
        expiresAt: new Date(Date.now() + 60_000),
        user: { ...activeUser, accountStatus: 'SUSPENDED' },
      });

      await expect(AuthService.rotateRefreshToken('inactive-refresh')).rejects.toMatchObject({
        statusCode: 401,
        code: 'ACCOUNT_INACTIVE',
      });
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('should revoke only the provided refresh token on logout', async () => {
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await expect(AuthService.revokeRefreshToken('refresh-current')).resolves.toEqual({ message: 'Déconnecté' });

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          token: AuthService.hashRefreshToken('refresh-current'),
          revoked: false,
        },
        data: { revoked: true },
      });
    });

    it('should increment tokenVersion and revoke all refresh tokens on global logout', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

      await expect(AuthService.logoutGlobal('user-1')).resolves.toEqual({
        message: 'Déconnecté de tous les appareils',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { tokenVersion: { increment: 1 } },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revoked: false },
        data: { revoked: true },
      });
    });

    it('should not invent a DEK for encrypted accounts without wrappedDek context', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'refresh-1',
        revoked: false,
        expiresAt: new Date(Date.now() + 60_000),
        user: { ...activeUser, encryptedDek: 'encrypted-dek' },
      });
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (generateToken as jest.Mock).mockReturnValue('new-access-token');

      const result = await AuthService.rotateRefreshToken('encrypted-refresh');

      expect(generateToken).toHaveBeenCalledWith('user-1', 'user@example.com', 3, undefined);
      expect(result).toMatchObject({
        token: 'new-access-token',
        dekUnlockRequired: true,
      });
    });

    it('should preserve wrappedDek only from a valid matching access token', async () => {
      process.env.JWT_SECRET = 'test-secret';
      (jwt.verify as jest.Mock).mockReturnValue({
        type: 'auth',
        userId: 'user-1',
        tokenVersion: 3,
        wrappedDek: 'wrapped-dek',
      });
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'refresh-1',
        revoked: false,
        expiresAt: new Date(Date.now() + 60_000),
        user: { ...activeUser, encryptedDek: 'encrypted-dek' },
      });
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});
      (generateToken as jest.Mock).mockReturnValue('new-access-token');

      const result = await AuthService.rotateRefreshToken('encrypted-refresh', 'old-access-token');

      expect(jwt.verify).toHaveBeenCalledWith('old-access-token', 'test-secret');
      expect(generateToken).toHaveBeenCalledWith('user-1', 'user@example.com', 3, { wrappedDek: 'wrapped-dek' });
      expect(result).toMatchObject({ token: 'new-access-token' });
      expect(result).not.toHaveProperty('dekUnlockRequired');
    });
  });

  describe('resetPassword', () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);

    it('should refuse reset for encrypted accounts without deleting DEK or vault data', async () => {
      (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'reset-token-id',
        expiresAt: futureDate,
        user: {
          id: 'user-1',
          email: 'secure@example.com',
          firstName: 'Secure',
          language: 'fr',
          mfaEnabled: false,
          encryptedDek: 'encrypted-dek',
          kekSalt: 'kek-salt',
          vaultEnabled: true,
          vaultPasswordHash: 'vault-hash',
        },
      });

      await expect(AuthService.resetPassword('reset-token', 'new-password')).rejects.toMatchObject({
        statusCode: 409,
        code: 'DEK_RECOVERY_REQUIRED',
      });

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.passwordResetToken.delete).not.toHaveBeenCalled();
    });

    it('should reset password for accounts without encrypted DEK without touching vault fields', async () => {
      (prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'reset-token-id',
        expiresAt: futureDate,
        user: {
          id: 'oauth-user',
          email: 'oauth@example.com',
          firstName: 'OAuth',
          language: 'fr',
          mfaEnabled: false,
          encryptedDek: null,
          kekSalt: null,
          vaultEnabled: false,
          vaultPasswordHash: null,
        },
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new-password');
      (prisma.user.update as jest.Mock).mockResolvedValue({
        email: 'oauth@example.com',
        firstName: 'OAuth',
        language: 'fr',
      });
      (prisma.passwordResetToken.delete as jest.Mock).mockResolvedValue({});

      const result = await AuthService.resetPassword('reset-token', 'new-password');

      expect(result).toEqual({ message: 'Password reset successfully' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'oauth-user' },
        data: {
          password: 'hashed-new-password',
          tokenVersion: { increment: 1 },
        },
      });
      const updateData = (prisma.user.update as jest.Mock).mock.calls[0][0].data;
      expect(updateData).not.toHaveProperty('kekSalt');
      expect(updateData).not.toHaveProperty('encryptedDek');
      expect(updateData).not.toHaveProperty('vaultEnabled');
      expect(updateData).not.toHaveProperty('vaultPasswordHash');
      expect(prisma.passwordResetToken.delete).toHaveBeenCalledWith({ where: { id: 'reset-token-id' } });
    });
  });
});
