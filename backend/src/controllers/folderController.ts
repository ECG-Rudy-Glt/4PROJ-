import { Response } from 'express';
import { FolderService } from '../services/folderService';
import { AuthRequest } from '../types';

export class FolderController {
  static async createFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { name, parentId } = req.body;

      const folder = await FolderService.createFolder(userId, name, parentId);

      res.status(201).json({ folder });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.params;

      const folder = await FolderService.getFolder(folderId, userId);

      res.status(200).json({ folder });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }

  static async listFolders(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { parentId } = req.query;

      const folders = await FolderService.listFolders(
        userId,
        parentId ? String(parentId) : undefined
      );

      res.status(200).json({ folders });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.params;
      const { name } = req.body;

      const folder = await FolderService.updateFolder(folderId, userId, name);

      res.status(200).json({ folder });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async moveFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.params;
      const { parentId } = req.body;

      const folder = await FolderService.moveFolder(folderId, userId, parentId);

      res.status(200).json({ folder });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async deleteFolder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.params;

      const result = await FolderService.deleteFolder(folderId, userId);

      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getBreadcrumbs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.params;

      const breadcrumbs = await FolderService.getFolderBreadcrumbs(folderId, userId);

      res.status(200).json({ breadcrumbs });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }
}
