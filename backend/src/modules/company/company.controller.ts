import { Request, Response } from 'express';
import { companyService } from './company.service';
import { AppError, success } from '../../utils/response';

export const companyController = {
  async get(_req: Request, res: Response) {
    const settings = await companyService.get();
    return success(res, settings);
  },

  async update(req: Request, res: Response) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
    const updated = await companyService.update(req.body, req.user.id, req);
    return success(res, updated, 'Company settings updated');
  },
};