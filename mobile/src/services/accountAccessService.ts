import api from './api';
import { User } from '../types';

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
  ownerUser?: { id: string; email: string; firstName?: string | null; lastName?: string | null };
  delegateUser?: { id: string; email: string; firstName?: string | null; lastName?: string | null };
}

export const accountAccessService = {
  async listSwitchLinks(): Promise<{ links: AccountSwitchLink[] }> {
    const res = await api.get('/account-access/switch-links');
    return res.data;
  },

  async addSwitchLink(payload: {
    email: string;
    password: string;
    mfaCode?: string;
    backupCode?: string;
    label?: string;
  }): Promise<{ link: AccountSwitchLink }> {
    const res = await api.post('/account-access/switch-links', payload);
    return res.data;
  },

  async revokeSwitchLink(linkId: string): Promise<void> {
    await api.delete(`/account-access/switch-links/${linkId}`);
  },

  async switchToLinkedAccount(linkId: string): Promise<{ token: string; user: User }> {
    const res = await api.post(`/account-access/switch-links/${linkId}/switch`);
    return res.data;
  },

  async switchBack(): Promise<{ token: string; user: User }> {
    const res = await api.post('/account-access/switch/back');
    return res.data;
  },

  async listDelegations(): Promise<{ given: DelegationRecord[]; received: DelegationRecord[] }> {
    const res = await api.get('/account-access/delegations');
    return res.data;
  },

  async grantDelegation(payload: {
    delegateEmail: string;
    permissions?: { canRead?: boolean; canWrite?: boolean; canDelete?: boolean; canShare?: boolean };
    expiresAt?: string | null;
  }): Promise<{ delegation: DelegationRecord }> {
    const res = await api.post('/account-access/delegations', payload);
    return res.data;
  },

  async revokeDelegation(delegationId: string): Promise<void> {
    await api.patch(`/account-access/delegations/${delegationId}/revoke`);
  },

  async assumeDelegation(delegationId: string): Promise<{ token: string; user: User }> {
    const res = await api.post(`/account-access/delegations/${delegationId}/assume`);
    return res.data;
  },
};
