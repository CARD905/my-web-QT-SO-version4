import { Request, Response } from 'express';
import { saleOrdersService } from './sale-orders.service';
import { AppError, success } from '../../utils/response';

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
  const u = req.user as { id: string; role?: string; roleCode?: string };
  return {
    id: u.id,
    roleCode: u.roleCode || u.role || 'OFFICER',
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