import { Router } from 'express';
import { usersAdminController } from './users-admin.controller';
import { authenticate } from '../../../middleware/auth';
import { requirePermission } from '../../../middleware/permission';
import { validate } from '../../../middleware/validate';
import { asyncHandler } from '../../../middleware/error';
import {
  listUsersQuerySchema,
  updateUserSchema,
} from './users-admin.schema';

const router = Router();
router.use(authenticate);

// View users — Admin/CEO only (user:view:ALL)
router.get(
  '/',
  requirePermission('user', 'view', 'ALL'),
  validate(listUsersQuerySchema, 'query'),
  asyncHandler(usersAdminController.list),
);

// Helper endpoints for dropdowns
router.get(
  '/_roles',
  requirePermission('user', 'view', 'ALL'),
  asyncHandler(usersAdminController.listRoles),
);
router.get(
  '/_teams',
  requirePermission('user', 'view', 'ALL'),
  asyncHandler(usersAdminController.listTeams),
);

router.get(
  '/:id',
  requirePermission('user', 'view', 'ALL'),
  asyncHandler(usersAdminController.getById),
);

// Update — Admin/CEO only
router.patch(
  '/:id',
  requirePermission('user', 'update', 'ALL'),
  validate(updateUserSchema),
  asyncHandler(usersAdminController.update),
);

router.post(
  '/:id/activate',
  requirePermission('user', 'update', 'ALL'),
  asyncHandler(usersAdminController.activate),
);

router.post(
  '/:id/deactivate',
  requirePermission('user', 'update', 'ALL'),
  asyncHandler(usersAdminController.deactivate),
);

router.post(
  '/:id/reset-password',
  requirePermission('user', 'update', 'ALL'),
  asyncHandler(usersAdminController.resetPassword),
);

export default router;