import { Router, Request, Response, NextFunction } from 'express';
import { customersController } from './customers.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permission';
import { requireRole } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import {
  createCustomerSchema,
  editRequestSchema,
  listCustomersSchema,
  updateCustomerSchema,
} from './customers.schema';

function restrictManagerFields(req: Request, _res: Response, next: NextFunction) {
  const userRole = (req.user as any)?.roleCode || (req.user as any)?.role;
  if (userRole === 'MANAGER') {
    const allowed = new Set(['email', 'phone', 'billingAddress', 'shippingAddress']);
    for (const key of Object.keys(req.body)) {
      if (!allowed.has(key)) delete req.body[key];
    }
  }
  next();
}

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

// ─── UPDATE — Admin, CEO, Manager (Manager limited to email/phone/addresses) ─
router.patch(
  '/:id',
  requireRole('ADMIN', 'CEO', 'MANAGER'),
  restrictManagerFields,
  validate(updateCustomerSchema),
  asyncHandler(customersController.update),
);

// ─── EDIT REQUEST — Manager sends change request to Admin ──────────────────
router.post(
  '/:id/edit-request',
  requireRole('MANAGER'),
  validate(editRequestSchema),
  asyncHandler(customersController.editRequest),
);

// ─── DELETE — Admin, CEO เท่านั้น ───────────────────────────────────────────
router.delete(
  '/:id',
  requireRole('ADMIN', 'CEO'),
  asyncHandler(customersController.remove),
);

export default router;