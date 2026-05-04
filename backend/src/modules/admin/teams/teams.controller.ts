import { Request, Response } from 'express';
import { teamsService } from './teams.service';
import { AppError, created, success } from '../../../utils/response';

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
  return req.user;
}

export const teamsController = {
  async list(req: Request, res: Response) {
    const departmentId = req.query.departmentId as string | undefined;
    const data = await teamsService.list(departmentId);
    return success(res, data);
  },

  async getById(req: Request, res: Response) {
    const data = await teamsService.getById(req.params.id);
    return success(res, data);
  },

  async create(req: Request, res: Response) {
    const user = requireUser(req);
    const data = await teamsService.create(req.body, user.id, req);
    return created(res, data, 'Team created');
  },

  async update(req: Request, res: Response) {
    const user = requireUser(req);
    const data = await teamsService.update(req.params.id, req.body, user.id, req);
    return success(res, data, 'Team updated');
  },

  async remove(req: Request, res: Response) {
    const user = requireUser(req);
    await teamsService.remove(req.params.id, user.id, req);
    return success(res, null, 'Team deleted');
  },
};