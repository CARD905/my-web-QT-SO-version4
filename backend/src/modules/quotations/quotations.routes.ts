import { Router } from 'express';
import { quotationsController } from './quotations.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission, requireAnyPermission } from '../../middleware/permission';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import commentsRoutes from './comments.routes';
import {
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

// ============================================================
// STATIC routes — ต้องอยู่ก่อน /:id เสมอ
// ============================================================

// POST /bulk-approve
router.post(
  '/bulk-approve',
  requireAnyPermission(
    ['quotation', 'approve', 'TEAM'],
    ['quotation', 'approve', 'ALL'],
  ),
  asyncHandler(quotationsController.bulkApprove),
);

// DELETE /comments/:commentId
router.delete(
  '/comments/:commentId',
  asyncHandler(quotationsController.deleteComment),
);

// ============================================================
// VIEW
// ============================================================
router.get(
  '/',
  requireAnyPermission(
    ['quotation', 'view', 'OWN'],
    ['quotation', 'view', 'TEAM'],
    ['quotation', 'view', 'DEPARTMENT'],
    ['quotation', 'view', 'ALL'],
  ),
  validate(listQuotationsSchema, 'query'),
  asyncHandler(quotationsController.list),
);

router.get(
  '/:id',
  requireAnyPermission(
    ['quotation', 'view', 'OWN'],
    ['quotation', 'view', 'TEAM'],
    ['quotation', 'view', 'DEPARTMENT'],
    ['quotation', 'view', 'ALL'],
  ),
  asyncHandler(quotationsController.getById),
);

// ============================================================
// CREATE / UPDATE / SUBMIT / CANCEL
// ============================================================
router.post(
  '/',
  requirePermission('quotation', 'create', 'OWN'),
  validate(createQuotationSchema),
  asyncHandler(quotationsController.create),
);

router.patch(
  '/:id',
  requirePermission('quotation', 'update', 'OWN'),
  validate(updateQuotationSchema),
  asyncHandler(quotationsController.update),
);

router.post(
  '/:id/submit',
  requirePermission('quotation', 'submit', 'OWN'),
  validate(submitQuotationSchema),
  asyncHandler(quotationsController.submit),
);

router.post(
  '/:id/cancel',
  requirePermission('quotation', 'cancel', 'OWN'),
  validate(cancelQuotationSchema),
  asyncHandler(quotationsController.cancel),
);

// ============================================================
// APPROVE / REJECT
// ============================================================
router.post(
  '/:id/approve',
  requireAnyPermission(
    ['quotation', 'approve', 'TEAM'],
    ['quotation', 'approve', 'DEPARTMENT'],
    ['quotation', 'approve', 'ALL'],
  ),
  validate(approveQuotationSchema),
  asyncHandler(quotationsController.approve),
);

router.post(
  '/:id/reject',
  requireAnyPermission(
    ['quotation', 'reject', 'TEAM'],
    ['quotation', 'reject', 'DEPARTMENT'],
    ['quotation', 'reject', 'ALL'],
  ),
  validate(rejectQuotationSchema),
  asyncHandler(quotationsController.reject),
);

// ============================================================
// VERSIONS
// ============================================================
router.get(
  '/:id/versions',
  requireAnyPermission(
    ['quotation', 'view', 'OWN'],
    ['quotation', 'view', 'TEAM'],
    ['quotation', 'view', 'ALL'],
  ),
  asyncHandler(quotationsController.getVersions),
);

// ============================================================
// COMMENTS — mount ที่ /:quotationId/comments
// commentsRoutes ใช้ mergeParams: true จึงเข้าถึง :quotationId ได้
// ============================================================
router.use('/:quotationId/comments', commentsRoutes);

export default router;