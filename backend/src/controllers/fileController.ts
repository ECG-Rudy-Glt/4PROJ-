import { Response } from 'express';
import { FileService } from '../services/fileService';
import { AuthRequest, FileUploadRequest } from '../types';
import fs from 'fs';
import path from 'path';

export class FileController {
  static async uploadFile(req: FileUploadRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.body;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const newFile = await FileService.createFile(
        userId,
        file.originalname,
        file.originalname,
        file.mimetype,
        file.size,
        file.path,
        folderId
      );

      res.status(201).json({ file: newFile });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const file = await FileService.getFile(fileId, userId);

      res.status(200).json({ file });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }

  static async listFiles(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId, sortBy, sortOrder } = req.query;

      const files = await FileService.listFiles(
        userId,
        folderId ? String(folderId) : undefined,
        sortBy ? String(sortBy) : 'createdAt',
        sortOrder === 'asc' ? 'asc' : 'desc'
      );

      res.status(200).json({ files });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;
      const { name } = req.body;

      const file = await FileService.updateFile(fileId, userId, { name });

      res.status(200).json({ file });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async moveFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;
      const { folderId } = req.body;

      const file = await FileService.moveFile(fileId, userId, folderId);

      res.status(200).json({ file });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async deleteFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;
      const { permanent } = req.query;

      const result = await FileService.deleteFile(
        fileId,
        userId,
        permanent === 'true'
      );

      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async restoreFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const file = await FileService.restoreFile(fileId, userId);

      res.status(200).json({ file });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getDeletedFiles(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const files = await FileService.getDeletedFiles(userId);

      res.status(200).json({ files });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async downloadFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const file = await FileService.getFile(fileId, userId);

      if (!fs.existsSync(file.storagePath)) {
        res.status(404).json({ error: 'File not found on disk' });
        return;
      }

      res.download(file.storagePath, file.name);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }

  static async streamFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const file = await FileService.getFile(fileId, userId);

      if (!fs.existsSync(file.storagePath)) {
        res.status(404).json({ error: 'File not found on disk' });
        return;
      }

      const stat = fs.statSync(file.storagePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;
        const fileStream = fs.createReadStream(file.storagePath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': file.mimeType,
        };
        res.writeHead(206, head);
        fileStream.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': file.mimeType,
        };
        res.writeHead(200, head);
        fs.createReadStream(file.storagePath).pipe(res);
      }
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }

  static async searchFiles(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { q, mimeType, dateFrom, dateTo } = req.query;

      if (!q) {
        res.status(400).json({ error: 'Query parameter required' });
        return;
      }

      const files = await FileService.searchFiles(userId, String(q), {
        mimeType: mimeType ? String(mimeType) : undefined,
        dateFrom: dateFrom ? new Date(String(dateFrom)) : undefined,
        dateTo: dateTo ? new Date(String(dateTo)) : undefined,
      });

      res.status(200).json({ files });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async toggleFavorite(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const file = await FileService.toggleFavorite(fileId, userId);

      res.status(200).json({ file });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getFavoriteFiles(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const files = await FileService.getFavoriteFiles(userId);

      res.status(200).json({ files });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getAcceptedShares(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const shares = await FileService.getAcceptedShares(userId);

      res.status(200).json(shares);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
