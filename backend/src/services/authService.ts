import bcrypt from 'bcryptjs';
import { Plan, SubscriptionStatus } from '@prisma/client';
import prisma from '../config/database';
import { generateToken } from '../utils/jwt';
import { MailService } from './mailService';
import { PlanService } from './planService';
import logger from '../config/logger';

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
    const freePlanLimit = PlanService.getStorageLimit(Plan.FREE);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        plan: Plan.FREE,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        quotaLimit: freePlanLimit,
      },
    });

    // Generate token
    const token = generateToken(user.id, user.email, user.tokenVersion);

    // Send welcome email
    try {
      await MailService.sendWelcomeNotification(user.email, user.firstName || 'Utilisateur');
    } catch (error) {
      logger.error('Failed to send welcome email', error);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        role: user.role,
        accountStatus: user.accountStatus,
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
        vaultEnabled: user.vaultEnabled,
        currentOrganizationId: user.currentOrganizationId,
        quotaUsed: Number(user.quotaUsed),
        quotaLimit: Number(user.quotaLimit),
        theme: user.theme,
        createdAt: user.createdAt,
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
    if (user.accountStatus !== 'ACTIVE') {
      throw new Error('Account inactive or suspended');
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Update lastActiveAt on login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() }
    });

    // Generate token
    const token = generateToken(user.id, user.email, user.tokenVersion);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        role: user.role,
        accountStatus: user.accountStatus,
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
        vaultEnabled: user.vaultEnabled,
        currentOrganizationId: user.currentOrganizationId,
        quotaUsed: Number(user.quotaUsed),
        quotaLimit: Number(user.quotaLimit),
        theme: user.theme,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  static async logoutGlobal(userId: string) {
    // Increment token version to invalidate all existing tokens
    await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } }
    });
    return { message: 'Déconnecté de tous les appareils' };
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
      role: user.role,
      accountStatus: user.accountStatus,
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      vaultEnabled: user.vaultEnabled,
      currentOrganizationId: user.currentOrganizationId,
      quotaUsed: Number(user.quotaUsed),
      quotaLimit: Number(user.quotaLimit),
      theme: user.theme,
      createdAt: user.createdAt,
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
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Send notification
    try {
      await MailService.sendPasswordChangeNotification(updatedUser.email, updatedUser.firstName || 'Utilisateur');
    } catch (error) {
      logger.error('Failed to send password change notification', error);
    }

    return { message: 'Password changed successfully' };
  }
}
