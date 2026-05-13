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
} from './sale-orders.schema';

const router = Router();
router.use(authenticate);

// GET /sale-orders
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

// GET /sale-orders/:id
router.get(
  '/:id',
  requireAnyPermission(
    ['saleOrder', 'view', 'OWN'],
    ['saleOrder', 'view', 'TEAM'],
    ['saleOrder', 'view', 'ALL'],
  ),
  asyncHandler(saleOrdersController.getById),
);

// PATCH /sale-orders/:id — Officer แก้ DRAFT
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
// PATCH /sale-orders/:id/deadline — Officer แก้ deadline เมื่อ REJECTED
router.patch(
  '/:id/deadline',
  requireAnyPermission(
    ['saleOrder', 'view', 'OWN'],
    ['saleOrder', 'view', 'TEAM'],
    ['saleOrder', 'view', 'ALL'],
  ),
  asyncHandler(saleOrdersController.updateDeadline),
);

// POST /sale-orders/:id/submit — Officer ส่งให้ Manager
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

// POST /sale-orders/:id/approve — Manager อนุมัติ → CONFIRMED
router.post(
  '/:id/approve',
  requireAnyPermission(
    ['saleOrder', 'view', 'TEAM'],
    ['saleOrder', 'view', 'ALL'],
  ),
  asyncHandler(saleOrdersController.approve),
);

// POST /sale-orders/:id/reject — Manager ปฏิเสธ → REJECTED
router.post(
  '/:id/reject',
  requireAnyPermission(
    ['saleOrder', 'view', 'TEAM'],
    ['saleOrder', 'view', 'ALL'],
  ),
  asyncHandler(saleOrdersController.reject),
);

// PDF
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