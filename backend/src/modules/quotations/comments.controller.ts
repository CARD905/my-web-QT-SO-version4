import { Request, Response } from 'express';
import { commentsService } from './comments.service';
import { AppError, success } from '../../utils/response';

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
  const u = req.user as { id: string; role?: string; roleCode?: string };
  return {
    id: u.id,
    roleCode: u.roleCode || u.role || 'OFFICER',
  };
}

export const commentsController = {
  async list(req: Request, res: Response) {
    const user = requireUser(req);
    const data = await commentsService.list(req.params.quotationId, user);
    return success(res, data);
  },

  async create(req: Request, res: Response) {
    const user = requireUser(req);
    try {
      const data = await commentsService.create(req.params.quotationId, user, {
        message: req.body.message,
        isInternal: req.body.isInternal,
      });
      return success(res, data);
    } catch (err: any) {
      if (err.message?.startsWith('NOT_FOUND')) {
        throw new AppError(404, 'NOT_FOUND', err.message);
      }
      throw new AppError(400, 'BAD_REQUEST', err.message);
    }
  },

  async remove(req: Request, res: Response) {
    const user = requireUser(req);
    try {
      const data = await commentsService.remove(req.params.commentId, user);
      return success(res, data);
    } catch (err: any) {
      if (err.message?.startsWith('FORBIDDEN')) {
        throw new AppError(403, 'FORBIDDEN', err.message);
      }
      if (err.message?.startsWith('NOT_FOUND')) {
        throw new AppError(404, 'NOT_FOUND', err.message);
      }
      throw err;
    }
  },
  
};