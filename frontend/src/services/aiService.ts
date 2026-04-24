import api from './api';

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface ChatResponse {
  response: string;
  timestamp: string;
}

export interface AnalyzeFileResponse {
  fileId: string;
  analysis: string;
  timestamp: string;
}

export interface SearchFilesResponse {
  files: any[];
  searchCriteria?: any;
  message: string;
  timestamp: string;
}

export interface GenerateFileResponse {
  file: any;
  content: string;
  message: string;
  timestamp: string;
}

export const aiService = {
  /**
   * Chat général avec Bobby le robot
   */
  async chat(message: string, history?: ChatMessage[]): Promise<ChatResponse> {
    const response = await api.post('/ai/chat', { message, history });
    return response.data;
  },

  /**
   * Analyser un fichier
   */
  async analyzeFile(fileId: string, prompt?: string): Promise<AnalyzeFileResponse> {
    const response = await api.post('/ai/analyze-file', { fileId, prompt });
    return response.data;
  },

  /**
   * Rechercher des fichiers avec l'IA
   */
  async searchFiles(query: string): Promise<SearchFilesResponse> {
    const response = await api.post('/ai/search-files', { query });
    return response.data;
  },

  /**
   * Générer un fichier avec l'IA
   */
  async generateFile(
    prompt: string,
    fileName?: string,
    folderId?: string
  ): Promise<GenerateFileResponse> {
    const response = await api.post('/ai/generate-file', { prompt, fileName, folderId });
    return response.data;
  },
};
