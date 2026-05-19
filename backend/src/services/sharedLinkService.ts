import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { AuditService } from './auditService';
import { PlanService } from './planService';
import logger from '../config/logger';
import { AppError } from '../middlewares/errorHandler';

export class SharedLinkService {
  static async assertShareLimit(userId: string) {
    const now = new Date();
    const [linksCount, sharedFilesCount, sharedFoldersCount] = await Promise.all([
      prisma.sharedLink.count({
        where: {
          userId,
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
      }),
      prisma.sharedFile.count({ where: { sharedById: userId } }),
      prisma.sharedFolder.count({ where: { sharedById: userId } }),
    ]);

    const currentCount = linksCount + sharedFilesCount + sharedFoldersCount;
    await PlanService.assertLimit(userId, 'maxShares', currentCount);
  }

  static async createShareLink(
    userId: string,
    fileId: string,
    options?: { password?: string; expiresAt?: Date; maxDownloads?: number; ownerWrappedDek?: string }
  ) {
    const file = await prisma.file.findFirst({
      where: { id: fileId, userId, isDeleted: false },
    });

    if (!file) throw new Error('File not found');
    if (file.isVault) throw new Error('Le partage public est interdit pour les fichiers du coffre-fort');

    await this.assertShareLimit(userId);

    let hashedPassword: string | undefined;
    if (options?.password) {
      await PlanService.assertFeature(userId, 'sharePassword');
      hashedPassword = await bcrypt.hash(options.password, 10);
    }

    const shareLink = await prisma.sharedLink.create({
      data: {
        token: uuidv4(),
        fileId,
        userId,
        password: hashedPassword,
        expiresAt: options?.expiresAt,
        maxDownloads: options?.maxDownloads,
        ownerWrappedDek: options?.ownerWrappedDek,
      },
      include: { file: true },
    });

    AuditService.createLog(userId, 'SHARE', {
      fileName: file.name,
      fileId,
      shareToken: shareLink.token,
    }).catch((e) => logger.error(e));

    return shareLink;
  }

  static async getShareLink(token: string, password?: string) {
    const shareLink = await prisma.sharedLink.findUnique({
      where: { token },
      include: {
        file: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true, accountStatus: true } },
      },
    });

    if (!shareLink) {
      throw new AppError(
        404,
        'Lien de partage introuvable ou révoqué.',
        'SHARE_LINK_NOT_FOUND'
      );
    }
    if (shareLink.user.accountStatus !== 'ACTIVE') throw new Error('Share link is unavailable');
    if (!shareLink.bundleFileIds) {
      if (shareLink.folderId || !shareLink.file) throw new Error('Public folder links are not supported');
      if (shareLink.file.isDeleted) throw new Error('Share link is unavailable');
    }
    if (shareLink.file?.isVault) throw new Error('Le partage public est interdit pour les fichiers du coffre-fort');
    if (shareLink.expiresAt && shareLink.expiresAt < new Date()) throw new Error('Share link has expired');
    if (shareLink.maxDownloads && shareLink.downloads >= shareLink.maxDownloads) throw new Error('Share link download limit reached');

    if (shareLink.password) {
      if (!password) throw new Error('Password required');
      const isValid = await bcrypt.compare(password, shareLink.password);
      if (!isValid) throw new Error('Invalid password');
    }

    return shareLink;
  }

  static async incrementDownloadCount(token: string) {
    await prisma.sharedLink.update({
      where: { token },
      data: { downloads: { increment: 1 } },
    });
  }

  static async listUserShareLinks(userId: string) {
    return prisma.sharedLink.findMany({
      where: { userId },
      include: { file: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async createBundleShareLink(
    userId: string,
    fileIds: string[],
    options?: { password?: string; expiresAt?: Date; maxDownloads?: number; ownerWrappedDek?: string }
  ) {
    if (!fileIds || fileIds.length === 0) throw new Error('Au moins un fichier est requis');

    const files = await prisma.file.findMany({
      where: { id: { in: fileIds }, userId, isDeleted: false },
    });

    if (files.length !== fileIds.length) throw new Error('Un ou plusieurs fichiers sont introuvables');
    if (files.some((f) => f.isVault)) throw new Error('Le partage public est interdit pour les fichiers du coffre-fort');

    await this.assertShareLimit(userId);

    let hashedPassword: string | undefined;
    if (options?.password) {
      await PlanService.assertFeature(userId, 'sharePassword');
      hashedPassword = await bcrypt.hash(options.password, 10);
    }

    const shareLink = await prisma.sharedLink.create({
      data: {
        token: uuidv4(),
        bundleFileIds: JSON.stringify(fileIds),
        userId,
        password: hashedPassword,
        expiresAt: options?.expiresAt,
        maxDownloads: options?.maxDownloads,
        ownerWrappedDek: options?.ownerWrappedDek,
      },
    });

    AuditService.createLog(userId, 'SHARE', {
      bundleFileIds: fileIds,
      shareToken: shareLink.token,
    }).catch((e) => logger.error(e));

    return shareLink;
  }

  static async getBundleShareLink(token: string, password?: string) {
    const shareLink = await prisma.sharedLink.findUnique({
      where: { token },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, accountStatus: true } },
      },
    });

    if (!shareLink || !shareLink.bundleFileIds) throw new Error('Bundle share link not found');
    if (shareLink.user.accountStatus !== 'ACTIVE') throw new Error('Share link is unavailable');
    if (shareLink.expiresAt && shareLink.expiresAt < new Date()) throw new Error('Share link has expired');
    if (shareLink.maxDownloads && shareLink.downloads >= shareLink.maxDownloads) throw new Error('Share link download limit reached');

    if (shareLink.password) {
      if (!password) throw new Error('Password required');
      const isValid = await bcrypt.compare(password, shareLink.password);
      if (!isValid) throw new Error('Invalid password');
    }

    const fileIds: string[] = JSON.parse(shareLink.bundleFileIds);
    const files = await prisma.file.findMany({
      where: { id: { in: fileIds }, isDeleted: false },
    });
    if (files.length !== fileIds.length) {
      throw new Error('One or more shared files are no longer available');
    }
    if (files.some((file) => file.isVault)) {
      throw new Error('Le partage public est interdit pour les fichiers du coffre-fort');
    }

    return { shareLink, files };
  }

  static async deleteShareLink(linkId: string, userId: string) {
    const shareLink = await prisma.sharedLink.findFirst({
      where: { id: linkId, userId },
    });

    if (!shareLink) {
      throw new AppError(
        404,
        'Lien de partage introuvable ou révoqué.',
        'SHARE_LINK_NOT_FOUND'
      );
    }

    await prisma.sharedLink.delete({ where: { id: linkId } });
    return { message: 'Share link deleted successfully' };
  }
}
