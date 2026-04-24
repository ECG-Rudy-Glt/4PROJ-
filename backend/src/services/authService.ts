import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AppError } from '../middlewares/errorHandler';
import { Plan, SubscriptionStatus } from '@prisma/client';
import prisma from '../config/database';
import { generateToken } from '../utils/jwt';
import { MailService } from './mailService';
import { PlanService } from './planService';
import { KekService } from './kekService';
import { mfaService } from './mfaService';
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
      language?: string;
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
      language: user.language,
      createdAt: user.createdAt,
    };
  }

  static async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
    mfaCode?: string
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

    if (user.mfaEnabled) {
      if (!mfaCode) {
        throw new AppError(401, 'Code MFA requis.');
      }

      const isTotpValid = await mfaService.verifyUserTOTPCode(user.id, mfaCode);
      let isBackupValid = false;

      if (!isTotpValid) {
        isBackupValid = await mfaService.verifyBackupCode(user.id, mfaCode);
      }

      if (!isTotpValid && !isBackupValid) {
        throw new AppError(401, 'Code MFA invalide.');
      }
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
      await MailService.sendPasswordChangeNotification(updatedUser.email, updatedUser.firstName || 'Utilisateur', updatedUser.language);
    } catch (error) {
      logger.error({ err: error }, 'Failed to send password change notification');
    }

    return { message: 'Password changed successfully' };
  }

  static async requestPasswordReset(email: string, requestLanguage?: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't throw error to prevent email enumeration
      logger.info('[AuthService.requestPasswordReset] Reset requested for unknown email');
      return { message: 'If this email exists, a reset link has been sent.' };
    }

    // Invalidate existing tokens
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiration

    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      }
    });

    // Determine language: use user.language, fallback to requestLanguage or 'fr'
    const lang = user.language || requestLanguage || 'fr';
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    try {
      const sent = await MailService.sendPasswordResetMail(user.email, user.firstName || 'Utilisateur', resetLink, lang);
      if (sent) {
        logger.info({ userId: user.id }, '[AuthService.requestPasswordReset] Reset email sent');
      } else {
        logger.error({ userId: user.id }, '[AuthService.requestPasswordReset] Reset email send failed');
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to send password reset email');
    }

    return { message: 'If this email exists, a reset link has been sent.' };
  }

  static async getResetTokenInfo(token: string) {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!resetToken || resetToken.expiresAt < new Date()) {
      throw new AppError(400, "Le lien de réinitialisation est invalide ou a expiré.");
    }

    return {
      mfaEnabled: resetToken.user.mfaEnabled
    };
  }

  static async resetPassword(token: string, newPassword: string, mfaCode?: string) {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!resetToken || resetToken.expiresAt < new Date()) {
      throw new AppError(400, "Le lien de réinitialisation est invalide ou a expiré.");
    }

    const user = resetToken.user;

    // MFA Verification if enabled
    if (user.mfaEnabled) {
      if (!mfaCode) {
        throw new AppError(401, "Code MFA requis.");
      }
      
      const isTotpValid = await mfaService.verifyUserTOTPCode(user.id, mfaCode);
      let isBackupValid = false;
      
      if (!isTotpValid) {
        isBackupValid = await mfaService.verifyBackupCode(user.id, mfaCode);
      }

      if (!isTotpValid && !isBackupValid) {
        throw new AppError(401, "Code MFA invalide.");
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    let dekUpdate = {};
    if (user.kekSalt && user.encryptedDek) {
        dekUpdate = {
            kekSalt: null,
            encryptedDek: null,
            vaultEnabled: false,
            vaultPasswordHash: null
        };
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 },
        ...dekUpdate
      }
    });

    // Delete token
    await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });

    try {
      await MailService.sendPasswordChangeNotification(user.email, user.firstName || 'Utilisateur', user.language);
    } catch (error) {
      logger.error({ err: error }, 'Failed to send password change notification');
    }

    return { message: 'Password reset successfully' };
  }
}
