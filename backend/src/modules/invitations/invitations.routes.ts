import { Router } from 'express';
import { invitationsController } from './invitations.controller';
import { authenticate } from '../../middleware/auth';
import { requireAnyPermission } from '../../middleware/permission';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import {
  createInvitationSchema,
  listInvitationsQuerySchema,
  acceptInvitationSchema,
} from './invitations.schema';

const router = Router();

// ===========================
// PUBLIC ROUTES (no auth)
// ===========================
router.get(
  '/by-token/:token',
  asyncHandler(invitationsController.getByToken),
);

router.post(
  '/accept',
  validate(acceptInvitationSchema),
  asyncHandler(invitationsController.accept),
);

// ===========================
// AUTHENTICATED ROUTES
// ===========================
router.use(authenticate);

router.get(
  '/',
  requireAnyPermission(
    ['user', 'invite', 'TEAM'],
    ['user', 'invite', 'ALL'],
  ),
  validate(listInvitationsQuerySchema, 'query'),
  asyncHandler(invitationsController.list),
);

router.post(
  '/',
  requireAnyPermission(
    ['user', 'invite', 'TEAM'],
    ['user', 'invite', 'ALL'],
  ),
  validate(createInvitationSchema),
  asyncHandler(invitationsController.create),
);

router.post(
  '/:id/revoke',
  requireAnyPermission(
    ['user', 'invite', 'TEAM'],
    ['user', 'invite', 'ALL'],
  ),
  asyncHandler(invitationsController.revoke),
);

export default router;