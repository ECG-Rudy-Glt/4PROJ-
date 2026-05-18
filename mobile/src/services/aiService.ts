import api from './api';

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface ChatResponse {
  response: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyzeFileResponse {
  fileId: string;
  analysis: string;
  timestamp: string;
}

export interface SearchFilesResponse {
  files: { id: string; name: string; mimeType: string }[];
  message: string;
  timestamp: string;
}

export const aiService = {
  async chat(message: string, history?: ChatMessage[]): Promise<ChatResponse> {
    const res = await api.post('/ai/chat', { message, history });
    return res.data as ChatResponse;
  },

  async getConversations(): Promise<Conversation[]> {
    const res = await api.get('/ai/conversations');
    return res.data as Conversation[];
  },

  async deleteConversation(id: string): Promise<void> {
    await api.delete(`/ai/conversations/${id}`);
  },

  async analyzeFile(fileId: string, prompt?: string): Promise<AnalyzeFileResponse> {
    const res = await api.post('/ai/analyze-file', { fileId, prompt });
    return res.data as AnalyzeFileResponse;
  },

  async searchFiles(query: string): Promise<SearchFilesResponse> {
    const res = await api.post('/ai/search-files', { query });
    return res.data as SearchFilesResponse;
  },
};
