import { Router } from 'express';
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

const router = Router();

router.use(authenticate);

// ─── VIEW — ทุก role ที่มี customer:view:ALL ────────────────────────────────
router.get(
  '/',
  requirePermission('customer', 'view', 'ALL'),
  validate(listCustomersSchema, 'query'),
  asyncHandler(customersController.list),
);

// ─── PENDING COUNT — Admin badge ───────────────────────────────────────────
router.get(
  '/edit-requests/pending-count',
  requireRole('ADMIN', 'CEO'),
  asyncHandler(customersController.pendingEditRequestCount),
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

// ─── UPDATE — Admin, CEO only (Manager must use edit-request) ─────────────────
router.patch(
  '/:id',
  requireRole('ADMIN', 'CEO'),
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

// ─── LIST EDIT REQUESTS per customer — Admin only ─────────────────────────
router.get(
  '/:id/edit-requests',
  requireRole('ADMIN', 'CEO'),
  asyncHandler(customersController.listEditRequests),
);

// ─── APPROVE / REJECT — Admin only ─────────────────────────────────────────
router.post(
  '/edit-requests/:requestId/approve',
  requireRole('ADMIN', 'CEO'),
  asyncHandler(customersController.approveEditRequest),
);

router.post(
  '/edit-requests/:requestId/reject',
  requireRole('ADMIN', 'CEO'),
  asyncHandler(customersController.rejectEditRequest),
);

// ─── DELETE — Admin, CEO เท่านั้น ───────────────────────────────────────────
router.delete(
  '/:id',
  requireRole('ADMIN', 'CEO'),
  asyncHandler(customersController.remove),
);

export default router;