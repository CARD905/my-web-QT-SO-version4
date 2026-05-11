import { Router } from 'express';
import { productsController } from './products.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permission';
import { requireRole } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import {
  createProductSchema,
  listProductsSchema,
  updateProductSchema,
} from './products.schema';

const router = Router();

router.use(authenticate);

// ─── VIEW — ทุก role ที่มี product:view:ALL ─────────────────────────────────
router.get(
  '/',
  requirePermission('product', 'view', 'ALL'),
  validate(listProductsSchema, 'query'),
  asyncHandler(productsController.list),
);

router.get(
  '/:id',
  requirePermission('product', 'view', 'ALL'),
  asyncHandler(productsController.getById),
);

// ─── CREATE / UPDATE / DELETE — Admin, CEO เท่านั้น ─────────────────────────
router.post(
  '/',
  requireRole('ADMIN', 'CEO'),
  validate(createProductSchema),
  asyncHandler(productsController.create),
);

router.patch(
  '/:id',
  requireRole('ADMIN', 'CEO'),
  validate(updateProductSchema),
  asyncHandler(productsController.update),
);

router.delete(
  '/:id',
  requireRole('ADMIN', 'CEO'),
  asyncHandler(productsController.remove),
);

export default router;