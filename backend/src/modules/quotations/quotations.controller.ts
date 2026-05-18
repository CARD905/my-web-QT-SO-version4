import { Request, Response } from 'express';
import { quotationsService, CurrentUser } from './quotations.service';
import { AppError, created, success } from '../../utils/response';

function requireUser(req: Request): CurrentUser {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
  const u = req.user as {
    id: string; name?: string; email?: string;
    role?: string; roleCode?: string; roleId?: string;
  };
  if (!u.roleId) throw new AppError(401, 'INVALID_TOKEN', 'Token missing role info');
  return {
    id: u.id,
    roleCode: u.roleCode || u.role || 'OFFICER',
    roleId: u.roleId,
    name: u.name ?? '',
    email: u.email ?? '',
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
    return success(res, result, 'Quotation approved');
  },

  async reject(req: Request, res: Response) {
    const user = requireUser(req);
    const quotation = await quotationsService.reject(req.params.id, req.body, user.id, req);
    return success(res, quotation, 'Quotation rejected');
  },

  // ✅ ESCALATE — Manager ส่งต่อขึ้นไปยังผู้มีอำนาจถัดไป
  async escalate(req: Request, res: Response) {
    const user = requireUser(req);
    const { comment } = req.body as { comment?: string };
    const result = await quotationsService.escalate(req.params.id, comment, user.id, req);
    return success(res, result, 'Quotation escalated to next approver');
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

  async deleteComment(req: Request, res: Response) {
    const user = requireUser(req);
    await quotationsService.deleteComment(req.params.commentId, user);
    return success(res, null, 'Comment deleted');
  },

  async bulkApprove(req: Request, res: Response) {
    const user = requireUser(req);
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) throw new AppError(400, 'BAD_REQUEST', 'ids array required');
    if (ids.length > 50) throw new AppError(400, 'BAD_REQUEST', 'Maximum 50 quotations per batch');
    const data = await quotationsService.bulkApprove(ids, user);
    return success(res, data);
  },

  async listSpecialDiscountRequests(req: Request, res: Response) {
    const user = requireUser(req);
    const result = await quotationsService.listSpecialDiscountRequests(user);
    return success(res, result);
  },

  async approveSpecialDiscount(req: Request, res: Response) {
    const user = requireUser(req);
    const result = await quotationsService.approveSpecialDiscount(req.params.id, user, req);
    return success(res, result, 'Special discount approved ✅');
  },

  async rejectSpecialDiscount(req: Request, res: Response) {
    const user = requireUser(req);
    const result = await quotationsService.rejectSpecialDiscount(req.params.id, user, req);
    return success(res, result, 'Special discount rejected — discounts auto-reduced to 20%');
  },

  async modifySpecialDiscount(req: Request, res: Response) {
    const user = requireUser(req);
    const { finalPercent } = req.body as { finalPercent: number };
    if (typeof finalPercent !== 'number') throw new AppError(400, 'BAD_REQUEST', 'finalPercent is required');
    const result = await quotationsService.modifySpecialDiscount(req.params.id, finalPercent, user, req);
    return success(res, result, `Special discount modified to ${finalPercent}%`);
  },

  async renew(req: Request, res: Response) {
    const user = requireUser(req);
    const data = await quotationsService.renew(req.params.id, user.id, req);
    return created(res, data, `Renewed quotation ${data.quotationNo}`);
  },
};