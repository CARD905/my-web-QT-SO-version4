import { Router } from 'express';
import { rolesAdminController } from './roles-admin.controller';
import { authenticate } from '../../../middleware/auth';
import { requirePermission } from '../../../middleware/permission';
import { validate } from '../../../middleware/validate';
import { asyncHandler } from '../../../middleware/error';
import {
  createRoleSchema,
  updateRoleSchema,
  updatePermissionsSchema,
} from './roles-admin.schema';

const router = Router();
router.use(authenticate);

// View — anyone with role:view (Admin/CEO)
router.get(
  '/',
  requirePermission('role', 'view', 'ALL'),
  asyncHandler(rolesAdminController.list),
);

router.get(
  '/_permissions',
  requirePermission('role', 'view', 'ALL'),
  asyncHandler(rolesAdminController.listPermissions),
);

router.get(
  '/:id',
  requirePermission('role', 'view', 'ALL'),
  asyncHandler(rolesAdminController.getById),
);

// Mutations — Admin only (role:create/update/delete)
router.post(
  '/',
  requirePermission('role', 'create', 'ALL'),
  validate(createRoleSchema),
  asyncHandler(rolesAdminController.create),
);

router.patch(
  '/:id',
  requirePermission('role', 'update', 'ALL'),
  validate(updateRoleSchema),
  asyncHandler(rolesAdminController.update),
);

router.delete(
  '/:id',
  requirePermission('role', 'delete', 'ALL'),
  asyncHandler(rolesAdminController.remove),
);

// Assign permissions — Admin/CEO (role:assignPermission)
router.put(
  '/:id/permissions',
  requirePermission('role', 'assignPermission', 'ALL'),
  validate(updatePermissionsSchema),
  asyncHandler(rolesAdminController.updatePermissions),
);

export default router;