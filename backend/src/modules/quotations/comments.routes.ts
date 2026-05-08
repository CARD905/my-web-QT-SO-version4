import { Router } from 'express';
import { commentsController } from './comments.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';

const router = Router();
router.use(authenticate);

// GET /quotations/:quotationId/comments
router.get(
  '/quotations/:quotationId/comments',
  asyncHandler(commentsController.list),
);

// POST /quotations/:quotationId/comments
router.post(
  '/quotations/:quotationId/comments',
  asyncHandler(commentsController.create),
);

// DELETE /comments/:commentId
router.delete(
  '/comments/:commentId',
  asyncHandler(commentsController.remove),
);

export default router;