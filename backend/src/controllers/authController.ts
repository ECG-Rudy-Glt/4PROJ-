import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { AuthRequest } from '../types';
import { generateToken } from '../utils/jwt';

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, firstName, lastName } = req.body;

      const result = await AuthService.register(email, password, firstName, lastName);

      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      const result = await AuthService.login(email, password);

      res.status(200).json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }

  static async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          quotaUsed: user.quotaUsed,
          quotaLimit: user.quotaLimit,
          theme: user.theme,
          createdAt: user.createdAt,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { firstName, lastName, avatar, theme } = req.body;

      const user = await AuthService.updateProfile(userId, {
        firstName,
        lastName,
        avatar,
        theme,
      });

      res.status(200).json({ user });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async changePassword(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { oldPassword, newPassword } = req.body;

      const result = await AuthService.changePassword(userId, oldPassword, newPassword);

      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async oauthCallback(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const token = generateToken(user.id, user.email);

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    } catch (error: any) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/callback?error=${error.message}`);
    }
  }

  static async uploadAvatar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Generate avatar URL
      const avatarUrl = `/uploads/avatars/${file.filename}`;

      // Update user profile with new avatar
      const user = await AuthService.updateProfile(userId, {
        avatar: avatarUrl,
      });

      res.status(200).json({ avatarUrl, user });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
