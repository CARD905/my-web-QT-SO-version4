import { Router } from 'express';
import { managerDashboardController } from './manager-dashboard.controller';
import { authenticate } from '../../middleware/auth';
import { requireAnyPermission } from '../../middleware/permission';
import { asyncHandler } from '../../middleware/error';

const router = Router();
router.use(authenticate);

// ── Overview — Manager/CEO/Admin (with filter via query params) ──
router.get(
  '/overview',
  requireAnyPermission(
    ['dashboard', 'view', 'TEAM'],
    ['dashboard', 'view', 'ALL'],
  ),
  asyncHandler(managerDashboardController.overview),
);

// ── Filterable users — list users currentUser can pick from filter ──
router.get(
  '/filterable-users',
  requireAnyPermission(
    ['dashboard', 'view', 'TEAM'],
    ['dashboard', 'view', 'ALL'],
  ),
  asyncHandler(managerDashboardController.filterableUsers),
);

// ── Nav counts (officer sidebar badges) ──
router.get(
  '/nav-counts',
  asyncHandler(managerDashboardController.navCounts),
);

// ── Pending count (manager approval badge) ──
router.get(
  '/pending-count',
  asyncHandler(managerDashboardController.pendingCount),
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