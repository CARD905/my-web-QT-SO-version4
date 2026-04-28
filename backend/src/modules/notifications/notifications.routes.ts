import { Router } from 'express';
import { notificationsController } from './notifications.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/error';
import { listNotificationsSchema } from './notifications.schema';

const router = Router();

router.use(authenticate);

router.get('/', validate(listNotificationsSchema, 'query'), asyncHandler(notificationsController.list));
router.get('/unread-count', asyncHandler(notificationsController.unreadCount));
router.patch('/read-all', asyncHandler(notificationsController.markAllRead));
router.patch('/:id/read', asyncHandler(notificationsController.markRead));
router.delete('/:id', asyncHandler(notificationsController.remove));

export default router;
