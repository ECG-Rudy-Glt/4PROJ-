import api from './api';

function unwrap<T>(data: any): T {
  return (data?.success === true && 'data' in data) ? data.data : data;
}

export const billingService = {
  async createCheckoutSession(planId: string): Promise<{ url: string }> {
    const res = await api.post('/billing/checkout-session', { planId });
    return unwrap(res.data);
  },

  async downgradeToFree(): Promise<void> {
    await api.post('/billing/downgrade-free');
  },
};
