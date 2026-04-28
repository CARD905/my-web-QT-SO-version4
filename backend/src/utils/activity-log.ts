import { ActivityAction, Prisma, PrismaClient } from '@prisma/client';
import { Request } from 'express';
import { logger } from './logger';

interface LogActivityParams {
  userId: string;
  action: ActivityAction;
  entityType: string;
  entityId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}

export async function logActivity(
  client: Prisma.TransactionClient | PrismaClient,
  params: LogActivityParams,
): Promise<void> {
  try {
    await client.activityLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        description: params.description,
        metadata: (params.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        ipAddress: params.req?.ip,
        userAgent: params.req?.headers['user-agent'],
      },
    });
  } catch (err) {
    // Activity log failures should NOT break the main flow
    logger.warn('Failed to log activity', err);
  }
}
