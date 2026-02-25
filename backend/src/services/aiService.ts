import { CohereClientV2 } from 'cohere-ai';
import prisma from '../config/database';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

export class AIService {
  private cohere: CohereClientV2;
  private model: string;

  constructor() {
    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ COHERE_API_KEY not found in environment variables. Bobby will not be available.');
      this.cohere = null as any;
    } else {
      this.cohere = new CohereClientV2({
        token: apiKey,
      });
    }
    this.model = process.env.COHERE_MODEL || 'command-r-plus-08-2024';
  }

  /**
   * A. Analyser le contenu d'un fichier
   */
  async analyzeFile(fileId: string, userId: string, userPrompt?: string): Promise<string> {
    if (!this.cohere) {
      throw new Error('AI Service not configured. Please add COHERE_API_KEY to your .env file.');
    }
    // Récupérer le fichier depuis la BDD
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
        isDeleted: false,
      },
    });

    if (!file) {
      throw new Error('File not found or access denied');
    }

    const filePath = file.storagePath;
    const mimeType = file.mimeType;

    try {
      let prompt = userPrompt || 'Décris le contenu de ce fichier de manière détaillée.';

      // Si c'est une image
      if (mimeType.startsWith('image/')) {
        return "L'analyse d'images n'est pas encore supportée avec le modèle Cohere actuel. Veuillez utiliser des fichiers texte ou PDF.";
      }

      // Si c'est un PDF
      if (mimeType === 'application/pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await (pdfParse as any)(dataBuffer);
        const text = pdfData.text;

        const fullPrompt = `Voici le contenu d'un fichier PDF :\n\n${text}\n\n${prompt}\n\nIMPORTANT : Réponds UNIQUEMENT en français.`;

        const response = await this.cohere.chat({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'Tu es un assistant IA qui analyse des fichiers. Tu DOIS TOUJOURS répondre en FRANÇAIS, peu importe la langue du contenu analysé.',
            },
            { role: 'user', content: fullPrompt },
          ],
        });

        return (response.message.content as any)?.[0]?.text || 'Impossible d\'analyser ce PDF.';
      }

      // Si c'est un fichier texte
      if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('javascript')) {
        const textContent = fs.readFileSync(filePath, 'utf-8');
        const fullPrompt = `Voici le contenu d'un fichier texte :\n\n${textContent}\n\n${prompt}\n\nIMPORTANT : Réponds UNIQUEMENT en français.`;

        const response = await this.cohere.chat({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'Tu es un assistant IA qui analyse des fichiers. Tu DOIS TOUJOURS répondre en FRANÇAIS, peu importe la langue du contenu analysé.',
            },
            { role: 'user', content: fullPrompt },
          ],
        });

        return (response.message.content as any)?.[0]?.text || 'Impossible d\'analyser ce fichier texte.';
      }

      // Pour les autres types de fichiers
      return `Je ne peux pas analyser ce type de fichier (${mimeType}) pour le moment. Je supporte les images, PDF et fichiers texte.`;
    } catch (error: any) {
      console.error('Error analyzing file:', error);
      throw new Error(`Failed to analyze file: ${error.message}`);
    }
  }

  /**
   * B. Rechercher des fichiers avec function calling
   */
  async searchFiles(userId: string, userPrompt: string): Promise<any> {
    if (!this.cohere) {
      throw new Error('AI Service not configured. Please add COHERE_API_KEY to your .env file.');
    }
    // Définir la fonction de recherche
    const searchFilesFunction = {
      name: 'searchFiles',
      description: 'Recherche des fichiers dans la base de données en fonction de critères spécifiques',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: 'Mot-clé à rechercher dans le nom du fichier',
          },
          mimeType: {
            type: 'string',
            description: 'Type MIME du fichier (ex: application/pdf, image/png)',
          },
          category: {
            type: 'string',
            description: 'Catégorie du fichier (image, video, doc, audio, other)',
          },
          isFavorite: {
            type: 'boolean',
            description: 'Si le fichier est marqué comme favori',
          },
        },
        required: [],
      },
    };

    try {
      const response = await this.cohere.chat({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `Tu es un assistant qui aide à rechercher des fichiers. Utilise la fonction searchFiles pour extraire les critères de recherche du message de l'utilisateur.

RÈGLES IMPORTANTES :
- Si l'utilisateur demande "les images", "mes images", "liste les images" → utilise category: "image" (PAS keyword)
- Si l'utilisateur demande "les vidéos", "mes vidéos" → utilise category: "video"
- Si l'utilisateur demande "les documents", "mes documents" → utilise category: "doc"
- Si l'utilisateur demande "les PDF", "fichiers PDF" → utilise mimeType: "pdf"
- Si l'utilisateur demande "les PNG", "fichiers PNG" → utilise mimeType: "png"
- Si l'utilisateur cherche un nom spécifique (ex: "facture", "rapport") → utilise keyword
- Ne mets JAMAIS "images", "vidéos", "documents" dans le keyword, utilise category à la place`,
          },
          { role: 'user', content: userPrompt },
        ],
        tools: [{ type: 'function', function: searchFilesFunction }],
      });

      const toolCalls = response.message?.toolCalls;

      if (toolCalls && toolCalls.length > 0) {
        const functionCall = toolCalls[0];
        const args = JSON.parse(functionCall.function?.arguments || '{}');

        // Construire la requête Prisma
        const whereClause: any = {
          userId,
          isDeleted: false,
        };

        if (args.keyword) {
          whereClause.name = {
            contains: args.keyword,
            mode: 'insensitive',
          };
        }

        if (args.mimeType) {
          whereClause.mimeType = {
            contains: args.mimeType,
            mode: 'insensitive',
          };
        }

        // Filtrer par catégorie OU par mimeType si catégorie demandée
        if (args.category && !args.mimeType && !args.keyword) {
          // Si la catégorie est demandée, on cherche soit par category, soit par mimeType
          // Car certains fichiers n'ont pas encore de catégorie définie
          if (args.category === 'image') {
            whereClause.OR = [
              { category: 'image' },
              { mimeType: { startsWith: 'image/', mode: 'insensitive' } },
            ];
          } else if (args.category === 'video') {
            whereClause.OR = [
              { category: 'video' },
              { mimeType: { startsWith: 'video/', mode: 'insensitive' } },
            ];
          } else if (args.category === 'audio') {
            whereClause.OR = [
              { category: 'audio' },
              { mimeType: { startsWith: 'audio/', mode: 'insensitive' } },
            ];
          } else if (args.category === 'doc') {
            whereClause.OR = [
              { category: 'doc' },
              { mimeType: { contains: 'pdf', mode: 'insensitive' } },
              { mimeType: { contains: 'document', mode: 'insensitive' } },
              { mimeType: { contains: 'word', mode: 'insensitive' } },
              { mimeType: { contains: 'excel', mode: 'insensitive' } },
              { mimeType: { contains: 'spreadsheet', mode: 'insensitive' } },
            ];
          } else {
            whereClause.category = args.category;
          }
        }

        if (args.isFavorite !== undefined) {
          whereClause.isFavorite = args.isFavorite;
        }

        // Exécuter la recherche
        console.log('[searchFiles] WHERE clause:', JSON.stringify(whereClause, null, 2));
        const files = await prisma.file.findMany({
          where: whereClause,
          include: {
            folder: true,
            tags: {
              include: {
                tag: true,
              },
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
          take: 20, // Limiter à 20 résultats
        });
        console.log('[searchFiles] Found files:', files.length);

        return {
          files,
          searchCriteria: args,
          message: files.length > 0
            ? `J'ai trouvé ${files.length} fichier${files.length > 1 ? 's' : ''} correspondant à votre recherche.`
            : 'Aucun fichier trouvé correspondant à ces critères.',
        };
      }

      // Si pas de function call, recherche basique
      const files = await prisma.file.findMany({
        where: {
          userId,
          isDeleted: false,
          name: {
            contains: userPrompt,
            mode: 'insensitive',
          },
        },
        include: {
          folder: true,
          tags: {
            include: {
              tag: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 20,
      });

      return {
        files,
        message: files.length > 0
          ? `J'ai trouvé ${files.length} fichier${files.length > 1 ? 's' : ''}.`
          : 'Aucun fichier trouvé.',
      };
    } catch (error: any) {
      console.error('Error searching files:', error);
      throw new Error(`Failed to search files: ${error.message}`);
    }
  }

  /**
   * C. Créer un fichier avec du contenu généré par l'IA
   */
  async createGeneratedFile(
    userId: string,
    prompt: string,
    fileName?: string,
    folderId?: string
  ): Promise<any> {
    if (!this.cohere) {
      throw new Error('AI Service not configured. Please add COHERE_API_KEY to your .env file.');
    }
    try {
      // Générer le contenu avec Cohere
      const response = await this.cohere.chat({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
      });

      const generatedContent = (response.message.content as any)?.[0]?.text || '';

      // Déterminer le nom du fichier
      const finalFileName = fileName || `document-genere-${Date.now()}.txt`;

      // Créer le fichier physique
      const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
      const storagePath = path.join(uploadDir, `generated-${Date.now()}-${finalFileName}`);

      fs.writeFileSync(storagePath, generatedContent, 'utf-8');

      // Obtenir la taille du fichier
      const stats = fs.statSync(storagePath);
      const fileSize = stats.size;

      // Vérifier le quota
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        fs.unlinkSync(storagePath); // Supprimer le fichier
        throw new Error('User not found');
      }

      if (BigInt(user.quotaUsed) + BigInt(fileSize) > BigInt(user.quotaLimit)) {
        fs.unlinkSync(storagePath); // Supprimer le fichier
        throw new Error('Quota exceeded');
      }

      // Créer l'entrée dans la BDD
      const file = await prisma.file.create({
        data: {
          name: finalFileName,
          originalName: finalFileName,
          mimeType: 'text/plain',
          size: BigInt(fileSize),
          storagePath,
          userId,
          folderId: folderId || null,
          category: 'doc',
        },
        include: {
          folder: true,
        },
      });

      // Mettre à jour le quota utilisateur
      await prisma.user.update({
        where: { id: userId },
        data: {
          quotaUsed: BigInt(user.quotaUsed) + BigInt(fileSize),
        },
      });

      return {
        file,
        content: generatedContent,
        message: `Fichier "${finalFileName}" créé avec succès !`,
      };
    } catch (error: any) {
      console.error('Error creating generated file:', error);
      throw new Error(`Failed to create file: ${error.message}`);
    }
  }

  /**
   * Chat général avec l'IA (pour les conversations normales)
   */
  async chat(userId: string, message: string, conversationHistory?: any[]): Promise<string> {
    if (!this.cohere) {
      return "Je suis désolé, mais mon service d'IA n'est pas encore configuré (Clé API Cohere manquante). Veuillez contacter l'administrateur.";
    }
    try {
      console.log(`[Bobby] Using model: ${this.model}`);

      // Définir les fonctions disponibles
      const availableFunctions = [
        {
          name: 'searchFiles',
          description: 'Recherche des fichiers dans la base de données de l\'utilisateur. Utilise cette fonction quand l\'utilisateur demande à voir, lister ou trouver des fichiers.',
          parameters: {
            type: 'object',
            properties: {
              keyword: {
                type: 'string',
                description: 'Mot-clé à rechercher dans le nom du fichier',
              },
            },
            required: [],
          },
        },
      ];

      // Ajouter un message système pour expliquer les capacités
      const systemMessage = `Tu es Bobby le robot, un assistant IA intégré dans l'application SUPFILE de gestion de fichiers. Tu as accès aux fichiers de l'utilisateur via des fonctions spéciales.

IMPORTANT :
- Quand l'utilisateur demande à VOIR, LISTER ou CHERCHER des fichiers (ex: "liste mes fichiers", "montre mes images"), utilise la fonction searchFiles
- Quand l'utilisateur demande "qu'est-ce que [nom de fichier]", "analyse [nom de fichier]", "que contient [nom de fichier]" ou "décris [nom de fichier]", tu dois utiliser searchFiles pour trouver le fichier par son nom
- Si l'utilisateur dit "analyse le" ou "analyse la" ou "que contient il" SANS préciser de nom, regarde dans l'historique de conversation pour trouver le dernier fichier mentionné et utilise searchFiles avec ce nom de fichier

Tu peux aider l'utilisateur avec ses fichiers, la recherche, et l'organisation.`;

      // Préparer les messages
      const messages: any[] = [{ role: 'system', content: systemMessage }];

      // Ajouter l'historique de conversation
      if (conversationHistory && conversationHistory.length > 0) {
        conversationHistory.forEach((msg) => {
          if (msg.role === 'user' || msg.role === 'model') {
            messages.push({
              role: msg.role === 'model' ? 'assistant' : 'user',
              content: msg.parts[0].text,
            });
          }
        });
      }

      // Ajouter le message actuel
      messages.push({ role: 'user', content: message });

      const response = await this.cohere.chat({
        model: this.model,
        messages: messages,
        tools: availableFunctions.map((f) => ({ type: 'function', function: f })),
      });

      const toolCalls = response.message?.toolCalls;

      if (toolCalls && toolCalls.length > 0) {
        const functionCall = toolCalls[0];

        // Appeler searchFiles
        if (functionCall.function?.name === 'searchFiles') {
          console.log('[Bobby] Calling searchFiles for userId:', userId);
          const searchResult = await this.searchFiles(userId, message);
          console.log('[Bobby] Search result:', searchResult);

          // Vérifier si l'utilisateur veut analyser un fichier spécifique
          const isAnalysisRequest = message.toLowerCase().match(/qu'est-ce que|analyse|décris|décrit|c'est quoi|que contient/);

          if (isAnalysisRequest && searchResult.files && searchResult.files.length === 1) {
            // Si c'est une demande d'analyse et qu'on a trouvé exactement 1 fichier, l'analyser
            console.log('[Bobby] Analyzing single file found:', searchResult.files[0].id);
            const file = searchResult.files[0];
            const analysis = await this.analyzeFile(file.id, userId, message);
            return `Voici l'analyse de **${file.name}** :\n\n${analysis}`;
          }

          // Si l'utilisateur dit "analyse le/la" sans nom de fichier mais qu'on a trouvé des fichiers
          const isSimpleAnalysisRequest = message.toLowerCase().match(/^(analyse|décris|décrit)[\s-]*(le|la|les|l'|ce|cette|celui|celle)?$/i);
          if (isSimpleAnalysisRequest && searchResult.files && searchResult.files.length === 1) {
            console.log('[Bobby] Simple analysis request, analyzing:', searchResult.files[0].id);
            const file = searchResult.files[0];
            const analysis = await this.analyzeFile(file.id, userId, 'Décris le contenu de ce fichier de manière détaillée.');
            return `Voici l'analyse de **${file.name}** :\n\n${analysis}`;
          }

          // Formater la réponse
          if (searchResult.files && searchResult.files.length > 0) {
            const filesList = searchResult.files.map((f: any) =>
              `- ${f.name} (${f.category || 'non catégorisé'}, ${(Number(f.size) / 1024).toFixed(2)} KB) - Modifié le ${new Date(f.updatedAt).toLocaleDateString('fr-FR')}`
            ).join('\n');

            return `${searchResult.message}\n\n${filesList}`;
          } else {
            return searchResult.message;
          }
        }
      }

      return (response.message.content as any)?.[0]?.text || 'Désolé, je n\'ai pas pu traiter votre demande.';
    } catch (error: any) {
      console.error('Error in chat:', error);

      // Détecter les erreurs de rate limit
      if (error.message && error.message.includes('429')) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }

      throw new Error(`Chat failed: ${error.message}`);
    }
  }
}

export default new AIService();
