import { Request, Response } from 'express';
import { usersAdminService } from './users-admin.service';
import { AppError, success } from '../../../utils/response';
import { resetPasswordSchema } from './users-admin.schema';

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
  return req.user;
}

export const usersAdminController = {
  async list(req: Request, res: Response) {
    const result = await usersAdminService.list(req.query as never);
    return success(res, result.data, undefined, result.meta);
  },

  async getById(req: Request, res: Response) {
    const data = await usersAdminService.getById(req.params.id);
    return success(res, data);
  },

  async update(req: Request, res: Response) {
    const actor = requireUser(req);
    const data = await usersAdminService.update(req.params.id, req.body, actor.id, req);
    return success(res, data, 'User updated');
  },

  async activate(req: Request, res: Response) {
    const actor = requireUser(req);
    const data = await usersAdminService.setActive(req.params.id, true, actor.id, req);
    return success(res, data, 'User activated');
  },

  async deactivate(req: Request, res: Response) {
    const actor = requireUser(req);
    const data = await usersAdminService.setActive(req.params.id, false, actor.id, req);
    return success(res, data, 'User deactivated');
  },

  async resetPassword(req: Request, res: Response) {
    const actor = requireUser(req);
    const { newPassword } = resetPasswordSchema.parse(req.body);
    await usersAdminService.resetPassword(req.params.id, newPassword, actor.id, req);
    return success(res, null, 'Password reset successfully');
  },

  async listRoles(_req: Request, res: Response) {
    const data = await usersAdminService.listRoles();
    return success(res, data);
  },

  async listTeams(_req: Request, res: Response) {
    const data = await usersAdminService.listTeams();
    return success(res, data);
  },
};