import api from './api';

export interface UserBasicInfo {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export const userService = {
  async searchUsers(query: string, limit: number = 10): Promise<{ users: UserBasicInfo[] }> {
    const response = await api.get(`/users/search`, {
      params: { query, limit },
    });
    return response.data;
  },

  async getUserInfo(userId: string): Promise<{ user: UserBasicInfo }> {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },
};
