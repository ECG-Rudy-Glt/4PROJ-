import bcrypt from 'bcryptjs';
import { AppError } from '../middlewares/errorHandler';
import { Plan, SubscriptionStatus } from '@prisma/client';
import prisma from '../config/database';
import { generateToken } from '../utils/jwt';
import { MailService } from './mailService';
import { PlanService } from './planService';
import { KekService } from './kekService';
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
      throw new AppError(409, "Un compte avec cette adresse e-mail existe déjà.");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Générer KEK/DEK pour le chiffrement par utilisateur
    const kekSalt = KekService.generateSalt();
    const dek = KekService.generateDek();
    const kek = await KekService.deriveKek(password, kekSalt);
    const encryptedDek = KekService.encryptDekWithKek(dek, kek);

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
        kekSalt,
        encryptedDek,
      },
    });

    // Générer le token avec le DEK enveloppé
    let wrappedDek: string | undefined;
    try {
      wrappedDek = KekService.wrapDek(dek);
    } catch (err) {
      logger.warn({ err }, '[AuthService.register] DEK_WRAP_SECRET absent — wrappedDek omis du JWT');
    }
    const token = generateToken(user.id, user.email, user.tokenVersion, { wrappedDek });

    // Send welcome email
    try {
      await MailService.sendWelcomeNotification(user.email, user.firstName || 'Utilisateur');
    } catch (error) {
      logger.error({ err: error }, 'Failed to send welcome email');
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
      throw new AppError(401, "Aucun compte n'existe avec cette adresse e-mail.");
    }
    if (user.accountStatus !== 'ACTIVE') {
      throw new AppError(401, "Ce compte est inactif ou a été suspendu.");
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new AppError(401, "Le mot de passe saisi est incorrect.");
    }

    // Update lastActiveAt on login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() }
    });

    // Dériver KEK → déchiffrer DEK → envelopper pour le JWT
    let wrappedDek: string | undefined;
    if (user.kekSalt && user.encryptedDek) {
      try {
        const kek = await KekService.deriveKek(password, user.kekSalt);
        const dek = KekService.decryptDekWithKek(user.encryptedDek, kek);
        wrappedDek = KekService.wrapDek(dek);
      } catch (err) {
        logger.warn({ err }, '[AuthService.login] Impossible de déchiffrer le DEK utilisateur');
      }
    }

    // Generate token
    const token = generateToken(user.id, user.email, user.tokenVersion, { wrappedDek });

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

    // Re-chiffrer le DEK avec la nouvelle KEK
    let newEncryptedDek: string | undefined;
    if (user.kekSalt && user.encryptedDek) {
      try {
        const oldKek = await KekService.deriveKek(oldPassword, user.kekSalt);
        const dek = KekService.decryptDekWithKek(user.encryptedDek, oldKek);
        const newKek = await KekService.deriveKek(newPassword, user.kekSalt);
        newEncryptedDek = KekService.encryptDekWithKek(dek, newKek);
      } catch (err) {
        logger.warn({ err }, '[AuthService.changePassword] Impossible de re-chiffrer le DEK');
      }
    }

    // Update password (+ encryptedDek si disponible)
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        ...(newEncryptedDek ? { encryptedDek: newEncryptedDek } : {}),
      },
    });

    // Send notification
    try {
      await MailService.sendPasswordChangeNotification(updatedUser.email, updatedUser.firstName || 'Utilisateur');
    } catch (error) {
      logger.error({ err: error }, 'Failed to send password change notification');
    }

    return { message: 'Password changed successfully' };
  }
}
