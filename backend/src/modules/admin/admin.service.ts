// backend/src/modules/admin/admin.service.ts
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/response';
import { buildPaginationMeta, getPaginationParams } from '../../utils/pagination';
import { logActivity } from '../../utils/activity-log';
import { Request } from 'express';

export interface AdminUser {
  id: string;
  roleCode: string;
  roleId: string;
  name: string;
  email: string;
}

// ─── Default system settings ─────────────────────────────────────────────
const DEFAULT_SETTINGS = [
  { key: 'vat_rate',              value: '7',     type: 'number',  group: 'vat',      label: 'VAT Rate (%)', description: 'อัตราภาษีมูลค่าเพิ่ม' },
  { key: 'vat_enabled',           value: 'true',  type: 'boolean', group: 'vat',      label: 'Enable VAT by default', description: 'เปิด VAT ในใบเสนอราคาใหม่โดยอัตโนมัติ' },
  { key: 'qt_prefix',             value: 'QT',    type: 'string',  group: 'numbering', label: 'Quotation Prefix', description: 'เช่น QT → QT-2026-0001' },
  { key: 'so_prefix',             value: 'SO',    type: 'string',  group: 'numbering', label: 'Sale Order Prefix', description: 'เช่น SO → SO-2026-0001' },
  { key: 'qt_expiry_days',        value: '30',    type: 'number',  group: 'general',  label: 'Quotation Expiry Days', description: 'จำนวนวันหมดอายุของใบเสนอราคา' },
  { key: 'normal_discount_max',   value: '20',    type: 'number',  group: 'approval', label: 'Normal Discount Max (%)', description: 'ส่วนลดสูงสุดที่ Officer ให้ได้' },
  { key: 'special_discount_max',  value: '50',    type: 'number',  group: 'approval', label: 'Special Discount Max (%)', description: 'ส่วนลดสูงสุดที่ CEO อนุมัติได้' },
  { key: 'high_value_threshold',  value: '100000',type: 'number',  group: 'approval', label: 'High Value Threshold (฿)', description: 'มูลค่าที่ต้องส่ง CEO อนุมัติ' },
  { key: 'invitation_expire_days',value: '3',     type: 'number',  group: 'general',  label: 'Invitation Expiry Days', description: 'จำนวนวันหมดอายุของ Invitation' },
  { key: 'currency_default',      value: 'THB',   type: 'string',  group: 'general',  label: 'Default Currency', description: 'สกุลเงินหลัก' },
];

