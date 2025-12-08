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
          url: `${process.env.API_URL}/api/share/${shareLink.token}`,
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
          createdAt: link.createdAt,
          url: `${process.env.API_URL}/api/share/${link.token}`,
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
      const { folderId, targetUserEmail, canEdit } = req.body;

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
        canEdit
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
}
