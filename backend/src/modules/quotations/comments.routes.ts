import { Router } from 'express';
import { commentsController } from './comments.controller';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error';

// mergeParams: true — ให้เข้าถึง :quotationId จาก parent router ได้
const router = Router({ mergeParams: true });
router.use(authenticate);

// GET /quotations/:quotationId/comments
router.get('/', asyncHandler(commentsController.list));

// POST /quotations/:quotationId/comments
router.post('/', asyncHandler(commentsController.create));

export default router;