import { Response, NextFunction } from 'express';
import { FolderService } from '../services/folderService';
import { AuthRequest } from '../types';
import { sendSuccess, sendCreated } from '../utils/response';
import { ensureDekUnlocked } from '../utils/dekGuard';

export class FolderController {
  static async createFolder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { name, parentId } = req.body;

      const folder = await FolderService.createFolder(userId, name, parentId);
      sendCreated(res, { folder });
    } catch (error) { next(error); }
  }

  static async getFolder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.params;

      const folder = await FolderService.getFolder(folderId, userId);
      sendSuccess(res, { folder });
    } catch (error) { next(error); }
  }

  static async listFolders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { parentId } = req.query;

      const folders = await FolderService.listFolders(
        userId,
        parentId ? String(parentId) : undefined
      );

      sendSuccess(res, { folders });
    } catch (error) { next(error); }
  }

  static async updateFolder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.params;
      const { name } = req.body;

      const folder = await FolderService.updateFolder(folderId, userId, name);
      sendSuccess(res, { folder });
    } catch (error) { next(error); }
  }

  static async moveFolder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.params;
      const { parentId } = req.body;

      const folder = await FolderService.moveFolder(folderId, userId, parentId);
      sendSuccess(res, { folder });
    } catch (error) { next(error); }
  }

  static async deleteFolder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.params;
      const { permanent } = req.query;

      const result = await FolderService.deleteFolder(folderId, userId, permanent === 'true');
      sendSuccess(res, result);
    } catch (error) { next(error); }
  }

  static async restoreFolder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.params;

      const folder = await FolderService.restoreFolder(folderId, userId);
      sendSuccess(res, { folder });
    } catch (error) { next(error); }
  }

  static async getDeletedFolders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const folders = await FolderService.getDeletedFolders(userId);
      sendSuccess(res, { folders });
    } catch (error) { next(error); }
  }

  static async getBreadcrumbs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.params;

      const breadcrumbs = await FolderService.getFolderBreadcrumbs(folderId, userId);
      sendSuccess(res, { breadcrumbs });
    } catch (error) { next(error); }
  }

  static async getFolderTrashContents(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.params;

      const contents = await FolderService.getFolderTrashContents(folderId, userId);
      sendSuccess(res, contents);
    } catch (error) { next(error); }
  }

  static async downloadAsZip(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.params;

      const folder = await FolderService.getFolder(folderId, userId);

      if (folder.userId === userId && !ensureDekUnlocked(req, res)) return;

      const safeName = folder.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}.zip`);

      await FolderService.streamFolderAsZip(folderId, userId, res, req.dekBuffer);
    } catch (error) {
      if (!res.headersSent) {
        next(error);
      }
    }
  }
}
