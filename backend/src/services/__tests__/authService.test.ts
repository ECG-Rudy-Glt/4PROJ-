import bcrypt from 'bcryptjs';
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
    }
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

jest.mock('../mailService', () => ({
  MailService: {
    sendWelcomeNotification: jest.fn(),
    sendPasswordChangeNotification: jest.fn()
  }
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
});
