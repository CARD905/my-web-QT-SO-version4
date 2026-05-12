import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

interface CurrentUser {
  id: string;
  roleId: string;
  roleCode: string;
}

export type DashboardFilter = 'self' | 'team' | 'all' | 'user';

interface OverviewOptions {
  filter?: DashboardFilter;
  userId?: string;
}

async function getSubordinateIds(managerId: string): Promise<string[]> {
  const ids: string[] = [];
  const queue = [managerId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = await prisma.user.findMany({
      where: { reportsToId: current, deletedAt: null, isActive: true },
      select: { id: true },
    });
    for (const c of children) {
      if (!ids.includes(c.id)) { ids.push(c.id); queue.push(c.id); }
    }
  }
  return ids;
}

async function canViewUser(currentUser: CurrentUser, targetUserId: string): Promise<boolean> {
  if (['CEO', 'ADMIN'].includes(currentUser.roleCode)) return true;
  if (currentUser.id === targetUserId) return true;
  if (currentUser.roleCode === 'MANAGER') {
    const subIds = await getSubordinateIds(currentUser.id);
    return subIds.includes(targetUserId);
  }
  return false;
}

async function resolveWhereFromFilter(
  currentUser: CurrentUser,
  options: OverviewOptions,
): Promise<Prisma.QuotationWhereInput | null> {
  const filter = options.filter || 'self';
  if (filter === 'self') return { createdById: currentUser.id };
  if (filter === 'user') {
    if (!options.userId) throw new Error('userId is required when filter=user');
    const allowed = await canViewUser(currentUser, options.userId);
    if (!allowed) throw new Error('FORBIDDEN: You cannot view this user');
    return { createdById: options.userId };
  }
  if (filter === 'all') {
    if (!['CEO', 'ADMIN'].includes(currentUser.roleCode))
      throw new Error('FORBIDDEN: Only CEO/Admin can view all');
    return {};
  }
  if (filter === 'team') {
    if (['CEO', 'ADMIN'].includes(currentUser.roleCode)) return {};
    const subIds = await getSubordinateIds(currentUser.id);
    if (subIds.length === 0) return { createdById: currentUser.id };
    return { createdById: { in: [currentUser.id, ...subIds] } };
  }
  return null;
}

