import { Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, success } from '../../utils/response';
import { getRolePermissions, PERMISSIONS, PERMISSION_LABELS } from '../../utils/permissions';

export const permissionsController = {
  async myPermissions(req: Request, res: Response) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
    const perms = getRolePermissions(req.user.role);
    return success(res, {
      role: req.user.role,
      permissions: perms,
      labels: PERMISSION_LABELS,
    });
  },

  async matrix(_req: Request, res: Response) {
    const company = await prisma.companySettings.findFirst();
    return success(res, {
      roles: ['SALES', 'APPROVER', 'MANAGER', 'ADMIN'] as UserRole[],
      permissions: PERMISSIONS,
      labels: PERMISSION_LABELS,
      limits: {
        approverLimit: Number(company?.approverLimit ?? 100000),
        managerLimit: Number(company?.managerLimit ?? 0),
      },
    });
  },

  async updateLimits(req: Request, res: Response) {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');

    const { approverLimit, managerLimit } = req.body;

    if (typeof approverLimit !== 'number' || approverLimit < 0) {
      throw new AppError(400, 'INVALID_INPUT', 'approverLimit must be >= 0');
    }
    if (typeof managerLimit !== 'number' || managerLimit < 0) {
      throw new AppError(400, 'INVALID_INPUT', 'managerLimit must be >= 0');
    }

    let company = await prisma.companySettings.findFirst();

    if (!company) {
      company = await prisma.companySettings.create({
        data: { companyName: 'Your Company', approverLimit, managerLimit },
      });
    } else {
      company = await prisma.companySettings.update({
        where: { id: company.id },
        data: { approverLimit, managerLimit },
      });
    }

    return success(res, {
      approverLimit: Number(company.approverLimit),
      managerLimit: Number(company.managerLimit),
    }, 'Limits updated');
  },
};