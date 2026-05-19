import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types';
import { getJwtSecret } from '../config/secrets';

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface TokenContextOptions {
  switchRootUserId?: string;
  switchSessionId?: string;
  delegatedByUserId?: string;
  delegationId?: string;
  /** DEK enveloppée (base64) à inclure dans le payload JWT. */
  wrappedDek?: string;
}

export const generateToken = (
  userId: string,
  email: string,
  tokenVersion: number = 1,
  context?: TokenContextOptions
): string => {
  const payload: JWTPayload = {
    userId,
    email,
    tokenVersion,
    ...(context?.switchRootUserId ? { switchRootUserId: context.switchRootUserId } : {}),
    ...(context?.switchSessionId ? { switchSessionId: context.switchSessionId } : {}),
    ...(context?.delegatedByUserId ? { delegatedByUserId: context.delegatedByUserId } : {}),
    ...(context?.delegationId ? { delegationId: context.delegationId } : {}),
    ...(context?.wrappedDek ? { wrappedDek: context.wrappedDek } : {}),
    type: 'auth',
  };

  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, getJwtSecret()) as JWTPayload;
};
