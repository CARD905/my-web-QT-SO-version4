import { Request, Response } from 'express';
import { managerDashboardService } from './manager-dashboard.service';
import { AppError, success } from '../../utils/response';

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
  const u = req.user as { id: string; role?: string; roleCode?: string; roleId?: string };
  return {
    id: u.id,
    roleCode: u.roleCode || u.role || 'OFFICER',
    roleId: u.roleId || '',
  };
}

export const managerDashboardController = {
  async overview(req: Request, res: Response) {
    const user = requireUser(req);
    const data = await managerDashboardService.overview(user);
    return success(res, data);
  },

  async users(req: Request, res: Response) {
    const user = requireUser(req);
    const data = await managerDashboardService.usersList(user);
    return success(res, data);
  },

  async userDetail(req: Request, res: Response) {
    const user = requireUser(req);
    const data = await managerDashboardService.userDetail(req.params.userId, user);
    return success(res, data);
  },
};