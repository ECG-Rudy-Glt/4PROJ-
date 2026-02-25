import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

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
    const response = await axios.post(
      `${API_URL}/api/ai/chat`,
      { message, history },
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Analyser un fichier
   */
  async analyzeFile(fileId: string, prompt?: string): Promise<AnalyzeFileResponse> {
    const response = await axios.post(
      `${API_URL}/api/ai/analyze-file`,
      { fileId, prompt },
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Rechercher des fichiers avec l'IA
   */
  async searchFiles(query: string): Promise<SearchFilesResponse> {
    const response = await axios.post(
      `${API_URL}/api/ai/search-files`,
      { query },
      { headers: getAuthHeaders() }
    );
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
    const response = await axios.post(
      `${API_URL}/api/ai/generate-file`,
      { prompt, fileName, folderId },
      { headers: getAuthHeaders() }
    );
    return response.data;
  },
};
