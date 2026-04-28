import { Request, Response } from 'express';
import { authService } from './auth.service';
import { success } from '../../utils/response';
import { AppError } from '../../utils/response';

export const authController = {
  async login(req: Request, res: Response) {
    const result = await authService.login(
      req.body,
      req.ip,
      req.headers['user-agent'],
    );
    return success(res, result, 'Login successful');
  },

  async refresh(req: Request, res: Response) {
    const result = await authService.refresh(req.body.refreshToken);
    return success(res, result, 'Token refreshed');
  },

  async logout(req: Request, res: Response) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
    const refreshToken = req.body?.refreshToken as string | undefined;
    if (refreshToken) {
      await authService.logout(refreshToken, req.user.id);
    }
    return success(res, null, 'Logged out');
  },

  async me(req: Request, res: Response) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
    const profile = await authService.getProfile(req.user.id);
    return success(res, profile);
  },

  async updateProfile(req: Request, res: Response) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
    const updated = await authService.updateProfile(req.user.id, req.body);
    return success(res, updated, 'Profile updated');
  },

  async changePassword(req: Request, res: Response) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
    await authService.changePassword(req.user.id, req.body);
    return success(res, null, 'Password changed. Please login again.');
  },
};
