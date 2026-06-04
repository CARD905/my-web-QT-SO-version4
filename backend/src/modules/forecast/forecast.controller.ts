import { Request, Response } from 'express';
import { forecastService } from './forecast.service';
import { AppError, success } from '../../utils/response';

export const forecastController = {
  async summary(_req: Request, res: Response) {
    const data = await forecastService.getSummary();
    return success(res, data);
  },

  async advanced(req: Request, res: Response) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
    const roleCode: string = (req.user as { roleCode?: string }).roleCode ?? 'OFFICER';
    const data = await forecastService.getAdvancedData(req.user.id, roleCode);
    return success(res, data);
  },

  async getTargets(_req: Request, res: Response) {
    const data = await forecastService.getTargets();
    return success(res, data);
  },

  async upsertTarget(req: Request, res: Response) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
    const { year, month, target, notes } = req.body as { year: number; month: number; target: number; notes?: string };
    if (!year || !month || target == null) throw new AppError(400, 'BAD_REQUEST', 'year, month, target are required');
    if (month < 1 || month > 12) throw new AppError(400, 'BAD_REQUEST', 'month must be 1-12');
    if (target < 0) throw new AppError(400, 'BAD_REQUEST', 'target must be >= 0');
    const data = await forecastService.upsertTarget(req.user.id, year, month, target, notes);
    return success(res, data);
  },

  async deleteTarget(req: Request, res: Response) {
    const year = parseInt(req.params.year ?? '');
    const month = parseInt(req.params.month ?? '');
    if (!year || !month) throw new AppError(400, 'BAD_REQUEST', 'year and month are required');
    await forecastService.deleteTarget(year, month);
    return success(res, { deleted: true });
  },
};
