import { Request, Response } from 'express';
import { departmentsService } from './departments.service';
import { AppError, created, success } from '../../../utils/response';

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
  return req.user;
}

export const departmentsController = {
  async list(_req: Request, res: Response) {
    const data = await departmentsService.list();
    return success(res, data);
  },

  async getById(req: Request, res: Response) {
    const data = await departmentsService.getById(req.params.id);
    return success(res, data);
  },

  async create(req: Request, res: Response) {
    const user = requireUser(req);
    const data = await departmentsService.create(req.body, user.id, req);
    return created(res, data, 'Department created');
  },

  async update(req: Request, res: Response) {
    const user = requireUser(req);
    const data = await departmentsService.update(req.params.id, req.body, user.id, req);
    return success(res, data, 'Department updated');
  },

  async remove(req: Request, res: Response) {
    const user = requireUser(req);
    await departmentsService.remove(req.params.id, user.id, req);
    return success(res, null, 'Department deleted');
  },
};