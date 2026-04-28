import { Request, Response } from 'express';
import { productsService } from './products.service';
import { AppError, created, success } from '../../utils/response';

export const productsController = {
  async list(req: Request, res: Response) {
    const result = await productsService.list(req.query as never);
    return success(res, result.data, undefined, result.meta);
  },

  async getById(req: Request, res: Response) {
    const product = await productsService.getById(req.params.id);
    return success(res, product);
  },

  async create(req: Request, res: Response) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
    const product = await productsService.create(req.body, req.user.id, req);
    return created(res, product, 'Product created');
  },

  async update(req: Request, res: Response) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
    const product = await productsService.update(req.params.id, req.body, req.user.id, req);
    return success(res, product, 'Product updated');
  },

  async remove(req: Request, res: Response) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
    await productsService.softDelete(req.params.id, req.user.id, req);
    return success(res, null, 'Product deleted');
  },
};
