import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, JWTPayload } from '../types';
import prisma from '../config/database';
import { activityMiddleware } from './activityMiddleware';
import { PlanService } from '../services/planService';
import { getCookieValue, SWITCH_SESSION_COOKIE } from '../utils/cookies';
import logger from '../config/logger';

export { AuthRequest };

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    logger.error('[FATAL] JWT_SECRET environment variable is not set. Refusing to start.');
    process.exit(1);
  }
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    // Token must come from the Authorization header only.
    // Query-param tokens are rejected: they leak into server logs and browser history.
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    if (user.accountStatus !== 'ACTIVE') {
      res.status(403).json({ error: 'Account inactive or suspended' });
      return;
    }

    // Global Logout: Check token version
    // If token has no version (old tokens), assume version 1
    const tokenVersion = decoded.tokenVersion || 1;
    if (user.tokenVersion !== tokenVersion) {
      logger.info(`[Auth] Token version mismatch for user ${user.email}. Expected: ${user.tokenVersion}, Got: ${tokenVersion}`);
      res.status(401).json({ error: 'Session expired (global logout)' });
      return;
    }

    const rootUserId = decoded.switchRootUserId || decoded.userId;
    const hasContextualSession =
      !!decoded.switchRootUserId || !!decoded.delegatedByUserId || !!decoded.switchSessionId;

    if (hasContextualSession) {
      // Accept switch session ID from cookie (web) or header (mobile)
      const switchSessionCookie =
        getCookieValue(req, SWITCH_SESSION_COOKIE) ||
        (req.headers['x-switch-session'] as string | undefined) ||
        null;
      if (!switchSessionCookie || !decoded.switchSessionId || switchSessionCookie !== decoded.switchSessionId) {
        res.status(401).json({ error: 'Invalid switch session cookie' });
        return;
      }
    }

    const authContext: AuthRequest['authContext'] = {
      authType: 'DIRECT',
      rootUserId,
      actorUserId: user.id,
    };

    if (decoded.delegatedByUserId) {
      const now = new Date();
      const delegation = await prisma.delegation.findFirst({
        where: {
          id: decoded.delegationId,
          ownerUserId: user.id,
          delegateUserId: decoded.delegatedByUserId,
          status: 'ACTIVE',
          revokedAt: null,
          startsAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: {
          id: true,
          canRead: true,
          canWrite: true,
          canDelete: true,
          canShare: true,
          expiresAt: true,
        },
      });

      if (!delegation) {
        res.status(401).json({ error: 'Delegation is no longer valid' });
        return;
      }

      const delegatedBy = await prisma.user.findUnique({
        where: { id: decoded.delegatedByUserId },
        select: { id: true, accountStatus: true },
      });

      if (!delegatedBy || delegatedBy.accountStatus !== 'ACTIVE') {
        res.status(401).json({ error: 'Delegate account inactive' });
        return;
      }

      authContext.authType = 'DELEGATION';
      authContext.actorUserId = decoded.delegatedByUserId;
      authContext.delegation = delegation;
    } else if (decoded.switchRootUserId && decoded.switchRootUserId !== decoded.userId) {
      authContext.authType = 'SWITCH';
      authContext.actorUserId = decoded.switchRootUserId;
    }

    if (rootUserId !== user.id) {
      const rootUser = await prisma.user.findUnique({
        where: { id: rootUserId },
        select: { id: true, accountStatus: true },
      });
      if (!rootUser || rootUser.accountStatus !== 'ACTIVE') {
        res.status(401).json({ error: 'Root session account inactive' });
        return;
      }
    }

    // Keep persisted quota limit aligned with current plan limits.
    const expectedQuotaLimit = PlanService.getStorageLimit(user.plan);
    if (BigInt(user.quotaLimit) !== expectedQuotaLimit) {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { quotaLimit: expectedQuotaLimit },
      });
      req.user = updatedUser;
    } else {
      req.user = user;
    }
    req.authContext = authContext;

    // Check activity / session timeout
    activityMiddleware(req, res, next);
    return;
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const JWT_SECRET = process.env.JWT_SECRET || '';
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    next();
  }
};
