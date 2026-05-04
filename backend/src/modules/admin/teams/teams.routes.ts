import { Router } from 'express';
import { teamsController } from './teams.controller';
import { authenticate } from '../../../middleware/auth';
import { requirePermission } from '../../../middleware/permission';
import { validate } from '../../../middleware/validate';
import { asyncHandler } from '../../../middleware/error';
import { createTeamSchema, updateTeamSchema } from './teams.schema';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('team', 'view', 'ALL'), asyncHandler(teamsController.list));
router.get('/:id', requirePermission('team', 'view', 'ALL'), asyncHandler(teamsController.getById));
router.post(
  '/',
  requirePermission('team', 'manage', 'ALL'),
  validate(createTeamSchema),
  asyncHandler(teamsController.create),
);
router.patch(
  '/:id',
  requirePermission('team', 'manage', 'ALL'),
  validate(updateTeamSchema),
  asyncHandler(teamsController.update),
);
router.delete(
  '/:id',
  requirePermission('team', 'manage', 'ALL'),
  asyncHandler(teamsController.remove),
);

export default router;