import axios from 'axios';
import mammoth from 'mammoth';
import { XMLParser } from 'fast-xml-parser';
import { Readable } from 'stream';
import zlib from 'zlib';
import prisma from '../config/database';
import { EncryptionService } from './encryptionService';
import { BrainService } from './brainService';
import logger from '../config/logger';
// StorageService importé via EncryptionService.decryptToBufferAuto — pas besoin ici

const MAX_INDEX_TEXT_LENGTH = 200_000;
// If pdf-parse extracts fewer characters than this, we consider the PDF scanned
const SCANNED_PDF_THRESHOLD = 50;

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
      logger.error({ err: error }, '[FileIndexService] OCR failed:');
      return { text: '', ocrUsed: false };
    }
  }

  /**
   * Extract text from a PDF buffer.
   * If the native extraction yields too little text (scanned PDF), fall back to OCR.
   */
  private static async extractTextFromPdf(buffer: Buffer): Promise<{ text: string; ocrUsed: boolean }> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PDFParse } = require('pdf-parse');
      const parsed = await new PDFParse({ data: buffer }).getText();
      const native = this.trimText(parsed?.text || '');
      if (native.length >= SCANNED_PDF_THRESHOLD) {
        return { text: native, ocrUsed: false };
      }
      // Scanned PDF → try OCR
      logger.info('[FileIndexService] PDF appears scanned, falling back to OCR');
      const ocrResult = await this.extractTextFromImage(buffer, 'application/pdf');
      return ocrResult.text ? ocrResult : { text: native, ocrUsed: false };
    } catch (error) {
      logger.error({ err: error }, '[FileIndexService] pdf-parse failed:');
      return { text: '', ocrUsed: false };
    }
  }

  /**
   * Extract plain text from a DOCX/DOC buffer using mammoth.
   */
  private static async extractTextFromDocx(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return this.trimText(result.value);
    } catch (error) {
      logger.error({ err: error }, '[FileIndexService] mammoth DOCX extraction failed:');
      return '';
    }
  }

  /**
   * Extract text from PPTX / XLSX (Office Open XML = ZIP of XML files).
   * Reads slide/sheet XML entries and strips tags.
   */
  private static async extractTextFromOOXML(buffer: Buffer, type: 'pptx' | 'xlsx'): Promise<string> {
    try {
      const entries = await this.unzipToMap(buffer);
      const parser = new XMLParser({ ignoreAttributes: true });
      const texts: string[] = [];

      for (const [name, content] of entries) {
        const isTarget =
          type === 'pptx'
            ? name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
            : name.startsWith('xl/worksheets/sheet') && name.endsWith('.xml');

        if (!isTarget) continue;

        try {
          const xml = content.toString('utf-8');
          const parsed = parser.parse(xml);
          const rawTexts = this.collectText(parsed);
          texts.push(...rawTexts);
        } catch {
          // skip malformed entry
        }
      }

      return this.trimText(texts.join(' '));
    } catch (error) {
      logger.error({ err: error }, '[FileIndexService] OOXML extraction failed:');
      return '';
    }
  }

  /** Walk an arbitrary parsed-XML object and collect string leaves. */
  private static collectText(node: any): string[] {
    if (!node || typeof node !== 'object') return typeof node === 'string' ? [node] : [];
    const results: string[] = [];
    for (const v of Object.values(node)) {
      results.push(...this.collectText(v));
    }
    return results;
  }

  /** Unzip a buffer and return a Map<entryName, Buffer>. */
  private static async unzipToMap(buffer: Buffer): Promise<Map<string, Buffer>> {
    return new Promise((resolve, reject) => {
      const map = new Map<string, Buffer>();
      // Minimal PK ZIP parser using Node built-ins is complex;
      // use the simpler approach: write to a temp stream and parse manually.
      // Instead, use a pure-JS approach with Buffer slicing.
      try {
        const result = this.parseZip(buffer);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Minimal ZIP parser (PKZIP format, stored or deflated entries).
   * Sufficient for Office Open XML files which use deflate compression.
   */
  private static parseZip(buffer: Buffer): Map<string, Buffer> {
    const map = new Map<string, Buffer>();
    let offset = 0;
    const SIG = 0x04034b50; // Local file header signature

    while (offset + 30 <= buffer.length) {
      const sig = buffer.readUInt32LE(offset);
      if (sig !== SIG) break;

      const compression = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const fileNameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);

      const nameStart = offset + 30;
      const dataStart = nameStart + fileNameLen + extraLen;
      const name = buffer.slice(nameStart, nameStart + fileNameLen).toString('utf-8');
      const compressedData = buffer.slice(dataStart, dataStart + compressedSize);

      if (compression === 0) {
        // Stored
        map.set(name, compressedData);
      } else if (compression === 8) {
        // Deflated
        try {
          map.set(name, zlib.inflateRawSync(compressedData));
        } catch {
          // skip corrupted entry
        }
      }

      offset = dataStart + compressedSize;
    }

    return map;
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
        name: true,
        userId: true,
        mimeType: true,
        storagePath: true,
      },
    });

    if (!file) {
      return;
    }

    let extractedText = '';
    let ocrUsed = false;

    const mime = file.mimeType;
    // Pas d'indexation pour les types non-textuels (vidéo, audio, archives...) — évite de charger de gros fichiers en mémoire
    const isIndexable =
      mime === 'application/pdf' ||
      mime.startsWith('text/') ||
      mime.startsWith('image/') ||
      mime.includes('document') || mime.includes('word') ||
      mime.includes('excel') || mime.includes('spreadsheet') ||
      mime.includes('presentation') || mime.includes('powerpoint') ||
      mime.includes('json') || mime.includes('javascript') || mime.includes('xml') ||
      file.name.toLowerCase().match(/\.(docx?|xlsx?|pptx?|md|markdown)$/);

    if (!isIndexable) return;

    try {
      const decryptedBuffer = await EncryptionService.decryptToBufferAuto(file.storagePath);
      const nameLower = file.name.toLowerCase();

      if (mime === 'application/pdf') {
        const result = await this.extractTextFromPdf(decryptedBuffer);
        extractedText = result.text;
        ocrUsed = result.ocrUsed;
      } else if (
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mime === 'application/msword' ||
        mime === 'application/vnd.oasis.opendocument.text' ||
        nameLower.endsWith('.docx') ||
        nameLower.endsWith('.doc')
      ) {
        extractedText = await this.extractTextFromDocx(decryptedBuffer);
      } else if (
        mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        mime === 'application/vnd.ms-powerpoint' ||
        nameLower.endsWith('.pptx') ||
        nameLower.endsWith('.ppt')
      ) {
        extractedText = await this.extractTextFromOOXML(decryptedBuffer, 'pptx');
      } else if (
        mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mime === 'application/vnd.ms-excel' ||
        nameLower.endsWith('.xlsx') ||
        nameLower.endsWith('.xls')
      ) {
        extractedText = await this.extractTextFromOOXML(decryptedBuffer, 'xlsx');
      } else if (
        mime.startsWith('text/') ||
        mime.includes('json') ||
        mime.includes('javascript') ||
        mime.includes('xml') ||
        nameLower.endsWith('.md') ||
        nameLower.endsWith('.markdown')
      ) {
        extractedText = this.trimText(decryptedBuffer.toString('utf-8'));
      } else if (mime.startsWith('image/')) {
        const ocrResult = await this.extractTextFromImage(decryptedBuffer, mime);
        extractedText = ocrResult.text;
        ocrUsed = ocrResult.ocrUsed;
      }
    } catch (error) {
      logger.error({ err: error }, '[FileIndexService] indexFile failed:');
      return;
    }

    const aiSummary = this.summarizeText(extractedText);
    // Le texte complet est chiffré au repos — seul aiSummary (court extrait affiché)
    // reste en clair pour permettre la recherche SQL de secours.
    const encryptedText = extractedText ? EncryptionService.encryptText(extractedText) : '';

    await prisma.fileSearchIndex.upsert({
      where: {
        fileId: file.id,
      },
      update: {
        extractedText: encryptedText,
        aiSummary,
        ocrUsed,
        indexedAt: new Date(),
      },
      create: {
        fileId: file.id,
        extractedText: encryptedText,
        aiSummary,
        ocrUsed,
      },
    });

    // Trigger semantic embedding — fire-and-forget, non-blocking
    if (extractedText && process.env.BRAIN_API_URL) {
      BrainService.embedFile(file.id, file.userId, file.name, extractedText)
        .catch((err) => console.warn('[brain] Embedding failed (non-critical):', err.message));
    }
  }

  static indexFileAsync(fileId: string, userId?: string): void {
    this.indexFile(fileId, userId).catch((error) => {
      logger.error({ err: error }, '[FileIndexService] async index error:');
    });
  }

  static async searchIndexedFiles(userId: string, query: string, take: number = 30) {
    if (!query.trim()) return [];

    const indexes = await prisma.fileSearchIndex.findMany({
      where: {
        // extractedText est chiffré — on cherche sur aiSummary (extrait court en clair)
        aiSummary: {
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
