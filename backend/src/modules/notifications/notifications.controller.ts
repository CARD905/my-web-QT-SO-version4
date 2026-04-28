import { Request, Response } from 'express';
import { notificationsService } from './notifications.service';
import { AppError, success } from '../../utils/response';

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
  return req.user;
}

export const notificationsController = {
  async list(req: Request, res: Response) {
    const user = requireUser(req);
    const result = await notificationsService.list(req.query as never, user.id);
    return success(res, result.data, undefined, result.meta);
  },

  async unreadCount(req: Request, res: Response) {
    const user = requireUser(req);
    const count = await notificationsService.getUnreadCount(user.id);
    return success(res, { count });
  },

  async markRead(req: Request, res: Response) {
    const user = requireUser(req);
    const updated = await notificationsService.markAsRead(req.params.id, user.id);
    return success(res, updated, 'Notification marked as read');
  },

  async markAllRead(req: Request, res: Response) {
    const user = requireUser(req);
    const result = await notificationsService.markAllAsRead(user.id);
    return success(res, result, `${result.count} notifications marked as read`);
  },

  async remove(req: Request, res: Response) {
    const user = requireUser(req);
    await notificationsService.remove(req.params.id, user.id);
    return success(res, null, 'Notification deleted');
  },
};
