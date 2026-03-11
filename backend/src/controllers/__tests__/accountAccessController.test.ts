import { AccountAccessController } from '../accountAccessController';
import { AccountAccessService } from '../../services/accountAccessService';
import { AuditService } from '../../services/auditService';
import { ensureSwitchSessionId } from '../../utils/cookies';

jest.mock('../../services/accountAccessService', () => ({
  AccountAccessService: {
    createSwitchToken: jest.fn(),
    assumeDelegation: jest.fn(),
  },
}));

jest.mock('../../services/auditService', () => ({
  AuditService: {
    createLog: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../utils/cookies', () => ({
  ensureSwitchSessionId: jest.fn(),
}));

const createRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('AccountAccessController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ensureSwitchSessionId as jest.Mock).mockReturnValue('switch-session-1');
  });

  describe('switchToLinkedAccount', () => {
    it('should return REAUTH_REQUIRED when switch session is too old', async () => {
      (AccountAccessService.createSwitchToken as jest.Mock).mockResolvedValue({
        reauthRequired: true,
      });

      const req: any = {
        user: { id: 'root-user' },
        params: { linkId: 'link-1' },
      };
      const res = createRes();

      await AccountAccessController.switchToLinkedAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Re-authentification requise pour continuer le switch',
        code: 'REAUTH_REQUIRED',
      });
      expect(AuditService.createLog).not.toHaveBeenCalled();
    });

    it('should switch account when link is valid', async () => {
      (AccountAccessService.createSwitchToken as jest.Mock).mockResolvedValue({
        reauthRequired: false,
        token: 'switched-token',
        user: { id: 'target-user', email: 'target@example.com' },
      });

      const req: any = {
        user: { id: 'root-user' },
        params: { linkId: 'link-1' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('jest-test'),
      };
      const res = createRes();

      await AccountAccessController.switchToLinkedAccount(req, res);

      expect(AccountAccessService.createSwitchToken).toHaveBeenCalledWith(
        'root-user',
        'link-1',
        'switch-session-1'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        token: 'switched-token',
        user: { id: 'target-user', email: 'target@example.com' },
      });
      expect(AuditService.createLog).toHaveBeenCalledTimes(2);
    });
  });

  describe('assumeDelegation', () => {
    it('should assume delegation and return delegated token', async () => {
      (AccountAccessService.assumeDelegation as jest.Mock).mockResolvedValue({
        token: 'delegated-token',
        user: { id: 'owner-user', email: 'owner@example.com' },
        delegation: {
          id: 'delegation-1',
          canRead: true,
          canWrite: false,
          canDelete: false,
          canShare: false,
          expiresAt: null,
        },
      });

      const req: any = {
        user: { id: 'delegate-user' },
        params: { delegationId: 'delegation-1' },
        ip: '127.0.0.1',
      };
      const res = createRes();

      await AccountAccessController.assumeDelegation(req, res);

      expect(AccountAccessService.assumeDelegation).toHaveBeenCalledWith(
        'delegate-user',
        'delegation-1',
        'switch-session-1'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        token: 'delegated-token',
        user: { id: 'owner-user', email: 'owner@example.com' },
        delegation: {
          id: 'delegation-1',
          canRead: true,
          canWrite: false,
          canDelete: false,
          canShare: false,
          expiresAt: null,
        },
      });
    });
  });
});
