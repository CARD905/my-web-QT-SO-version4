import { Router } from 'express';
import { permissionsController } from './permissions.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/role';
import { asyncHandler } from '../../middleware/error';

const router = Router();

router.use(authenticate);

router.get('/me', asyncHandler(permissionsController.myPermissions));
router.get('/matrix', asyncHandler(permissionsController.matrix));

// Only Manager/Admin can update limits
router.patch(
  '/limits',
  requireRole('MANAGER', 'ADMIN'),
  asyncHandler(permissionsController.updateLimits),
);

export default router;