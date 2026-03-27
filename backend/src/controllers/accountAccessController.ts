import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { AccountAccessService } from '../services/accountAccessService';
import { AuditService } from '../services/auditService';
import { ensureSwitchSessionId } from '../utils/cookies';

const getRootUserId = (req: AuthRequest) => req.authContext?.rootUserId || req.user!.id;
const getActorUserId = (req: AuthRequest) => req.authContext?.actorUserId || req.user!.id;

export class AccountAccessController {
  static async listSwitchLinks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const links = await AccountAccessService.listSwitchLinks(getRootUserId(req));
      res.status(200).json({ links });
    } catch (error) { next(error); }
  }

  static async addSwitchLink(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rootUserId = getRootUserId(req);
      const { email, password, mfaCode, backupCode, label } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'email et password sont requis' });
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

      res.status(201).json({ link });
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

      res.status(200).json({ message: 'Lien de switch révoqué' });
    } catch (error) { next(error); }
  }

  static async switchToLinkedAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const rootUserId = getRootUserId(req);
      const { linkId } = req.params;
      const switchSessionId = ensureSwitchSessionId(req, res);

      const result = await AccountAccessService.createSwitchToken(rootUserId, linkId, switchSessionId);
      if (result.reauthRequired) {
        res.status(401).json({
          error: 'Re-authentification requise pour continuer le switch',
          code: 'REAUTH_REQUIRED',
        });
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

      res.status(200).json({
        token: result.token,
        user: result.user,
      });
    } catch (error) { next(error); }
  }

  static async switchBack(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.authContext || req.authContext.authType === 'DIRECT') {
        res.status(400).json({ error: 'Aucune session déléguée/switch active' });
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

      res.status(200).json({
        token: result.token,
        user: result.user,
      });
    } catch (error) { next(error); }
  }

  static async grantDelegation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const ownerUserId = req.user!.id;
      const { delegateEmail, permissions, expiresAt } = req.body;

      if (!delegateEmail) {
        res.status(400).json({ error: 'delegateEmail est requis' });
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

      res.status(201).json({ delegation });
    } catch (error) { next(error); }
  }

  static async listDelegations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await AccountAccessService.listDelegations(req.user!.id);
      res.status(200).json(data);
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

      res.status(200).json({ message: 'Délégation révoquée' });
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

      res.status(200).json(result);
    } catch (error) { next(error); }
  }
}

