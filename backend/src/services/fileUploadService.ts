import path from 'path';
import prisma from '../config/database';
import { deleteFile } from '../utils/fileUtils';

import { VersionService } from './versionService';
import { AuditService } from './auditService';
import { SocketService } from './socketService';
import { EncryptionService } from './encryptionService';
import { PlanService } from './planService';
import { VaultService } from './vaultService';
import { FileIndexService } from './fileIndexService';

function getCategoryFromMimeType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('word') ||
    mimeType.includes('excel') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('presentation') ||
    mimeType.includes('powerpoint') ||
    mimeType.includes('text/')
  ) return 'doc';
  return 'other';
}

async function getUniqueFileName(name: string, folderId: string | undefined, userId: string): Promise<string> {
  const lastDotIndex = name.lastIndexOf('.');
  const baseName = lastDotIndex > 0 ? name.substring(0, lastDotIndex) : name;
  const extension = lastDotIndex > 0 ? name.substring(lastDotIndex) : '';

  const existingFiles = await prisma.file.findMany({
    where: { userId, folderId: folderId || null, isDeleted: false, name: { startsWith: baseName } },
    select: { name: true },
  });

  if (existingFiles.length === 0 || !existingFiles.some((f) => f.name === name)) return name;

  let counter = 1;
  let newName = `${baseName} (${counter})${extension}`;
  while (existingFiles.some((f) => f.name === newName)) {
    counter++;
    newName = `${baseName} (${counter})${extension}`;
  }
  return newName;
}

export class FileUploadService {
  static async createFiles(userId: string, files: Express.Multer.File[], folderId?: string) {
    const createdFiles: any[] = [];
    const errors: Array<{ fileName: string; error: string }> = [];

    for (const uploadedFile of files) {
      const originalName = Buffer.from(uploadedFile.originalname, 'latin1').toString('utf8');
      try {
        const createdFile = await this.createFile(
          userId,
          originalName,
          originalName,
          uploadedFile.mimetype,
          uploadedFile.size,
          uploadedFile.path,
          folderId
        );
        createdFiles.push(createdFile);
      } catch (error: any) {
        // Nettoyer le fichier temporaire local si l'upload S3 a échoué avant
        await deleteFile(uploadedFile.path).catch(() => undefined);
        errors.push({ fileName: originalName, error: error?.message || 'Upload failed' });
      }
    }

    return { files: createdFiles, errors };
  }

  static async createFile(
    userId: string,
    name: string,
    originalName: string,
    mimeType: string,
    size: number,
    storagePath: string,
    folderId?: string
  ) {
    const isVault = await VaultService.isVaultFolder(userId, folderId || null);
    await VaultService.assertUnlockedIfVault(userId, isVault);

    const fileSizeAllowed = await PlanService.checkFileSize(userId, size);
    if (!fileSizeAllowed) {
      await deleteFile(storagePath);
      throw new Error('Fichier trop volumineux pour votre plan. Passez à un plan supérieur.');
    }

    const hasSpace = await PlanService.checkQuota(userId, size);
    if (!hasSpace) {
      await deleteFile(storagePath);
      throw new Error('Quota exceeded');
    }

    const uniqueName = await getUniqueFileName(name, folderId, userId);
    const category = getCategoryFromMimeType(mimeType);

    // Chiffrer et uploader vers S3 — storagePath devient la clé S3
    const s3Key = `files/${userId}/${path.basename(storagePath)}`;
    await EncryptionService.encryptFileToS3(storagePath, s3Key);

    const file = await prisma.file.create({
      data: { name: uniqueName, originalName, mimeType, size: BigInt(size), storagePath: s3Key, userId, folderId, category, isVault },
      include: { folder: true },
    });

    await PlanService.updateQuotaUsed(userId, size);
    await AuditService.createLog(userId, 'UPLOAD', { fileName: uniqueName, fileId: file.id, folderId });

    SocketService.emitToUser(userId, 'file_uploaded', file);
    if (folderId) SocketService.emitToUser(userId, 'folder_updated', { folderId });

    FileIndexService.indexFileAsync(file.id, userId);

    return file;
  }

  static async replaceFileContent(
    fileId: string,
    userId: string,
    newFilePath: string,
    newFileName: string,
    newFileSize: number,
    newMimeType: string
  ) {
    await VersionService.createVersion(fileId, userId, newFilePath, newFileName, newFileSize, newMimeType);
    FileIndexService.indexFileAsync(fileId, userId);

    return prisma.file.findFirst({
      where: { id: fileId, userId, isDeleted: false },
      include: { folder: true, tags: { include: { tag: true } } },
    });
  }
}
