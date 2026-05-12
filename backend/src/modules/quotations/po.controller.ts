/**
 * PO Workflow Controller
 * Path: backend/src/modules/quotations/po.controller.ts
 */
import { Request, Response } from 'express';
import { poService } from './po.service';
import { AppError, success } from '../../utils/response';

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
  const u = req.user as {
    id: string;
    role?: string;
    roleCode?: string;
    name?: string;
    email?: string;
  };
  return {
    id: u.id,
    roleCode: u.roleCode || u.role || 'OFFICER',
    name: u.name,
    email: u.email,
  };
}

export const poController = {
  // POST /quotations/:id/po-upload (multipart/form-data, field 'file')
  async upload(req: Request, res: Response) {
    const user = requireUser(req);
    if (!req.file) {
      throw new AppError(400, 'BAD_REQUEST', 'No file uploaded (field: file)');
    }
    const data = await poService.uploadPo(req.params.id, user, req.file, req);
    return success(res, data);
  },

  // POST /quotations/:id/po-submit
  async submit(req: Request, res: Response) {
    const user = requireUser(req);
    const data = await poService.submitPo(req.params.id, user, req);
    return success(res, data);
  },

  // POST /quotations/:id/po-approve
  async approve(req: Request, res: Response) {
    const user = requireUser(req);
    const data = await poService.approvePo(req.params.id, user, req);
    return success(res, data);
  },

  // POST /quotations/:id/po-reject  body: { reason: string }
  async reject(req: Request, res: Response) {
    const user = requireUser(req);
    const data = await poService.rejectPo(req.params.id, user, req.body.reason, req);
    return success(res, data);
  },

  // GET /quotations/checklist?status=&search=
  async checklist(req: Request, res: Response) {
    const user = requireUser(req);
    const data = await poService.getChecklist(user, {
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
    });
    return success(res, data);
  },
  async cancel(req: Request, res: Response) {
  const user = requireUser(req);
  const data = await poService.cancelPo(
    req.params.id,
    user,
    req.body.reason,
    req,
  );
  return success(res, data);
},
};