import crypto from 'crypto';
import { Request } from 'express';
import prisma from '../config/database';
import { TrustedDevice } from '@prisma/client';

/**
 * Service de gestion des appareils de confiance
 */
export class TrustedDeviceService {
  /**
   * Génère un device fingerprint unique basé sur les headers de la requête
   */
  generateDeviceFingerprint(req: Request): string {
    const userAgent = req.headers['user-agent'] || '';
    const acceptLanguage = req.headers['accept-language'] || '';
    const ip = req.ip || req.socket.remoteAddress || '';

    const data = `${userAgent}-${ip}-${acceptLanguage}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Extrait le nom lisible de l'appareil depuis le user-agent
   */
  private extractDeviceName(userAgent: string): string {
    // Détection du navigateur
    let browser = 'Navigateur inconnu';
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browser = 'Chrome';
    } else if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browser = 'Safari';
    } else if (userAgent.includes('Edg')) {
      browser = 'Edge';
    } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
      browser = 'Opera';
    }

    // Détection de l'OS
    let os = 'OS inconnu';
    if (userAgent.includes('Windows')) {
      os = 'Windows';
    } else if (userAgent.includes('Mac OS X')) {
      os = 'macOS';
    } else if (userAgent.includes('Linux')) {
      os = 'Linux';
    } else if (userAgent.includes('Android')) {
      os = 'Android';
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      os = 'iOS';
    }

    return `${browser} sur ${os}`;
  }

  /**
   * Crée un appareil de confiance
   */
  async createTrustedDevice(userId: string, req: Request): Promise<TrustedDevice> {
    const deviceFingerprint = this.generateDeviceFingerprint(req);
    const userAgent = req.headers['user-agent'] || '';
    const deviceName = this.extractDeviceName(userAgent);
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    // Calculer la date d'expiration (30 jours)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Vérifier si l'appareil existe déjà
    const existingDevice = await prisma.trustedDevice.findFirst({
      where: {
        userId,
        deviceFingerprint,
      },
    });

    if (existingDevice) {
      // Mettre à jour la date de dernière utilisation et l'expiration
      return await prisma.trustedDevice.update({
        where: { id: existingDevice.id },
        data: {
          lastUsedAt: new Date(),
          expiresAt,
        },
      });
    }

    // Créer un nouvel appareil
    return await prisma.trustedDevice.create({
      data: {
        userId,
        deviceFingerprint,
        deviceName,
        ipAddress,
        expiresAt,
      },
    });
  }

  /**
   * Vérifie si un appareil est de confiance
   */
  async isTrustedDevice(userId: string, deviceFingerprint: string): Promise<boolean> {
    const device = await prisma.trustedDevice.findFirst({
      where: {
        userId,
        deviceFingerprint,
        expiresAt: {
          gte: new Date(), // Pas encore expiré
        },
      },
    });

    if (device) {
      // Mettre à jour la date de dernière utilisation
      await prisma.trustedDevice.update({
        where: { id: device.id },
        data: { lastUsedAt: new Date() },
      });

      return true;
    }

    return false;
  }

  /**
   * Vérifie si un appareil est de confiance basé sur la requête
   */
  async isTrustedDeviceFromRequest(userId: string, req: Request): Promise<boolean> {
    const deviceFingerprint = this.generateDeviceFingerprint(req);
    return await this.isTrustedDevice(userId, deviceFingerprint);
  }

  /**
   * Récupère tous les appareils de confiance d'un utilisateur
   */
  async getUserTrustedDevices(userId: string): Promise<TrustedDevice[]> {
    return await prisma.trustedDevice.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  /**
   * Révoque un appareil de confiance
   */
  async revokeTrustedDevice(userId: string, deviceId: string): Promise<void> {
    await prisma.trustedDevice.delete({
      where: {
        id: deviceId,
        userId, // S'assurer que l'appareil appartient à l'utilisateur
      },
    });
  }

  /**
   * Révoque tous les appareils de confiance d'un utilisateur
   */
  async revokeAllTrustedDevices(userId: string): Promise<void> {
    await prisma.trustedDevice.deleteMany({
      where: { userId },
    });
  }

  /**
   * Nettoie les appareils expirés (à exécuter périodiquement)
   */
  async cleanupExpiredDevices(): Promise<number> {
    const result = await prisma.trustedDevice.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  /**
   * Compte le nombre d'appareils de confiance actifs pour un utilisateur
   */
  async countActiveTrustedDevices(userId: string): Promise<number> {
    return await prisma.trustedDevice.count({
      where: {
        userId,
        expiresAt: {
          gte: new Date(),
        },
      },
    });
  }
}

export const trustedDeviceService = new TrustedDeviceService();
