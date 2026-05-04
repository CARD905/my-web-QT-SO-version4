import { Request } from 'express';
import { prisma } from '../../../config/prisma';
import { AppError } from '../../../utils/response';
import { logActivity } from '../../../utils/activity-log';
import { CreateTeamInput, UpdateTeamInput } from './teams.schema';

const teamInclude = {
  department: { select: { id: true, code: true, name: true } },
  manager: { select: { id: true, name: true, email: true } },
  _count: { select: { members: true } },
} as const;

export const teamsService = {
  async list(departmentId?: string) {
    return prisma.team.findMany({
      where: departmentId ? { departmentId } : undefined,
      include: teamInclude,
      orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
    });
  },

  async getById(id: string) {
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        ...teamInclude,
        members: {
          select: {
            id: true,
            name: true,
            email: true,
            role: { select: { code: true, nameTh: true } },
            isActive: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!team) throw new AppError(404, 'NOT_FOUND', 'Team not found');
    return team;
  },

  async create(input: CreateTeamInput, userId: string, req?: Request) {
    if (input.code) {
      const existing = await prisma.team.findUnique({ where: { code: input.code } });
      if (existing) throw new AppError(409, 'DUPLICATE_CODE', `Code "${input.code}" already exists`);
    }

    const dept = await prisma.department.findUnique({ where: { id: input.departmentId } });
    if (!dept) throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found');

    const team = await prisma.team.create({
      data: input,
      include: teamInclude,
    });

    await logActivity(prisma, {
      userId,
      action: 'team.create',
      entityType: 'Team',
      entityId: team.id,
      description: `Created team: ${team.name} in ${dept.name}`,
      req,
    });
    return team;
  },

  async update(id: string, input: UpdateTeamInput, userId: string, req?: Request) {
    const existing = await prisma.team.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Team not found');

    if (input.code && input.code !== existing.code) {
      const dup = await prisma.team.findUnique({ where: { code: input.code } });
      if (dup) throw new AppError(409, 'DUPLICATE_CODE', `Code already exists`);
    }

    const updated = await prisma.team.update({
      where: { id },
      data: input,
      include: teamInclude,
    });

    await logActivity(prisma, {
      userId,
      action: 'team.update',
      entityType: 'Team',
      entityId: id,
      description: `Updated team: ${updated.name}`,
      req,
    });
    return updated;
  },

  async remove(id: string, userId: string, req?: Request) {
    const team = await prisma.team.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!team) throw new AppError(404, 'NOT_FOUND', 'Team not found');

    if (team._count.members > 0) {
      throw new AppError(
        409,
        'TEAM_HAS_MEMBERS',
        `Cannot delete: ${team._count.members} member(s) in team. Move them first.`,
      );
    }

    await prisma.team.delete({ where: { id } });

    await logActivity(prisma, {
      userId,
      action: 'team.delete',
      entityType: 'Team',
      entityId: id,
      description: `Deleted team: ${team.name}`,
      req,
    });
  },
};