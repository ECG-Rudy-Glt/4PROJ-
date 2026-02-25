import { Response, Request } from 'express';
import { ShareService } from '../services/shareService';
import { FileService } from '../services/fileService';
import { AuthRequest } from '../types';
import { SocketService } from '../services/socketService';
import fs from 'fs';
import { EncryptionService } from '../services/encryptionService';

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

      res.setHeader('Content-Disposition', `attachment; filename="${shareLink.file!.name}"`);
      res.setHeader('Content-Type', shareLink.file!.mimeType);

      const decryptStream = EncryptionService.getDecryptStream(shareLink.file!.storagePath);
      decryptStream.pipe(res);
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
        // User not found, so generate a share link and email it to them
        const { MailService } = await import('../services/mailService');
        const folder = await prisma.folder.findFirst({
          where: { id: folderId, userId },
        });

        if (!folder) {
          res.status(404).json({ error: 'Dossier non trouvé' });
          return;
        }

        // We can't generate a public share link for a folder directly yet with the current structure
        // But we can inform them to create an account
        const signupLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?email=${encodeURIComponent(targetUserEmail)}`;
        
        await MailService.sendMail({
          to: targetUserEmail,
          subject: `${req.user!.firstName || req.user!.email} souhaite partager un dossier avec vous`,
          text: `Bonjour,\n\n${req.user!.firstName || req.user!.email} souhaite partager le dossier "${folder.name}" avec vous.\n\nCependant, vous n'avez pas encore de compte sur SupFile. Veuillez créer un compte gratuitement via ce lien pour pouvoir y accéder : ${signupLink}\n\nUne fois votre compte créé, demandez à l'utilisateur de vous repartager le dossier.\n\nL'équipe SupFile`,
        });

        res.status(200).json({ 
          message: 'Invitation envoyée à créer un compte', 
          isNewUser: true,
          sharedFolder: null
        });
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

      // Notification temps réel
      SocketService.emitToUser(targetUser.id, 'share_received', {
        type: 'folder',
        item: sharedFolder,
        sharedBy: req.user,
      });

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
        // User not found, so generate a share link and email it to them
        const { MailService } = await import('../services/mailService');
        const file = await prisma.file.findFirst({
          where: { id: fileId, userId, isDeleted: false },
        });

        if (!file) {
          res.status(404).json({ error: 'Fichier non trouvé' });
          return;
        }

        // Generate a public link (7 days expiration)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const shareLink = await ShareService.createShareLink(userId, fileId, { expiresAt });

        const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/share/${shareLink.token}`;
        
        await MailService.sendMail({
          to: targetUserEmail,
          subject: `${req.user!.firstName || req.user!.email} a partagé un fichier avec vous`,
          text: `Bonjour,\n\n${req.user!.firstName || req.user!.email} souhaite partager le fichier "${file.name}" avec vous.\n\nVous n'avez pas encore de compte sur SupFile. Vous pouvez accéder au fichier via ce lien sécurisé (valable 7 jours) : ${inviteLink}\n\nSi vous souhaitez collaborer davantage, n'hésitez pas à créer un compte gratuitement !\n\nL'équipe SupFile`,
        });

        res.status(200).json({ 
          message: 'Invitation envoyée avec succès', 
          isNewUser: true,
          sharedFile: null
        });
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

      res.status(201).json({ sharedFile, isNewUser: false });
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
      const fileSize = stat.size - 32; // IV + auth tag AES-GCM

      const head = {
        'Content-Length': fileSize,
        'Content-Type': sharedFile.file!.mimeType,
      };
      res.writeHead(200, head);
      const decryptStream = EncryptionService.getDecryptStream(sharedFile.file!.storagePath);
      decryptStream.pipe(res);
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

      res.setHeader('Content-Disposition', `attachment; filename="${sharedFile.file!.name}"`);
      res.setHeader('Content-Type', sharedFile.file!.mimeType);

      const decryptStream = EncryptionService.getDecryptStream(sharedFile.file!.storagePath);
      decryptStream.pipe(res);
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

      // Notification au propriétaire
      if (sharedFolder.folder.userId) {
        SocketService.emitToUser(sharedFolder.folder.userId, 'share_accepted', {
          type: 'folder',
          item: sharedFolder,
          acceptedBy: req.user,
        });
      }

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

      // Notification au propriétaire
      if (sharedFile.file.userId) {
        SocketService.emitToUser(sharedFile.file.userId, 'share_accepted', {
          type: 'file',
          item: sharedFile,
          acceptedBy: req.user,
        });
      }

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
