import api from './api';
import { User } from '@/types';

export interface AccountSwitchLink {
  id: string;
  label?: string | null;
  expiresAt: string;
  lastAuthenticatedAt: string;
  createdAt: string;
  targetUser: User;
}

export interface DelegationRecord {
  id: string;
  ownerUserId: string;
  delegateUserId: string;
  status: 'ACTIVE' | 'REVOKED';
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canShare: boolean;
  startsAt: string;
  expiresAt: string | null;
  revokedAt?: string | null;
  ownerUser?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    accountStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  };
  delegateUser?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    accountStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  };
}

export const accountAccessService = {
  async listSwitchLinks(): Promise<{ links: AccountSwitchLink[] }> {
    const response = await api.get('/account-access/switch-links');
    return response.data;
  },

  async addSwitchLink(payload: {
    email: string;
    password: string;
    mfaCode?: string;
    backupCode?: string;
    label?: string;
  }): Promise<{ link: AccountSwitchLink }> {
    const response = await api.post('/account-access/switch-links', payload);
    return response.data;
  },

  async revokeSwitchLink(linkId: string): Promise<{ message: string }> {
    const response = await api.delete(`/account-access/switch-links/${linkId}`);
    return response.data;
  },

  async switchToLinkedAccount(linkId: string): Promise<{ token: string; user: User; authContext: any; switchSessionId: string }> {
    const response = await api.post(`/account-access/switch-links/${linkId}/switch`);
    return response.data;
  },

  async switchBack(): Promise<{ token: string; user: User; authContext: any }> {
    const response = await api.post('/account-access/switch/back');
    return response.data;
  },

  async listDelegations(): Promise<{ given: DelegationRecord[]; received: DelegationRecord[] }> {
    const response = await api.get('/account-access/delegations');
    return response.data;
  },

  async grantDelegation(payload: {
    delegateEmail: string;
    permissions?: {
      canRead?: boolean;
      canWrite?: boolean;
      canDelete?: boolean;
      canShare?: boolean;
    };
    expiresAt?: string | null;
  }): Promise<{ delegation: DelegationRecord }> {
    const response = await api.post('/account-access/delegations', payload);
    return response.data;
  },

  async revokeDelegation(delegationId: string): Promise<{ message: string }> {
    const response = await api.patch(`/account-access/delegations/${delegationId}/revoke`);
    return response.data;
  },

  async assumeDelegation(delegationId: string): Promise<{
    token: string;
    user: User;
    authContext: any;
    switchSessionId: string;
  }> {
    const response = await api.post(`/account-access/delegations/${delegationId}/assume`);
    return response.data;
  },
};

