import prisma from '../config/database';
import logger from '../config/logger';
import { KekService } from './kekService';

type ShareWithOwnerDek = {
  ownerWrappedDek?: string | null;
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

  static stripOwnerWrappedDek<T extends ShareWithOwnerDek>(share: T): Omit<T, 'ownerWrappedDek'> {
    const { ownerWrappedDek, ...safeShare } = share;
    return safeShare;
  }

  static stripOwnerWrappedDekMany<T extends ShareWithOwnerDek>(shares: T[]): Array<Omit<T, 'ownerWrappedDek'>> {
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
