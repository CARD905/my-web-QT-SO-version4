import { NotificationType, Prisma, PrismaClient } from '@prisma/client';
import { logger } from './logger';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create notification for a single user.
 * Errors are caught and logged - notifications must never break main flow.
 */
export async function createNotification(
  client: Prisma.TransactionClient | PrismaClient,
  params: CreateNotificationParams,
): Promise<void> {
  try {
    await client.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
        metadata: (params.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  } catch (err) {
    logger.warn('Failed to create notification', err);
  }
}

/**
 * Notify all users with a specific role code (e.g. 'MANAGER', 'ADMIN').
 */
export async function notifyByRole(
  client: Prisma.TransactionClient | PrismaClient,
  roleCode: string,
  params: Omit<CreateNotificationParams, 'userId'>,
): Promise<void> {
  try {
    const users = await client.user.findMany({
      where: {
        role: { code: roleCode },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    await Promise.all(
      users.map((u) =>
        client.notification.create({
          data: {
            userId: u.id,
            type: params.type,
            title: params.title,
            message: params.message,
            link: params.link,
            metadata: (params.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          },
        }),
      ),
    );
  } catch (err) {
    logger.warn('Failed to notify by role', err);
  }
}