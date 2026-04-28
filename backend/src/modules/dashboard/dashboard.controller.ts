import { Request, Response } from 'express';
import { dashboardService } from './dashboard.service';
import { AppError, success } from '../../utils/response';

export const dashboardController = {
  async sales(req: Request, res: Response) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
    const stats = await dashboardService.getSalesStats(req.user.id);
    return success(res, stats);
  },

  async approver(_req: Request, res: Response) {
    const stats = await dashboardService.getApproverStats();
    return success(res, stats);
  },
};
