import { Router } from 'express';
import { quotationsController } from './quotations.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission, requireAnyPermission } from '../../middleware/permission';
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

// ============================================================
// VIEW — anyone with any view scope (OWN/TEAM/ALL)
// Service-layer scope filter handles actual filtering.
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
// CREATE / UPDATE / SUBMIT / CANCEL — Officer (own)
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
// APPROVE / REJECT — Manager (TEAM) or Admin/CEO (ALL)
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
// VERSIONS / COMMENTS — anyone with view permission
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

router.get(
  '/:id/comments',
  requireAnyPermission(
    ['quotation', 'view', 'OWN'],
    ['quotation', 'view', 'TEAM'],
    ['quotation', 'view', 'ALL'],
  ),
  asyncHandler(quotationsController.getComments),
);

router.post(
  '/:id/comments',
  requireAnyPermission(
    ['quotation', 'view', 'OWN'],
    ['quotation', 'view', 'TEAM'],
    ['quotation', 'view', 'ALL'],
  ),
  validate(addCommentSchema),
  asyncHandler(quotationsController.addComment),
);

export default router;