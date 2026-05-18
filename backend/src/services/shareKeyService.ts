import prisma from '../config/database';
import logger from '../config/logger';
import { KekService } from './kekService';

type ShareWithOwnerDek = {
  ownerWrappedDek?: string | null;
  passwordHash?: string | null;
};

export class ShareKeyService {
  static wrapOwnerDek(dek?: Buffer): string | undefined {
    return dek ? KekService.wrapDek(dek) : undefined;
  }

  static unwrapOwnerDek(ownerWrappedDek?: string | null): Buffer | undefined {
    if (!ownerWrappedDek) return undefined;

    const dek = KekService.unwrapDek(ownerWrappedDek);
    if (!dek) {
      logger.warn('[ShareKeyService] Unable to unwrap shared owner DEK');
      return undefined;
    }

    return dek;
  }

  static stripOwnerWrappedDek<T extends ShareWithOwnerDek>(share: T): Omit<T, 'ownerWrappedDek' | 'passwordHash'> & { passwordProtected?: boolean } {
    const { ownerWrappedDek, passwordHash, ...safeShare } = share as any;

    if (passwordHash !== undefined) {
      return {
        ...safeShare,
        passwordProtected: !!passwordHash
      };
    }

    return safeShare;
  }

  static stripOwnerWrappedDekMany<T extends ShareWithOwnerDek>(shares: T[]): Array<Omit<T, 'ownerWrappedDek' | 'passwordHash'> & { passwordProtected?: boolean }> {
    return shares.map((share) => this.stripOwnerWrappedDek(share));
  }

  static async backfillOwnerShareKeys(userId: string, ownerWrappedDek?: string): Promise<void> {
    if (!ownerWrappedDek) return;

    await Promise.all([
      prisma.sharedFolder.updateMany({
        where: { sharedById: userId, ownerWrappedDek: null },
        data: { ownerWrappedDek },
      }),
      prisma.sharedFile.updateMany({
        where: { sharedById: userId, ownerWrappedDek: null },
        data: { ownerWrappedDek },
      }),
      prisma.sharedLink.updateMany({
        where: { userId, ownerWrappedDek: null },
        data: { ownerWrappedDek },
      }),
    ]);
  }
}
