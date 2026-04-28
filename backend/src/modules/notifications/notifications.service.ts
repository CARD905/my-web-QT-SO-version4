import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/response';
import { buildPaginationMeta, getPaginationParams } from '../../utils/pagination';
import { ListNotificationsQuery } from './notifications.schema';

export const notificationsService = {
  async list(query: ListNotificationsQuery, userId: string) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.NotificationWhereInput = { userId };
    if (query.isRead !== undefined) where.isRead = query.isRead;

    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data,
      meta: { ...buildPaginationMeta(total, page, limit), unreadCount },
    };
  },

  async getUnreadCount(userId: string) {
    return prisma.notification.count({ where: { userId, isRead: false } });
  },

  async markAsRead(id: string, userId: string) {
    const notif = await prisma.notification.findFirst({ where: { id, userId } });
    if (!notif) throw new AppError(404, 'NOT_FOUND', 'Notification not found');

    return prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  },

  async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { count: result.count };
  },

  async remove(id: string, userId: string) {
    const notif = await prisma.notification.findFirst({ where: { id, userId } });
    if (!notif) throw new AppError(404, 'NOT_FOUND', 'Notification not found');
    await prisma.notification.delete({ where: { id } });
  },
};
