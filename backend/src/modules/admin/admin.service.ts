import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/response';
import { buildPaginationMeta, getPaginationParams, paginationSchema } from '../../utils/pagination';
import { logActivity } from '../../utils/activity-log';

export interface AdminUser {
  id: string;
  roleCode: string;
  name: string;
  email: string;
}

// ✅ Role ที่ได้รับการปกป้อง — มีได้เพียง 1 account และห้ามปิด/เปลี่ยน
const PROTECTED_ROLES = ['ADMIN', 'CEO'];
const MANAGER_LEVELS = ['DIVISION', 'DEPARTMENT', 'SECTION'] as const;
type ManagerLevel = (typeof MANAGER_LEVELS)[number];
type DbClient = typeof prisma | Prisma.TransactionClient;

const MANAGER_LEVEL_LABEL: Record<ManagerLevel, string> = {
  DIVISION: 'Division Manager',
  DEPARTMENT: 'Department Manager',
  SECTION: 'Section Manager',
};

function getParentManagerLevel(level: ManagerLevel) {
  if (level === 'SECTION') return 'DEPARTMENT';
  if (level === 'DEPARTMENT') return 'DIVISION';
  return null;
}

async function getTeamApproverId(teamId: string, tx: DbClient = prisma) {
  const managers = await tx.user.findMany({
    where: {
      teamId,
      deletedAt: null,
      isActive: true,
      role: { code: 'MANAGER' },
      managerLevel: { in: ['SECTION', 'DEPARTMENT', 'DIVISION'] },
    },
    select: { id: true, managerLevel: true },
  });
  return (
    managers.find((manager) => manager.managerLevel === 'SECTION')?.id ??
    managers.find((manager) => manager.managerLevel === 'DEPARTMENT')?.id ??
    managers.find((manager) => manager.managerLevel === 'DIVISION')?.id ??
    null
  );
}

