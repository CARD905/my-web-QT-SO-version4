import { Router } from 'express';
import { uploadsController } from './uploads.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';
import { uploadAttachment } from './multer.config';

const router = Router();

router.use(authenticate);

// Upload a file to a specific quotation
router.post(
  '/quotations/:quotationId/attachments',
  uploadAttachment.single('file'),
  asyncHandler(uploadsController.uploadQuotationAttachment),
);

// List attachments of a quotation
router.get(
  '/quotations/:quotationId/attachments',
  asyncHandler(uploadsController.listAttachments),
);

// Delete an attachment
router.delete(
  '/attachments/:attachmentId',
  asyncHandler(uploadsController.remove),
);

export default router;
