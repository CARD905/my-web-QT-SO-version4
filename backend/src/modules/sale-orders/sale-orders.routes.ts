import { Router } from 'express';
import { saleOrdersController } from './sale-orders.controller';
import { authenticate } from '../../middleware/auth';
import { requireAnyPermission } from '../../middleware/permission';
import { asyncHandler } from '../../middleware/error';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  requireAnyPermission(
    ['saleOrder', 'view', 'OWN'],
    ['saleOrder', 'view', 'TEAM'],
    ['saleOrder', 'view', 'ALL'],
  ),
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