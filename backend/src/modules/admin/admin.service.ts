import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/response';
import { buildPaginationMeta, getPaginationParams } from '../../utils/pagination';
import { logActivity } from '../../utils/activity-log';

export interface AdminUser {
  id: string;
  roleCode: string;
  name: string;
  email: string;
}

// ✅ Role ที่ได้รับการปกป้อง — มีได้เพียง 1 account และห้ามปิด/เปลี่ยน
const PROTECTED_ROLES = ['ADMIN', 'CEO'];

export const adminService = {
  // ============================================================
  // LIST USERS
  // ============================================================
  async listUsers(query: any) {
    const { skip, take, page, limit } = getPaginationParams(query);
    const where: Prisma.UserWhereInput = { deletedAt: null };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.roleCode) where.role = { code: query.roleCode };
    if (query.teamId) where.teamId = query.teamId;
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, phone: true,
          isActive: true, isTeamLead: true, lastLoginAt: true,
          createdAt: true, approvalLimit: true, managerLevel: true,
          role: { select: { id: true, code: true, nameTh: true } },
          team: { select: { id: true, name: true } },
          reportsTo: { select: { id: true, name: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  },

  // ============================================================
  // GET ROLES
  // ============================================================
  async getRoles() {
    return prisma.role.findMany({
      where: { isActive: true },
      orderBy: { level: 'asc' },
      select: { id: true, code: true, nameTh: true, nameEn: true, level: true },
    });
  },

  // ============================================================
  // GET TEAMS
  // ============================================================
  async getTeams() {
    return prisma.team.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, code: true,
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true, managerLevel: true } },
        _count: { select: { members: true } },
      },
    });
  },

  // ============================================================
  // GET DEPARTMENTS
  // ============================================================
  async getDepartments() {
    return prisma.department.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: 'asc' },
      include: {
        teams: {
          where: { deletedAt: null },
          include: {
            manager: { select: { id: true, name: true, managerLevel: true, approvalLimit: true } },
            _count: { select: { members: true } },
          },
        },
      },
    });
  },

  // ============================================================
  // CREATE DEPARTMENT
  // ============================================================
  async createDepartment(data: { name: string; code: string; description?: string }, currentUser: AdminUser, req?: Request) {
    const existing = await prisma.department.findFirst({ where: { code: data.code } });
    if (existing) throw new AppError(409, 'CODE_EXISTS', `Department code "${data.code}" already exists`);

    const dept = await prisma.department.create({ data });
    await logActivity(prisma, {
      userId: currentUser.id, action: 'department.create',
      entityType: 'Department', entityId: dept.id,
      description: `Created department ${dept.name}`, req,
    });
    return dept;
  },

  // ============================================================
  // CREATE TEAM
  // ============================================================
  async createTeam(data: { name: string; code?: string; departmentId: string; description?: string }, currentUser: AdminUser, req?: Request) {
    if (data.code) {
      const existing = await prisma.team.findFirst({ where: { code: data.code } });
      if (existing) throw new AppError(409, 'CODE_EXISTS', `Team code "${data.code}" already exists`);
    }

    const dept = await prisma.department.findUnique({ where: { id: data.departmentId } });
    if (!dept) throw new AppError(404, 'NOT_FOUND', 'Department not found');

    const team = await prisma.team.create({ data: { ...data, code: data.code || null } });
    await logActivity(prisma, {
      userId: currentUser.id, action: 'team.create',
      entityType: 'Team', entityId: team.id,
      description: `Created team ${team.name}`, req,
    });
    return team;
  },

  // ============================================================
  // ASSIGN TEAM MANAGER
  // ============================================================
  async assignTeamManager(teamId: string, managerId: string, currentUser: AdminUser, req?: Request) {
    const [team, manager] = await Promise.all([
      prisma.team.findUnique({ where: { id: teamId } }),
      prisma.user.findFirst({ where: { id: managerId, deletedAt: null }, include: { role: true } }),
    ]);
    if (!team) throw new AppError(404, 'NOT_FOUND', 'Team not found');
    if (!manager) throw new AppError(404, 'NOT_FOUND', 'Manager not found');
    if (manager.role.code !== 'MANAGER') {
      throw new AppError(400, 'INVALID_ROLE', 'User must have MANAGER role to be assigned as team manager');
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: { managerId },
    });

    await logActivity(prisma, {
      userId: currentUser.id, action: 'team.assignManager',
      entityType: 'Team', entityId: teamId,
      description: `Assigned ${manager.name} as manager of ${team.name}`, req,
    });

    return updated;
  },

  // ============================================================
  // ASSIGN ROLE — ✅ ปกป้อง ADMIN/CEO
  // ============================================================
  async assignRole(userId: string, roleId: string, currentUser: AdminUser, req?: Request) {
    const [user, role] = await Promise.all([
      prisma.user.findFirst({ where: { id: userId, deletedAt: null }, include: { role: true } }),
      prisma.role.findUnique({ where: { id: roleId } }),
    ]);
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    if (!role) throw new AppError(404, 'NOT_FOUND', 'Role not found');

    // ✅ ห้ามเปลี่ยน Role ของ ADMIN/CEO
    if (PROTECTED_ROLES.includes(user.role.code)) {
      throw new AppError(403, 'PROTECTED_ACCOUNT', `ไม่สามารถเปลี่ยน Role ของ ${user.role.code} account ได้`);
    }

    // ✅ ห้าม assign เป็น ADMIN/CEO ถ้ามีแล้ว 1 account
    if (PROTECTED_ROLES.includes(role.code)) {
      const existing = await prisma.user.count({
        where: { role: { code: role.code }, deletedAt: null },
      });
      if (existing >= 1) {
        throw new AppError(409, 'ROLE_LIMIT', `มี ${role.code} อยู่แล้ว 1 account — ไม่สามารถเพิ่มได้`);
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { roleId },
      include: { role: true },
    });

    await logActivity(prisma, {
      userId: currentUser.id, action: 'user.assignRole',
      entityType: 'User', entityId: userId,
      description: `Changed role of ${user.name}: ${user.role.code} → ${role.code}`, req,
    });

    return updated;
  },

  // ============================================================
  // TOGGLE ACTIVE — ✅ ปกป้อง ADMIN/CEO
  // ============================================================
  async toggleUserActive(userId: string, currentUser: AdminUser, req?: Request) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { role: true },
    });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

    // ✅ ห้ามปิดตัวเอง
    if (userId === currentUser.id) {
      throw new AppError(400, 'SELF_ACTION', 'Cannot deactivate yourself');
    }

    // ✅ ห้ามปิด ADMIN/CEO
    if (PROTECTED_ROLES.includes(user.role.code)) {
      throw new AppError(403, 'PROTECTED_ACCOUNT', `ไม่สามารถปิดการใช้งาน ${user.role.code} account ได้`);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
    });

    await logActivity(prisma, {
      userId: currentUser.id, action: 'user.toggleActive',
      entityType: 'User', entityId: userId,
      description: `${updated.isActive ? 'Activated' : 'Deactivated'} user ${user.name}`, req,
    });

    return updated;
  },

  // ============================================================
  // RESET PASSWORD
  // ============================================================
  async resetPassword(userId: string, newPassword: string, currentUser: AdminUser, req?: Request) {
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({ where: { id: userId }, data: { password: hash } });

    await logActivity(prisma, {
      userId: currentUser.id, action: 'user.resetPassword',
      entityType: 'User', entityId: userId,
      description: `Reset password for ${user.name}`, req,
    });

    return { success: true };
  },

  // ============================================================
  // APPROVAL AUTHORITY
  // ============================================================
  async getApprovalAuthority() {
    return prisma.user.findMany({
      where: {
        deletedAt: null, isActive: true,
        role: { code: { in: ['MANAGER', 'CEO'] } },
      },
      orderBy: [{ role: { level: 'asc' } }, { name: 'asc' }],
      select: {
        id: true, name: true, email: true,
        approvalLimit: true, managerLevel: true,
        role: { select: { code: true, nameTh: true } },
        team: { select: { id: true, name: true } },
      },
    });
  },

  async updateApprovalLimit(userId: string, limit: number | null, currentUser: AdminUser, req?: Request) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { role: true },
    });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { approvalLimit: limit },
    });

    await logActivity(prisma, {
      userId: currentUser.id, action: 'user.updateApprovalLimit',
      entityType: 'User', entityId: userId,
      description: `Updated approval limit of ${user.name}: ${limit ?? 'unlimited'}`, req,
    });

    return updated;
  },

  // ============================================================
  // ACTIVITY LOGS
  // ============================================================
  async getActivityLogs(query: any) {
    const { skip, take, page, limit } = getPaginationParams(query);
    const where: Prisma.ActivityLogWhereInput = {};

    if (query.search) {
      where.OR = [
        { userName: { contains: query.search, mode: 'insensitive' } },
        { userEmail: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.entityType) where.entityType = query.entityType;
    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      prisma.activityLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.activityLog.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  },

  // ============================================================
  // LOGIN HISTORY
  // ============================================================
  async getLoginHistory(query: any) {
    const { skip, take, page, limit } = getPaginationParams(query);
    const where: Prisma.LoginHistoryWhereInput = {};

    if (query.search) {
      where.email = { contains: query.search, mode: 'insensitive' };
    }
    if (query.success !== undefined) {
      where.success = query.success === 'true';
    }

    const [data, total] = await Promise.all([
      prisma.loginHistory.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true } } },
      }),
      prisma.loginHistory.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  },

  // ============================================================
  // SYSTEM SETTINGS
  // ============================================================
  async getSettings(group?: string) {
    return prisma.systemSetting.findMany({
      where: group ? { group } : undefined,
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
  },

  async updateSetting(key: string, value: string, currentUser: AdminUser, req?: Request) {
    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value, updatedById: currentUser.id },
      create: { key, value, label: key, updatedById: currentUser.id },
    });

    await logActivity(prisma, {
      userId: currentUser.id, action: 'settings.update',
      entityType: 'SystemSetting', entityId: setting.id,
      description: `Updated setting ${key} = ${value}`, req,
    });

    return setting;
  },

  // ============================================================
  // DOCUMENT COUNTER
  // ============================================================
  async getDocumentCounters() {
    const year = new Date().getFullYear();
    return prisma.documentCounter.findMany({
      where: { year },
      orderBy: { type: 'asc' },
    });
  },

  async resetDocumentCounter(type: string, currentUser: AdminUser, req?: Request) {
    const year = new Date().getFullYear();
    const counter = await prisma.documentCounter.upsert({
      where: { type_year: { type, year } },
      update: { counter: 0 },
      create: { type, year, counter: 0 },
    });

    await logActivity(prisma, {
      userId: currentUser.id, action: 'documentCounter.reset',
      entityType: 'DocumentCounter', entityId: counter.id,
      description: `Reset ${type} counter for ${year}`, req,
    });

    return counter;
  },
};