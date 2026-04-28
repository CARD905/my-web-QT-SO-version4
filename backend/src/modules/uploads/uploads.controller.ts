import { Request, Response } from 'express';
import { uploadsService } from './uploads.service';
import { AppError, created, success } from '../../utils/response';

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
  return req.user;
}

export const uploadsController = {
  async uploadQuotationAttachment(req: Request, res: Response) {
    const user = requireUser(req);
    if (!req.file) throw new AppError(400, 'NO_FILE', 'No file uploaded');

    const attachment = await uploadsService.attachToQuotation(
      req.params.quotationId,
      req.file,
      user,
      req,
    );
    return created(res, attachment, 'File uploaded');
  },

  async listAttachments(req: Request, res: Response) {
    const user = requireUser(req);
    const attachments = await uploadsService.listForQuotation(req.params.quotationId, user);
    return success(res, attachments);
  },

  async remove(req: Request, res: Response) {
    const user = requireUser(req);
    await uploadsService.remove(req.params.attachmentId, user, req);
    return success(res, null, 'Attachment removed');
  },
};
