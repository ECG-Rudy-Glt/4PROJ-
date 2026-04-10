import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { TagService } from '../services/tagService';
import { sendSuccess, sendCreated, sendError } from '../utils/response';

export class TagController {
  static async createTag(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { name, color } = req.body;

      if (!name) {
        sendError(res, 'Le nom du tag est requis', 400);
        return;
      }

      const tag = await TagService.createTag(userId, name, color);
      sendCreated(res, { tag });
    } catch (error) { next(error); }
  }

  static async getUserTags(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const tags = await TagService.getUserTags(userId);
      sendSuccess(res, { tags });
    } catch (error) { next(error); }
  }

  static async updateTag(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { tagId } = req.params;
      const { name, color } = req.body;

      const tag = await TagService.updateTag(tagId, userId, name, color);
      sendSuccess(res, { tag });
    } catch (error) { next(error); }
  }

  static async deleteTag(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { tagId } = req.params;

      await TagService.deleteTag(tagId, userId);
      sendSuccess(res, { message: 'Tag supprimé' });
    } catch (error) { next(error); }
  }

  static async addTagToFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;
      const { tagId } = req.body;

      if (!tagId) {
        sendError(res, 'Le tagId est requis', 400);
        return;
      }

      const fileTag = await TagService.addTagToFile(fileId, tagId, userId);
      sendCreated(res, { fileTag });
    } catch (error) { next(error); }
  }

  static async removeTagFromFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId, tagId } = req.params;

      await TagService.removeTagFromFile(fileId, tagId, userId);
      sendSuccess(res, { message: 'Tag retiré du fichier' });
    } catch (error) { next(error); }
  }

  static async getFileTags(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const tags = await TagService.getFileTags(fileId, userId);
      sendSuccess(res, { tags });
    } catch (error) { next(error); }
  }

  static async getFilesByTag(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { tagId } = req.params;

      const files = await TagService.getFilesByTag(tagId, userId);
      sendSuccess(res, { files });
    } catch (error) { next(error); }
  }
}
