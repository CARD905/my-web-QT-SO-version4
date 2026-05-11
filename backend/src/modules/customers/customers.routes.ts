import { Router } from 'express';
import { customersController } from './customers.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permission';
import { requireRole } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import {
  createCustomerSchema,
  listCustomersSchema,
  updateCustomerSchema,
} from './customers.schema';

const router = Router();

router.use(authenticate);

// ─── VIEW — ทุก role ที่มี customer:view:ALL ────────────────────────────────
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

// ─── CREATE — Admin, CEO ────────────────────────────────────────────────────
router.post(
  '/',
  requireRole('ADMIN', 'CEO'),
  validate(createCustomerSchema),
  asyncHandler(customersController.create),
);

// ─── UPDATE — Admin, CEO, Manager ──────────────────────────────────────────
router.patch(
  '/:id',
  requireRole('ADMIN', 'CEO', 'MANAGER'),
  validate(updateCustomerSchema),
  asyncHandler(customersController.update),
);

// ─── DELETE — Admin, CEO เท่านั้น ───────────────────────────────────────────
router.delete(
  '/:id',
  requireRole('ADMIN', 'CEO'),
  asyncHandler(customersController.remove),
);

export default router;