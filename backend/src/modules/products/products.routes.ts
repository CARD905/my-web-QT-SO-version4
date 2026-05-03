import { Router } from 'express';
import { productsController } from './products.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permission';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import {
  createProductSchema,
  listProductsSchema,
  updateProductSchema,
} from './products.schema';

const router = Router();

router.use(authenticate);

// VIEW — anyone authenticated
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

// MUTATIONS — Admin/CEO only
router.post(
  '/',
  requirePermission('product', 'create', 'ALL'),
  validate(createProductSchema),
  asyncHandler(productsController.create),
);

router.patch(
  '/:id',
  requirePermission('product', 'update', 'ALL'),
  validate(updateProductSchema),
  asyncHandler(productsController.update),
);

router.delete(
  '/:id',
  requirePermission('product', 'delete', 'ALL'),
  asyncHandler(productsController.remove),
);

export default router;