export const adminService = {

  // ══════════════════════════════════════════════════════════════════════
  // SYSTEM SETTINGS
  // ══════════════════════════════════════════════════════════════════════
  async getSystemSettings() {
    // seed default ถ้ายังไม่มี
    for (const s of DEFAULT_SETTINGS) {
      await prisma.systemSetting.upsert({
        where: { key: s.key },
        create: s,
        update: {},
      });
    }
    return prisma.systemSetting.findMany({ orderBy: [{ group: 'asc' }, { label: 'asc' }] });
  },

  async updateSystemSetting(key: string, value: string, currentUser: AdminUser, req?: Request) {
    const setting = await prisma.systemSetting.findUnique({ where: { key } });
    if (!setting) throw new AppError(404, 'NOT_FOUND', `Setting "${key}" not found`);

    const updated = await prisma.systemSetting.update({
      where: { key },
      data: { value, updatedById: currentUser.id },
    });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'admin.setting.update',
      entityType: 'SystemSetting',
      entityId: key,
      description: `Updated setting ${key}: ${setting.value} → ${value}`,
      req,
    });

    return updated;
  },

  async bulkUpdateSettings(updates: { key: string; value: string }[], currentUser: AdminUser, req?: Request) {
    const results = await Promise.all(
      updates.map((u) => this.updateSystemSetting(u.key, u.value, currentUser, req))
    );
    return results;
  },

  // ══════════════════════════════════════════════════════════════════════
  // APPROVAL AUTHORITY
  // ══════════════════════════════════════════════════════════════════════
  async getApprovalAuthority() {
    const [roles, users] = await Promise.all([
      prisma.role.findMany({
        where: { isActive: true },
        select: { id: true, code: true, nameTh: true, level: true, defaultApprovalLimit: true },
        orderBy: { level: 'asc' },
      }),
      prisma.user.findMany({
        where: { deletedAt: null, isActive: true },
        select: {
          id: true, name: true, email: true, approvalLimit: true,
          role: { select: { code: true, nameTh: true } },
          team: { select: { name: true } },
        },
      }),
    ]);
    return { roles, users };
  },

  async updateRoleApprovalLimit(roleId: string, limit: number | null, currentUser: AdminUser, req?: Request) {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new AppError(404, 'NOT_FOUND', 'Role not found');

    const updated = await prisma.role.update({
      where: { id: roleId },
      data: { defaultApprovalLimit: limit },
    });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'admin.role.updateApprovalLimit',
      entityType: 'Role',
      entityId: roleId,
      description: `Updated ${role.code} approval limit: ${role.defaultApprovalLimit} → ${limit}`,
      req,
    });

    return updated;
  },

  async updateUserApprovalLimit(userId: string, limit: number | null, currentUser: AdminUser, req?: Request) {
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { approvalLimit: limit },
    });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'admin.user.updateApprovalLimit',
      entityType: 'User',
      entityId: userId,
      description: `Updated ${user.name} approval limit: ${user.approvalLimit} → ${limit}`,
      req,
    });

    return updated;
  },

  // ══════════════════════════════════════════════════════════════════════
  // ACTIVITY LOGS
  // ══════════════════════════════════════════════════════════════════════
  async getActivityLogs(query: {
    page?: number; limit?: number; userId?: string;
    action?: string; entityType?: string;
    from?: string; to?: string; search?: string;
  }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where: Prisma.ActivityLogWhereInput = {};
    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };
    if (query.entityType) where.entityType = query.entityType;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }
    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { userEmail: { contains: query.search, mode: 'insensitive' } },
        { userName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.activityLog.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  },

  // ══════════════════════════════════════════════════════════════════════
  // LOGIN HISTORY
  // ══════════════════════════════════════════════════════════════════════
  async getLoginHistory(query: {
    page?: number; limit?: number;
    userId?: string; success?: boolean; from?: string; to?: string;
  }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where: Prisma.LoginHistoryWhereInput = {};
    if (query.userId) where.userId = query.userId;
    if (query.success !== undefined) where.success = query.success;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const [data, total] = await Promise.all([
      prisma.loginHistory.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true } } },
      }),
      prisma.loginHistory.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  },

  // ══════════════════════════════════════════════════════════════════════
  // DEPARTMENT & TEAM MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════
  async getDepartments() {
    return prisma.department.findMany({
      where: { deletedAt: null },
      include: {
        teams: {
          where: { deletedAt: null },
          include: {
            manager: { select: { id: true, name: true, email: true } },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  },

  async createDepartment(data: { name: string; code: string; description?: string }, currentUser: AdminUser, req?: Request) {
    const existing = await prisma.department.findUnique({ where: { code: data.code } });
    if (existing) throw new AppError(409, 'CODE_EXISTS', 'Department code already exists');

    const dept = await prisma.department.create({ data });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'admin.department.create',
      entityType: 'Department',
      entityId: dept.id,
      description: `Created department: ${dept.name}`,
      req,
    });

    return dept;
  },

  async createTeam(data: {
    name: string; code?: string; departmentId: string;
    managerId?: string; description?: string;
  }, currentUser: AdminUser, req?: Request) {
    const dept = await prisma.department.findUnique({ where: { id: data.departmentId } });
    if (!dept) throw new AppError(404, 'NOT_FOUND', 'Department not found');

    if (data.managerId) {
      const manager = await prisma.user.findFirst({ where: { id: data.managerId, deletedAt: null } });
      if (!manager) throw new AppError(404, 'NOT_FOUND', 'Manager not found');
    }

    const team = await prisma.team.create({ data });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'admin.team.create',
      entityType: 'Team',
      entityId: team.id,
      description: `Created team: ${team.name} under ${dept.name}`,
      req,
    });

    return team;
  },

  async assignTeamManager(teamId: string, managerId: string, currentUser: AdminUser, req?: Request) {
    const [team, manager] = await Promise.all([
      prisma.team.findFirst({ where: { id: teamId, deletedAt: null } }),
      prisma.user.findFirst({ where: { id: managerId, deletedAt: null } }),
    ]);
    if (!team) throw new AppError(404, 'NOT_FOUND', 'Team not found');
    if (!manager) throw new AppError(404, 'NOT_FOUND', 'Manager not found');

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: { managerId },
    });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'admin.team.assignManager',
      entityType: 'Team',
      entityId: teamId,
      description: `Assigned ${manager.name} as manager of ${team.name}`,
      req,
    });

    return updated;
  },

  // ══════════════════════════════════════════════════════════════════════
  // USER MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════
  async getUsers(query: { page?: number; limit?: number; search?: string; roleCode?: string; teamId?: string }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (query.roleCode) where.role = { code: query.roleCode };
    if (query.teamId) where.teamId = query.teamId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, phone: true,
          isActive: true, isTeamLead: true, lastLoginAt: true,
          createdAt: true, approvalLimit: true,
          role: { select: { id: true, code: true, nameTh: true } },
          team: { select: { id: true, name: true } },
          reportsTo: { select: { id: true, name: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  },

  async assignRole(userId: string, roleId: string, currentUser: AdminUser, req?: Request) {
    const [user, role] = await Promise.all([
      prisma.user.findFirst({ where: { id: userId, deletedAt: null } }),
      prisma.role.findUnique({ where: { id: roleId } }),
    ]);
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    if (!role) throw new AppError(404, 'NOT_FOUND', 'Role not found');

    const oldRole = await prisma.role.findUnique({ where: { id: user.roleId } });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { roleId },
      include: { role: { select: { code: true, nameTh: true } } },
    });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'admin.user.assignRole',
      entityType: 'User',
      entityId: userId,
      description: `Changed ${user.name} role: ${oldRole?.code} → ${role.code}`,
      req,
    });

    return updated;
  },

  async toggleUserActive(userId: string, currentUser: AdminUser, req?: Request) {
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    if (userId === currentUser.id) throw new AppError(400, 'SELF_ACTION', 'Cannot deactivate yourself');

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
    });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: `admin.user.${updated.isActive ? 'activate' : 'deactivate'}`,
      entityType: 'User',
      entityId: userId,
      description: `${updated.isActive ? 'Activated' : 'Deactivated'} user: ${user.name}`,
      req,
    });

    return updated;
  },

  async resetPassword(userId: string, newPassword: string, currentUser: AdminUser, req?: Request) {
    const bcrypt = await import('bcrypt');
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { password: hash } });

    // revoke all refresh tokens
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'admin.user.resetPassword',
      entityType: 'User',
      entityId: userId,
      description: `Reset password for: ${user.name}`,
      req,
    });

    return { success: true };
  },

  // ══════════════════════════════════════════════════════════════════════
  // DOCUMENT COUNTER (Running Number Config)
  // ══════════════════════════════════════════════════════════════════════
  async getDocumentCounters() {
    return prisma.documentCounter.findMany({
      orderBy: [{ type: 'asc' }, { year: 'desc' }],
    });
  },

  async resetDocumentCounter(type: string, year: number, newCounter: number, currentUser: AdminUser, req?: Request) {
    const updated = await prisma.documentCounter.upsert({
      where: { type_year: { type, year } },
      create: { type, year, counter: newCounter },
      update: { counter: newCounter },
    });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'admin.counter.reset',
      entityType: 'DocumentCounter',
      entityId: `${type}-${year}`,
      description: `Reset ${type} counter for ${year} to ${newCounter}`,
      req,
    });

    return updated;
  },
};