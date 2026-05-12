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

// ════════════════════════════════════════════════════════════
// CHECKLIST — ต้องอยู่ก่อน /:id (ไม่งั้น "checklist" จะถูก match เป็น :id)
// GET /quotations/checklist
// ════════════════════════════════════════════════════════════
router.get(
  '/checklist',
  asyncHandler(poController.checklist),
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

// ════════════════════════════════════════════════════════════
// PO WORKFLOW — ต้องอยู่หลัง /:id/submit, /:id/approve ฯลฯ
// แต่ก่อน /:quotationId/comments
// ════════════════════════════════════════════════════════════

// POST /quotations/:id/po-upload (multipart/form-data, field: file)
router.post(
  '/:id/po-upload',
  uploadPoFile,
  asyncHandler(poController.upload),
);

// POST /quotations/:id/po-submit
router.post(
  '/:id/po-submit',
  asyncHandler(poController.submit),
);

// POST /quotations/:id/po-approve (Manager+)
router.post(
  '/:id/po-approve',
  requireAnyPermission(
    ['quotation', 'approve', 'TEAM'],
    ['quotation', 'approve', 'ALL'],
  ),
  asyncHandler(poController.approve),
);
router.post(
  '/:id/po-cancel',
  requireAnyPermission(
    ['quotation', 'approve', 'TEAM'],
    ['quotation', 'approve', 'ALL'],
  ),
  asyncHandler(poController.cancel),
);

// POST /quotations/:id/po-reject (Manager+)
router.post(
  '/:id/po-reject',
  requireAnyPermission(
    ['quotation', 'approve', 'TEAM'],
    ['quotation', 'approve', 'ALL'],
  ),
  asyncHandler(poController.reject),
);


// ============================================================
// COMMENTS — mount ที่ /:quotationId/comments
// commentsRoutes ใช้ mergeParams: true จึงเข้าถึง :quotationId ได้
// ============================================================
router.use('/:quotationId/comments', commentsRoutes);

export default router;