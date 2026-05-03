import { Request, Response } from 'express';
import { quotationsService } from './quotations.service';
import { AppError, created, success } from '../../utils/response';

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
  const u = req.user as {
    id: string;
    role?: string;
    roleCode?: string;
    roleId?: string;
  };
  if (!u.roleId) throw new AppError(401, 'INVALID_TOKEN', 'Token missing role info');
  return {
    id: u.id,
    roleCode: u.roleCode || u.role || 'OFFICER',
    roleId: u.roleId,
  };
}

export const quotationsController = {
  async list(req: Request, res: Response) {
    const user = requireUser(req);
    const result = await quotationsService.list(req.query as never, user);
    return success(res, result.data, undefined, result.meta);
  },

  async getById(req: Request, res: Response) {
    const user = requireUser(req);
    const quotation = await quotationsService.getById(req.params.id, user);
    return success(res, quotation);
  },

  async create(req: Request, res: Response) {
    const user = requireUser(req);
    const quotation = await quotationsService.create(req.body, user.id, req);
    return created(res, quotation, 'Quotation created');
  },

  async update(req: Request, res: Response) {
    const user = requireUser(req);
    const quotation = await quotationsService.update(req.params.id, req.body, user.id, req);
    return success(res, quotation, 'Quotation updated');
  },

  async submit(req: Request, res: Response) {
    const user = requireUser(req);
    const quotation = await quotationsService.submit(req.params.id, req.body, user.id, req);
    return success(res, quotation, 'Quotation submitted for approval');
  },

  async approve(req: Request, res: Response) {
    const user = requireUser(req);
    const result = await quotationsService.approve(req.params.id, req.body, user.id, req);
    return success(res, result, 'Quotation approved and Sale Order created');
  },

  async reject(req: Request, res: Response) {
    const user = requireUser(req);
    const quotation = await quotationsService.reject(req.params.id, req.body, user.id, req);
    return success(res, quotation, 'Quotation rejected');
  },

  async cancel(req: Request, res: Response) {
    const user = requireUser(req);
    const quotation = await quotationsService.cancel(req.params.id, req.body, user.id, req);
    return success(res, quotation, 'Quotation cancelled');
  },

  async getVersions(req: Request, res: Response) {
    const user = requireUser(req);
    const versions = await quotationsService.getVersions(req.params.id, user);
    return success(res, versions);
  },

  async getComments(req: Request, res: Response) {
    const user = requireUser(req);
    const comments = await quotationsService.getComments(req.params.id, user);
    return success(res, comments);
  },

  async addComment(req: Request, res: Response) {
    const user = requireUser(req);
    const comment = await quotationsService.addComment(req.params.id, req.body, user, req);
    return created(res, comment, 'Comment added');
  },
};