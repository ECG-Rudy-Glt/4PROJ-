import { Response, Request } from 'express';
import { ShareService } from '../services/shareService';
import { FileService } from '../services/fileService';
import { AuthRequest } from '../types';
import fs from 'fs';

export class ShareController {
  static async createShareLink(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId, password, expiresAt, maxDownloads } = req.body;

      const shareLink = await ShareService.createShareLink(userId, fileId, {
        password,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        maxDownloads,
      });

      res.status(201).json({
        shareLink: {
          id: shareLink.id,
          token: shareLink.token,
          fileId: shareLink.fileId,
          expiresAt: shareLink.expiresAt,
          maxDownloads: shareLink.maxDownloads,
          downloads: shareLink.downloads,
          url: `${process.env.FRONTEND_URL}/share/${shareLink.token}`,
        },
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getSharedFile(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const { password } = req.query;

      const shareLink = await ShareService.getShareLink(
        token,
        password ? String(password) : undefined
      );

      res.status(200).json({
        file: {
          id: shareLink.file!.id,
          name: shareLink.file!.name,
          mimeType: shareLink.file!.mimeType,
          size: Number(shareLink.file!.size),
          createdAt: shareLink.file!.createdAt,
        },
        sharedBy: shareLink.user,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async downloadSharedFile(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const { password } = req.query;

      const shareLink = await ShareService.getShareLink(
        token,
        password ? String(password) : undefined
      );

      if (!fs.existsSync(shareLink.file!.storagePath)) {
        res.status(404).json({ error: 'File not found on disk' });
        return;
      }

      // Increment download count
      await ShareService.incrementDownloadCount(token);

      res.download(shareLink.file!.storagePath, shareLink.file!.name);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async listUserShareLinks(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const shareLinks = await ShareService.listUserShareLinks(userId);

      res.status(200).json({
        shareLinks: shareLinks.map((link) => ({
          id: link.id,
          token: link.token,
          fileId: link.fileId,
          fileName: link.file?.name,
          expiresAt: link.expiresAt,
          maxDownloads: link.maxDownloads,
          downloads: link.downloads,
          password: !!link.password, // true/false indicator
          createdAt: link.createdAt,
          url: `${process.env.FRONTEND_URL}/share/${link.token}`,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteShareLink(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { linkId } = req.params;

      const result = await ShareService.deleteShareLink(linkId, userId);

      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async shareFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId, targetUserEmail, canRead, canWrite, canDelete, canShare } = req.body;

      // Find target user by email
      const prisma = (await import('../config/database')).default;
      const targetUser = await prisma.user.findUnique({
        where: { email: targetUserEmail },
      });

      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const sharedFolder = await ShareService.shareFolder(
        userId,
        folderId,
        targetUser.id,
        {
          canRead,
          canWrite,
          canDelete,
          canShare,
        }
      );

      res.status(201).json({ sharedFolder });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async listSharedWithMe(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const sharedFolders = await ShareService.listSharedWithMe(userId);

      res.status(200).json({ sharedFolders });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async listSharedByMe(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const sharedFolders = await ShareService.listSharedByMe(userId);

      res.status(200).json({ sharedFolders });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateSharedFolderPermissions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;
      const { canRead, canWrite, canDelete, canShare } = req.body;

      const sharedFolder = await ShareService.updateSharedFolderPermissions(
        shareId,
        userId,
        {
          canRead,
          canWrite,
          canDelete,
          canShare,
        }
      );

      res.status(200).json({ sharedFolder });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async removeSharedFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;

      const result = await ShareService.removeSharedFolder(shareId, userId);

      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // File sharing controllers
  static async shareFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId, targetUserEmail, canRead, canWrite, canDelete, canShare } = req.body;

      // Find target user by email
      const prisma = (await import('../config/database')).default;
      const targetUser = await prisma.user.findUnique({
        where: { email: targetUserEmail },
      });

      if (!targetUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const sharedFile = await ShareService.shareFile(
        userId,
        fileId,
        targetUser.id,
        {
          canRead,
          canWrite,
          canDelete,
          canShare,
        }
      );

      res.status(201).json({ sharedFile });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async listFilesSharedWithMe(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const sharedFiles = await ShareService.listFilesSharedWithMe(userId);

      res.status(200).json({ sharedFiles });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async listFilesSharedByMe(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const sharedFiles = await ShareService.listFilesSharedByMe(userId);

      res.status(200).json({ sharedFiles });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getFileShares(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const shares = await ShareService.getFileShares(fileId, userId);

      res.status(200).json({ shares });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async updateSharedFilePermissions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;
      const { canRead, canWrite, canDelete, canShare } = req.body;

      const sharedFile = await ShareService.updateSharedFilePermissions(
        shareId,
        userId,
        {
          canRead,
          canWrite,
          canDelete,
          canShare,
        }
      );

      res.status(200).json({ sharedFile });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async removeSharedFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;

      const result = await ShareService.removeSharedFile(shareId, userId);

      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // Access shared file (stream for authenticated users with read permission)
  static async streamSharedFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const sharedFile = await ShareService.getSharedFileAccess(fileId, userId);

      if (!fs.existsSync(sharedFile.file!.storagePath)) {
        res.status(404).json({ error: 'File not found on disk' });
        return;
      }

      const stat = fs.statSync(sharedFile.file!.storagePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;
        const fileStream = fs.createReadStream(sharedFile.file!.storagePath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': sharedFile.file!.mimeType,
        };
        res.writeHead(206, head);
        fileStream.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': sharedFile.file!.mimeType,
        };
        res.writeHead(200, head);
        fs.createReadStream(sharedFile.file!.storagePath).pipe(res);
      }
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }

  // Download shared file (for authenticated users with read permission)
  static async downloadSharedFileAuth(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const sharedFile = await ShareService.getSharedFileAccess(fileId, userId);

      if (!fs.existsSync(sharedFile.file!.storagePath)) {
        res.status(404).json({ error: 'File not found on disk' });
        return;
      }

      res.download(sharedFile.file!.storagePath, sharedFile.file!.name);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }

  // Get pending shares (not accepted yet)
  static async getPendingShares(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const pendingShares = await ShareService.getPendingShares(userId);
      res.status(200).json(pendingShares);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // Accept a shared folder
  static async acceptSharedFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;

      const sharedFolder = await ShareService.acceptSharedFolder(shareId, userId);
      res.status(200).json({ message: 'Partage accepté', sharedFolder });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // Accept a shared file
  static async acceptSharedFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;

      const sharedFile = await ShareService.acceptSharedFile(shareId, userId);
      res.status(200).json({ message: 'Partage accepté', sharedFile });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // Reject a shared folder
  static async rejectSharedFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;

      await ShareService.rejectSharedFolder(shareId, userId);
      res.status(200).json({ message: 'Partage rejeté' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // Reject a shared file
  static async rejectSharedFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { shareId } = req.params;

      await ShareService.rejectSharedFile(shareId, userId);
      res.status(200).json({ message: 'Partage rejeté' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
