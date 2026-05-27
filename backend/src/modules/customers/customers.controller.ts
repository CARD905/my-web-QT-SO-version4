import { Request, Response } from 'express';
import { customersService } from './customers.service';
import { AppError, created, success } from '../../utils/response';

export const customersController = {
  async list(req: Request, res: Response) {
    const result = await customersService.list(req.query as never);
    return success(res, result.data, undefined, result.meta);
  },

  async getById(req: Request, res: Response) {
    const customer = await customersService.getById(req.params.id);
    return success(res, customer);
  },

  async create(req: Request, res: Response) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
    const customer = await customersService.create(req.body, req.user.id, req);
    return created(res, customer, 'Customer created');
  },

  async update(req: Request, res: Response) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
    const customer = await customersService.update(req.params.id, req.body, req.user.id, req);
    return success(res, customer, 'Customer updated');
  },

  async editRequest(req: Request, res: Response) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
    const user = req.user as { id: string; name?: string };
    const result = await customersService.editRequest(
      req.params.id,
      req.body,
      user.id,
      user.name ?? 'Manager',
      req,
    );
    return success(res, result, 'Edit request sent to admin');
  },

  async pendingEditRequestCount(_req: Request, res: Response) {
    const data = await customersService.pendingEditRequestCount();
    return success(res, data);
  },

  async listEditRequests(req: Request, res: Response) {
    const customerId = req.params.id as string | undefined;
    const status = req.query.status as string | undefined;
    const data = await customersService.listEditRequests(customerId, status);
    return success(res, data);
  },

  async approveEditRequest(req: Request, res: Response) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
    await customersService.approveEditRequest(
      req.params.requestId, req.user.id, req.body.note, req, !!req.body.skipApply,
    );
    return success(res, null, 'อนุมัติคำขอเรียบร้อย');
  },

  async rejectEditRequest(req: Request, res: Response) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
    await customersService.rejectEditRequest(req.params.requestId, req.user.id, req.body.note, req);
    return success(res, null, 'ปฏิเสธคำขอเรียบร้อย');
  },

  async remove(req: Request, res: Response) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
    await customersService.softDelete(req.params.id, req.user.id, req);
    return success(res, null, 'Customer deleted');
  },
};
