import fs from 'fs';
import path from 'path';

import pdfParse from 'pdf-parse';

import prisma from '../config/database';
import { BrainService } from './brainService';
import { EncryptionService } from './encryptionService';
import { FileService } from './fileService';
import { VaultService } from './vaultService';

export class AIService {
  /**
   * Extract search criteria from a natural-language query using regex.
   * Replaces Cohere function-calling — small models are unreliable for JSON tool use.
   */
  private extractCriteria(query: string): {
    keyword?: string;
    mimeType?: string;
    category?: string;
    isFavorite?: boolean;
  } {
    const q = query.toLowerCase();
    const criteria: Record<string, any> = {};

    if (/\bimage[s]?\b|photo[s]?|\.png\b|\.jpg\b|\.jpeg\b|\.gif\b|\.webp\b/.test(q)) {
      criteria.category = 'image';
    } else if (/\bvid[eé]o[s]?\b|\.mp4\b|\.avi\b|\.mov\b|\.mkv\b/.test(q)) {
      criteria.category = 'video';
    } else if (/\baudio\b|\bmusique\b|\.mp3\b|\.wav\b|\.flac\b/.test(q)) {
      criteria.category = 'audio';
    } else if (/\bpdf\b|\bdocument[s]?\b|\bword\b|\bexcel\b|\btableur\b/.test(q)) {
      criteria.category = 'doc';
    }

    if (/\.pdf\b/.test(q) && !criteria.mimeType) criteria.mimeType = 'pdf';
    if (/\.png\b/.test(q) && !criteria.mimeType) criteria.mimeType = 'png';
    if (/\bfavori[s]?\b|\bstar\b|\bépingl/.test(q)) criteria.isFavorite = true;

    // Extract keyword only when no structural category was detected
    if (!criteria.category && !criteria.mimeType) {
      const stop = new Set([
        'les', 'mes', 'trouve', 'cherche', 'montre', 'affiche', 'liste', 'fichier',
        'fichiers', 'document', 'documents', 'où', 'est', 'mon', 'ma', 'le', 'la',
        'un', 'une', 'des', 'du', 'au', 'par', 'sur', 'dans', 'avec', 'pour', 'qui',
        'que', 'quoi', 'comment', 'quand', 'tout', 'tous', 'cette', 'cet', 'ces', 'ce',
      ]);
      const words = q
        .replace(/[?!.,]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stop.has(w));
      if (words.length > 0) criteria.keyword = words.slice(0, 3).join(' ');
    }

    return criteria;
  }

