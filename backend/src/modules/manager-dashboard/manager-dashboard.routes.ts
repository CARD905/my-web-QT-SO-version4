import { Router } from 'express';
import { managerDashboardController } from './manager-dashboard.controller';
import { authenticate } from '../../middleware/auth';
import { requireAnyPermission } from '../../middleware/permission';
import { asyncHandler } from '../../middleware/error';

const router = Router();
router.use(authenticate);

// View — anyone with dashboard:view:team or :all
router.get(
  '/overview',
  requireAnyPermission(
    ['dashboard', 'view', 'TEAM'],
    ['dashboard', 'view', 'ALL'],
  ),
  asyncHandler(managerDashboardController.overview),
);

router.get(
  '/users',
  requireAnyPermission(
    ['user', 'view', 'TEAM'],
    ['user', 'view', 'ALL'],
  ),
  asyncHandler(managerDashboardController.users),
);

router.get(
  '/users/:userId',
  requireAnyPermission(
    ['user', 'view', 'TEAM'],
    ['user', 'view', 'ALL'],
  ),
  asyncHandler(managerDashboardController.userDetail),
);

export default router;