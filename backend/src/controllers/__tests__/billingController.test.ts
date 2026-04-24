import { Role } from '@prisma/client';
import { BillingController } from '../billingController';
import prisma from '../../config/database';
import { PlanService } from '../../services/planService';
import { BillingService } from '../../services/billingService';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    user: {
      update: jest.fn(),
    },
  },
}));

jest.mock('../../services/planService', () => ({
  PlanService: {
    getStorageLimit: jest.fn(),
  },
}));

jest.mock('../../services/billingService', () => ({
  BillingService: {
    createCheckoutSession: jest.fn(),
    createBillingPortalSession: jest.fn(),
    constructWebhookEvent: jest.fn(),
    handleWebhookEvent: jest.fn(),
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

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.STRIPE_SECRET_KEY;
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  afterAll(() => {
    process.env.STRIPE_SECRET_KEY = originalStripeKey;
    process.env.FRONTEND_URL = originalFrontendUrl;
  });

  describe('createCheckoutSession', () => {
    it('should allow user bypass when Stripe key is missing', async () => {
      (PlanService.getStorageLimit as jest.Mock).mockReturnValue(BigInt(1234));

      const req: any = {
        user: { id: 'user-1', role: Role.USER },
        body: { plan: 'PRO' },
      };
      const res = createRes();

      await BillingController.createCheckoutSession(req, res, jest.fn());

      expect(PlanService.getStorageLimit).toHaveBeenCalledWith('PRO');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { plan: 'PRO', quotaLimit: BigInt(1234) },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          url: 'http://localhost:3000/plans?checkout=success',
        },
      });
    });

    it('should use Stripe checkout when Stripe key is configured', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';
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
      expect(prisma.user.update).not.toHaveBeenCalled();
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

