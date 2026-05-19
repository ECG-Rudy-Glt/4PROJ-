import { Response, NextFunction } from 'express';
import { VersionService } from '../services/versionService';
import { AuthRequest } from '../types';

export class VersionController {
  static async getFileVersions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const versions = await VersionService.getFileVersions(fileId, userId);

      res.status(200).json({ versions });
    } catch (error) { next(error); }
  }

  static async restoreVersion(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId, versionId } = req.params;

      const file = await VersionService.restoreVersion(versionId, fileId, userId, req.dekBuffer);

      res.status(200).json({ file, message: 'Version restaurée' });
    } catch (error) { next(error); }
  }

  static async deleteVersion(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId, versionId } = req.params;

      const result = await VersionService.deleteVersion(versionId, fileId, userId);

      res.status(200).json(result);
    } catch (error) { next(error); }
  }
}
