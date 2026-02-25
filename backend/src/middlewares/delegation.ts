import { NextFunction, Response } from 'express';
import { AuthRequest } from '../types';

type DelegationPermission = 'read' | 'write' | 'delete' | 'share';

const PERMISSION_MAP: Record<DelegationPermission, keyof NonNullable<AuthRequest['authContext']>['delegation']> = {
  read: 'canRead',
  write: 'canWrite',
  delete: 'canDelete',
  share: 'canShare',
};

export const requireDelegationPermission = (permission: DelegationPermission) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.authContext?.authType !== 'DELEGATION') {
      next();
      return;
    }

    const delegation = req.authContext.delegation;
    if (!delegation) {
      res.status(403).json({ error: 'Delegation context missing' });
      return;
    }

    const key = PERMISSION_MAP[permission];
    if (!delegation[key]) {
      res.status(403).json({ error: `Delegation does not allow ${permission} actions` });
      return;
    }

    next();
  };
};

