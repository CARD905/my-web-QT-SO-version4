import { Router } from 'express';
import { permissionsController } from './permissions.controller';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permission';
import { asyncHandler } from '../../middleware/error';

const router = Router();

router.use(authenticate);

// Anyone authenticated can see their own permissions
router.get('/me', asyncHandler(permissionsController.myPermissions));

// Only Admin/CEO can see full matrix
router.get(
  '/matrix',
  requirePermission('role', 'view', 'ALL'),
  asyncHandler(permissionsController.matrix),
);

export default router;