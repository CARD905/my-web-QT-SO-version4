import { Router } from 'express';
import { productsController } from './products.controller';
import { authenticate } from '../../middleware/auth';
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

router.get('/', validate(listProductsSchema, 'query'), asyncHandler(productsController.list));
router.get('/:id', asyncHandler(productsController.getById));

router.post(
  '/',
  requireRole('SALES', 'ADMIN'),
  validate(createProductSchema),
  asyncHandler(productsController.create),
);

router.patch(
  '/:id',
  requireRole('SALES', 'ADMIN'),
  validate(updateProductSchema),
  asyncHandler(productsController.update),
);

router.delete(
  '/:id',
  requireRole('SALES', 'ADMIN'),
  asyncHandler(productsController.remove),
);

export default router;
