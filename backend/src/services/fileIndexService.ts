import axios from 'axios';
import pdfParse from 'pdf-parse';
import prisma from '../config/database';
import { EncryptionService } from './encryptionService';
import logger from '../config/logger';

const MAX_INDEX_TEXT_LENGTH = 200_000;

export class FileIndexService {
  private static trimText(text: string): string {
    return (text || '').replace(/\u0000/g, '').trim().slice(0, MAX_INDEX_TEXT_LENGTH);
  }

  private static async extractTextFromImage(buffer: Buffer, mimeType: string): Promise<{ text: string; ocrUsed: boolean }> {
    const ocrApiKey = process.env.OCR_SPACE_API_KEY;
    if (!ocrApiKey) {
      return { text: '', ocrUsed: false };
    }

    const base64 = buffer.toString('base64');
    const payload = new URLSearchParams();
    payload.append('apikey', ocrApiKey);
    payload.append('language', 'fre');
    payload.append('isOverlayRequired', 'false');
    payload.append('base64Image', `data:${mimeType};base64,${base64}`);

    try {
      const response = await axios.post('https://api.ocr.space/parse/image', payload.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30_000,
      });

      const parsedResults = response.data?.ParsedResults;
      const text = Array.isArray(parsedResults)
        ? parsedResults.map((entry: any) => entry?.ParsedText || '').join('\n')
        : '';

      return { text: this.trimText(text), ocrUsed: true };
    } catch (error) {
      logger.error('[FileIndexService] OCR failed:', error);
      return { text: '', ocrUsed: false };
    }
  }

  private static summarizeText(text: string): string | null {
    if (!text) return null;
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return null;
    return normalized.slice(0, 800);
  }

  static async indexFile(fileId: string, userId?: string): Promise<void> {
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        isDeleted: false,
        ...(userId ? { userId } : {}),
      },
      select: {
        id: true,
        mimeType: true,
        storagePath: true,
      },
    });

    if (!file) {
      return;
    }

    let extractedText = '';
    let ocrUsed = false;

    try {
      const decryptedBuffer = await EncryptionService.decryptFileToBuffer(file.storagePath);
      if (file.mimeType === 'application/pdf') {
        const parsed = await (pdfParse as any)(decryptedBuffer);
        extractedText = this.trimText(parsed?.text || '');
      } else if (
        file.mimeType.startsWith('text/')
        || file.mimeType.includes('json')
        || file.mimeType.includes('javascript')
      ) {
        extractedText = this.trimText(decryptedBuffer.toString('utf-8'));
      } else if (file.mimeType.startsWith('image/')) {
        const ocrResult = await this.extractTextFromImage(decryptedBuffer, file.mimeType);
        extractedText = ocrResult.text;
        ocrUsed = ocrResult.ocrUsed;
      }
    } catch (error) {
      logger.error('[FileIndexService] indexFile failed:', error);
      return;
    }

    const aiSummary = this.summarizeText(extractedText);

    await prisma.fileSearchIndex.upsert({
      where: {
        fileId: file.id,
      },
      update: {
        extractedText,
        aiSummary,
        ocrUsed,
        indexedAt: new Date(),
      },
      create: {
        fileId: file.id,
        extractedText,
        aiSummary,
        ocrUsed,
      },
    });
  }

  static indexFileAsync(fileId: string, userId?: string): void {
    this.indexFile(fileId, userId).catch((error) => {
      logger.error('[FileIndexService] async index error:', error);
    });
  }

  static async searchIndexedFiles(userId: string, query: string, take: number = 30) {
    if (!query.trim()) return [];

    const indexes = await prisma.fileSearchIndex.findMany({
      where: {
        extractedText: {
          contains: query.trim(),
          mode: 'insensitive',
        },
        file: {
          userId,
          isDeleted: false,
        },
      },
      include: {
        file: {
          include: {
            folder: true,
            tags: {
              include: {
                tag: true,
              },
            },
          },
        },
      },
      orderBy: {
        indexedAt: 'desc',
      },
      take,
    });

    return indexes.map((entry) => entry.file);
  }
}
