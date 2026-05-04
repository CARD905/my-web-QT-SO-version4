import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { buildScopeFilter } from '../../utils/scope-filter';

interface CurrentUser {
  id: string;
  roleId: string;
  roleCode: string;
}

const HIGH_VALUE_THRESHOLD = 100000;

export const managerDashboardService = {
  // ============================================================
  // OVERVIEW — scope-aware (Manager: TEAM, Admin/CEO: ALL)
  // ============================================================
  async overview(currentUser: CurrentUser) {
    // Build scope filter for "view team's quotations"
    const scope = await buildScopeFilter(
      currentUser,
      'quotation',
      'view',
      'createdById',
    );

    if (!scope) {
      return {
        totals: {
          quotations: 0,
          pending: 0,
          escalated: 0,
          approved: 0,
          rejected: 0,
          totalValue: 0,
          pendingValue: 0,
        },
        todayActivity: { approved: 0, rejected: 0 },
        topOfficers: [],
        topApprovers: [],
        recentEscalated: [],
        statusBreakdown: [],
      };
    }

    const baseWhere: Prisma.QuotationWhereInput = { deletedAt: null, ...scope };

    // Run parallel queries
    const [
      totalCount,
      pendingCount,
      escalatedCount,
      approvedCount,
      rejectedCount,
      totalValueAgg,
      pendingValueAgg,
      todayApprovedCount,
      todayRejectedCount,
      topOfficersData,
      recentEscalatedData,
      statusBreakdownData,
    ] = await Promise.all([
      // Counts
      prisma.quotation.count({ where: baseWhere }),
      prisma.quotation.count({ where: { ...baseWhere, status: 'PENDING' } }),
      prisma.quotation.count({ where: { ...baseWhere, status: 'PENDING_ESCALATED' } }),
      prisma.quotation.count({ where: { ...baseWhere, status: 'APPROVED' } }),
      prisma.quotation.count({ where: { ...baseWhere, status: 'REJECTED' } }),

      // Values
      prisma.quotation.aggregate({
        where: { ...baseWhere, status: 'APPROVED' },
        _sum: { grandTotal: true },
      }),
      prisma.quotation.aggregate({
        where: {
          ...baseWhere,
          status: { in: ['PENDING', 'PENDING_ESCALATED'] },
        },
        _sum: { grandTotal: true },
      }),

      // Today's activity
      prisma.quotation.count({
        where: {
          ...baseWhere,
          status: 'APPROVED',
          approvedAt: { gte: startOfToday() },
        },
      }),
      prisma.quotation.count({
        where: {
          ...baseWhere,
          status: 'REJECTED',
          rejectedAt: { gte: startOfToday() },
        },
      }),

      // Top officers (by quotation count)
      prisma.quotation.groupBy({
        by: ['createdById'],
        where: baseWhere,
        _count: { id: true },
        _sum: { grandTotal: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),

      // Recent escalated (top 5)
      prisma.quotation.findMany({
        where: { ...baseWhere, status: 'PENDING_ESCALATED' },
        orderBy: { submittedAt: 'desc' },
        take: 5,
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      }),

      // Status breakdown
      prisma.quotation.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { id: true },
      }),
    ]);

    // Hydrate top officers with user info
    const officerIds = topOfficersData.map((t) => t.createdById);
    const officers = await prisma.user.findMany({
      where: { id: { in: officerIds } },
      select: { id: true, name: true, email: true },
    });
    const officerMap = new Map(officers.map((u) => [u.id, u]));

    const topOfficers = topOfficersData.map((t) => ({
      userId: t.createdById,
      userName: officerMap.get(t.createdById)?.name || '-',
      userEmail: officerMap.get(t.createdById)?.email || '',
      count: t._count.id,
      value: Number(t._sum.grandTotal ?? 0),
    }));

    // Top approvers — count approvals in scope
    const topApproversRaw = await prisma.quotation.groupBy({
      by: ['approvedById'],
      where: {
        ...baseWhere,
        status: 'APPROVED',
        approvedById: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });
    const approverIds = topApproversRaw
      .map((t) => t.approvedById)
      .filter((id): id is string => id !== null);
    const approvers = await prisma.user.findMany({
      where: { id: { in: approverIds } },
      select: { id: true, name: true, email: true },
    });
    const approverMap = new Map(approvers.map((u) => [u.id, u]));
    const topApprovers = topApproversRaw
      .filter((t): t is typeof t & { approvedById: string } => t.approvedById !== null)
      .map((t) => ({
        userId: t.approvedById,
        userName: approverMap.get(t.approvedById)?.name || '-',
        count: t._count.id,
      }));

    return {
      totals: {
        quotations: totalCount,
        pending: pendingCount,
        escalated: escalatedCount,
        approved: approvedCount,
        rejected: rejectedCount,
        totalValue: Number(totalValueAgg._sum.grandTotal ?? 0),
        pendingValue: Number(pendingValueAgg._sum.grandTotal ?? 0),
      },
      todayActivity: {
        approved: todayApprovedCount,
        rejected: todayRejectedCount,
      },
      topOfficers,
      topApprovers,
      recentEscalated: recentEscalatedData.map((q) => ({
        id: q.id,
        quotationNo: q.quotationNo,
        grandTotal: Number(q.grandTotal),
        customerCompany: q.customerCompany,
        createdByName: q.createdBy?.name || '-',
        submittedAt: q.submittedAt?.toISOString() || q.createdAt.toISOString(),
      })),
      statusBreakdown: statusBreakdownData.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
    };
  },

  // ============================================================
  // USERS LIST — team members of the manager
  // ============================================================
  async usersList(currentUser: CurrentUser) {
    // Get user IDs in scope
    const scope = await buildScopeFilter(
      currentUser,
      'user',
      'view',
      'id',
    );

    if (!scope) return [];

    const users = await prisma.user.findMany({
      where: { ...scope, deletedAt: null },
      include: {
        role: { select: { code: true, nameTh: true, level: true } },
        team: { select: { id: true, name: true } },
        _count: {
          select: { createdQuotations: { where: { deletedAt: null } } },
        },
      },
      orderBy: [{ isActive: 'desc' }, { role: { level: 'desc' } }, { name: 'asc' }],
    });

    // Get stats per user
    const userIds = users.map((u) => u.id);
    const statsRaw = await prisma.quotation.groupBy({
      by: ['createdById', 'status'],
      where: { createdById: { in: userIds }, deletedAt: null },
      _count: { id: true },
      _sum: { grandTotal: true },
    });

    type UserStats = { total: number; approved: number; approvedValue: number };
    const statsByUser = new Map<string, UserStats>();
    for (const s of statsRaw) {
      const cur = statsByUser.get(s.createdById) ?? {
        total: 0,
        approved: 0,
        approvedValue: 0,
      };
      cur.total += s._count.id;
      if (s.status === 'APPROVED') {
        cur.approved += s._count.id;
        cur.approvedValue += Number(s._sum.grandTotal ?? 0);
      }
      statsByUser.set(s.createdById, cur);
    }

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      role: u.role.code,
      roleName: u.role.nameTh,
      team: u.team ? { id: u.team.id, name: u.team.name } : null,
      stats: statsByUser.get(u.id) ?? { total: 0, approved: 0, approvedValue: 0 },
    }));
  },

  // ============================================================
  // USER DETAIL — drill-down on a specific user
  // ============================================================
  async userDetail(userId: string, currentUser: CurrentUser) {
    // Verify access via scope
    const scope = await buildScopeFilter(
      currentUser,
      'user',
      'view',
      'id',
    );

    if (!scope) {
      return {
        user: null,
        totals: { quotations: 0, approvedValue: 0, thisMonth: 0 },
        byStatus: [],
        recent: [],
      };
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null, ...scope },
      include: {
        role: { select: { code: true, nameTh: true } },
        team: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      return {
        user: null,
        totals: { quotations: 0, approvedValue: 0, thisMonth: 0 },
        byStatus: [],
        recent: [],
      };
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [totalCount, approvedAgg, thisMonthCount, byStatusRaw, recent] = await Promise.all([
      prisma.quotation.count({ where: { createdById: userId, deletedAt: null } }),
      prisma.quotation.aggregate({
        where: { createdById: userId, status: 'APPROVED', deletedAt: null },
        _sum: { grandTotal: true },
      }),
      prisma.quotation.count({
        where: {
          createdById: userId,
          createdAt: { gte: startOfMonth },
          deletedAt: null,
        },
      }),
      prisma.quotation.groupBy({
        by: ['status'],
        where: { createdById: userId, deletedAt: null },
        _count: { id: true },
      }),
      prisma.quotation.findMany({
        where: { createdById: userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          quotationNo: true,
          status: true,
          grandTotal: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: { code: user.role.code, nameTh: user.role.nameTh },
        team: user.team,
        isActive: user.isActive,
      },
      totals: {
        quotations: totalCount,
        approvedValue: Number(approvedAgg._sum.grandTotal ?? 0),
        thisMonth: thisMonthCount,
      },
      byStatus: byStatusRaw.map((s) => ({ status: s.status, count: s._count.id })),
      recent: recent.map((q) => ({
        id: q.id,
        quotationNo: q.quotationNo,
        status: q.status,
        grandTotal: Number(q.grandTotal),
        createdAt: q.createdAt.toISOString(),
      })),
    };
  },
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}