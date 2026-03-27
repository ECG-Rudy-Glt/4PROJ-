import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import logger from '../config/logger';

const unlinkAsync = promisify(fs.unlink);
const statAsync = promisify(fs.stat);
const readdirAsync = promisify(fs.readdir);

export const deleteFile = async (filePath: string): Promise<void> => {
  try {
    if (fs.existsSync(filePath)) {
      await unlinkAsync(filePath);
    }
  } catch (error) {
    logger.error('Error deleting file:', error);
    throw error;
  }
};

export const getFileSize = async (filePath: string): Promise<number> => {
  const stats = await statAsync(filePath);
  return stats.size;
};

export const ensureDirectory = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

export const getMimeTypeCategory = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return 'Images';
  if (mimeType.startsWith('video/')) return 'Videos';
  if (mimeType.startsWith('audio/')) return 'Audio';
  if (mimeType.startsWith('application/pdf')) return 'Documents';
  if (
    mimeType.includes('word') ||
    mimeType.includes('document') ||
    mimeType.includes('text')
  ) {
    return 'Documents';
  }
  return 'Others';
};

export const isPreviewable = (mimeType: string): boolean => {
  const previewableMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
  ];
  return previewableMimes.includes(mimeType);
};
