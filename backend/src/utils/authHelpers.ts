import { AuthRequest } from '../types';

export const getRootUserId = (req: AuthRequest): string =>
  req.authContext?.rootUserId || req.user!.id;

export const getActorUserId = (req: AuthRequest): string =>
  req.authContext?.actorUserId || req.user!.id;