  // ---------------------------------------------------------------------------
  // A. Analyse d'un fichier spécifique
  // ---------------------------------------------------------------------------
  async analyzeFile(fileId: string, userId: string, userPrompt?: string): Promise<string> {
    const file = await prisma.file.findFirst({
      where: { id: fileId, userId, isDeleted: false },
      include: { searchIndex: true },
    });

    if (!file) throw new Error('File not found or access denied');
    await VaultService.assertUnlockedIfVault(userId, file.isVault);

    const question = userPrompt || 'Décris le contenu de ce fichier de manière détaillée.';

    // Prefer already-indexed text to avoid double decryption
    if (file.searchIndex?.extractedText) {
      return BrainService.analyze(file.searchIndex.extractedText, question);
    }

    // Fallback: decrypt and extract on the fly
    try {
      const buffer = await EncryptionService.decryptFileToBuffer(file.storagePath);
      let text = '';

      if (file.mimeType === 'application/pdf') {
        const parsed = await (pdfParse as any)(buffer);
        text = parsed?.text || '';
      } else if (
        file.mimeType.startsWith('text/') ||
        file.mimeType.includes('json') ||
        file.mimeType.includes('javascript')
      ) {
        text = buffer.toString('utf-8');
      } else {
        return `Je ne peux pas analyser ce type de fichier (${file.mimeType}) localement.`;
      }

      return BrainService.analyze(text, question);
    } catch (error: any) {
      throw new Error(`Failed to analyze file: ${error.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // B. Recherche de fichiers
  //
  //  Stratégie en deux temps :
  //  1. Regex → détecte catégorie / mime / favoris → requête Prisma directe
  //     (fiable à 100% pour "mes images", "liste les PDFs")
  //  2. Contenu / sémantique → vector search dans ChromaDB → file_ids → Prisma
  //     (géré par brain-api pour "facture mars", "rapport Q1 2024")
  //  Le LLM 0.5B est trop petit pour du function-calling fiable — on l'évite ici.
  // ---------------------------------------------------------------------------
  async searchFiles(userId: string, userPrompt: string): Promise<any> {
    const args = this.extractCriteria(userPrompt);
    const vaultUnlocked = await VaultService.isVaultUnlocked(userId);
    const baseWhere = {
      userId,
      isDeleted: false,
      ...(vaultUnlocked ? {} : { isVault: false }),
    };
    const include = { folder: true, tags: { include: { tag: true } } };

    // ── 1. Structural query (category / mime / favorites) ──────────────────
    if (args.category || args.mimeType || args.isFavorite !== undefined) {
      const whereClause: any = { ...baseWhere };

      if (args.mimeType) {
        whereClause.mimeType = { contains: args.mimeType, mode: 'insensitive' };
      }

      if (args.category && !args.mimeType) {
        if (args.category === 'image') {
          whereClause.OR = [{ category: 'image' }, { mimeType: { startsWith: 'image/' } }];
        } else if (args.category === 'video') {
          whereClause.OR = [{ category: 'video' }, { mimeType: { startsWith: 'video/' } }];
        } else if (args.category === 'audio') {
          whereClause.OR = [{ category: 'audio' }, { mimeType: { startsWith: 'audio/' } }];
        } else if (args.category === 'doc') {
          whereClause.OR = [
            { category: 'doc' },
            { mimeType: { contains: 'pdf' } },
            { mimeType: { contains: 'document' } },
            { mimeType: { contains: 'word' } },
            { mimeType: { contains: 'excel' } },
            { mimeType: { contains: 'spreadsheet' } },
          ];
        } else {
          whereClause.category = args.category;
        }
      }

      if (args.isFavorite !== undefined) whereClause.isFavorite = args.isFavorite;

      const files = await prisma.file.findMany({
        where: whereClause,
        include,
        orderBy: { updatedAt: 'desc' },
        take: 20,
      });
      return this._buildResult(files, args);
    }

    // ── 2. Semantic / content query → vector search ────────────────────────
    if (process.env.BRAIN_API_URL) {
      try {
        const chunks = await BrainService.search(userId, userPrompt, 5);
        if (chunks.length > 0) {
          const fileIds = [...new Set(chunks.map((c) => c.file_id))];
          const files = await prisma.file.findMany({
            where: { ...baseWhere, id: { in: fileIds } },
            include,
            orderBy: { updatedAt: 'desc' },
          });
          return this._buildResult(files, args);
        }
      } catch (err: any) {
        console.warn('[searchFiles] vector search failed, falling back to LIKE:', err.message);
      }
    }

    // ── 3. Fallback: SQL LIKE on name + extractedText ──────────────────────
    const keyword = args.keyword || userPrompt.slice(0, 50);
    const files = await prisma.file.findMany({
      where: {
        ...baseWhere,
        OR: [
          { name: { contains: keyword, mode: 'insensitive' } },
          { originalName: { contains: keyword, mode: 'insensitive' } },
          { searchIndex: { is: { extractedText: { contains: keyword, mode: 'insensitive' } } } },
        ],
      },
      include,
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    return this._buildResult(files, args);
  }

  private _buildResult(files: any[], criteria: object) {
    return {
      files,
      searchCriteria: criteria,
      message:
        files.length > 0
          ? `J'ai trouvé ${files.length} fichier${files.length > 1 ? 's' : ''} correspondant à votre recherche.`
          : 'Aucun fichier trouvé correspondant à ces critères.',
    };
  }

  // ---------------------------------------------------------------------------
  // C. Création d'un fichier avec contenu généré
  // ---------------------------------------------------------------------------
  async createGeneratedFile(
    userId: string,
    prompt: string,
    fileName?: string,
    folderId?: string,
  ): Promise<any> {
    const generatedContent = await BrainService.generate(prompt);
    const finalFileName = fileName || `document-genere-${Date.now()}.txt`;
    const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
    const storagePath = path.join(uploadDir, `generated-${Date.now()}-${finalFileName}`);

    fs.writeFileSync(storagePath, generatedContent, 'utf-8');
    const stats = fs.statSync(storagePath);

    let file: any;
    try {
      file = await FileService.createFile(
        userId,
        finalFileName,
        finalFileName,
        'text/plain',
        stats.size,
        storagePath,
        folderId || undefined,
      );
    } catch (createError) {
      if (fs.existsSync(storagePath)) fs.unlinkSync(storagePath);
      throw createError;
    }

    return {
      file,
      content: generatedContent,
      message: `Fichier "${finalFileName}" créé avec succès !`,
    };
  }

  // ---------------------------------------------------------------------------
  // D. Chat général avec RAG automatique
  // ---------------------------------------------------------------------------
  async chat(userId: string, message: string, _conversationHistory?: any[]): Promise<string> {
    // File listing requests don't need RAG — just Prisma
    const isListRequest =
      /\b(liste|montre|affiche|trouve|cherche|combien)\b.*(fichier|image|vid[eé]o|document|pdf|audio)/i.test(
        message,
      ) || /\b(mes fichiers|mes images|mes vid[eé]os|mes documents)\b/i.test(message);

    if (isListRequest) {
      const result = await this.searchFiles(userId, message);
      if (result.files.length > 0) {
        const list = result.files
          .map(
            (f: any) =>
              `- ${f.name} (${f.category || 'autre'}, ${(Number(f.size) / 1024).toFixed(1)} KB)`,
          )
          .join('\n');
        return `${result.message}\n\n${list}`;
      }
      return result.message;
    }

    // Everything else → RAG chat via brain-api
    try {
      return await BrainService.chat(userId, message);
    } catch (error: any) {
      if (error.name === 'AbortError') throw new Error('TIMEOUT');
      throw error;
    }

  }
}

export default new AIService();
