import { Router } from 'express';
import { quotationsController } from './quotations.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import {
  addCommentSchema,
  approveQuotationSchema,
  cancelQuotationSchema,
  createQuotationSchema,
  listQuotationsSchema,
  rejectQuotationSchema,
  submitQuotationSchema,
  updateQuotationSchema,
} from './quotations.schema';

const router = Router();

router.use(authenticate);

// LIST + GET
router.get('/', validate(listQuotationsSchema, 'query'), asyncHandler(quotationsController.list));
router.get('/:id', asyncHandler(quotationsController.getById));

// CREATE / UPDATE / DELETE -- Sales & Admin
router.post(
  '/',
  requireRole('SALES', 'ADMIN'),
  validate(createQuotationSchema),
  asyncHandler(quotationsController.create),
);

router.patch(
  '/:id',
  requireRole('SALES', 'ADMIN'),
  validate(updateQuotationSchema),
  asyncHandler(quotationsController.update),
);

// WORKFLOW
router.post(
  '/:id/submit',
  requireRole('SALES', 'ADMIN'),
  validate(submitQuotationSchema),
  asyncHandler(quotationsController.submit),
);

router.post(
  '/:id/cancel',
  requireRole('SALES', 'ADMIN'),
  validate(cancelQuotationSchema),
  asyncHandler(quotationsController.cancel),
);

router.post(
  '/:id/approve',
  requireRole('APPROVER', 'ADMIN'),
  validate(approveQuotationSchema),
  asyncHandler(quotationsController.approve),
);

router.post(
  '/:id/reject',
  requireRole('APPROVER', 'ADMIN'),
  validate(rejectQuotationSchema),
  asyncHandler(quotationsController.reject),
);

// VERSIONS & COMMENTS
router.get('/:id/versions', asyncHandler(quotationsController.getVersions));
router.get('/:id/comments', asyncHandler(quotationsController.getComments));
router.post(
  '/:id/comments',
  validate(addCommentSchema),
  asyncHandler(quotationsController.addComment),
);

export default router;
