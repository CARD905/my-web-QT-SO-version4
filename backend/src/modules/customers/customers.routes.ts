import { Router } from 'express';
import { customersController } from './customers.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permission';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import {
  createCustomerSchema,
  listCustomersSchema,
  updateCustomerSchema,
} from './customers.schema';

const router = Router();

router.use(authenticate);

// ============================================================
// VIEW — anyone can view (Customer is shared master data)
// ============================================================
router.get(
  '/',
  requirePermission('customer', 'view', 'ALL'),
  validate(listCustomersSchema, 'query'),
  asyncHandler(customersController.list),
);

router.get(
  '/:id',
  requirePermission('customer', 'view', 'ALL'),
  asyncHandler(customersController.getById),
);

// ============================================================
// CREATE — Admin/CEO only (per Phase 1 seed)
// ============================================================
router.post(
  '/',
  requirePermission('customer', 'create', 'ALL'),
  validate(createCustomerSchema),
  asyncHandler(customersController.create),
);

// ============================================================
// UPDATE — All roles (Officer/Manager/Admin/CEO) per Q4.1
// ============================================================
router.patch(
  '/:id',
  requirePermission('customer', 'update', 'ALL'),
  validate(updateCustomerSchema),
  asyncHandler(customersController.update),
);

// ============================================================
// DELETE — Admin/CEO only
// ============================================================
router.delete(
  '/:id',
  requirePermission('customer', 'delete', 'ALL'),
  asyncHandler(customersController.remove),
);

export default router;