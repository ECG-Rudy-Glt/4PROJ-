import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { AccountAccessService } from '../services/accountAccessService';
import { AuditService } from '../services/auditService';
import { ensureSwitchSessionId } from '../utils/cookies';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { getRootUserId, getActorUserId } from '../utils/authHelpers';

export class AccountAccessController {
  static async listSwitchLinks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const links = await AccountAccessService.listSwitchLinks(getRootUserId(req));
      sendSuccess(res, { links });
    } catch (error) { next(error); }
  }

  static async addSwitchLink(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rootUserId = getRootUserId(req);
      const { email, password, mfaCode, backupCode, label } = req.body;

      if (!email || !password) {
        sendError(res, 'email et password sont requis', 400);
        return;
      }

      const link = await AccountAccessService.linkAccount(rootUserId, {
        email: String(email),
        password: String(password),
        mfaCode: mfaCode ? String(mfaCode) : undefined,
        backupCode: backupCode ? String(backupCode) : undefined,
        label: label ? String(label) : undefined,
      });

      await AuditService.createLog(getActorUserId(req), 'ACCOUNT_SWITCH_LINK_ADDED', {
        rootUserId,
        targetUserId: link.targetUser.id,
        targetEmail: link.targetUser.email,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      sendCreated(res, { link });
    } catch (error) { next(error); }
  }

  static async revokeSwitchLink(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rootUserId = getRootUserId(req);
      const { linkId } = req.params;

      const revoked = await AccountAccessService.revokeSwitchLink(rootUserId, linkId);
      await AuditService.createLog(getActorUserId(req), 'ACCOUNT_SWITCH_LINK_REVOKED', {
        rootUserId,
        linkId: revoked.id,
        targetUserId: revoked.targetUserId,
      });

      sendSuccess(res, { message: 'Lien de switch révoqué' });
    } catch (error) { next(error); }
  }

  static async switchToLinkedAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rootUserId = getRootUserId(req);
      const { linkId } = req.params;
      const switchSessionId = ensureSwitchSessionId(req, res);

      const result = await AccountAccessService.createSwitchToken(rootUserId, linkId, switchSessionId);
      if (result.reauthRequired) {
        sendError(res, 'Re-authentification requise pour continuer le switch', 401, 'REAUTH_REQUIRED');
        return;
      }

      await AuditService.createLog(getActorUserId(req), 'ACCOUNT_SWITCH', {
        rootUserId,
        switchedToUserId: result.user.id,
        switchedToEmail: result.user.email,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      await AuditService.createLog(result.user.id, 'ACCOUNT_SWITCH', {
        rootUserId,
        switchedByUserId: getActorUserId(req),
        ipAddress: req.ip,
      });

      sendSuccess(res, {
        token: result.token,
        user: result.user,
        switchSessionId,
        authContext: {
          authType: 'SWITCH',
          rootUserId,
          actorUserId: rootUserId,
        },
      });
    } catch (error) { next(error); }
  }

  static async switchBack(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.authContext || req.authContext.authType === 'DIRECT') {
        sendError(res, 'Aucune session déléguée/switch active', 401);
        return;
      }

      const rootUserId = req.authContext.rootUserId;
      const result = await AccountAccessService.createRootToken(rootUserId);

      const action = req.authContext.authType === 'DELEGATION' ? 'DELEGATION_STOP' : 'ACCOUNT_SWITCH_BACK';
      await AuditService.createLog(getActorUserId(req), action, {
        fromUserId: req.user!.id,
        backToUserId: rootUserId,
        ipAddress: req.ip,
      });

      sendSuccess(res, {
        token: result.token,
        user: result.user,
        authContext: {
          authType: 'DIRECT',
          rootUserId,
          actorUserId: rootUserId,
        },
      });
    } catch (error) { next(error); }
  }

  static async grantDelegation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const ownerUserId = req.user!.id;
      const { delegateEmail, permissions, expiresAt } = req.body;

      if (!delegateEmail) {
        sendError(res, 'delegateEmail est requis', 400);
        return;
      }

      const delegation = await AccountAccessService.grantDelegation(ownerUserId, {
        delegateEmail: String(delegateEmail),
        permissions,
        expiresAt: expiresAt ? String(expiresAt) : null,
      });

      await AuditService.createLog(ownerUserId, 'DELEGATION_GRANTED', {
        delegationId: delegation.id,
        delegateUserId: delegation.delegateUserId,
        delegateEmail: delegation.delegate.email,
        permissions: {
          canRead: delegation.canRead,
          canWrite: delegation.canWrite,
          canDelete: delegation.canDelete,
          canShare: delegation.canShare,
        },
        expiresAt: delegation.expiresAt,
      });

      sendCreated(res, { delegation });
    } catch (error) { next(error); }
  }

  static async listDelegations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await AccountAccessService.listDelegations(req.user!.id);
      sendSuccess(res, data);
    } catch (error) { next(error); }
  }

  static async revokeDelegation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const ownerUserId = req.user!.id;
      const { delegationId } = req.params;
      const delegation = await AccountAccessService.revokeDelegation(ownerUserId, delegationId);

      await AuditService.createLog(ownerUserId, 'DELEGATION_REVOKED', {
        delegationId: delegation.id,
        delegateUserId: delegation.delegateUserId,
      });

      sendSuccess(res, { message: 'Délégation révoquée' });
    } catch (error) { next(error); }
  }

  static async assumeDelegation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const delegateUserId = req.user!.id;
      const { delegationId } = req.params;
      const switchSessionId = ensureSwitchSessionId(req, res);

      const result = await AccountAccessService.assumeDelegation(delegateUserId, delegationId, switchSessionId);

      await AuditService.createLog(delegateUserId, 'DELEGATION_ASSUME', {
        delegationId,
        actingOnBehalfOfUserId: result.user.id,
        permissions: result.delegation,
        ipAddress: req.ip,
      });
      await AuditService.createLog(result.user.id, 'DELEGATION_ASSUME', {
        delegationId,
        delegatedByUserId: delegateUserId,
        ipAddress: req.ip,
      });

      sendSuccess(res, {
        ...result,
        switchSessionId,
        authContext: {
          authType: 'DELEGATION',
          rootUserId: delegateUserId,
          actorUserId: delegateUserId,
          delegation: result.delegation,
        },
      });
    } catch (error) { next(error); }
  }
}
