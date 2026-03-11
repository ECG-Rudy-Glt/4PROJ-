import jwt from 'jsonwebtoken';
import prisma from '../../config/database';
import { authenticate } from '../auth';
import { PlanService } from '../../services/planService';

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    delegation: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../services/planService', () => ({
  PlanService: {
    getStorageLimit: jest.fn(),
  },
}));

jest.mock('../activityMiddleware', () => ({
  activityMiddleware: jest.fn((_req, _res, next) => next()),
}));

const createRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const baseUser = {
  id: 'user-1',
  email: 'user@example.com',
  password: 'hashed',
  accountStatus: 'ACTIVE',
  tokenVersion: 2,
  plan: 'FREE',
  quotaLimit: BigInt(1024),
  quotaUsed: BigInt(0),
};

describe('authenticate middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (PlanService.getStorageLimit as jest.Mock).mockReturnValue(BigInt(1024));
  });

  it('should reject contextual token when switch session cookie is invalid', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({
      userId: 'user-1',
      tokenVersion: 2,
      switchRootUserId: 'root-1',
      switchSessionId: 'expected-cookie',
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(baseUser);

    const req: any = {
      headers: {
        authorization: 'Bearer test-token',
        cookie: 'sf_switch_sid=wrong-cookie',
      },
      query: {},
    };
    const res = createRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid switch session cookie' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject delegation session when delegation is no longer valid', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({
      userId: 'owner-user',
      tokenVersion: 2,
      delegatedByUserId: 'delegate-user',
      delegationId: 'delegation-1',
      switchRootUserId: 'delegate-user',
      switchSessionId: 'valid-cookie',
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...baseUser,
      id: 'owner-user',
      tokenVersion: 2,
    });
    (prisma.delegation.findFirst as jest.Mock).mockResolvedValue(null);

    const req: any = {
      headers: {
        authorization: 'Bearer delegated-token',
        cookie: 'sf_switch_sid=valid-cookie',
      },
      query: {},
    };
    const res = createRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Delegation is no longer valid' });
    expect(next).not.toHaveBeenCalled();
  });
});
