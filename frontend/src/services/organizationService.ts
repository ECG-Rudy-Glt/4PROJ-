import api from './api';
import { OrganizationMemberRow, OrganizationMembership } from '@/types';

export const organizationService = {
  async listMine(): Promise<{ organizations: OrganizationMembership[] }> {
    const response = await api.get('/organizations/mine');
    return response.data;
  },

  async create(name: string): Promise<{ organization: { id: string; name: string; slug: string } }> {
    const response = await api.post('/organizations', { name });
    return response.data;
  },

  async getById(orgId: string): Promise<{
    organization: {
      id: string;
      name: string;
      slug: string;
      createdAt: string;
      updatedAt: string;
      members: OrganizationMemberRow[];
    };
    membershipRole: 'OWNER' | 'ADMIN' | 'MEMBER';
  }> {
    const response = await api.get(`/organizations/${orgId}`);
    return response.data;
  },

  async addMember(orgId: string, email: string, role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'MEMBER') {
    const response = await api.post(`/organizations/${orgId}/members`, { email, role });
    return response.data;
  },

  async updateMemberRole(orgId: string, memberId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER') {
    const response = await api.patch(`/organizations/${orgId}/members/${memberId}`, { role });
    return response.data;
  },

  async removeMember(orgId: string, memberId: string) {
    const response = await api.delete(`/organizations/${orgId}/members/${memberId}`);
    return response.data;
  },

  async switchCurrent(orgId: string) {
    const response = await api.post(`/organizations/${orgId}/switch`);
    return response.data;
  },
};
