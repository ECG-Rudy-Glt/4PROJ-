import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { TagService } from '../services/tagService';

export class TagController {
  // Créer un tag
  static async createTag(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { name, color } = req.body;

      if (!name) {
        res.status(400).json({ error: 'Le nom du tag est requis' });
        return;
      }

      const tag = await TagService.createTag(userId, name, color);
      res.status(201).json({ tag });
    } catch (error) { next(error); }
  }

  // Récupérer tous les tags de l'utilisateur
  static async getUserTags(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const tags = await TagService.getUserTags(userId);
      res.status(200).json({ tags });
    } catch (error) { next(error); }
  }

  // Mettre à jour un tag
  static async updateTag(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { tagId } = req.params;
      const { name, color } = req.body;

      const tag = await TagService.updateTag(tagId, userId, name, color);
      res.status(200).json({ tag });
    } catch (error) { next(error); }
  }

  // Supprimer un tag
  static async deleteTag(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { tagId } = req.params;

      await TagService.deleteTag(tagId, userId);
      res.status(200).json({ message: 'Tag supprimé' });
    } catch (error) { next(error); }
  }

  // Ajouter un tag à un fichier
  static async addTagToFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;
      const { tagId } = req.body;

      if (!tagId) {
        res.status(400).json({ error: 'Le tagId est requis' });
        return;
      }

      const fileTag = await TagService.addTagToFile(fileId, tagId, userId);
      res.status(201).json({ fileTag });
    } catch (error) { next(error); }
  }

  // Retirer un tag d'un fichier
  static async removeTagFromFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId, tagId } = req.params;

      await TagService.removeTagFromFile(fileId, tagId, userId);
      res.status(200).json({ message: 'Tag retiré du fichier' });
    } catch (error) { next(error); }
  }

  // Récupérer tous les tags d'un fichier
  static async getFileTags(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const tags = await TagService.getFileTags(fileId, userId);
      res.status(200).json({ tags });
    } catch (error) { next(error); }
  }

  // Récupérer tous les fichiers avec un tag spécifique
  static async getFilesByTag(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { tagId } = req.params;

      const files = await TagService.getFilesByTag(tagId, userId);
      res.status(200).json({ files });
    } catch (error) { next(error); }
  }
}
