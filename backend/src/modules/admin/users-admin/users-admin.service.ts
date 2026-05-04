import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { prisma } from '../../../config/prisma';
import { AppError } from '../../../utils/response';
import { logActivity } from '../../../utils/activity-log';
import { buildPaginationMeta, getPaginationParams } from '../../../utils/pagination';
import {
  ListUsersQuery,
  UpdateUserInput,
} from './users-admin.schema';

const userInclude = {
  role: { select: { id: true, code: true, nameTh: true, nameEn: true, level: true } },
  team: {
    select: {
      id: true,
      name: true,
      code: true,
      department: { select: { id: true, name: true, code: true } },
    },
  },
  reportsTo: { select: { id: true, name: true, email: true } },
  _count: { select: { reports: true } },
} as const;

export const usersAdminService = {
  async list(query: ListUsersQuery) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (query.roleId) where.roleId = query.roleId;
    if (query.teamId) where.teamId = query.teamId;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        include: userInclude,
      }),
      prisma.user.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  },

  async getById(id: string) {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: userInclude,
    });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    return user;
  },

  async update(id: string, input: UpdateUserInput, actorId: string, req?: Request) {
    const existing = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { role: true },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'User not found');

    if (input.roleId && input.roleId !== existing.roleId) {
      const role = await prisma.role.findUnique({ where: { id: input.roleId } });
      if (!role || !role.isActive) {
        throw new AppError(404, 'ROLE_NOT_FOUND', 'Role not found');
      }
    }

    if (input.teamId !== undefined && input.teamId !== null) {
      const team = await prisma.team.findUnique({ where: { id: input.teamId } });
      if (!team) throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
    }

    if (input.reportsToId !== undefined && input.reportsToId !== null) {
      if (input.reportsToId === id) {
        throw new AppError(400, 'CANNOT_REPORT_TO_SELF', 'A user cannot report to themselves');
      }
      const supervisor = await prisma.user.findFirst({
        where: { id: input.reportsToId, deletedAt: null },
      });
      if (!supervisor) {
        throw new AppError(404, 'SUPERVISOR_NOT_FOUND', 'Reports-to user not found');
      }
      // Cycle detection
      let cursorId: string | null = supervisor.reportsToId;
      const visited = new Set<string>([supervisor.id]);
      while (cursorId) {
        if (cursorId === id) {
          throw new AppError(400, 'REPORTS_CYCLE', 'This change would create a reporting cycle');
        }
        if (visited.has(cursorId)) break;
        visited.add(cursorId);
        const next = await prisma.user.findUnique({
          where: { id: cursorId },
          select: { reportsToId: true },
        });
        cursorId = next?.reportsToId ?? null;
      }
    }

    // Build update data — only include fields explicitly set
    const updateData: Prisma.UserUpdateInput = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.roleId !== undefined) {
      updateData.role = { connect: { id: input.roleId } };
    }
    if (input.teamId !== undefined) {
      updateData.team = input.teamId
        ? { connect: { id: input.teamId } }
        : { disconnect: true };
    }
    if (input.reportsToId !== undefined) {
      updateData.reportsTo = input.reportsToId
        ? { connect: { id: input.reportsToId } }
        : { disconnect: true };
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      include: userInclude,
    });

    await logActivity(prisma, {
      userId: actorId,
      action: 'user.update',
      entityType: 'User',
      entityId: id,
      description: `Updated user: ${updated.email}`,
      req,
    });
    return updated;
  },

  async setActive(id: string, isActive: boolean, actorId: string, req?: Request) {
    const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'User not found');

    if (existing.isActive === isActive) {
      return existing;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive },
      include: userInclude,
    });

    if (!isActive) {
      await prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await logActivity(prisma, {
      userId: actorId,
      action: isActive ? 'user.activate' : 'user.deactivate',
      entityType: 'User',
      entityId: id,
      description: `${isActive ? 'Activated' : 'Deactivated'} user: ${updated.email}`,
      req,
    });

    return updated;
  },

  async resetPassword(id: string, newPassword: string, actorId: string, req?: Request) {
    const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { password: hash } });

    await prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await logActivity(prisma, {
      userId: actorId,
      action: 'user.reset_password',
      entityType: 'User',
      entityId: id,
      description: `Reset password for ${user.email}`,
      req,
    });
  },

  async listRoles() {
    return prisma.role.findMany({
      where: { isActive: true },
      orderBy: { level: 'asc' },
      select: { id: true, code: true, nameTh: true, nameEn: true, level: true, themeColor: true },
    });
  },

  async listTeams() {
    return prisma.team.findMany({
      where: { isActive: true },
      include: { department: { select: { id: true, name: true, code: true } } },
      orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
    });
  },
};