import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, JWTPayload } from '../types';
import prisma from '../config/database';
import { activityMiddleware } from './activityMiddleware';

export { AuthRequest };

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    // Try to get token from Authorization header
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    // If not in header, try query parameter (for media streaming)
    else if (req.query.token && typeof req.query.token === 'string') {
      token = req.query.token;
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

    // Global Logout: Check token version
    // If token has no version (old tokens), assume version 1
    const tokenVersion = decoded.tokenVersion || 1;
    if (user.tokenVersion !== tokenVersion) {
      console.log(`[Auth] Token version mismatch for user ${user.email}. Expected: ${user.tokenVersion}, Got: ${tokenVersion}`);
      res.status(401).json({ error: 'Session expired (global logout)' });
      return;
    }

    req.user = user;

    // Check activity / session timeout
    return activityMiddleware(req, res, next);
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
