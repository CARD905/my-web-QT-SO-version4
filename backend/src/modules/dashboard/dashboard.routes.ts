import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/role';
import { asyncHandler } from '../../middleware/error';

const router = Router();

router.use(authenticate);

router.get(
  '/sales',
  requireRole('SALES', 'ADMIN'),
  asyncHandler(dashboardController.sales),
);

router.get(
  '/approver',
  requireRole('APPROVER', 'ADMIN'),
  asyncHandler(dashboardController.approver),
);

export default router;
