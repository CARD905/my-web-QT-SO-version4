import { Request, Response } from 'express';
import { saleOrdersService } from './sale-orders.service';
import { AppError, success } from '../../utils/response';

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
  const u = req.user as {
    id: string;
    role?: string;
    roleCode?: string;
    roleId?: string;
  };
  return {
    id: u.id,
    roleCode: u.roleCode || u.role || 'OFFICER',
    roleId: u.roleId || '',
  };
}

export const saleOrdersController = {
  async list(req: Request, res: Response) {
    const user = requireUser(req);
    const result = await saleOrdersService.list(req.query as never, user);
    return success(res, result.data, undefined, result.meta);
  },

  async getById(req: Request, res: Response) {
    const user = requireUser(req);
    const so = await saleOrdersService.getById(req.params.id, user);
    return success(res, so);
  },

  async update(req: Request, res: Response) {
    const user = requireUser(req);
    const so = await saleOrdersService.update(req.params.id, req.body, user, req);
    return success(res, so, 'Sale Order updated');
  },

  async submit(req: Request, res: Response) {
    const user = requireUser(req);
    const so = await saleOrdersService.submit(req.params.id, req.body, user, req);
    return success(res, so, 'Sale Order submitted for review');
  },

  async reviewApprove(req: Request, res: Response) {
    const user = requireUser(req);
    const so = await saleOrdersService.reviewApprove(req.params.id, req.body, user, req);
    return success(res, so, 'Sale Order review approved');
  },

  async confirm(req: Request, res: Response) {
    const user = requireUser(req);
    const so = await saleOrdersService.confirm(req.params.id, user, req);
    return success(res, so, 'Sale Order confirmed (locked)');
  },

  async generatePdf(req: Request, res: Response) {
    const user = requireUser(req);
    const result = await saleOrdersService.generatePdf(req.params.id, user, req);
    return success(
      res,
      {
        url: result.url,
        fileName: result.fileName,
        generatedAt: new Date().toISOString(),
      },
      'PDF generated',
    );
  },

  async downloadPdf(req: Request, res: Response) {
    const user = requireUser(req);
    const { filePath, fileName } = await saleOrdersService.getPdfFile(req.params.id, user, req);
    res.download(filePath, fileName);
  },
};