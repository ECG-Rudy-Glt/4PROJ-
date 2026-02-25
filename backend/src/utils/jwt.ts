import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface TokenContextOptions {
  switchRootUserId?: string;
  switchSessionId?: string;
  delegatedByUserId?: string;
  delegationId?: string;
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
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
};
