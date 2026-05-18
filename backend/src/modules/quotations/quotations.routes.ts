import { Router } from 'express';
import { quotationsController } from './quotations.controller';
import { poController } from './po.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission, requireAnyPermission } from '../../middleware/permission';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import { uploadPoFile } from '../../middleware/upload';
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

// ─── STATIC routes ก่อน /:id เสมอ ──────────────────────────────────────────

router.post(
  '/bulk-approve',
  requireAnyPermission(['quotation', 'approve', 'TEAM'], ['quotation', 'approve', 'ALL']),
  asyncHandler(quotationsController.bulkApprove),
);

router.delete('/comments/:commentId', asyncHandler(quotationsController.deleteComment));

router.get('/checklist', asyncHandler(poController.checklist));

// ✅ Special Discount — CEO only (ต้องอยู่ก่อน /:id)
router.get(
  '/special-discount/pending',
  requireAnyPermission(['quotation', 'approve', 'ALL']),
  asyncHandler(quotationsController.listSpecialDiscountRequests),
);

// ─── LIST / GET ──────────────────────────────────────────────────────────────

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

// ─── CREATE / UPDATE / SUBMIT / CANCEL ──────────────────────────────────────

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
router.post(
  '/:id/renew',
  requirePermission('quotation', 'create', 'OWN'),
  asyncHandler(quotationsController.renew),
);

// ─── APPROVE / REJECT ────────────────────────────────────────────────────────

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
// เพิ่มหลัง reject route
router.post(
  '/:id/escalate',
  requireAnyPermission(
    ['quotation', 'approve', 'TEAM'],
    ['quotation', 'approve', 'ALL'],
  ),
  asyncHandler(quotationsController.escalate),
);
// ─── VERSIONS ────────────────────────────────────────────────────────────────

router.get(
  '/:id/versions',
  requireAnyPermission(
    ['quotation', 'view', 'OWN'],
    ['quotation', 'view', 'TEAM'],
    ['quotation', 'view', 'ALL'],
  ),
  asyncHandler(quotationsController.getVersions),
);

// ─── PO WORKFLOW ─────────────────────────────────────────────────────────────

router.post('/:id/po-upload', uploadPoFile, asyncHandler(poController.upload));
router.post('/:id/po-submit', asyncHandler(poController.submit));
router.post(
  '/:id/po-approve',
  requireAnyPermission(['quotation', 'approve', 'TEAM'], ['quotation', 'approve', 'ALL']),
  asyncHandler(poController.approve),
);
router.post(
  '/:id/po-cancel',
  requireAnyPermission(['quotation', 'approve', 'TEAM'], ['quotation', 'approve', 'ALL']),
  asyncHandler(poController.cancel),
);
router.post(
  '/:id/po-reject',
  requireAnyPermission(['quotation', 'approve', 'TEAM'], ['quotation', 'approve', 'ALL']),
  asyncHandler(poController.reject),
);

// ✅ SPECIAL DISCOUNT — CEO/Admin เท่านั้น
router.post(
  '/:id/special-discount/approve',
  requireAnyPermission(['quotation', 'approve', 'ALL']),
  asyncHandler(quotationsController.approveSpecialDiscount),
);
router.post(
  '/:id/special-discount/reject',
  requireAnyPermission(['quotation', 'approve', 'ALL']),
  asyncHandler(quotationsController.rejectSpecialDiscount),
);
router.post(
  '/:id/special-discount/modify',
  requireAnyPermission(['quotation', 'approve', 'ALL']),
  asyncHandler(quotationsController.modifySpecialDiscount),
);

// ─── COMMENTS ────────────────────────────────────────────────────────────────

router.use('/:quotationId/comments', commentsRoutes);

export default router;