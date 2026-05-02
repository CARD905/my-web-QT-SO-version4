import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { AppError, success } from '../../utils/response';
import { getRolePermissions } from '../../utils/permissions';

/** Get current user's permissions */
async function myPermissions(req: Request, res: Response) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { role: true },
  });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

  const perms = await getRolePermissions(user.roleId);

  return success(res, {
    role: user.role.code,
    roleName: user.role.nameTh,
    permissions: perms.map((p) => p.code),
    detail: perms,
  });
}

/** Stub for matrix — Phase 2 implements UI */
async function matrix(_req: Request, res: Response) {
  const roles = await prisma.role.findMany({
    where: { isActive: true },
    orderBy: { level: 'asc' },
    include: { permissions: { include: { permission: true } } },
  });

  return success(res, {
    roles: roles.map((r) => ({ code: r.code, nameTh: r.nameTh, level: r.level })),
    permissions: roles.flatMap((r) =>
      r.permissions.map((rp) => ({
        roleCode: r.code,
        permissionCode: rp.permission.code,
      })),
    ),
    labels: {},
    limits: { approverLimit: 0, managerLimit: 0 },
  });
}

/** Stub for limits — Phase 2 will move limits to Role.defaultApprovalLimit */
async function updateLimits(_req: Request, res: Response) {
  return success(res, { approverLimit: 0, managerLimit: 0 }, 'Phase 2 feature');
}

export const permissionsController = {
  myPermissions,
  matrix,
  updateLimits,
};