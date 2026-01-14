import { Response } from 'express';
import { FileService } from '../services/fileService';
import { AuthRequest, FileUploadRequest } from '../types';
import fs from 'fs';
import path from 'path';
import { EncryptionService } from '../services/encryptionService';

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
      const { folderId, sortBy, sortOrder, minSize, maxSize, mimeType, dateFrom, dateTo } = req.query;

      const filters = {
        minSize: minSize ? Number(minSize) : undefined,
        maxSize: maxSize ? Number(maxSize) : undefined,
        mimeType: mimeType ? String(mimeType) : undefined,
        dateFrom: dateFrom ? new Date(String(dateFrom)) : undefined,
        dateTo: dateTo ? new Date(String(dateTo)) : undefined,
      };

      const files = await FileService.listFiles(
        userId,
        folderId ? String(folderId) : undefined,
        sortBy ? String(sortBy) : 'createdAt',
        sortOrder === 'asc' ? 'asc' : 'desc',
        filters
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

      // Decrypt and stream
      res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
      res.setHeader('Content-Type', file.mimeType);

      const decryptStream = EncryptionService.getDecryptStream(file.storagePath);
      decryptStream.pipe(res);
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
      // Decrypted size is roughly original size (minus IV/AuthTag if stored in file).
      // We stored IV (16) + Tag (16) = 32 bytes overhead.
      const fileSize = stat.size - 32;

      // Support simple streaming (no range for encrypted files in MVP)
      const head = {
        'Content-Length': fileSize,
        'Content-Type': file.mimeType,
      };
      res.writeHead(200, head);

      const decryptStream = EncryptionService.getDecryptStream(file.storagePath);
      decryptStream.pipe(res);
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
