import { CohereClientV2 } from 'cohere-ai';
import prisma from '../config/database';
import fs from 'fs';
import path from 'path';

import { EncryptionService } from './encryptionService';
import { FileUploadService } from './fileUploadService';
import { VaultService } from './vaultService';
import logger from '../config/logger';

export class AIFileService {
  constructor(private cohere: CohereClientV2, private model: string) {}

  async analyzeFile(fileId: string, userId: string, userPrompt?: string): Promise<string> {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId, isDeleted: false } });
    if (!file) throw new Error('File not found or access denied');
    await VaultService.assertUnlockedIfVault(userId, file.isVault);

    const decryptedBuffer = await EncryptionService.decryptFileToBuffer(file.storagePath);
    const prompt = userPrompt || 'Décris le contenu de ce fichier de manière détaillée.';

    if (file.mimeType.startsWith('image/')) {
      return "L'analyse d'images n'est pas encore supportée avec le modèle Cohere actuel.";
    }

    let fileText: string;

    if (file.mimeType === 'application/pdf') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PDFParse } = require('pdf-parse');
      const pdfData = await new PDFParse({ data: decryptedBuffer }).getText();
      fileText = `Voici le contenu d'un fichier PDF :\n\n${pdfData.text}`;
    } else if (file.mimeType.startsWith('text/') || file.mimeType.includes('json') || file.mimeType.includes('javascript')) {
      fileText = `Voici le contenu d'un fichier texte :\n\n${decryptedBuffer.toString('utf-8')}`;
    } else {
      return `Je ne peux pas analyser ce type de fichier (${file.mimeType}) pour le moment.`;
    }

    try {
      const response = await this.cohere.chat({
        model: this.model,
        messages: [
          { role: 'system', content: 'Tu es un assistant IA qui analyse des fichiers. Tu DOIS TOUJOURS répondre en FRANÇAIS.' },
          { role: 'user', content: `${fileText}\n\n${prompt}\n\nIMPORTANT : Réponds UNIQUEMENT en français.` },
        ],
      });
      return (response.message.content as any)?.[0]?.text || 'Impossible d\'analyser ce fichier.';
    } catch (error) {
      logger.error({ err: error }, 'Error analyzing file');
      const msg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to analyze file: ${msg}`);
    }
  }

  async createGeneratedFile(userId: string, prompt: string, fileName?: string, folderId?: string): Promise<any> {
    const response = await this.cohere.chat({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
    });

    const generatedContent = (response.message.content as any)?.[0]?.text || '';
    const finalFileName = fileName || `document-genere-${Date.now()}.txt`;

    const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
    const storagePath = path.join(uploadDir, `generated-${Date.now()}-${finalFileName}`);

    fs.writeFileSync(storagePath, generatedContent, 'utf-8');

    const stats = fs.statSync(storagePath);
    let file: any;

    try {
      file = await FileUploadService.createFile(userId, finalFileName, finalFileName, 'text/plain', stats.size, storagePath, folderId);
    } catch (createError) {
      if (fs.existsSync(storagePath)) fs.unlinkSync(storagePath);
      throw createError;
    }

    return { file, content: generatedContent, message: `Fichier "${finalFileName}" créé avec succès !` };
  }
}
