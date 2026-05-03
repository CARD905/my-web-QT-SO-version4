import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { AppError, success } from '../../utils/response';
import { getRolePermissions } from '../../utils/permissions';

/**
 * GET /permissions/me
 * Return the current user's permissions list.
 */
async function myPermissions(req: Request, res: Response) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      role: true,
      team: { include: { department: true } },
    },
  });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

  const permissions = await getRolePermissions(user.roleId);

  // Group by resource for easy lookup on frontend
  const grouped: Record<string, Record<string, string>> = {};
  for (const p of permissions) {
    grouped[p.resource] ??= {};
    grouped[p.resource][p.action] = p.scope; // e.g. { quotation: { view: 'TEAM' } }
  }

  return success(res, {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    role: {
      id: user.role.id,
      code: user.role.code,
      nameTh: user.role.nameTh,
      nameEn: user.role.nameEn,
      level: user.role.level,
      themeColor: user.role.themeColor,
      defaultApprovalLimit: user.role.defaultApprovalLimit,
    },
    team: user.team
      ? {
          id: user.team.id,
          name: user.team.name,
          department: user.team.department
            ? { id: user.team.department.id, name: user.team.department.name }
            : null,
        }
      : null,
    permissions: permissions.map((p) => p.code),
    permissionsByResource: grouped,
    detail: permissions,
  });
}

/**
 * GET /permissions/matrix
 * Return all roles × permissions (for admin UI).
 */
async function matrix(_req: Request, res: Response) {
  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      where: { isActive: true },
      orderBy: { level: 'asc' },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    }),
    prisma.permission.findMany({ orderBy: [{ groupKey: 'asc' }, { code: 'asc' }] }),
  ]);

  return success(res, {
    roles: roles.map((r) => ({
      id: r.id,
      code: r.code,
      nameTh: r.nameTh,
      nameEn: r.nameEn,
      level: r.level,
      themeColor: r.themeColor,
      defaultApprovalLimit: r.defaultApprovalLimit,
      permissionCodes: r.permissions.map((rp) => rp.permission.code),
    })),
    permissions: permissions.map((p) => ({
      code: p.code,
      resource: p.resource,
      action: p.action,
      scope: p.scope,
      nameTh: p.nameTh,
      nameEn: p.nameEn,
      groupKey: p.groupKey,
    })),
  });
}

export const permissionsController = {
  myPermissions,
  matrix,
};