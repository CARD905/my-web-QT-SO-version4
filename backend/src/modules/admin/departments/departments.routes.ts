import { Router } from 'express';
import { departmentsController } from './departments.controller';
import { authenticate } from '../../../middleware/auth';
import { requirePermission } from '../../../middleware/permission';
import { validate } from '../../../middleware/validate';
import { asyncHandler } from '../../../middleware/error';
import { createDepartmentSchema, updateDepartmentSchema } from './departments.schema';

const router = Router();
router.use(authenticate);

// View — anyone with team:view (so officers can see structure)
router.get('/', requirePermission('team', 'view', 'ALL'), asyncHandler(departmentsController.list));
router.get('/:id', requirePermission('team', 'view', 'ALL'), asyncHandler(departmentsController.getById));

// Manage — Admin/CEO only
router.post(
  '/',
  requirePermission('team', 'manage', 'ALL'),
  validate(createDepartmentSchema),
  asyncHandler(departmentsController.create),
);
router.patch(
  '/:id',
  requirePermission('team', 'manage', 'ALL'),
  validate(updateDepartmentSchema),
  asyncHandler(departmentsController.update),
);
router.delete(
  '/:id',
  requirePermission('team', 'manage', 'ALL'),
  asyncHandler(departmentsController.remove),
);

export default router;