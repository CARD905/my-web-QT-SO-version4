import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { prisma } from '../../../config/prisma';
import { AppError } from '../../../utils/response';
import { logActivity } from '../../../utils/activity-log';
import {
  CreateRoleInput,
  UpdateRoleInput,
  UpdatePermissionsInput,
} from './roles-admin.schema';

const roleInclude = {
  permissions: { include: { permission: true } },
  _count: { select: { users: true } },
} as const;

export const rolesAdminService = {
  // ============================================================
  // LIST roles
  // ============================================================
  async list() {
    return prisma.role.findMany({
      orderBy: { level: 'asc' },
      include: roleInclude,
    });
  },

  // ============================================================
  // GET ONE role with permissions
  // ============================================================
  async getById(id: string) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: roleInclude,
    });
    if (!role) throw new AppError(404, 'NOT_FOUND', 'Role not found');
    return role;
  },

  // ============================================================
  // LIST all permissions (for matrix)
  // ============================================================
  async listAllPermissions() {
    return prisma.permission.findMany({
      orderBy: [{ groupKey: 'asc' }, { resource: 'asc' }, { action: 'asc' }],
    });
  },

  // ============================================================
  // CREATE custom role
  // ============================================================
  async create(input: CreateRoleInput, actorId: string, req?: Request) {
    const existing = await prisma.role.findUnique({ where: { code: input.code } });
    if (existing) throw new AppError(409, 'DUPLICATE_CODE', `Code "${input.code}" already exists`);

    const role = await prisma.role.create({
      data: {
        code: input.code,
        nameTh: input.nameTh,
        nameEn: input.nameEn,
        description: input.description,
        level: input.level,
        themeColor: input.themeColor,
        defaultApprovalLimit:
          input.defaultApprovalLimit !== null && input.defaultApprovalLimit !== undefined
            ? new Prisma.Decimal(input.defaultApprovalLimit)
            : null,
        isSystem: false, // custom roles only
        isActive: true,
      },
      include: roleInclude,
    });

    await logActivity(prisma, {
      userId: actorId,
      action: 'role.create',
      entityType: 'Role',
      entityId: role.id,
      description: `Created custom role: ${role.code} (${role.nameTh})`,
      req,
    });

    return role;
  },

  // ============================================================
  // UPDATE role properties
  // ============================================================
  async update(id: string, input: UpdateRoleInput, actorId: string, req?: Request) {
    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Role not found');

    // Block changing critical fields on system roles
    if (existing.isSystem) {
      // Can update display fields (name/description/themeColor/limit) but not level/code/isActive
      if (input.level !== undefined && input.level !== existing.level) {
        throw new AppError(
          403,
          'SYSTEM_ROLE_PROTECTED',
          `Cannot change level of system role "${existing.code}"`,
        );
      }
      if (input.isActive === false) {
        throw new AppError(
          403,
          'SYSTEM_ROLE_PROTECTED',
          `Cannot deactivate system role "${existing.code}"`,
        );
      }
    }

    const updateData: Prisma.RoleUpdateInput = {};
    if (input.nameTh !== undefined) updateData.nameTh = input.nameTh;
    if (input.nameEn !== undefined) updateData.nameEn = input.nameEn;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.level !== undefined) updateData.level = input.level;
    if (input.themeColor !== undefined) updateData.themeColor = input.themeColor;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.defaultApprovalLimit !== undefined) {
      updateData.defaultApprovalLimit =
        input.defaultApprovalLimit !== null
          ? new Prisma.Decimal(input.defaultApprovalLimit)
          : null;
    }

    const updated = await prisma.role.update({
      where: { id },
      data: updateData,
      include: roleInclude,
    });

    await logActivity(prisma, {
      userId: actorId,
      action: 'role.update',
      entityType: 'Role',
      entityId: id,
      description: `Updated role: ${updated.code}`,
      req,
    });

    return updated;
  },

  // ============================================================
  // DELETE custom role
  // ============================================================
  async remove(id: string, actorId: string, req?: Request) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new AppError(404, 'NOT_FOUND', 'Role not found');

    if (role.isSystem) {
      throw new AppError(
        403,
        'SYSTEM_ROLE_PROTECTED',
        `Cannot delete system role "${role.code}"`,
      );
    }

    if (role._count.users > 0) {
      throw new AppError(
        409,
        'ROLE_IN_USE',
        `Cannot delete: ${role._count.users} user(s) still have this role. Reassign them first.`,
      );
    }

    // Cascade delete role_permissions, then role
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      prisma.role.delete({ where: { id } }),
    ]);

    await logActivity(prisma, {
      userId: actorId,
      action: 'role.delete',
      entityType: 'Role',
      entityId: id,
      description: `Deleted custom role: ${role.code}`,
      req,
    });
  },

  // ============================================================
  // UPDATE role permissions (bulk replace)
  // ============================================================
  async updatePermissions(
    roleId: string,
    input: UpdatePermissionsInput,
    actorId: string,
    req?: Request,
  ) {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new AppError(404, 'NOT_FOUND', 'Role not found');

    // Validate all codes exist
    const permissions = await prisma.permission.findMany({
      where: { code: { in: input.permissionCodes } },
      select: { id: true, code: true },
    });
    if (permissions.length !== input.permissionCodes.length) {
      const foundCodes = permissions.map((p) => p.code);
      const missing = input.permissionCodes.filter((c) => !foundCodes.includes(c));
      throw new AppError(
        400,
        'INVALID_PERMISSIONS',
        `Unknown permission codes: ${missing.join(', ')}`,
      );
    }

    // Compute diff for audit log
    const existing = await prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: { select: { code: true } } },
    });
    const existingCodes = new Set(existing.map((rp) => rp.permission.code));
    const newCodes = new Set(input.permissionCodes);
    const added = [...newCodes].filter((c) => !existingCodes.has(c));
    const removed = [...existingCodes].filter((c) => !newCodes.has(c));

    // Replace all permissions in a transaction
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      ...permissions.map((p) =>
        prisma.rolePermission.create({
          data: {
            roleId,
            permissionId: p.id,
            grantedById: actorId,
          },
        }),
      ),
    ]);

    await logActivity(prisma, {
      userId: actorId,
      action: 'role.update_permissions',
      entityType: 'Role',
      entityId: roleId,
      description: `Updated permissions for ${role.code}: +${added.length} (${added.join(', ')}), -${removed.length} (${removed.join(', ')})`,
      req,
    });

    return this.getById(roleId);
  },
};