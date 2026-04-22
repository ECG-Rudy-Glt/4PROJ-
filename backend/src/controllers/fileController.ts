import { Response, NextFunction } from 'express';
import { FileService } from '../services/fileService';
import { AuthRequest, FileUploadRequest } from '../types';
import fs from 'fs';
import path from 'path';
import { EncryptionService } from '../services/encryptionService';
import { StorageService } from '../services/storageService';
import { AuditService } from '../services/auditService';
import { NotificationService } from '../services/notificationService';
import prisma from '../config/database';
import logger from '../config/logger';

export class FileController {
  static async uploadFile(req: FileUploadRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { folderId } = req.body;
      const files = Array.isArray(req.files)
        ? req.files
        : req.file
          ? [req.file]
          : [];

      if (files.length === 0) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const { files: createdFiles, errors } = await FileService.createFiles(
        userId,
        files,
        folderId
      );

      if (createdFiles.length === 0) {
        res.status(400).json({
          error: errors[0]?.error || 'Upload failed',
          errors,
        });
        return;
      }

      // Vérifier si l'utilisateur dépasse 90% de son quota
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { quotaUsed: true, quotaLimit: true },
      });
      if (user) {
        const usage = Number(user.quotaUsed) / Number(user.quotaLimit);
        if (usage >= 0.9) {
          NotificationService.create(
            userId,
            'QUOTA',
            'notifications.quota.title',
            'notifications.quota.message',
            { usage: Math.round(usage * 100), quotaUsed: Number(user.quotaUsed), quotaLimit: Number(user.quotaLimit) }
          ).catch((e) => logger.error(e));
        }
      }

      const hasPartialFailures = errors.length > 0;
      res.status(hasPartialFailures ? 207 : 201).json({
        file: createdFiles[0],
        files: createdFiles,
        errors,
        summary: {
          total: files.length,
          success: createdFiles.length,
          failed: errors.length,
        },
      });
    } catch (error) { next(error); }
  }

  static async getFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const file = await FileService.getFile(fileId, userId);

      // Increment view count (async, don't wait)
      FileService.incrementViewCount(fileId).catch((e) => logger.error(e));

      res.status(200).json({ file });
    } catch (error) { next(error); }
  }

  static async listFiles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
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
    } catch (error) { next(error); }
  }

  static async updateFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;
      const { name } = req.body;

      const file = await FileService.updateFile(fileId, userId, { name });

      res.status(200).json({ file });
    } catch (error) { next(error); }
  }

  static async moveFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;
      const { folderId } = req.body;

      const file = await FileService.moveFile(fileId, userId, folderId);

      res.status(200).json({ file });
    } catch (error) { next(error); }
  }

  static async deleteFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
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
    } catch (error) { next(error); }
  }

  static async restoreFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const file = await FileService.restoreFile(fileId, userId);

      res.status(200).json({ file });
    } catch (error) { next(error); }
  }

  static async getDeletedFiles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const files = await FileService.getDeletedFiles(userId);

      res.status(200).json({ files });
    } catch (error) { next(error); }
  }

  static async downloadFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const file = await FileService.getFile(fileId, userId);

      // Vérifier l'existence selon la source (S3 ou local)
      if (!StorageService.isS3Key(file.storagePath) && !fs.existsSync(file.storagePath)) {
        res.status(404).json({ error: 'File not found on disk' });
        return;
      }

      // Increment download count
      FileService.incrementDownloadCount(fileId).catch((e) => logger.error(e));

      // Audit log
      AuditService.createLog(userId, 'DOWNLOAD', {
        fileName: file.name,
        fileId: file.id,
      }).catch((e) => logger.error(e));

      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
      res.setHeader('Content-Type', file.mimeType);

      const decryptStream = await EncryptionService.getDecryptStreamAuto(file.storagePath);
      decryptStream.on('error', (err) => {
        logger.error({ err }, '[downloadFile] decrypt error:');
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to download file' });
        } else {
          res.destroy();
        }
      });
      decryptStream.pipe(res);
    } catch (error) {
      if (!res.headersSent) {
        next(error);
      }
    }
  }

  static async streamFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const file = await FileService.getFile(fileId, userId);

      if (!StorageService.isS3Key(file.storagePath) && !fs.existsSync(file.storagePath)) {
        res.status(404).json({ error: 'File not found on disk' });
        return;
      }

      // Increment view count for streams/previews
      FileService.incrementViewCount(fileId).catch((e) => logger.error(e));

      const ENCRYPTION_OVERHEAD_BYTES = 32;
      let encryptedSize: number;
      if (StorageService.isS3Key(file.storagePath)) {
        encryptedSize = await StorageService.getObjectSize(file.storagePath);
      } else {
        const stat = fs.statSync(file.storagePath);
        encryptedSize = stat.size;
      }

      if (encryptedSize < ENCRYPTION_OVERHEAD_BYTES) {
        logger.error({ fileId: file.id, storagePath: file.storagePath, encryptedSize }, '[streamFile] invalid encrypted file size');
        res.status(500).json({ error: 'Stored file is invalid or corrupted' });
        return;
      }

      const decryptedSize = encryptedSize - ENCRYPTION_OVERHEAD_BYTES;
      const rangeHeader = req.headers.range;

      const decryptStream = await EncryptionService.getDecryptStreamAuto(file.storagePath);
      decryptStream.on('error', (err) => {
        logger.error({ err }, '[streamFile] decrypt error:');
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream file' });
        } else {
          res.destroy();
        }
      });

      if (rangeHeader) {
        // Range request — requis par les players vidéo/audio (expo-video, AVFoundation, ExoPlayer)
        // Le stream décrypté démarre toujours à l'octet 0 : on skip les octets avant `start`
        // et on ne transmet que `chunkSize` octets.
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end   = parts[1] ? Math.min(parseInt(parts[1], 10), decryptedSize - 1) : decryptedSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
          'Content-Range':  `bytes ${start}-${end}/${decryptedSize}`,
          'Accept-Ranges':  'bytes',
          'Content-Length': chunkSize,
          'Content-Type':   file.mimeType,
        });

        // Transform stream : skip `start` octets puis émet exactement `chunkSize` octets
        let skipped = 0;
        let sent    = 0;
        const { Transform } = await import('stream');
        const rangeFilter = new Transform({
          transform(chunk: Buffer, _enc, cb) {
            if (sent >= chunkSize) { cb(); return; }

            let offset = 0;

            // Phase skip
            if (skipped < start) {
              const toSkip = Math.min(start - skipped, chunk.length);
              offset   += toSkip;
              skipped  += toSkip;
            }

            // Phase emit
            if (skipped >= start && offset < chunk.length) {
              const available = chunk.length - offset;
              const toSend    = Math.min(chunkSize - sent, available);
              if (toSend > 0) {
                this.push(chunk.subarray(offset, offset + toSend));
                sent += toSend;
              }
              if (sent >= chunkSize) this.push(null);
            }
            cb();
          },
        });

        decryptStream.pipe(rangeFilter).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': decryptedSize,
          'Content-Type':   file.mimeType,
          'Accept-Ranges':  'bytes',
        });
        decryptStream.pipe(res);
      }
    } catch (error) {
      if (!res.headersSent) {
        next(error);
      }
    }
  }

  static async searchFiles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
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
    } catch (error) { next(error); }
  }

  static async toggleFavorite(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { fileId } = req.params;

      const file = await FileService.toggleFavorite(fileId, userId);

      res.status(200).json({ file });
    } catch (error) { next(error); }
  }

  static async getFavoriteFiles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const files = await FileService.getFavoriteFiles(userId);

      res.status(200).json({ files });
    } catch (error) { next(error); }
  }

  static async getAcceptedShares(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const shares = await FileService.getAcceptedShares(userId);

      res.status(200).json(shares);
    } catch (error) { next(error); }
  }

  static async exportFilesCsv(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const files = await prisma.file.findMany({
        where: {
          userId,
          isDeleted: false,
        },
        include: {
          folder: {
            select: {
              id: true,
              name: true,
              path: true,
            },
          },
          tags: {
            include: {
              tag: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const rows = files.map((file) => ({
        id: file.id,
        nom: file.name,
        nomOriginal: file.originalName,
        mimeType: file.mimeType,
        tailleOctets: Number(file.size),
        dossier: file.folder?.name || 'Racine',
        chemin: file.folder?.path || '/',
        tags: file.tags.map((entry) => entry.tag.name).join('|'),
        favori: file.isFavorite ? 'oui' : 'non',
        coffreFort: file.isVault ? 'oui' : 'non',
        creeLe: file.createdAt.toISOString(),
        modifieLe: file.updatedAt.toISOString(),
      }));

      const { stringify } = require('csv-stringify/sync');
      const csv = stringify(rows, { header: true });
      const fileName = `supfile-files-${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.status(200).send(csv);
    } catch (error) { next(error); }
  }
}
