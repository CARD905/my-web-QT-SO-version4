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

  async remove(req: Request, res: Response) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
    await customersService.softDelete(req.params.id, req.user.id, req);
    return success(res, null, 'Customer deleted');
  },
};
