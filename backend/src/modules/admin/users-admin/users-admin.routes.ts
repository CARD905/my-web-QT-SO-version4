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

router.get(
  '/',
  requirePermission('user', 'view', 'ALL'),
  validate(listUsersQuerySchema, 'query'),
  asyncHandler(usersAdminController.list),
);

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

// ✅ เพิ่มใหม่
router.delete(
  '/:id',
  requirePermission('user', 'delete', 'ALL'),
  asyncHandler(usersAdminController.remove),
);

export default router;