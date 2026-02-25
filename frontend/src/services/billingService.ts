import api from './api';

export const billingService = {
  async createCheckoutSession(plan: 'PRO' | 'BUSINESS' | 'ENTERPRISE'): Promise<{ id: string; url: string | null }> {
    const response = await api.post('/billing/checkout-session', { plan });
    return response.data;
  },

  async createPortalSession(): Promise<{ url: string }> {
    const response = await api.post('/billing/portal-session');
    return response.data;
  },
};
