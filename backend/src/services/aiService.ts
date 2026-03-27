// Logic split into AIFileService and AIChatService
export { AIFileService } from './aiFileService';
export { AIChatService } from './aiChatService';

import { CohereClientV2 } from 'cohere-ai';
import logger from '../config/logger';
import { AIFileService } from './aiFileService';
import { AIChatService } from './aiChatService';

class AIService {
  private fileService: AIFileService;
  private chatService: AIChatService;
  private cohere: CohereClientV2;
  private model: string;

  constructor() {
    const apiKey = process.env.COHERE_API_KEY;
    this.model = process.env.COHERE_MODEL || 'command-r-plus-08-2024';

    if (!apiKey) {
      logger.warn('COHERE_API_KEY not found. Bobby will not be available.');
      this.cohere = null as any;
    } else {
      this.cohere = new CohereClientV2({ token: apiKey });
    }

    this.fileService = new AIFileService(this.cohere, this.model);
    this.chatService = new AIChatService(this.cohere, this.model, this.fileService);
  }

  async analyzeFile(fileId: string, userId: string, userPrompt?: string) {
    return this.fileService.analyzeFile(fileId, userId, userPrompt);
  }

  async searchFiles(userId: string, userPrompt: string) {
    return this.chatService.searchFiles(userId, userPrompt);
  }

  async createGeneratedFile(userId: string, prompt: string, fileName?: string, folderId?: string) {
    return this.fileService.createGeneratedFile(userId, prompt, fileName, folderId);
  }

  async chat(userId: string, message: string, conversationHistory?: any[]) {
    if (!this.cohere) {
      return "Je suis désolé, mais mon service d'IA n'est pas encore configuré (Clé API Cohere manquante). Veuillez contacter l'administrateur.";
    }
    return this.chatService.chat(userId, message, conversationHistory);
  }
}

export default new AIService();
