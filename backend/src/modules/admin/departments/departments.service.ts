import { Request } from 'express';
import { prisma } from '../../../config/prisma';
import { AppError } from '../../../utils/response';
import { logActivity } from '../../../utils/activity-log';
import { CreateDepartmentInput, UpdateDepartmentInput } from './departments.schema';

export const departmentsService = {
  async list() {
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { teams: true } },
      },
    });
    return departments;
  },

  async getById(id: string) {
    const dept = await prisma.department.findUnique({
      where: { id },
      include: {
        teams: {
          include: { _count: { select: { members: true } } },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!dept) throw new AppError(404, 'NOT_FOUND', 'Department not found');
    return dept;
  },

  async create(input: CreateDepartmentInput, userId: string, req?: Request) {
    const existing = await prisma.department.findUnique({ where: { code: input.code } });
    if (existing) throw new AppError(409, 'DUPLICATE_CODE', `Code "${input.code}" already exists`);

    const dept = await prisma.department.create({ data: input });

    await logActivity(prisma, {
      userId,
      action: 'department.create',
      entityType: 'Department',
      entityId: dept.id,
      description: `Created department: ${dept.code} - ${dept.name}`,
      req,
    });
    return dept;
  },

  async update(id: string, input: UpdateDepartmentInput, userId: string, req?: Request) {
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Department not found');

    if (input.code && input.code !== existing.code) {
      const dup = await prisma.department.findUnique({ where: { code: input.code } });
      if (dup) throw new AppError(409, 'DUPLICATE_CODE', `Code "${input.code}" already exists`);
    }

    const updated = await prisma.department.update({
      where: { id },
      data: input,
    });

    await logActivity(prisma, {
      userId,
      action: 'department.update',
      entityType: 'Department',
      entityId: id,
      description: `Updated department: ${updated.code}`,
      req,
    });
    return updated;
  },

  async remove(id: string, userId: string, req?: Request) {
    const dept = await prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { teams: true } } },
    });
    if (!dept) throw new AppError(404, 'NOT_FOUND', 'Department not found');

    if (dept._count.teams > 0) {
      throw new AppError(
        409,
        'DEPARTMENT_HAS_TEAMS',
        `Cannot delete: ${dept._count.teams} team(s) belong to this department`,
      );
    }

    await prisma.department.delete({ where: { id } });

    await logActivity(prisma, {
      userId,
      action: 'department.delete',
      entityType: 'Department',
      entityId: id,
      description: `Deleted department: ${dept.code}`,
      req,
    });
  },
};