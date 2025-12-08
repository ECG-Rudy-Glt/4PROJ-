import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export class ShareService {
  static async createShareLink(
    userId: string,
    fileId: string,
    options?: {
      password?: string;
      expiresAt?: Date;
      maxDownloads?: number;
    }
  ) {
    // Verify file belongs to user
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
        isDeleted: false,
      },
    });

    if (!file) {
      throw new Error('File not found');
    }

    // Hash password if provided
    let hashedPassword: string | undefined;
    if (options?.password) {
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
      },
      include: {
        file: true,
      },
    });

    return shareLink;
  }

  static async getShareLink(token: string, password?: string) {
    const shareLink = await prisma.sharedLink.findUnique({
      where: { token },
      include: {
        file: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!shareLink) {
      throw new Error('Share link not found');
    }

    // Check expiration
    if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
      throw new Error('Share link has expired');
    }

    // Check max downloads
    if (shareLink.maxDownloads && shareLink.downloads >= shareLink.maxDownloads) {
      throw new Error('Share link download limit reached');
    }

    // Check password
    if (shareLink.password) {
      if (!password) {
        throw new Error('Password required');
      }
      const isValid = await bcrypt.compare(password, shareLink.password);
      if (!isValid) {
        throw new Error('Invalid password');
      }
    }

    return shareLink;
  }

  static async incrementDownloadCount(token: string) {
    await prisma.sharedLink.update({
      where: { token },
      data: {
        downloads: {
          increment: 1,
        },
      },
    });
  }

  static async listUserShareLinks(userId: string) {
    return await prisma.sharedLink.findMany({
      where: { userId },
      include: {
        file: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  static async deleteShareLink(linkId: string, userId: string) {
    const shareLink = await prisma.sharedLink.findFirst({
      where: {
        id: linkId,
        userId,
      },
    });

    if (!shareLink) {
      throw new Error('Share link not found');
    }

    await prisma.sharedLink.delete({
      where: { id: linkId },
    });

    return { message: 'Share link deleted successfully' };
  }

  static async shareFolder(
    userId: string,
    folderId: string,
    targetUserId: string,
    canEdit: boolean = false
  ) {
    // Verify folder belongs to user
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // Check if already shared
    const existing = await prisma.sharedFolder.findFirst({
      where: {
        folderId,
        sharedWithId: targetUserId,
      },
    });

    if (existing) {
      throw new Error('Folder already shared with this user');
    }

    return await prisma.sharedFolder.create({
      data: {
        folderId,
        sharedById: userId,
        sharedWithId: targetUserId,
        canEdit,
      },
      include: {
        sharedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        sharedWith: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  static async listSharedWithMe(userId: string) {
    return await prisma.sharedFolder.findMany({
      where: {
        sharedWithId: userId,
      },
      include: {
        sharedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  static async listSharedByMe(userId: string) {
    return await prisma.sharedFolder.findMany({
      where: {
        sharedById: userId,
      },
      include: {
        sharedWith: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  static async removeSharedFolder(shareId: string, userId: string) {
    const sharedFolder = await prisma.sharedFolder.findFirst({
      where: {
        id: shareId,
        sharedById: userId,
      },
    });

    if (!sharedFolder) {
      throw new Error('Shared folder not found');
    }

    await prisma.sharedFolder.delete({
      where: { id: shareId },
    });

    return { message: 'Shared folder removed successfully' };
  }
}
