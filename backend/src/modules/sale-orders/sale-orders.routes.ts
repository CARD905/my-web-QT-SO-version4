import { Router } from 'express';
import { saleOrdersController } from './sale-orders.controller';
import { authenticate } from '../../middleware/auth';
import { requireAnyPermission } from '../../middleware/permission';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import {
  listSaleOrdersSchema,
  updateSaleOrderSchema,
  submitSaleOrderSchema,
  reviewSaleOrderSchema,
} from './sale-orders.schema';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  requireAnyPermission(
    ['saleOrder', 'view', 'OWN'],
    ['saleOrder', 'view', 'TEAM'],
    ['saleOrder', 'view', 'ALL'],
  ),
  validate(listSaleOrdersSchema, 'query'),
  asyncHandler(saleOrdersController.list),
);

router.get(
  '/:id',
  requireAnyPermission(
    ['saleOrder', 'view', 'OWN'],
    ['saleOrder', 'view', 'TEAM'],
    ['saleOrder', 'view', 'ALL'],
  ),
  asyncHandler(saleOrdersController.getById),
);

// Edit DRAFT — Officer only
router.patch(
  '/:id',
  requireAnyPermission(
    ['saleOrder', 'view', 'OWN'],
    ['saleOrder', 'view', 'TEAM'],
    ['saleOrder', 'view', 'ALL'],
  ),
  validate(updateSaleOrderSchema),
  asyncHandler(saleOrdersController.update),
);

// Submit DRAFT for Manager review
router.post(
  '/:id/submit',
  requireAnyPermission(
    ['saleOrder', 'view', 'OWN'],
    ['saleOrder', 'view', 'TEAM'],
    ['saleOrder', 'view', 'ALL'],
  ),
  validate(submitSaleOrderSchema),
  asyncHandler(saleOrdersController.submit),
);

// Manager approves review → back to DRAFT
router.post(
  '/:id/review-approve',
  requireAnyPermission(
    ['saleOrder', 'view', 'TEAM'],
    ['saleOrder', 'view', 'ALL'],
  ),
  validate(reviewSaleOrderSchema),
  asyncHandler(saleOrdersController.reviewApprove),
);

// Confirm → CONFIRMED (locked)
router.post(
  '/:id/confirm',
  requireAnyPermission(
    ['saleOrder', 'view', 'OWN'],
    ['saleOrder', 'view', 'TEAM'],
    ['saleOrder', 'view', 'ALL'],
  ),
  asyncHandler(saleOrdersController.confirm),
);

router.post(
  '/:id/pdf',
  requireAnyPermission(
    ['saleOrder', 'view', 'OWN'],
    ['saleOrder', 'view', 'TEAM'],
    ['saleOrder', 'view', 'ALL'],
  ),
  asyncHandler(saleOrdersController.generatePdf),
);

router.get(
  '/:id/pdf/download',
  requireAnyPermission(
    ['saleOrder', 'view', 'OWN'],
    ['saleOrder', 'view', 'TEAM'],
    ['saleOrder', 'view', 'ALL'],
  ),
  asyncHandler(saleOrdersController.downloadPdf),
);

export default router;