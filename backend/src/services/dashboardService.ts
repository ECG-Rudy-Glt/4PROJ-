import prisma from '../config/database';
import { getMimeTypeCategory } from '../utils/fileUtils';
import { FileStats, DashboardData } from '../types';

export class DashboardService {
  static async getDashboardData(userId: string): Promise<DashboardData> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get file statistics
    const files = await prisma.file.findMany({
      where: {
        userId,
        isDeleted: false,
      },
    });

    const fileStats: FileStats = {
      totalFiles: files.length,
      totalSize: 0,
      byMimeType: {},
    };

    files.forEach((file) => {
      const size = Number(file.size);
      fileStats.totalSize += size;

      const category = getMimeTypeCategory(file.mimeType);

      if (!fileStats.byMimeType[category]) {
        fileStats.byMimeType[category] = {
          count: 0,
          size: 0,
        };
      }

      fileStats.byMimeType[category].count += 1;
      fileStats.byMimeType[category].size += size;
    });

    // Get recent files
    const recentFiles = await prisma.file.findMany({
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
      take: 5,
    });

    return {
      quotaUsed: Number(user.quotaUsed),
      quotaLimit: Number(user.quotaLimit),
      fileStats,
      recentFiles: recentFiles.map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: Number(file.size),
        updatedAt: file.updatedAt,
        folder: file.folder
          ? {
              id: file.folder.id,
              name: file.folder.name,
            }
          : null,
      })),
    };
  }
}
