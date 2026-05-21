import { Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { FileUploadService } from '../services/fileUploadService';
import { SyncService } from '../services/syncService';
import { AuthRequest } from '../types';
import { sendError, sendSuccess } from '../utils/response';
import { ensureDekUnlocked } from '../utils/dekGuard';
import { deleteFile as deleteLocalFile } from '../utils/fileUtils';

type SyncUploadRequest = AuthRequest & {
  file?: Express.Multer.File;
};

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function checksumFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', resolve);
    stream.on('error', reject);
  });
  return hash.digest('hex');
}

export class SyncController {
  static async getRoot(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const root = await SyncService.getOrCreateRoot(req.user!.id);
      sendSuccess(res, { folder: root });
    } catch (error) {
      next(error);
    }
  }

  static async getTree(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const rootFolderId = parseOptionalString(req.query.rootFolderId);

      if (!rootFolderId) {
        sendError(res, 'rootFolderId is required', 400, 'ROOT_FOLDER_REQUIRED');
        return;
      }

      const tree = await SyncService.getTree(userId, rootFolderId);
      sendSuccess(res, { tree });
    } catch (error) {
      next(error);
    }
  }

  static async uploadFile(req: SyncUploadRequest, res: Response, next: NextFunction): Promise<void> {
    const uploadedFile = req.file;

    try {
      const userId = req.user!.id;
      const rootFolderId = parseOptionalString(req.body.rootFolderId);
      const remoteFileId = parseOptionalString(req.body.remoteFileId);
      const folderId = parseOptionalString(req.body.folderId);
      const baseRemoteUpdatedAt = parseOptionalString(req.body.baseRemoteUpdatedAt);
      const rawChecksum = parseOptionalString(req.body.checksum);
      const checksum = SyncService.normalizeChecksum(rawChecksum);

      if (!uploadedFile) {
        sendError(res, 'No file provided', 400);
        return;
      }

      if (!rootFolderId) {
        await deleteLocalFile(uploadedFile.path).catch(() => undefined);
        sendError(res, 'rootFolderId is required', 400, 'ROOT_FOLDER_REQUIRED');
        return;
      }

      if (rawChecksum && !checksum) {
        await deleteLocalFile(uploadedFile.path).catch(() => undefined);
        sendError(res, 'Invalid checksum', 400, 'INVALID_CHECKSUM');
        return;
      }

      if (!ensureDekUnlocked(req, res)) {
        await deleteLocalFile(uploadedFile.path).catch(() => undefined);
        return;
      }

      const targetFolderId = folderId || rootFolderId;
      const targetFolder = await SyncService.assertFolderInsideRoot(userId, rootFolderId, targetFolderId);

      if (checksum && await checksumFile(uploadedFile.path) !== checksum) {
        await deleteLocalFile(uploadedFile.path).catch(() => undefined);
        sendError(res, 'Checksum mismatch', 400, 'CHECKSUM_MISMATCH');
        return;
      }

      if (remoteFileId) {
        const currentFile = await SyncService.getFileForReplacement(userId, remoteFileId, rootFolderId);
        if (!currentFile) {
          await deleteLocalFile(uploadedFile.path).catch(() => undefined);
          sendError(res, 'Remote file not found', 404, 'REMOTE_FILE_NOT_FOUND');
          return;
        }

        if (currentFile.folderId !== targetFolder.id) {
          await deleteLocalFile(uploadedFile.path).catch(() => undefined);
          sendError(res, 'Remote file is not in target folder', 400, 'REMOTE_FILE_FOLDER_MISMATCH');
          return;
        }

        if (SyncService.shouldRejectReplacement(currentFile, baseRemoteUpdatedAt)) {
          await deleteLocalFile(uploadedFile.path).catch(() => undefined);
          sendError(res, 'Remote file changed since last sync', 409, 'SYNC_CONFLICT', {
            file: {
              id: currentFile.id,
              name: currentFile.name,
              folderId: currentFile.folderId,
              checksum: currentFile.checksum,
              updatedAt: currentFile.updatedAt,
              size: Number(currentFile.size),
              mimeType: currentFile.mimeType,
            },
          });
          return;
        }
      }

      const originalName = Buffer.from(uploadedFile.originalname, 'latin1').toString('utf8');
      const file = await FileUploadService.createFile(
        userId,
        originalName,
        originalName,
        uploadedFile.mimetype,
        uploadedFile.size,
        uploadedFile.path,
        targetFolder.id,
        req.dekBuffer,
        remoteFileId,
        checksum
      );

      sendSuccess(res, { file }, remoteFileId ? 200 : 201);
    } catch (error) {
      if (uploadedFile) {
        await deleteLocalFile(uploadedFile.path).catch(() => undefined);
      }
      next(error);
    }
  }
}
