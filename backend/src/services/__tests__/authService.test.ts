import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { AuthService } from '../authService';
import { generateToken } from '../../utils/jwt';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    }
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

  describe('login', () => {
    it('should throw an error if user is not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(AuthService.login('test@example.com', 'password')).rejects.toThrow('Invalid credentials');
    });

    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashedpassword',
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
