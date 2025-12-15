import prisma from '../config/database';
import { deleteFile } from '../utils/fileUtils';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';

export class FileService {
  static async createFile(
    userId: string,
    name: string,
    originalName: string,
    mimeType: string,
    size: number,
    storagePath: string,
    folderId?: string
  ) {
    // Check quota
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (BigInt(user.quotaUsed) + BigInt(size) > BigInt(user.quotaLimit)) {
      // Delete uploaded file if quota exceeded
      await deleteFile(storagePath);
      throw new Error('Quota exceeded');
    }

    // Create file record
    const file = await prisma.file.create({
      data: {
        name,
        originalName,
        mimeType,
        size: BigInt(size),
        storagePath,
        userId,
        folderId,
      },
      include: {
        folder: true,
      },
    });

    // Update user quota
    await prisma.user.update({
      where: { id: userId },
      data: {
        quotaUsed: BigInt(user.quotaUsed) + BigInt(size),
      },
    });

    return file;
  }

  static async getFile(fileId: string, userId: string) {
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
        isDeleted: false,
      },
      include: {
        folder: true,
      },
    });

    if (!file) {
      throw new Error('File not found');
    }

    return file;
  }

  static async listFiles(userId: string, folderId?: string) {
    return await prisma.file.findMany({
      where: {
        userId,
        folderId: folderId || null,
        isDeleted: false,
      },
      include: {
        folder: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  static async updateFile(fileId: string, userId: string, data: { name?: string }) {
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

    return await prisma.file.update({
      where: { id: fileId },
      data,
    });
  }

  static async moveFile(fileId: string, userId: string, targetFolderId?: string) {
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

    // Verify target folder exists and belongs to user
    if (targetFolderId) {
      const targetFolder = await prisma.folder.findFirst({
        where: {
          id: targetFolderId,
          userId,
        },
      });

      if (!targetFolder) {
        throw new Error('Target folder not found');
      }
    }

    return await prisma.file.update({
      where: { id: fileId },
      data: {
        folderId: targetFolderId || null,
      },
    });
  }

  static async deleteFile(fileId: string, userId: string, permanent: boolean = false) {
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
      },
    });

    if (!file) {
      throw new Error('File not found');
    }

    if (permanent || file.isDeleted) {
      // Permanently delete
      await deleteFile(file.storagePath);
      await prisma.file.delete({
        where: { id: fileId },
      });

      // Update user quota
      await prisma.user.update({
        where: { id: userId },
        data: {
          quotaUsed: {
            decrement: file.size,
          },
        },
      });
    } else {
      // Move to trash
      await prisma.file.update({
        where: { id: fileId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });
    }

    return { message: 'File deleted successfully' };
  }

  static async restoreFile(fileId: string, userId: string) {
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
        isDeleted: true,
      },
    });

    if (!file) {
      throw new Error('File not found in trash');
    }

    return await prisma.file.update({
      where: { id: fileId },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    });
  }

  static async getDeletedFiles(userId: string) {
    return await prisma.file.findMany({
      where: {
        userId,
        isDeleted: true,
      },
      orderBy: {
        deletedAt: 'desc',
      },
    });
  }

  static async searchFiles(userId: string, query: string, filters?: {
    mimeType?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    const where: any = {
      userId,
      isDeleted: false,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { originalName: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (filters?.mimeType) {
      where.mimeType = { startsWith: filters.mimeType };
    }

    if (filters?.dateFrom) {
      where.createdAt = { ...where.createdAt, gte: filters.dateFrom };
    }

    if (filters?.dateTo) {
      where.createdAt = { ...where.createdAt, lte: filters.dateTo };
    }

    return await prisma.file.findMany({
      where,
      include: {
        folder: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  static async getRecentFiles(userId: string, limit: number = 5) {
    return await prisma.file.findMany({
      where: {
        userId,
        isDeleted: false,
      },
      include: {
        folder: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
    });
  }

  static async toggleFavorite(fileId: string, userId: string) {
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
        isDeleted: false,
      },
    });

    if (!file) {
      throw new Error('Fichier introuvable');
    }

    const updatedFile = await prisma.file.update({
      where: { id: fileId },
      data: {
        isFavorite: !file.isFavorite,
      },
      include: {
        folder: true,
      },
    });

    return updatedFile;
  }

  static async getFavoriteFiles(userId: string) {
    return await prisma.file.findMany({
      where: {
        userId,
        isDeleted: false,
        isFavorite: true,
      },
      include: {
        folder: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }
}
