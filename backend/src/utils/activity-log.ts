import { Request } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { logger } from './logger';

interface LogActivityOptions {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  description: string;
  before?: unknown;
  after?: unknown;
  context?: Record<string, unknown>;
  req?: Request;
}

/**
 * Log an activity. Never throws — failures are logged but don't break flow.
 */
export async function logActivity(
  prisma: PrismaClient | Prisma.TransactionClient,
  opts: LogActivityOptions,
): Promise<void> {
  try {
    let userInfo = {
      userEmail: 'system',
      userName: 'System',
      userRoleCode: 'SYSTEM',
    };

    if (opts.userId) {
      const user = await prisma.user.findUnique({
        where: { id: opts.userId },
        include: { role: true },
      });
      if (user) {
        userInfo = {
          userEmail: user.email,
          userName: user.name,
          userRoleCode: user.role.code,
        };
      }
    }

    const metadata: Record<string, unknown> = {};
    if (opts.before !== undefined) metadata.before = opts.before;
    if (opts.after !== undefined) metadata.after = opts.after;
    if (opts.context !== undefined) metadata.context = opts.context;

    await prisma.activityLog.create({
      data: {
        userId: opts.userId ?? null,
        ...userInfo,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId,
        description: opts.description,
        metadata: Object.keys(metadata).length > 0 ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress: opts.req?.ip,
        userAgent: opts.req?.get('user-agent'),
        requestId: opts.req?.get('x-request-id'),
      },
    });
  } catch (err) {
    logger.error('Failed to log activity:', err);
  }
}