async function syncTeamReporting(teamId: string, tx: DbClient = prisma) {
  const managers = await tx.user.findMany({
    where: { teamId, deletedAt: null, role: { code: 'MANAGER' } },
    select: { id: true, managerLevel: true },
  });

  const managerByLevel = new Map(managers.map((manager) => [manager.managerLevel, manager.id]));
  const ceo = await tx.user.findFirst({
    where: { role: { code: 'CEO' }, isActive: true, deletedAt: null },
    select: { id: true },
  });

  for (const manager of managers) {
    if (!manager.managerLevel) continue;
    const parentLevel = getParentManagerLevel(manager.managerLevel as ManagerLevel);
    const reportsToId = parentLevel ? managerByLevel.get(parentLevel) ?? ceo?.id ?? null : ceo?.id ?? null;
    await tx.user.update({
      where: { id: manager.id },
      data: { reportsToId },
    });
  }

  const officerApproverId =
    managerByLevel.get('SECTION') ?? managerByLevel.get('DEPARTMENT') ?? managerByLevel.get('DIVISION') ?? ceo?.id ?? null;

  await tx.user.updateMany({
    where: {
      teamId,
      deletedAt: null,
      role: { code: { in: ['OFFICER', 'SALES'] } },
    },
    data: { reportsToId: officerApproverId },
  });

  await tx.team.update({
    where: { id: teamId },
    data: { managerId: managerByLevel.get('SECTION') ?? managerByLevel.get('DEPARTMENT') ?? managerByLevel.get('DIVISION') ?? null },
  });
}

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
  // GET ROLES / TEAMS
  // ============================================================
  async getRoles() {
    return prisma.role.findMany({
      where: { isActive: true },
      orderBy: { level: 'asc' },
      select: { id: true, code: true, nameTh: true, nameEn: true, level: true },
    });
  },

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
  // DEPARTMENTS
  // ============================================================
  async getDepartments() {
    return prisma.department.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: 'asc' },
      include: {
        teams: {
          where: { deletedAt: null },
          include: {
            manager: {
              select: {
                id: true,
                name: true,
                email: true,
                approvalLimit: true,
                managerLevel: true,
                isActive: true,
                role: { select: { code: true, nameTh: true } },
                team: { select: { id: true, name: true } },
              },
            },
            members: {
              where: { deletedAt: null },
              select: {
                id: true,
                name: true,
                email: true,
                approvalLimit: true,
                managerLevel: true,
                isActive: true,
                role: { select: { code: true, nameTh: true } },
                team: { select: { id: true, name: true } },
                reportsTo: { select: { id: true, name: true } },
              },
              orderBy: { name: 'asc' },
            },
            _count: { select: { members: true } },
          },
        },
      },
    });
  },

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
  // TEAMS
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

  async assignTeamManager(teamId: string, managerId: string, currentUser: AdminUser, req?: Request, managerLevel?: ManagerLevel) {
    const [team, manager] = await Promise.all([
      prisma.team.findUnique({ where: { id: teamId } }),
      prisma.user.findFirst({ where: { id: managerId, deletedAt: null }, include: { role: true } }),
    ]);
    if (!team) throw new AppError(404, 'NOT_FOUND', 'Team not found');
    if (!manager) throw new AppError(404, 'NOT_FOUND', 'Manager not found');
    if (manager.role.code !== 'MANAGER') {
      throw new AppError(400, 'INVALID_ROLE', 'User must have MANAGER role');
    }

    const level = managerLevel ?? (manager.managerLevel as ManagerLevel | null);
    if (!level || !MANAGER_LEVELS.includes(level)) {
      throw new AppError(400, 'MANAGER_LEVEL_REQUIRED', 'Manager level is required');
    }

    const conflictingManager = await prisma.user.findFirst({
      where: {
        id: { not: managerId },
        teamId,
        deletedAt: null,
        role: { code: 'MANAGER' },
        managerLevel: level,
      },
      select: { id: true, name: true },
    });
    if (conflictingManager) {
      throw new AppError(409, 'TEAM_MANAGER_LEVEL_EXISTS', `${level} Manager already assigned to ${team.name}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const oldTeamId = manager.teamId;
      const user = await tx.user.update({
        where: { id: managerId },
        data: { teamId, managerLevel: level },
      });

      await syncTeamReporting(teamId, tx);
      if (oldTeamId && oldTeamId !== teamId) {
        await syncTeamReporting(oldTeamId, tx);
      }

      return tx.team.findUnique({
        where: { id: teamId },
        include: {
          manager: { select: { id: true, name: true, managerLevel: true } },
          members: {
            where: { deletedAt: null },
            select: {
              id: true, name: true, email: true, approvalLimit: true, managerLevel: true, isActive: true,
              role: { select: { code: true, nameTh: true } },
              team: { select: { id: true, name: true } },
            },
          },
        },
      }) ?? user;
    });

    await logActivity(prisma, {
      userId: currentUser.id, action: 'team.assignManager',
      entityType: 'Team', entityId: teamId,
      description: `Assigned ${manager.name} as ${level} manager of ${team.name}`, req,
    });
    return updated;
  },

  async assignUserToTeam(userId: string, teamId: string | null, currentUser: AdminUser, req?: Request) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { role: true, team: true },
    });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    if (!['OFFICER', 'SALES', 'MANAGER'].includes(user.role.code)) {
      throw new AppError(400, 'INVALID_ROLE', 'Only managers and officers can be assigned to a team');
    }

    const previousTeamId = user.teamId;
    if (teamId) {
      const team = await prisma.team.findFirst({ where: { id: teamId, deletedAt: null } });
      if (!team) throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');

      if (user.role.code === 'MANAGER') {
        if (!user.managerLevel || !MANAGER_LEVELS.includes(user.managerLevel as ManagerLevel)) {
          throw new AppError(400, 'MANAGER_LEVEL_REQUIRED', 'Manager level is required before assigning to a team');
        }

        const conflict = await prisma.user.findFirst({
          where: {
            id: { not: userId },
            teamId,
            deletedAt: null,
            role: { code: 'MANAGER' },
            managerLevel: user.managerLevel,
          },
          select: { id: true, name: true },
        });
        if (conflict) {
          throw new AppError(409, 'TEAM_MANAGER_LEVEL_EXISTS', `${user.managerLevel} Manager already assigned to ${team.name}`);
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const reportsToId = teamId && user.role.code !== 'MANAGER'
        ? await getTeamApproverId(teamId, tx)
        : null;

      const data: Prisma.UserUpdateInput = {
        team: teamId ? { connect: { id: teamId } } : { disconnect: true },
        reportsTo: reportsToId ? { connect: { id: reportsToId } } : { disconnect: true },
      };

      const next = await tx.user.update({
        where: { id: userId },
        data,
        include: {
          role: { select: { code: true, nameTh: true } },
          team: { select: { id: true, name: true } },
          reportsTo: { select: { id: true, name: true } },
        },
      });

      if (teamId) await syncTeamReporting(teamId, tx);
      if (previousTeamId && previousTeamId !== teamId) await syncTeamReporting(previousTeamId, tx);

      return next;
    });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: teamId ? 'team.assignUser' : 'team.removeUser',
      entityType: 'User',
      entityId: userId,
      description: teamId
        ? `Assigned ${user.name} to team ${teamId}`
        : `Removed ${user.name} from team ${previousTeamId ?? '-'}`,
      req,
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
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null, isActive: true,
        role: { code: { in: ['MANAGER', 'CEO'] } },
      },
      orderBy: [{ role: { level: 'asc' } }, { name: 'asc' }],
      select: {
        id: true, name: true, email: true,
        approvalLimit: true, discountLimit: true, managerLevel: true,
        role: { select: { code: true, nameTh: true } },
        team: { select: { id: true, name: true } },
      },
    });

    const managerLevels = MANAGER_LEVELS.map((level) => {
      const levelUsers = users.filter((user) => user.role.code === 'MANAGER' && user.managerLevel === level);
      const limitValues = Array.from(new Set(levelUsers.map((user) => user.approvalLimit?.toString() ?? null)));
      const discountValues = Array.from(new Set(levelUsers.map((user) => (user as any).discountLimit?.toString() ?? null)));

      return {
        level,
        label: MANAGER_LEVEL_LABEL[level],
        approvalLimit: limitValues.length === 1 ? limitValues[0] : null,
        isMixed: limitValues.length > 1,
        discountLimit: discountValues.length === 1 ? discountValues[0] : null,
        isDiscountMixed: discountValues.length > 1,
        userCount: levelUsers.length,
      };
    });

    // CEO discount limit (from CEO user)
    const ceoUser = users.find((u) => u.role.code === 'CEO');

    return { managerLevels, users, ceoDiscountLimit: (ceoUser as any)?.discountLimit ?? null };
  },

  async updateManagerLevelApprovalLimit(managerLevel: ManagerLevel, limit: number | null, currentUser: AdminUser, req?: Request) {
    if (!MANAGER_LEVELS.includes(managerLevel)) {
      throw new AppError(400, 'INVALID_MANAGER_LEVEL', 'Invalid manager level');
    }

    const result = await prisma.user.updateMany({
      where: {
        deletedAt: null,
        role: { code: 'MANAGER' },
        managerLevel,
      },
      data: { approvalLimit: limit },
    });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'managerLevel.updateApprovalLimit',
      entityType: 'ManagerLevel',
      entityId: managerLevel,
      description: `Updated approval limit of ${managerLevel} managers: ${limit ?? 'unlimited'} (${result.count} user(s))`,
      req,
    });

    return {
      managerLevel,
      approvalLimit: limit,
      updatedUsers: result.count,
    };
  },

  async updateManagerLevelDiscountLimit(managerLevel: ManagerLevel | 'CEO', limit: number | null, currentUser: AdminUser, req?: Request) {
    let result: { count: number };
    if (managerLevel === 'CEO') {
      result = await prisma.user.updateMany({
        where: { deletedAt: null, role: { code: 'CEO' } },
        data: { discountLimit: limit } as any,
      });
    } else {
      if (!MANAGER_LEVELS.includes(managerLevel as ManagerLevel)) {
        throw new AppError(400, 'INVALID_MANAGER_LEVEL', 'Invalid manager level');
      }
      result = await prisma.user.updateMany({
        where: { deletedAt: null, role: { code: 'MANAGER' }, managerLevel: managerLevel as ManagerLevel },
        data: { discountLimit: limit } as any,
      });
    }

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'managerLevel.updateDiscountLimit',
      entityType: 'ManagerLevel',
      entityId: managerLevel,
      description: `Updated discount limit of ${managerLevel}: ${limit ?? 'unlimited'}% (${result.count} user(s))`,
      req,
    });

    return { managerLevel, discountLimit: limit, updatedUsers: result.count };
  },

  // ✅ ตรงกับ routes: updateRoleApprovalLimit(roleId, limit, user, req)
  async updateRoleApprovalLimit(roleId: string, limit: number | null, currentUser: AdminUser, req?: Request) {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new AppError(404, 'NOT_FOUND', 'Role not found');

    const updated = await prisma.role.update({
      where: { id: roleId },
      data: { defaultApprovalLimit: limit },
    });

    await logActivity(prisma, {
      userId: currentUser.id, action: 'role.updateApprovalLimit',
      entityType: 'Role', entityId: roleId,
      description: `Updated default approval limit of role ${role.code}: ${limit ?? 'unlimited'}`, req,
    });
    return updated;
  },

  // ✅ ตรงกับ routes: updateUserApprovalLimit(userId, limit, user, req)
  async updateUserApprovalLimit(userId: string, limit: number | null, currentUser: AdminUser, req?: Request) {
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
  async getActivityLogUsers(query: any) {
    const where: Prisma.ActivityLogWhereInput = {
      userId: { not: null },
    };

    if (query.search) {
      where.OR = [
        { userName: { contains: query.search, mode: 'insensitive' } },
        { userEmail: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.entityType) where.entityType = query.entityType;
    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };

    const [counts, latestLogs] = await Promise.all([
      prisma.activityLog.groupBy({
        by: ['userId'],
        where,
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.activityLog.findMany({
        where,
        distinct: ['userId'],
        orderBy: [{ userId: 'asc' }, { createdAt: 'desc' }],
        select: {
          userId: true,
          action: true,
          entityType: true,
          description: true,
          createdAt: true,
        },
      }),
    ]);

    const userIds = counts.map((item) => item.userId).filter((id): id is string => Boolean(id));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        managerLevel: true,
        isActive: true,
        role: { select: { code: true, nameTh: true } },
        team: { select: { id: true, name: true } },
      },
    });

    const userMap = new Map(users.map((user) => [user.id, user]));
    const latestMap = new Map<string, (typeof latestLogs)[number]>();
    for (const log of latestLogs) {
      if (log.userId && !latestMap.has(log.userId)) {
        latestMap.set(log.userId, log);
      }
    }

    return counts
      .map((item) => {
        if (!item.userId) return null;
        const user = userMap.get(item.userId);
        if (!user) return null;
        return {
          ...user,
          activityCount: item._count._all,
          lastActivityAt: item._max.createdAt,
          lastActivity: latestMap.get(item.userId) ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => new Date(b.lastActivityAt ?? 0).getTime() - new Date(a.lastActivityAt ?? 0).getTime());
  },

  async getActivityLogs(query: any) {
    const parsedQuery = paginationSchema.parse(query);
    const { skip, take, page, limit } = getPaginationParams(parsedQuery);
    const where: Prisma.ActivityLogWhereInput = {};

    if (parsedQuery.search) {
      where.OR = [
        { userName: { contains: parsedQuery.search, mode: 'insensitive' } },
        { userEmail: { contains: parsedQuery.search, mode: 'insensitive' } },
        { description: { contains: parsedQuery.search, mode: 'insensitive' } },
      ];
    }
    if (query.userId) where.userId = query.userId;
    if (query.entityType) where.entityType = query.entityType;
    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              managerLevel: true,
              role: { select: { code: true, nameTh: true } },
              team: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);
    return { data, meta: buildPaginationMeta(total, page, limit) };
  },

  // ============================================================
  // LOGIN HISTORY
  // ============================================================
  async getLoginHistory(query: any) {
    const parsedQuery = paginationSchema.parse(query);
    const { skip, take, page, limit } = getPaginationParams(parsedQuery);
    const where: Prisma.LoginHistoryWhereInput = {};

    if (parsedQuery.search) {
      where.OR = [
        { email: { contains: parsedQuery.search, mode: 'insensitive' } },
        { user: { is: { name: { contains: parsedQuery.search, mode: 'insensitive' } } } },
      ];
    }
    if (query.success !== undefined) where.success = query.success === true || query.success === 'true';

    const [data, total] = await Promise.all([
      prisma.loginHistory.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              managerLevel: true,
              role: { select: { code: true, nameTh: true } },
              team: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.loginHistory.count({ where }),
    ]);
    return { data, meta: buildPaginationMeta(total, page, limit) };
  },

  // ============================================================
  // SYSTEM SETTINGS
  // ============================================================
  // ✅ ตรงกับ routes: getSystemSettings()
  async getSystemSettings(group?: string) {
    const DEFAULT_SETTINGS = [
      { key: 'discount.normalMax', value: '20', type: 'number', group: 'discount', label: 'Normal Discount Max (%)' },
      { key: 'discount.specialMax', value: '50', type: 'number', group: 'discount', label: 'Special Discount Max (%)' },
      { key: 'vat.defaultRate', value: '7', type: 'number', group: 'vat', label: 'Default VAT Rate (%)' },
    ];
    for (const s of DEFAULT_SETTINGS) {
      const exists = await prisma.systemSetting.findUnique({ where: { key: s.key } });
      if (!exists) {
        try {
          await prisma.systemSetting.create({ data: s });
        } catch { /* race condition — ignore */ }
      }
    }
    return prisma.systemSetting.findMany({
      where: group ? { group } : undefined,
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
  },

  async getQuotationSettings() {
    const [normal, special, vat] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: 'discount.normalMax' } }),
      prisma.systemSetting.findUnique({ where: { key: 'discount.specialMax' } }),
      prisma.systemSetting.findUnique({ where: { key: 'vat.defaultRate' } }),
    ]);
    return {
      normalDiscountMax: normal ? (parseFloat(normal.value) || 20) : 20,
      specialDiscountMax: special ? (parseFloat(special.value) || 50) : 50,
      defaultVatRate: vat ? (parseFloat(vat.value) || 7) : 7,
    };
  },

  // ✅ ตรงกับ routes: bulkUpdateSettings(updates, user, req)
  async bulkUpdateSettings(updates: { key: string; value: string }[], currentUser: AdminUser, req?: Request) {
    const results = [];
    for (const { key, value } of updates) {
      const setting = await prisma.systemSetting.upsert({
        where: { key },
        update: { value, updatedById: currentUser.id },
        create: { key, value, label: key, updatedById: currentUser.id },
      });
      results.push(setting);
    }
    await logActivity(prisma, {
      userId: currentUser.id, action: 'settings.bulkUpdate',
      entityType: 'SystemSetting',
      description: `Bulk updated ${updates.length} settings`, req,
    });
    return results;
  },

  // ✅ ตรงกับ routes: updateSystemSetting(key, value, user, req)
  async updateSystemSetting(key: string, value: string, currentUser: AdminUser, req?: Request) {
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
  // DOCUMENT COUNTERS
  // ============================================================
  async getDocumentCounters() {
    const year = new Date().getFullYear();
    return prisma.documentCounter.findMany({
      where: { year },
      orderBy: { type: 'asc' },
    });
  },

  // ✅ ตรงกับ routes: resetDocumentCounter(type, year, counter, user, req) — 5 args
  async resetDocumentCounter(type: string, year: number, counter: number, currentUser: AdminUser, req?: Request) {
    const updated = await prisma.documentCounter.upsert({
      where: { type_year: { type, year } },
      update: { counter },
      create: { type, year, counter },
    });
    await logActivity(prisma, {
      userId: currentUser.id, action: 'documentCounter.reset',
      entityType: 'DocumentCounter', entityId: updated.id,
      description: `Reset ${type} counter for ${year} to ${counter}`, req,
    });
    return updated;
  },
};
