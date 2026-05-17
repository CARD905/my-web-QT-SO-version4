import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/role';
import { asyncHandler } from '../../middleware/error';

const router = Router();

router.use(authenticate);

router.get(
  '/sales',
  requireRole('OFFICER', 'SALES', 'ADMIN'),
  asyncHandler(dashboardController.sales),
);

router.get(
  '/approver',
  requireRole('MANAGER', 'CEO', 'ADMIN'),
  asyncHandler(dashboardController.approver),
);

export default router;
