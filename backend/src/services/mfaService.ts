import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../config/database';

const APP_NAME = 'SupFile';
const ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY || '';
if (!/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
  throw new Error('MFA_ENCRYPTION_KEY must be a 64-character hex string');
}
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

/**
 * Service de gestion MFA (Multi-Factor Authentication)
 */
export class MFAService {
  /**
   * Encrypte le secret TOTP avant stockage
   */
  private encryptSecret(secret: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      ENCRYPTION_ALGORITHM,
      Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex'),
      iv
    );
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Décrypte le secret TOTP depuis la base
   */
  private decryptSecret(encryptedSecret: string): string {
    const [ivHex, encrypted] = encryptedSecret.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex'),
      iv
    );
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Génère un code de récupération aléatoire
   */
  private generateBackupCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  /**
   * Génère le secret TOTP et le QR code pour la configuration initiale
   */
  async generateMFASecret(userId: string, email: string): Promise<{
    secret: string;
    qrCodeDataUrl: string;
    backupCodes: string[];
  }> {
    // Génération du secret TOTP
    const secret = speakeasy.generateSecret({
      name: `${APP_NAME}:${email}`,
      issuer: APP_NAME,
      length: 32,
    });

    // Génération du QR code
    const otpauthUrl = secret.otpauth_url!;
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Génération des codes de récupération (10 codes)
    const backupCodes: string[] = [];
    for (let i = 0; i < 10; i++) {
      backupCodes.push(this.generateBackupCode());
    }

    return {
      secret: secret.base32,
      qrCodeDataUrl,
      backupCodes,
    };
  }

  /**
   * Vérifie un code TOTP
   */
  verifyTOTPCode(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Permet une fenêtre de 60 secondes avant/après
    });
  }

  /**
   * Active le MFA pour un utilisateur
   */
  async enableMFA(userId: string, secret: string, backupCodes: string[]): Promise<void> {
    // Hash des codes de récupération
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, 10))
    );

    // Encryptage du secret
    const encryptedSecret = this.encryptSecret(secret);

    // Mise à jour de l'utilisateur
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaSecret: encryptedSecret,
        mfaBackupCodes: hashedBackupCodes,
        mfaSetupAt: new Date(),
      },
    });
  }

  /**
   * Vérifie un code TOTP pour un utilisateur
   */
  async verifyUserTOTPCode(userId: string, token: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaEnabled: true },
    });

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return false;
    }

    const secret = this.decryptSecret(user.mfaSecret);
    return this.verifyTOTPCode(secret, token);
  }

  /**
   * Vérifie un code de récupération
   */
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaBackupCodes: true },
    });

    if (!user || !user.mfaBackupCodes || user.mfaBackupCodes.length === 0) {
      return false;
    }

    // Vérifier si le code correspond à l'un des codes hashés
    for (let i = 0; i < user.mfaBackupCodes.length; i++) {
      const isValid = await bcrypt.compare(code, user.mfaBackupCodes[i]);
      if (isValid) {
        // Supprimer le code utilisé
        const updatedCodes = [...user.mfaBackupCodes];
        updatedCodes.splice(i, 1);

        await prisma.user.update({
          where: { id: userId },
          data: { mfaBackupCodes: updatedCodes },
        });

        return true;
      }
    }

    return false;
  }

  /**
   * Régénère les codes de récupération
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    // Génération de nouveaux codes
    const backupCodes: string[] = [];
    for (let i = 0; i < 10; i++) {
      backupCodes.push(this.generateBackupCode());
    }

    // Hash des codes
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, 10))
    );

    // Mise à jour
    await prisma.user.update({
      where: { id: userId },
      data: { mfaBackupCodes: hashedBackupCodes },
    });

    return backupCodes;
  }

  /**
   * Désactive le MFA pour un utilisateur
   */
  async disableMFA(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
        mfaSetupAt: null,
      },
    });

    // Supprimer tous les appareils de confiance
    await prisma.trustedDevice.deleteMany({
      where: { userId },
    });
  }

  /**
   * Vérifie si un utilisateur a le MFA activé
   */
  async isMFAEnabled(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });

    return user?.mfaEnabled || false;
  }

  /**
   * Obtient le nombre de codes de récupération restants
   */
  async getRemainingBackupCodesCount(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaBackupCodes: true },
    });

    return user?.mfaBackupCodes?.length || 0;
  }
}

export const mfaService = new MFAService();
