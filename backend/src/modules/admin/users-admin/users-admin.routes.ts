import { Router } from 'express';
import { usersAdminController } from './users-admin.controller';
import { authenticate } from '../../../middleware/auth';
import { requirePermission, requireAnyPermission } from '../../../middleware/permission';
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
  requireAnyPermission(['user', 'view', 'ALL'], ['user', 'view', 'TEAM']),
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

router.post(
  '/:id/force-logout',
  requirePermission('user', 'update', 'ALL'),
  asyncHandler(usersAdminController.forceLogout),
);

router.delete(
  '/:id',
  requirePermission('user', 'delete', 'ALL'),
  asyncHandler(usersAdminController.remove),
);

router.get(
  '/:id/permissions',
  requirePermission('user', 'update', 'ALL'),
  asyncHandler(usersAdminController.getUserPermissions),
);

router.put(
  '/:id/permissions',
  requirePermission('user', 'update', 'ALL'),
  asyncHandler(usersAdminController.setUserPermissions),
);

export default router;
