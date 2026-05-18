import { Role } from '@prisma/client';
import { BillingController } from '../billingController';
import { BillingService } from '../../services/billingService';

jest.mock('../../services/billingService', () => ({
  BillingService: {
    createCheckoutSession: jest.fn(),
    createBillingPortalSession: jest.fn(),
    constructWebhookEvent: jest.fn(),
    handleWebhookEvent: jest.fn(),
    downgradeToFree: jest.fn(),
  },
}));

const createRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('BillingController', () => {
  const originalStripeKey = process.env.STRIPE_SECRET_KEY;
  const originalFrontendUrl = process.env.FRONTEND_URL;
  const originalProPrice = process.env.STRIPE_PRICE_PRO_MONTHLY;
  const originalBusinessPrice = process.env.STRIPE_PRICE_BUSINESS_MONTHLY;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_PRO_MONTHLY;
    delete process.env.STRIPE_PRICE_BUSINESS_MONTHLY;
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  afterAll(() => {
    if (originalStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalStripeKey;
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
    if (originalProPrice === undefined) delete process.env.STRIPE_PRICE_PRO_MONTHLY;
    else process.env.STRIPE_PRICE_PRO_MONTHLY = originalProPrice;
    if (originalBusinessPrice === undefined) delete process.env.STRIPE_PRICE_BUSINESS_MONTHLY;
    else process.env.STRIPE_PRICE_BUSINESS_MONTHLY = originalBusinessPrice;
  });

  describe('createCheckoutSession', () => {
    it('should reject checkout when Stripe test key is missing', async () => {
      const req: any = {
        user: { id: 'user-1', role: Role.USER },
        body: { plan: 'PRO' },
      };
      const res = createRes();

      await BillingController.createCheckoutSession(req, res, jest.fn());

      expect(BillingService.createCheckoutSession).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Stripe test is not configured',
        code: 'BILLING_NOT_CONFIGURED',
      });
    });

    it('should use Stripe checkout when Stripe key is configured', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';
      process.env.STRIPE_PRICE_BUSINESS_MONTHLY = 'price_business_test';
      (BillingService.createCheckoutSession as jest.Mock).mockResolvedValue({
        url: 'https://checkout.stripe.test/session',
      });

      const req: any = {
        user: { id: 'user-2', role: Role.USER },
        body: { plan: 'BUSINESS' },
      };
      const res = createRes();

      await BillingController.createCheckoutSession(req, res, jest.fn());

      expect(BillingService.createCheckoutSession).toHaveBeenCalledWith('user-2', 'BUSINESS');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          url: 'https://checkout.stripe.test/session',
        },
      });
    });
  });
});

