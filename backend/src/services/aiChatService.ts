import { CohereClientV2 } from 'cohere-ai';
import prisma from '../config/database';
import { VaultService } from './vaultService';
import { AIFileService } from './aiFileService';
import logger from '../config/logger';

export class AIChatService {
  constructor(private cohere: CohereClientV2, private model: string, private aiFileService: AIFileService) {}

  async searchFiles(userId: string, userPrompt: string): Promise<any> {
    const searchFilesFunction = {
      name: 'searchFiles',
      description: 'Recherche des fichiers dans la base de données en fonction de critères spécifiques',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: 'Mot-clé à rechercher dans le nom du fichier' },
          mimeType: { type: 'string', description: 'Type MIME du fichier (ex: application/pdf, image/png)' },
          category: { type: 'string', description: 'Catégorie du fichier (image, video, doc, audio, other)' },
          isFavorite: { type: 'boolean', description: 'Si le fichier est marqué comme favori' },
        },
        required: [],
      },
    };

    const response = await this.cohere.chat({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `Tu es un assistant qui aide à rechercher des fichiers. Utilise la fonction searchFiles pour extraire les critères de recherche.
RÈGLES : Si demande d'images → category:"image", vidéos → category:"video", documents → category:"doc", PDF → mimeType:"pdf". Noms spécifiques → keyword.`,
        },
        { role: 'user', content: userPrompt },
      ],
      tools: [{ type: 'function', function: searchFilesFunction }],
    });

    const toolCalls = response.message?.toolCalls;
    const vaultUnlocked = await VaultService.isVaultUnlocked(userId);
    const baseWhere: any = { userId, isDeleted: false, ...(vaultUnlocked ? {} : { isVault: false }) };

    if (toolCalls && toolCalls.length > 0) {
      const args = JSON.parse(toolCalls[0].function?.arguments || '{}');
      const where: any = { ...baseWhere };

      if (args.keyword) {
        where.OR = [
          { name: { contains: args.keyword, mode: 'insensitive' } },
          { originalName: { contains: args.keyword, mode: 'insensitive' } },
          { searchIndex: { is: { extractedText: { contains: args.keyword, mode: 'insensitive' } } } },
        ];
      }
      if (args.mimeType) where.mimeType = { contains: args.mimeType, mode: 'insensitive' };
      if (args.category && !args.mimeType && !args.keyword) {
        const categoryMap: Record<string, any> = {
          image: [{ category: 'image' }, { mimeType: { startsWith: 'image/', mode: 'insensitive' } }],
          video: [{ category: 'video' }, { mimeType: { startsWith: 'video/', mode: 'insensitive' } }],
          audio: [{ category: 'audio' }, { mimeType: { startsWith: 'audio/', mode: 'insensitive' } }],
          doc: [
            { category: 'doc' },
            { mimeType: { contains: 'pdf', mode: 'insensitive' } },
            { mimeType: { contains: 'document', mode: 'insensitive' } },
            { mimeType: { contains: 'word', mode: 'insensitive' } },
            { mimeType: { contains: 'excel', mode: 'insensitive' } },
          ],
        };
        if (categoryMap[args.category]) where.OR = categoryMap[args.category];
        else where.category = args.category;
      }
      if (args.isFavorite !== undefined) where.isFavorite = args.isFavorite;

      const files = await prisma.file.findMany({
        where,
        include: { folder: true, tags: { include: { tag: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      });

      return {
        files,
        searchCriteria: args,
        message: files.length > 0
          ? `J'ai trouvé ${files.length} fichier${files.length > 1 ? 's' : ''} correspondant à votre recherche.`
          : 'Aucun fichier trouvé correspondant à ces critères.',
      };
    }

    const files = await prisma.file.findMany({
      where: {
        ...baseWhere,
        OR: [
          { name: { contains: userPrompt, mode: 'insensitive' } },
          { originalName: { contains: userPrompt, mode: 'insensitive' } },
        ],
      },
      include: { folder: true, tags: { include: { tag: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    return {
      files,
      message: files.length > 0 ? `J'ai trouvé ${files.length} fichier${files.length > 1 ? 's' : ''}.` : 'Aucun fichier trouvé.',
    };
  }

  async chat(userId: string, message: string, conversationHistory?: any[]): Promise<string> {
    const systemMessage = `Tu es Bobby le robot, un assistant IA intégré dans SUPFILE. Tu as accès aux fichiers de l'utilisateur.

IMPORTANT :
- Quand l'utilisateur demande à VOIR, LISTER ou CHERCHER des fichiers, utilise la fonction searchFiles
- Quand l'utilisateur veut analyser un fichier par son nom, utilise searchFiles pour le trouver d'abord`;

    const messages: any[] = [{ role: 'system', content: systemMessage }];

    if (conversationHistory?.length) {
      conversationHistory.forEach((msg) => {
        if (msg.role === 'user' || msg.role === 'model') {
          messages.push({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.parts[0].text });
        }
      });
    }

    messages.push({ role: 'user', content: message });

    try {
      logger.info(`[Bobby] Using model: ${this.model}`);

      const response = await this.cohere.chat({
        model: this.model,
        messages,
        tools: [{
          type: 'function',
          function: {
            name: 'searchFiles',
            description: 'Recherche des fichiers de l\'utilisateur.',
            parameters: { type: 'object', properties: { keyword: { type: 'string' } }, required: [] },
          },
        }],
      });

      const toolCalls = response.message?.toolCalls;

      if (toolCalls?.length) {
        if (toolCalls[0].function?.name === 'searchFiles') {
          const searchResult = await this.searchFiles(userId, message);

          const isAnalysisRequest = message.toLowerCase().match(/qu'est-ce que|analyse|décris|décrit|c'est quoi|que contient/);
          if (isAnalysisRequest && searchResult.files?.length === 1) {
            const file = searchResult.files[0];
            const analysis = await this.aiFileService.analyzeFile(file.id, userId, message);
            return `Voici l'analyse de **${file.name}** :\n\n${analysis}`;
          }

          if (searchResult.files?.length > 0) {
            const filesList = searchResult.files.map((f: any) =>
              `- ${f.name} (${f.category || 'non catégorisé'}, ${(Number(f.size) / 1024).toFixed(2)} KB)`
            ).join('\n');
            return `${searchResult.message}\n\n${filesList}`;
          }
          return searchResult.message;
        }
      }

      return (response.message.content as any)?.[0]?.text || 'Désolé, je n\'ai pas pu traiter votre demande.';
    } catch (error: any) {
      logger.error({ err: error }, 'Error in chat');
      if (error.message?.includes('429')) throw new Error('RATE_LIMIT_EXCEEDED');
      throw new Error(`Chat failed: ${error.message}`);
    }
  }
}
