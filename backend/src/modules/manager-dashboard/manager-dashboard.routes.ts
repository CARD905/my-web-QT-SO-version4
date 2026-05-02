import { Router } from 'express';
import { managerDashboardController } from './manager-dashboard.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/role';
import { asyncHandler } from '../../middleware/error';

const router = Router();

router.use(authenticate);
router.use(requireRole('MANAGER', 'ADMIN'));

router.get('/overview', asyncHandler(managerDashboardController.overview));
router.get('/users', asyncHandler(managerDashboardController.users));
router.get('/users/:userId', asyncHandler(managerDashboardController.userDetail));

export default router;