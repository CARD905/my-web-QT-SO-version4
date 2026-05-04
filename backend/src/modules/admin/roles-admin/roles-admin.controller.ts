import { Request, Response } from 'express';
import { rolesAdminService } from './roles-admin.service';
import { AppError, created, success } from '../../../utils/response';

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
  return req.user;
}

export const rolesAdminController = {
  async list(_req: Request, res: Response) {
    const data = await rolesAdminService.list();
    return success(res, data);
  },

  async getById(req: Request, res: Response) {
    const data = await rolesAdminService.getById(req.params.id);
    return success(res, data);
  },

  async listPermissions(_req: Request, res: Response) {
    const data = await rolesAdminService.listAllPermissions();
    return success(res, data);
  },

  async create(req: Request, res: Response) {
    const user = requireUser(req);
    const data = await rolesAdminService.create(req.body, user.id, req);
    return created(res, data, 'Role created');
  },

  async update(req: Request, res: Response) {
    const user = requireUser(req);
    const data = await rolesAdminService.update(req.params.id, req.body, user.id, req);
    return success(res, data, 'Role updated');
  },

  async remove(req: Request, res: Response) {
    const user = requireUser(req);
    await rolesAdminService.remove(req.params.id, user.id, req);
    return success(res, null, 'Role deleted');
  },

  async updatePermissions(req: Request, res: Response) {
    const user = requireUser(req);
    const data = await rolesAdminService.updatePermissions(
      req.params.id,
      req.body,
      user.id,
      req,
    );
    return success(res, data, 'Permissions updated');
  },
};