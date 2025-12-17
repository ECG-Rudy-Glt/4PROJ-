import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { generateToken } from '../utils/jwt';

export class AuthService {
  static async register(
    email: string,
    password: string,
    firstName?: string,
    lastName?: string
  ) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
      },
    });

    // Generate token
    const token = generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        quotaUsed: Number(user.quotaUsed),
        quotaLimit: Number(user.quotaLimit),
        theme: user.theme,
      },
      token,
    };
  }

  static async login(email: string, password: string) {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      throw new Error('Invalid credentials');
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate token
    const token = generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        quotaUsed: Number(user.quotaUsed),
        quotaLimit: Number(user.quotaLimit),
        theme: user.theme,
      },
      token,
    };
  }

  static async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      avatar?: string;
      theme?: string;
    }
  ) {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      quotaUsed: Number(user.quotaUsed),
      quotaLimit: Number(user.quotaLimit),
      theme: user.theme,
    };
  }

  static async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password) {
      throw new Error('User not found');
    }

    // Verify old password
    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) {
      throw new Error('Invalid old password');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }
}