// ─── Helper: group dates by month label ──────────────────────────────────────
function groupByMonth(dates: Date[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const d of dates) {
    const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

// ─── Helper: generate last N months labels ───────────────────────────────────
function lastNMonths(n: number): { label: string; start: Date; end: Date }[] {
  return Array.from({ length: n }, (_, i) => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    start.setMonth(start.getMonth() - (n - 1 - i));
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return {
      label: start.toLocaleDateString('en-US', { month: 'short' }),
      start,
      end,
    };
  });
}

export const managerDashboardService = {
  async overview(currentUser: CurrentUser, options: OverviewOptions = {}) {
    const filterWhere = await resolveWhereFromFilter(currentUser, options);
    if (filterWhere === null) return emptyDashboard();

    const baseWhere: Prisma.QuotationWhereInput = { deletedAt: null, ...filterWhere };
    const todayStart = startOfToday();
    const monthStart = startOfMonth();
    const sixMonthsAgo = (() => {
      const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
      d.setMonth(d.getMonth() - 5); return d;
    })();

    const actingUserId =
      options.filter === 'user' && options.userId
        ? options.userId
        : currentUser.id;

    const [
      totalCount, pendingCount, escalatedCount, approvedCount, rejectedCount,
      poVerificationPendingCount,
      totalValueAgg, pendingValueAgg,
      todayApprovedCount, todayRejectedCount,
      monthApprovedCount, monthRejectedCount,
      allTimeApprovedCount, allTimeRejectedCount,
      approvalBasedApproved, approvalBasedRejected, approvalBasedTotalValue,
      topOfficersData, recentEscalatedData, statusBreakdownData,
      // ─── New: trend + avg + rejection reasons ────────────────────────────
      approvedTrendRaw, rejectedTrendRaw,
      approvedTimings,
      rejectedWithReasons,
    ] = await Promise.all([
      prisma.quotation.count({ where: baseWhere }),
      prisma.quotation.count({ where: { ...baseWhere, status: 'PENDING' } }),
      prisma.quotation.count({ where: { ...baseWhere, status: 'PENDING_ESCALATED' } }),
      prisma.quotation.count({ where: { ...baseWhere, status: 'APPROVED' } }),
      prisma.quotation.count({ where: { ...baseWhere, status: 'REJECTED' } }),

      // PO รอตรวจสอบ
      prisma.quotation.count({ where: { ...baseWhere, status: 'PO_PENDING' } }),

      prisma.quotation.aggregate({ where: { ...baseWhere, status: { in: ['APPROVED', 'PO_APPROVED'] } }, _sum: { grandTotal: true } }),
      prisma.quotation.aggregate({ where: { ...baseWhere, status: { in: ['PENDING', 'PENDING_ESCALATED', 'PO_PENDING'] } }, _sum: { grandTotal: true } }),

      prisma.quotation.count({ where: { deletedAt: null, approvedById: actingUserId, approvedAt: { gte: todayStart } } }),
      prisma.quotation.count({ where: { deletedAt: null, rejectedById: actingUserId, rejectedAt: { gte: todayStart } } }),
      prisma.quotation.count({ where: { deletedAt: null, approvedById: actingUserId, approvedAt: { gte: monthStart } } }),
      prisma.quotation.count({ where: { deletedAt: null, rejectedById: actingUserId, rejectedAt: { gte: monthStart } } }),
      prisma.quotation.count({ where: { deletedAt: null, approvedById: actingUserId } }),
      prisma.quotation.count({ where: { deletedAt: null, rejectedById: actingUserId } }),

      prisma.quotation.count({ where: { deletedAt: null, approvedById: actingUserId } }),
      prisma.quotation.count({ where: { deletedAt: null, rejectedById: actingUserId } }),
      prisma.quotation.aggregate({ where: { deletedAt: null, approvedById: actingUserId }, _sum: { grandTotal: true } }),

      prisma.quotation.groupBy({ by: ['createdById'], where: baseWhere, _count: { id: true }, _sum: { grandTotal: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
      prisma.quotation.findMany({ where: { ...baseWhere, status: 'PENDING_ESCALATED' }, orderBy: { submittedAt: 'desc' }, take: 5, include: { createdBy: { select: { id: true, name: true } } } }),
      prisma.quotation.groupBy({ by: ['status'], where: baseWhere, _count: { id: true } }),

      // ─── Trend: approved/rejected ของ actingUser ช่วง 6 เดือน ────────────
      prisma.quotation.findMany({
        where: { deletedAt: null, approvedById: actingUserId, approvedAt: { gte: sixMonthsAgo } },
        select: { approvedAt: true },
      }),
      prisma.quotation.findMany({
        where: { deletedAt: null, rejectedById: actingUserId, rejectedAt: { gte: sixMonthsAgo } },
        select: { rejectedAt: true },
      }),

      // ─── Avg approval time: submittedAt → approvedAt ──────────────────────
      prisma.quotation.findMany({
        where: {
          ...baseWhere,
          status: { in: ['APPROVED', 'PO_APPROVED'] },
          submittedAt: { not: null },
          approvedAt: { not: null },
        },
        select: { submittedAt: true, approvedAt: true },
        take: 200,
      }),

      // ─── Rejection reasons (top 5) ─────────────────────────────────────────
      prisma.quotation.findMany({
        where: { ...baseWhere, status: 'REJECTED', rejectionReason: { not: null } },
        select: { rejectionReason: true },
      }),
    ]);

    // ─── Build trendData ──────────────────────────────────────────────────────
    const months = lastNMonths(6);
    const approvedByMonth = new Map<string, number>();
    const rejectedByMonth = new Map<string, number>();

    for (const { start, end, label } of months) {
      approvedByMonth.set(label, 0);
      rejectedByMonth.set(label, 0);
      // count approved in this month
      for (const q of approvedTrendRaw) {
        if (q.approvedAt && q.approvedAt >= start && q.approvedAt < end) {
          approvedByMonth.set(label, (approvedByMonth.get(label) ?? 0) + 1);
        }
      }
      // count rejected in this month
      for (const q of rejectedTrendRaw) {
        if (q.rejectedAt && q.rejectedAt >= start && q.rejectedAt < end) {
          rejectedByMonth.set(label, (rejectedByMonth.get(label) ?? 0) + 1);
        }
      }
    }

    const trendData = months.map(({ label }) => ({
      month: label,
      approved: approvedByMonth.get(label) ?? 0,
      rejected: rejectedByMonth.get(label) ?? 0,
    }));

    // ─── Avg approval hours ───────────────────────────────────────────────────
    const validTimings = approvedTimings.filter(
      (q) => q.submittedAt && q.approvedAt && q.approvedAt > q.submittedAt,
    );
    const avgApprovalHours =
      validTimings.length > 0
        ? validTimings.reduce((sum, q) => {
            const hrs = (q.approvedAt!.getTime() - q.submittedAt!.getTime()) / (1000 * 60 * 60);
            return sum + hrs;
          }, 0) / validTimings.length
        : null;

    // ─── Rejection reasons ────────────────────────────────────────────────────
    const reasonMap = new Map<string, number>();
    for (const q of rejectedWithReasons) {
      if (!q.rejectionReason) continue;
      // truncate + normalize
      const key = q.rejectionReason.trim().slice(0, 60);
      reasonMap.set(key, (reasonMap.get(key) ?? 0) + 1);
    }
    const rejectionReasons = Array.from(reasonMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }));

    // ─── Approval-based totals fallback ──────────────────────────────────────
    let finalApproved = approvedCount;
    let finalRejected = rejectedCount;
    let finalTotal = totalCount;
    let finalTotalValue = Number(totalValueAgg._sum.grandTotal ?? 0);
    let isApproverView = false;

    if (totalCount === 0 && (allTimeApprovedCount > 0 || allTimeRejectedCount > 0)) {
      finalApproved = approvalBasedApproved;
      finalRejected = approvalBasedRejected;
      finalTotal = approvalBasedApproved + approvalBasedRejected;
      finalTotalValue = Number(approvalBasedTotalValue._sum.grandTotal ?? 0);
      isApproverView = true;
    }

    // ─── Hydrate top officers ─────────────────────────────────────────────────
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

    return {
      filter: options.filter || 'self',
      filterUserId: options.userId,
      isApproverView,
      totals: {
        quotations: finalTotal,
        pending: isApproverView ? 0 : pendingCount,
        escalated: isApproverView ? 0 : escalatedCount,
        approved: finalApproved,
        rejected: finalRejected,
        totalValue: finalTotalValue,
        pendingValue: isApproverView ? 0 : Number(pendingValueAgg._sum.grandTotal ?? 0),
        poVerificationPending: poVerificationPendingCount,   // ✅ ใหม่
      },
      todayActivity: { approved: todayApprovedCount, rejected: todayRejectedCount },
      monthActivity: { approved: monthApprovedCount, rejected: monthRejectedCount },
      allTimeActivity: { approved: allTimeApprovedCount, rejected: allTimeRejectedCount },
      avgApprovalHours: avgApprovalHours !== null ? Math.round(avgApprovalHours * 10) / 10 : null, // ✅ ใหม่
      trendData,             // ✅ ใหม่
      rejectionReasons,      // ✅ ใหม่
      topOfficers,
      topApprovers: [],
      recentEscalated: recentEscalatedData.map((q) => ({
        id: q.id, quotationNo: q.quotationNo, grandTotal: Number(q.grandTotal),
        customerCompany: q.customerCompany, createdByName: q.createdBy?.name || '-',
        submittedAt: q.submittedAt?.toISOString() || q.createdAt.toISOString(),
      })),
      statusBreakdown: statusBreakdownData.map((s) => ({ status: s.status, count: s._count.id })),
    };
  },

  async filterableUsers(currentUser: CurrentUser) {
    if (['CEO', 'ADMIN'].includes(currentUser.roleCode)) {
      const users = await prisma.user.findMany({
        where: { deletedAt: null, isActive: true, id: { not: currentUser.id } },
        include: { role: { select: { code: true, nameTh: true, level: true } } },
        orderBy: [{ role: { level: 'desc' } }, { name: 'asc' }],
      });
      return users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: { code: u.role.code, nameTh: u.role.nameTh } }));
    }
    if (currentUser.roleCode === 'MANAGER') {
      const subIds = await getSubordinateIds(currentUser.id);
      if (subIds.length === 0) return [];
      const users = await prisma.user.findMany({
        where: { id: { in: subIds }, deletedAt: null, isActive: true },
        include: { role: { select: { code: true, nameTh: true } }, reportsTo: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
      });
      return users.map((u) => ({
        id: u.id, name: u.name, email: u.email,
        role: { code: u.role.code, nameTh: u.role.nameTh },
        reportsTo: u.reportsTo ? { id: u.reportsTo.id, name: u.reportsTo.name } : null,
      }));
    }
    return [];
  },

  async usersList(currentUser: CurrentUser) {
    if (!['CEO', 'ADMIN', 'MANAGER'].includes(currentUser.roleCode)) return [];
    let userIds: string[] | null = null;
    if (currentUser.roleCode === 'MANAGER') {
      const subIds = await getSubordinateIds(currentUser.id);
      userIds = [currentUser.id, ...subIds];
    }
    const where: Prisma.UserWhereInput = { deletedAt: null, ...(userIds ? { id: { in: userIds } } : {}) };
    const users = await prisma.user.findMany({
      where,
      include: { role: { select: { code: true, nameTh: true, level: true } }, team: { select: { id: true, name: true } } },
      orderBy: [{ role: { level: 'desc' } }, { name: 'asc' }],
    });
    const ids = users.map((u) => u.id);
    const statsRaw = await prisma.quotation.groupBy({
      by: ['createdById', 'status'], where: { createdById: { in: ids }, deletedAt: null },
      _count: { id: true }, _sum: { grandTotal: true },
    });
    type UserStats = { total: number; approved: number; approvedValue: number };
    const statsByUser = new Map<string, UserStats>();
    for (const s of statsRaw) {
      const cur = statsByUser.get(s.createdById) ?? { total: 0, approved: 0, approvedValue: 0 };
      cur.total += s._count.id;
      if (s.status === 'APPROVED') { cur.approved += s._count.id; cur.approvedValue += Number(s._sum.grandTotal ?? 0); }
      statsByUser.set(s.createdById, cur);
    }
    return users.map((u) => ({
      id: u.id, name: u.name, email: u.email, isActive: u.isActive,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      role: u.role.code, roleName: u.role.nameTh,
      team: u.team ? { id: u.team.id, name: u.team.name } : null,
      stats: statsByUser.get(u.id) ?? { total: 0, approved: 0, approvedValue: 0 },
    }));
  },

  async userDetail(userId: string, currentUser: CurrentUser) {
    const allowed = await canViewUser(currentUser, userId);
    if (!allowed) return { user: null, totals: { quotations: 0, approvedValue: 0, thisMonth: 0 }, byStatus: [], recent: [] };
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { role: { select: { code: true, nameTh: true } }, team: { select: { id: true, name: true } }, reportsTo: { select: { id: true, name: true } } },
    });
    if (!user) return { user: null, totals: { quotations: 0, approvedValue: 0, thisMonth: 0 }, byStatus: [], recent: [] };
    const monthStart = startOfMonth();
    const [totalCount, approvedAgg, thisMonthCount, byStatusRaw, recent] = await Promise.all([
      prisma.quotation.count({ where: { createdById: userId, deletedAt: null } }),
      prisma.quotation.aggregate({ where: { createdById: userId, status: 'APPROVED', deletedAt: null }, _sum: { grandTotal: true } }),
      prisma.quotation.count({ where: { createdById: userId, createdAt: { gte: monthStart }, deletedAt: null } }),
      prisma.quotation.groupBy({ by: ['status'], where: { createdById: userId, deletedAt: null }, _count: { id: true } }),
      prisma.quotation.findMany({ where: { createdById: userId, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, quotationNo: true, status: true, grandTotal: true, createdAt: true } }),
    ]);
    return {
      user: { id: user.id, name: user.name, email: user.email, role: { code: user.role.code, nameTh: user.role.nameTh }, team: user.team, reportsTo: user.reportsTo, isActive: user.isActive },
      totals: { quotations: totalCount, approvedValue: Number(approvedAgg._sum.grandTotal ?? 0), thisMonth: thisMonthCount },
      byStatus: byStatusRaw.map((s) => ({ status: s.status, count: s._count.id })),
      recent: recent.map((q) => ({ id: q.id, quotationNo: q.quotationNo, status: q.status, grandTotal: Number(q.grandTotal), createdAt: q.createdAt.toISOString() })),
    };
  },
};

function startOfToday(): Date { const d = new Date(); d.setHours(0,0,0,0); return d; }
function startOfMonth(): Date { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; }
function emptyDashboard() {
  return {
    filter: 'self' as DashboardFilter, filterUserId: undefined, isApproverView: false,
    totals: { quotations: 0, pending: 0, escalated: 0, approved: 0, rejected: 0, totalValue: 0, pendingValue: 0, poVerificationPending: 0 },
    todayActivity: { approved: 0, rejected: 0 },
    monthActivity: { approved: 0, rejected: 0 },
    allTimeActivity: { approved: 0, rejected: 0 },
    avgApprovalHours: null,
    trendData: [],
    rejectionReasons: [],
    topOfficers: [], topApprovers: [], recentEscalated: [], statusBreakdown: [],
  };
}