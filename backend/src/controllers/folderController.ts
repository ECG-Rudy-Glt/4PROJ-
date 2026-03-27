import { Response, NextFunction } from 'express';
import { FolderService } from '../services/folderService';
import { AuthRequest } from '../types';

export class FolderController {
  static async createFolder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { name, parentId } = req.body;

      const folder = await FolderService.createFolder(userId, name, parentId);

      res.status(201).json({ folder });
    } catch (error) { next(error); }
  }

  static async getFolder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.params;

      const folder = await FolderService.getFolder(folderId, userId);

      res.status(200).json({ folder });
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

      res.status(200).json({ folders });
    } catch (error) { next(error); }
  }

  static async updateFolder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.params;
      const { name } = req.body;

      const folder = await FolderService.updateFolder(folderId, userId, name);

      res.status(200).json({ folder });
    } catch (error) { next(error); }
  }

  static async moveFolder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.params;
      const { parentId } = req.body;

      const folder = await FolderService.moveFolder(folderId, userId, parentId);

      res.status(200).json({ folder });
    } catch (error) { next(error); }
  }

  static async deleteFolder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.params;

      const result = await FolderService.deleteFolder(folderId, userId);

      res.status(200).json(result);
    } catch (error) { next(error); }
  }

  static async getBreadcrumbs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.params;

      const breadcrumbs = await FolderService.getFolderBreadcrumbs(folderId, userId);

      res.status(200).json({ breadcrumbs });
    } catch (error) { next(error); }
  }
}
