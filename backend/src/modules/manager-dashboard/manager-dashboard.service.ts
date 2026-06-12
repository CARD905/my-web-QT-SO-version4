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

function toNum(v: any): number {
  return v == null ? 0 : Number(v.toString());
}
function toThb(value: number, currency?: string | null, rate: number = 35): number {
  return currency === 'USD' ? value * rate : value;
}
async function getUsdRate(): Promise<number> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: 'currency.usdExchangeRate' } });
    return row ? (parseFloat(row.value) || 35) : 35;
  } catch { return 35; }
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
    const usdRate = await getUsdRate();

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
      expiringQuotationsRaw,
      revenueTrendRaw,
      soConfirmedCount,
      soPendingCount,
      customerTopRaw, agingRaw, soStatusBreakdownRaw, soOverdueCount, marginAgg, salesApprovedRaw,
      soConfirmedByOfficerRaw,
      // ─── Pipeline detail ──────────────────────────────────────────────────────
      pipelineApprovedAgg, pipelinePoPendingAgg, pipelineSoConfirmedAgg,
      pipelineStage1Raw, pipelineStage2Raw, pipelineStage3Raw, pipelineStage4Raw,
    ] = await Promise.all([
      prisma.quotation.count({ where: { ...baseWhere, status: { notIn: ['EXPIRED', 'CANCELLED', 'DRAFT'] } } }),
      prisma.quotation.count({ where: { ...baseWhere, status: 'PENDING' } }),
      prisma.quotation.count({ where: { ...baseWhere, status: 'PENDING_ESCALATED' } }),
      prisma.quotation.count({ where: { ...baseWhere, status: 'APPROVED' } }),
      prisma.quotation.count({ where: { ...baseWhere, status: 'REJECTED' } }),

      // PO รอตรวจสอบ
      prisma.quotation.count({ where: { ...baseWhere, status: 'PO_PENDING' } }),

      prisma.quotation.findMany({ where: { ...baseWhere, status: { in: ['APPROVED', 'PO_APPROVED'] } }, select: { grandTotal: true, currency: true } }),
      prisma.quotation.findMany({ where: { ...baseWhere, status: { in: ['PENDING', 'PENDING_ESCALATED', 'PO_PENDING'] } }, select: { grandTotal: true, currency: true } }),

      prisma.quotation.count({ where: { deletedAt: null, approvedById: actingUserId, approvedAt: { gte: todayStart } } }),
      prisma.quotation.count({ where: { deletedAt: null, rejectedById: actingUserId, rejectedAt: { gte: todayStart } } }),
      prisma.quotation.count({ where: { deletedAt: null, approvedById: actingUserId, approvedAt: { gte: monthStart } } }),
      prisma.quotation.count({ where: { deletedAt: null, rejectedById: actingUserId, rejectedAt: { gte: monthStart } } }),
      prisma.quotation.count({ where: { deletedAt: null, approvedById: actingUserId } }),
      prisma.quotation.count({ where: { deletedAt: null, rejectedById: actingUserId } }),

      prisma.quotation.count({ where: { deletedAt: null, approvedById: actingUserId } }),
      prisma.quotation.count({ where: { deletedAt: null, rejectedById: actingUserId } }),
      prisma.quotation.findMany({ where: { deletedAt: null, approvedById: actingUserId }, select: { grandTotal: true, currency: true } }),

      prisma.quotation.findMany({ where: baseWhere, select: { createdById: true, grandTotal: true, currency: true } }),
      prisma.quotation.findMany({
        where: {
          ...baseWhere,
          status: 'PENDING_ESCALATED',
          // CEO only sees items routed specifically to them; other managers see their team's scope
          ...(currentUser.roleCode === 'CEO' ? { currentApproverId: currentUser.id } : {}),
        },
        orderBy: { submittedAt: 'desc' },
        take: 10,
        include: { createdBy: { select: { id: true, name: true } } },
      }),
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

      // Expiring quotations — next 7 days (active statuses only)
      prisma.quotation.findMany({
        where: {
          ...baseWhere,
          status: { notIn: ['APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'PO_APPROVED', 'PO_REJECTED'] },
          expiryDate: { gte: new Date(), lte: new Date(Date.now() + 7 * 86400000) },
        },
        select: { id: true, quotationNo: true, customerCompany: true, grandTotal: true, expiryDate: true, status: true },
        orderBy: { expiryDate: 'asc' },
        take: 10,
      }),

      // Revenue trend raw — approved value per month (6 months)
      prisma.quotation.findMany({
        where: {
          ...baseWhere,
          status: { in: ['APPROVED', 'PO_APPROVED'] },
          approvedAt: { gte: sixMonthsAgo },
        },
        select: { approvedAt: true, grandTotal: true, currency: true },
      }),

      // SO confirmed count
      prisma.saleOrder.count({
        where: { deletedAt: null, status: 'CONFIRMED', quotation: { deletedAt: null, ...filterWhere } },
      }),

      // SO pending review count
      prisma.saleOrder.count({
        where: { deletedAt: null, status: 'PENDING_REVIEW', quotation: { deletedAt: null, ...filterWhere } },
      }),

      // Customer top 10 by grandTotal
      prisma.quotation.findMany({ where: baseWhere, select: { customerId: true, grandTotal: true, currency: true } }),

      // Aging — pending QTs with submittedAt
      prisma.quotation.findMany({
        where: {
          ...baseWhere,
          status: { in: ['PENDING', 'PENDING_ESCALATED', 'PENDING_BACKUP'] },
          submittedAt: { not: null },
        },
        select: { id: true, submittedAt: true, grandTotal: true, currency: true },
      }),

      // SO status breakdown
      prisma.saleOrder.findMany({
        where: { deletedAt: null, quotation: { deletedAt: null, ...filterWhere } },
        select: { status: true, grandTotal: true, currency: true },
      }),

      // SO overdue (deadline passed, not yet completed/cancelled)
      prisma.saleOrder.count({
        where: {
          deletedAt: null,
          status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] },
          deadlineDate: { lt: new Date() },
          quotation: { deletedAt: null, ...filterWhere },
        },
      }),

      // Margin/discount aggregate (approved QTs)
      prisma.quotation.aggregate({
        where: { ...baseWhere, status: { in: ['APPROVED', 'PO_APPROVED'] } },
        _sum: { discountTotal: true, subtotal: true },
        _count: { id: true },
      }),

      // Approved count per salesperson (for win rate)
      prisma.quotation.groupBy({
        by: ['createdById'],
        where: { ...baseWhere, status: { in: ['APPROVED', 'PO_APPROVED'] } },
        _count: { id: true },
        _sum: { grandTotal: true },
      }),

      // SO confirmed/completed value per salesperson (Avg Deal column)
      prisma.quotation.findMany({
        where: { ...baseWhere, saleOrder: { deletedAt: null, status: { in: ['CONFIRMED', 'COMPLETED'] } } },
        select: { createdById: true, grandTotal: true, currency: true },
      }),

      // ─── Pipeline detail: value aggregates per stage ──────────────────────────
      prisma.quotation.findMany({ where: { ...baseWhere, status: 'APPROVED' }, select: { grandTotal: true, currency: true } }),
      prisma.quotation.findMany({ where: { ...baseWhere, status: 'PO_PENDING' }, select: { grandTotal: true, currency: true } }),
      prisma.saleOrder.findMany({
        where: { deletedAt: null, status: { in: ['CONFIRMED', 'COMPLETED'] }, quotation: { deletedAt: null, ...filterWhere } },
        select: { grandTotal: true, currency: true },
      }),

      // Pipeline stage 1: top 5 pending QTs (with quotationNo for drilldown)
      prisma.quotation.findMany({
        where: { ...baseWhere, status: { in: ['PENDING', 'PENDING_ESCALATED', 'PENDING_BACKUP'] }, submittedAt: { not: null } },
        select: { id: true, quotationNo: true, grandTotal: true, currency: true, submittedAt: true, customerCompany: true },
        orderBy: { grandTotal: 'desc' },
        take: 5,
      }),

      // Pipeline stage 2: top 5 approved QTs waiting for PO
      prisma.quotation.findMany({
        where: { ...baseWhere, status: 'APPROVED' },
        select: { id: true, quotationNo: true, grandTotal: true, currency: true, approvedAt: true, customerCompany: true },
        orderBy: { grandTotal: 'desc' },
        take: 5,
      }),

      // Pipeline stage 3: top 5 PO pending QTs
      prisma.quotation.findMany({
        where: { ...baseWhere, status: 'PO_PENDING' },
        select: { id: true, quotationNo: true, grandTotal: true, currency: true, poUploadedAt: true, customerCompany: true },
        orderBy: { grandTotal: 'desc' },
        take: 5,
      }),

      // Pipeline stage 4: top 5 SO confirmed
      prisma.saleOrder.findMany({
        where: { deletedAt: null, status: { in: ['CONFIRMED', 'COMPLETED'] }, quotation: { deletedAt: null, ...filterWhere } },
        select: { id: true, saleOrderNo: true, grandTotal: true, currency: true, createdAt: true, customerCompany: true },
        orderBy: { grandTotal: 'desc' },
        take: 5,
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

    // ─── Revenue trend: sum of grandTotal per month ───────────────────────────
    const revenueTrendMap = new Map<string, number>();
    for (const { label } of months) revenueTrendMap.set(label, 0);
    for (const q of revenueTrendRaw) {
      for (const { start, end, label } of months) {
        if (q.approvedAt && q.approvedAt >= start && q.approvedAt < end) {
          revenueTrendMap.set(label, (revenueTrendMap.get(label) ?? 0) + toThb(toNum(q.grandTotal), q.currency, usdRate));
        }
      }
    }
    const revenueTrend = months.map(({ label }) => ({ month: label, value: revenueTrendMap.get(label) ?? 0 }));

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
    let finalTotalValue = totalValueAgg.reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate), 0);
    let isApproverView = false;

    if (totalCount === 0 && (allTimeApprovedCount > 0 || allTimeRejectedCount > 0)) {
      finalApproved = approvalBasedApproved;
      finalRejected = approvalBasedRejected;
      finalTotal = approvalBasedApproved + approvalBasedRejected;
      finalTotalValue = approvalBasedTotalValue.reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate), 0);
      isApproverView = true;
    }

    // ─── Hydrate top officers ─────────────────────────────────────────────────
    // Manual grouping of topOfficersData (was groupBy) with currency conversion
    const officerGroupMap = new Map<string, { count: number; value: number }>();
    for (const q of topOfficersData) {
      const cur = officerGroupMap.get(q.createdById) ?? { count: 0, value: 0 };
      cur.count++;
      cur.value += toThb(toNum(q.grandTotal), q.currency, usdRate);
      officerGroupMap.set(q.createdById, cur);
    }
    const topOfficerEntries = Array.from(officerGroupMap.entries())
      .sort((a, b) => b[1].count - a[1].count).slice(0, 10);
    const officerIds = topOfficerEntries.map(([id]) => id);
    const officers = await prisma.user.findMany({
      where: { id: { in: officerIds } },
      select: { id: true, name: true, email: true },
    });
    const officerMap = new Map(officers.map((u) => [u.id, u]));
    const topOfficers = topOfficerEntries.map(([id, stats]) => ({
      userId: id,
      userName: officerMap.get(id)?.name || '-',
      userEmail: officerMap.get(id)?.email || '',
      count: stats.count,
      value: stats.value,
    }));

    // --- Customer Insights ---
    // Manual grouping of customerTopRaw (was groupBy) with currency conversion
    const custGroupMap = new Map<string, { count: number; value: number }>();
    for (const q of customerTopRaw) {
      const key = q.customerId ?? '';
      const cur = custGroupMap.get(key) ?? { count: 0, value: 0 };
      cur.count++;
      cur.value += toThb(toNum(q.grandTotal), q.currency, usdRate);
      custGroupMap.set(key, cur);
    }
    const topCustEntries = Array.from(custGroupMap.entries())
      .sort((a, b) => b[1].value - a[1].value).slice(0, 10);
    const customerIds = topCustEntries.map(([id]) => id).filter(Boolean);
    const customerDocs = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, company: true },
    });
    const customerMap = new Map(customerDocs.map((c) => [c.id, c.company]));
    const customerInsights = topCustEntries.map(([cid, stats]) => ({
      customerId: cid,
      customerCompany: cid ? (customerMap.get(cid) ?? '(ไม่ระบุ)') : '(ไม่ระบุ)',
      qtCount: stats.count,
      totalValue: stats.value,
    }));

    // --- Quotation Aging ---
    const now = Date.now();
    const agingBuckets = {
      lt1d:  { count: 0, value: 0 },
      d1to3: { count: 0, value: 0 },
      d3to7: { count: 0, value: 0 },
      gt7d:  { count: 0, value: 0 },
    };
    for (const q of agingRaw) {
      if (!q.submittedAt) continue;
      const hours = (now - q.submittedAt.getTime()) / (1000 * 60 * 60);
      const val = toThb(toNum(q.grandTotal), q.currency, usdRate);
      if (hours < 24)        { agingBuckets.lt1d.count++;  agingBuckets.lt1d.value  += val; }
      else if (hours < 72)   { agingBuckets.d1to3.count++; agingBuckets.d1to3.value += val; }
      else if (hours < 168)  { agingBuckets.d3to7.count++; agingBuckets.d3to7.value += val; }
      else                   { agingBuckets.gt7d.count++;  agingBuckets.gt7d.value  += val; }
    }

    // --- SO Execution ---
    const soStatusMap = new Map<string, { count: number; value: number }>();
    for (const s of soStatusBreakdownRaw) {
      const cur = soStatusMap.get(s.status) ?? { count: 0, value: 0 };
      cur.count++;
      cur.value += toThb(toNum(s.grandTotal), s.currency, usdRate);
      soStatusMap.set(s.status, cur);
    }
    const soExecution = {
      statusBreakdown: Array.from(soStatusMap.entries()).map(([status, v]) => ({ status, count: v.count, value: v.value })),
      overdueCount: soOverdueCount,
      totalSos: soStatusBreakdownRaw.length,
      completedValue: soStatusMap.get('COMPLETED')?.value ?? 0,
      completedCount: soStatusMap.get('COMPLETED')?.count ?? 0,
    };

    // --- Margin Analysis ---
    const approvedSubtotal = Number(marginAgg._sum.subtotal ?? 0);
    const totalDiscountGiven = Number(marginAgg._sum.discountTotal ?? 0);
    const avgDiscountRate = approvedSubtotal > 0 ? (totalDiscountGiven / approvedSubtotal) * 100 : 0;
    const marginAnalysis = {
      totalDiscountGiven,
      totalApprovedSubtotal: approvedSubtotal,
      avgDiscountRate: Math.round(avgDiscountRate * 10) / 10,
      approvedCount: marginAgg._count.id,
    };

    // --- Forecast ---
    const avgMonthlyRevenue = revenueTrend.length > 0
      ? revenueTrend.reduce((sum, m) => sum + m.value, 0) / revenueTrend.length : 0;
    const convRate = finalTotal > 0 ? finalApproved / finalTotal : 0;
    const forecast = {
      nextMonthForecast: Math.round(avgMonthlyRevenue * 1.05),
      pipelineCoverage: convRate > 0
        ? Math.round(pendingValueAgg.reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate), 0) * convRate)
        : 0,
      avgMonthlyRevenue: Math.round(avgMonthlyRevenue),
    };

    // --- Salesperson win rate (enhance topOfficers) ---
    // Value       = sum of ALL QT grandTotal for this officer (o.value)
    // avgDealSize = total QT grandTotal that converted to CONFIRMED/COMPLETED SOs
    // winRate     = avgDealSize / value * 100
    // Manual grouping of soConfirmedByOfficerRaw (was groupBy) with currency conversion
    const soConfirmedOfficerMap = new Map<string, { count: number; value: number }>();
    for (const q of soConfirmedByOfficerRaw) {
      const cur = soConfirmedOfficerMap.get(q.createdById) ?? { count: 0, value: 0 };
      cur.count++;
      cur.value += toThb(toNum(q.grandTotal), q.currency, usdRate);
      soConfirmedOfficerMap.set(q.createdById, cur);
    }
    const topOfficersEnhanced = topOfficers.map((o) => {
      const soData  = soConfirmedOfficerMap.get(o.userId);
      const soValue = soData?.value ?? 0;
      const winRate = o.value > 0 ? Math.round((soValue / o.value) * 100) : 0;
      return { ...o, winRate, avgDealSize: soValue, approvedCount: soData?.count ?? 0, approvedValue: soValue };
    });

    // ─── Pipeline detail ─────────────────────────────────────────────────────────
    const pipelineNow = Date.now();
    function avgHoursSince(items: Array<{ date: Date | null | undefined }>): number | null {
      const valid = items.filter((x) => x.date);
      if (valid.length === 0) return null;
      return Math.round(
        (valid.reduce((s, x) => s + (pipelineNow - x.date!.getTime()), 0) / valid.length / (1000 * 60 * 60)) * 10,
      ) / 10;
    }
    const pipelineDetail = {
      approvedOnlyValue: pipelineApprovedAgg.reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate), 0),
      poPendingValue: pipelinePoPendingAgg.reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate), 0),
      soConfirmedValue: pipelineSoConfirmedAgg.reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate), 0),
      stage1AvgHours: avgHoursSince(pipelineStage1Raw.map((q) => ({ date: q.submittedAt }))),
      stage2AvgHours: avgHoursSince(pipelineStage2Raw.map((q) => ({ date: q.approvedAt }))),
      stage3AvgHours: avgHoursSince(pipelineStage3Raw.map((q) => ({ date: q.poUploadedAt }))),
      stage1Top: pipelineStage1Raw.map((q) => ({ id: q.id, quotationNo: q.quotationNo, grandTotal: toThb(toNum(q.grandTotal), q.currency, usdRate), submittedAt: q.submittedAt?.toISOString() ?? null, customerCompany: q.customerCompany })),
      stage2Top: pipelineStage2Raw.map((q) => ({ id: q.id, quotationNo: q.quotationNo, grandTotal: toThb(toNum(q.grandTotal), q.currency, usdRate), approvedAt: q.approvedAt?.toISOString() ?? null, customerCompany: q.customerCompany })),
      stage3Top: pipelineStage3Raw.map((q) => ({ id: q.id, quotationNo: q.quotationNo, grandTotal: toThb(toNum(q.grandTotal), q.currency, usdRate), poUploadedAt: q.poUploadedAt?.toISOString() ?? null, customerCompany: q.customerCompany })),
      stage4Top: pipelineStage4Raw.map((so) => ({ id: so.id, saleOrderNo: so.saleOrderNo, grandTotal: toThb(toNum(so.grandTotal), so.currency, usdRate), createdAt: so.createdAt.toISOString(), customerCompany: so.customerCompany })),
    };

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
        pendingValue: isApproverView ? 0 : pendingValueAgg.reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate), 0),
        poVerificationPending: poVerificationPendingCount,
        soConfirmed: soConfirmedCount,
        soPending: soPendingCount,
      },
      todayActivity: { approved: todayApprovedCount, rejected: todayRejectedCount },
      monthActivity: { approved: monthApprovedCount, rejected: monthRejectedCount },
      allTimeActivity: { approved: allTimeApprovedCount, rejected: allTimeRejectedCount },
      avgApprovalHours: avgApprovalHours !== null ? Math.round(avgApprovalHours * 10) / 10 : null,
      trendData,
      revenueTrend,
      rejectionReasons,
      expiringQuotations: expiringQuotationsRaw.map((q) => ({
        id: q.id,
        quotationNo: q.quotationNo,
        customerCompany: q.customerCompany,
        grandTotal: Number(q.grandTotal),
        expiryDate: q.expiryDate!.toISOString(),
        status: q.status,
      })),
      topOfficers: topOfficersEnhanced,
      topApprovers: [],
      marginAnalysis,
      customerInsights,
      agingBuckets,
      soExecution,
      forecast,
      pipelineDetail,
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
        include: {
          role: { select: { code: true, nameTh: true, level: true } },
          team: { select: { id: true, name: true, code: true } },
          reportsTo: { select: { id: true, name: true } },
        },
        orderBy: [{ role: { level: 'desc' } }, { name: 'asc' }],
      });
      return users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: { code: u.role.code, nameTh: u.role.nameTh },
        team: u.team ? { id: u.team.id, name: u.team.name, code: u.team.code ?? undefined } : null,
        reportsTo: u.reportsTo ? { id: u.reportsTo.id, name: u.reportsTo.name } : null,
        managerLevel: u.managerLevel ?? null,
      }));
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

  async navCounts(currentUser: CurrentUser): Promise<{ qt: number; checklist: number; so: number }> {
    const [qt, checklist, so] = await Promise.all([
      // Quotation List: only items the officer must act on (submit or fix)
      prisma.quotation.count({ where: { deletedAt: null, createdById: currentUser.id, status: { in: ['DRAFT', 'REJECTED'] as any } } }),
      // Checklist (Awaiting PO): approved quotations waiting for PO, or PO was rejected
      prisma.quotation.count({ where: { deletedAt: null, createdById: currentUser.id, status: { in: ['APPROVED', 'PO_REJECTED'] as any } } }),
      // Sale Orders: only items the officer must act on (confirm or fix)
      prisma.saleOrder.count({ where: { deletedAt: null, status: { in: ['DRAFT', 'REJECTED'] as any }, quotation: { createdById: currentUser.id } } }),
    ]);
    return { qt, checklist, so };
  },

  async pendingCount(currentUser: CurrentUser): Promise<{ qtCount: number; soCount: number; total: number }> {
    const isManagerAbove = ['MANAGER', 'CEO', 'ADMIN'].includes(currentUser.roleCode);
    let qtCount = 0;
    let soCount = 0;
    if (isManagerAbove) {
      // QT approval: only items explicitly routed to this user
      // PO_PENDING is handled via Sale Order flow, not counted here
      const [normalQt, escalatedQt, pendingSo] = await Promise.all([
        prisma.quotation.count({ where: { deletedAt: null, status: { in: ['PENDING', 'PENDING_BACKUP'] }, currentApproverId: currentUser.id } }),
        prisma.quotation.count({ where: { deletedAt: null, status: 'PENDING_ESCALATED', currentApproverId: currentUser.id } }),
        prisma.saleOrder.count({ where: { deletedAt: null, status: 'PENDING_REVIEW' } }),
      ]);
      qtCount = normalQt + escalatedQt;
      soCount = pendingSo;
    } else {
      // Officer: their QTs in pending states + their draft/rejected SOs
      const [pendingQt, actionSo] = await Promise.all([
        prisma.quotation.count({ where: { deletedAt: null, createdById: currentUser.id, status: { in: ['PENDING', 'PENDING_ESCALATED', 'PENDING_BACKUP'] } } }),
        prisma.saleOrder.count({ where: { deletedAt: null, status: { in: ['DRAFT', 'REJECTED'] }, quotation: { createdById: currentUser.id } } }),
      ]);
      qtCount = pendingQt;
      soCount = actionSo;
    }
    return { qtCount, soCount, total: qtCount + soCount };
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
    const usdRate = await getUsdRate();
    const statsRaw = await prisma.quotation.findMany({
      where: { createdById: { in: ids }, deletedAt: null },
      select: { createdById: true, status: true, grandTotal: true, currency: true },
    });
    type UserStats = { total: number; approved: number; approvedValue: number };
    const statsByUser = new Map<string, UserStats>();
    for (const s of statsRaw) {
      const cur = statsByUser.get(s.createdById) ?? { total: 0, approved: 0, approvedValue: 0 };
      cur.total++;
      if (s.status === 'APPROVED') { cur.approved++; cur.approvedValue += toThb(toNum(s.grandTotal), s.currency, usdRate); }
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
    const usdRate = await getUsdRate();
    const allowed = await canViewUser(currentUser, userId);
    if (!allowed) return { user: null, totals: { quotations: 0, approvedValue: 0, thisMonth: 0, approvedCount: 0, rejectedCount: 0, soCount: 0, soValue: 0 }, byStatus: [], recent: [], recentSos: [], monthlyTrend: [] };
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        role: { select: { id: true, code: true, nameTh: true, level: true } },
        team: {
          select: {
            id: true,
            name: true,
            _count: { select: { members: true } },
          },
        },
        reportsTo: { select: { id: true, name: true } },
        _count: { select: { reports: true } },
      },
    });
    if (!user) return { user: null, totals: { quotations: 0, approvedValue: 0, thisMonth: 0, approvedCount: 0, rejectedCount: 0, soCount: 0, soValue: 0 }, byStatus: [], recent: [], recentSos: [], monthlyTrend: [] };

    const monthStart = startOfMonth();

    // Build 6-month date buckets
    const now = new Date();
    const months6: Array<{ label: string; gte: Date; lt: Date }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const label = `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
      months6.push({ label, gte: d, lt: next });
    }

    const now7d = new Date(Date.now() + 7 * 86400000);

    const [
      totalCount, approvedAgg, thisMonthCount, byStatusRaw, recent,
      soCountRaw, soAgg, recentSos,
      totalValueAgg, pendingValueAgg,
      expiringRaw, customerTopRaw,
    ] = await Promise.all([
      prisma.quotation.count({ where: { createdById: userId, deletedAt: null } }),
      prisma.quotation.findMany({ where: { createdById: userId, status: { in: ['APPROVED', 'PO_PENDING', 'PO_APPROVED', 'PO_REJECTED'] }, deletedAt: null }, select: { grandTotal: true, currency: true } }),
      prisma.quotation.count({ where: { createdById: userId, createdAt: { gte: monthStart }, deletedAt: null } }),
      prisma.quotation.groupBy({ by: ['status'], where: { createdById: userId, deletedAt: null }, _count: { id: true } }),
      prisma.quotation.findMany({ where: { createdById: userId, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, quotationNo: true, status: true, grandTotal: true, createdAt: true, customerCompany: true } }),
      prisma.saleOrder.count({ where: { deletedAt: null, status: { in: ['CONFIRMED', 'COMPLETED'] }, quotation: { createdById: userId, deletedAt: null } } }),
      prisma.saleOrder.findMany({ where: { deletedAt: null, status: { in: ['CONFIRMED', 'COMPLETED'] }, quotation: { createdById: userId, deletedAt: null } }, select: { grandTotal: true, currency: true } }),
      prisma.saleOrder.findMany({ where: { deletedAt: null, quotation: { createdById: userId, deletedAt: null } }, orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, saleOrderNo: true, status: true, grandTotal: true, createdAt: true, customerCompany: true } }),
      // Total value of all QTs (pipeline baseline)
      prisma.quotation.findMany({ where: { createdById: userId, deletedAt: null }, select: { grandTotal: true, currency: true } }),
      // Pending value
      prisma.quotation.findMany({ where: { createdById: userId, deletedAt: null, status: { in: ['PENDING', 'PENDING_ESCALATED', 'PENDING_BACKUP'] } }, select: { grandTotal: true, currency: true } }),
      // Expiring in 7 days
      prisma.quotation.findMany({
        where: {
          createdById: userId, deletedAt: null,
          status: { notIn: ['APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'PO_APPROVED', 'PO_REJECTED'] },
          expiryDate: { gte: new Date(), lte: now7d },
        },
        select: { id: true, quotationNo: true, customerCompany: true, grandTotal: true, expiryDate: true, status: true },
        orderBy: { expiryDate: 'asc' },
        take: 10,
      }),
      // Top 5 customers by total QT value
      prisma.quotation.findMany({
        where: { createdById: userId, deletedAt: null },
        select: { customerId: true, grandTotal: true, currency: true },
      }),
    ]);

    // Monthly trend — parallel per bucket
    const trendRaws = await Promise.all(
      months6.map((m) =>
        prisma.quotation.findMany({
          where: { createdById: userId, deletedAt: null, createdAt: { gte: m.gte, lt: m.lt } },
          select: { grandTotal: true, currency: true },
        }),
      ),
    );
    const monthlyTrend = months6.map((m, i) => ({
      month: m.label,
      count: trendRaws[i].length,
      value: trendRaws[i].reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate), 0),
    }));

    const rejCount = byStatusRaw.find((s) => s.status === 'REJECTED')?._count.id ?? 0;
    const approvedCount = approvedAgg.length;

    // Hydrate customer names — manual grouping with currency conversion
    const custDetailGroupMap = new Map<string, { count: number; value: number }>();
    for (const q of customerTopRaw) {
      const key = q.customerId ?? '';
      const cur = custDetailGroupMap.get(key) ?? { count: 0, value: 0 };
      cur.count++;
      cur.value += toThb(toNum(q.grandTotal), q.currency, usdRate);
      custDetailGroupMap.set(key, cur);
    }
    const topCustDetailEntries = Array.from(custDetailGroupMap.entries())
      .sort((a, b) => b[1].value - a[1].value).slice(0, 5);
    const customerDetailIds = topCustDetailEntries.map(([id]) => id).filter(Boolean);
    const customerDocs = customerDetailIds.length > 0
      ? await prisma.customer.findMany({ where: { id: { in: customerDetailIds } }, select: { id: true, company: true } })
      : [];
    const customerMap = new Map(customerDocs.map((c) => [c.id, c.company ?? '(ไม่ระบุ)']));

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: { id: user.role.id, code: user.role.code, nameTh: user.role.nameTh },
        team: user.team ? { id: user.team.id, name: user.team.name, size: user.team._count.members } : null,
        reportsTo: user.reportsTo,
        isActive: user.isActive,
        isTeamLead: user.isTeamLead,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        approvalLimit: user.approvalLimit?.toString() ?? null,
        managerLevel: user.managerLevel,
        approvalTier: user.role.level,
        position: user.managerLevel ? `${user.managerLevel} Manager` : user.role.nameTh,
      },
      totals: {
        quotations: totalCount,
        approvedValue: approvedAgg.reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate), 0),
        thisMonth: thisMonthCount,
        approvedCount,
        rejectedCount: rejCount,
        soCount: soCountRaw,
        soValue: soAgg.reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate), 0),
        totalValue: totalValueAgg.reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate), 0),
        pendingValue: pendingValueAgg.reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate), 0),
        pendingCount: (byStatusRaw.find((s) => s.status === 'PENDING')?._count.id ?? 0)
          + (byStatusRaw.find((s) => s.status === 'PENDING_ESCALATED')?._count.id ?? 0)
          + (byStatusRaw.find((s) => s.status === 'PENDING_BACKUP')?._count.id ?? 0),
        poPendingCount: byStatusRaw.find((s) => s.status === 'PO_PENDING')?._count.id ?? 0,
        approvedCount2: byStatusRaw.find((s) => s.status === 'APPROVED')?._count.id ?? 0,
      },
      byStatus: byStatusRaw.map((s) => ({ status: s.status, count: s._count.id })),
      recent: recent.map((q) => ({ id: q.id, quotationNo: q.quotationNo, status: q.status, grandTotal: Number(q.grandTotal), createdAt: q.createdAt.toISOString(), customerCompany: q.customerCompany })),
      recentSos: recentSos.map((so) => ({ id: so.id, saleOrderNo: so.saleOrderNo, status: so.status, grandTotal: Number(so.grandTotal), createdAt: so.createdAt.toISOString(), customerCompany: so.customerCompany })),
      monthlyTrend,
      expiringQuotations: expiringRaw.map((q) => ({
        id: q.id, quotationNo: q.quotationNo, customerCompany: q.customerCompany,
        grandTotal: Number(q.grandTotal), expiryDate: q.expiryDate!.toISOString(), status: q.status,
      })),
      topCustomers: topCustDetailEntries.map(([cid, stats]) => ({
        customerId: cid,
        customerCompany: cid ? (customerMap.get(cid) ?? '(ไม่ระบุ)') : '(ไม่ระบุ)',
        qtCount: stats.count,
        totalValue: stats.value,
      })),
    };
  },
};

function startOfToday(): Date { const d = new Date(); d.setHours(0,0,0,0); return d; }
function startOfMonth(): Date { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; }
function emptyDashboard() {
  return {
    filter: 'self' as DashboardFilter, filterUserId: undefined, isApproverView: false,
    totals: { quotations: 0, pending: 0, escalated: 0, approved: 0, rejected: 0, totalValue: 0, pendingValue: 0, poVerificationPending: 0, soConfirmed: 0, soPending: 0 },
    todayActivity: { approved: 0, rejected: 0 },
    monthActivity: { approved: 0, rejected: 0 },
    allTimeActivity: { approved: 0, rejected: 0 },
    avgApprovalHours: null,
    trendData: [],
    revenueTrend: [],
    rejectionReasons: [],
    expiringQuotations: [],
    topOfficers: [], topApprovers: [], recentEscalated: [], statusBreakdown: [],
    marginAnalysis: { totalDiscountGiven: 0, totalApprovedSubtotal: 0, avgDiscountRate: 0, approvedCount: 0 },
    customerInsights: [],
    agingBuckets: { lt1d: { count: 0, value: 0 }, d1to3: { count: 0, value: 0 }, d3to7: { count: 0, value: 0 }, gt7d: { count: 0, value: 0 } },
    soExecution: { statusBreakdown: [], overdueCount: 0, totalSos: 0, completedValue: 0, completedCount: 0 },
    forecast: { nextMonthForecast: 0, pipelineCoverage: 0, avgMonthlyRevenue: 0 },
    pipelineDetail: { approvedOnlyValue: 0, poPendingValue: 0, soConfirmedValue: 0, stage1AvgHours: null, stage2AvgHours: null, stage3AvgHours: null, stage1Top: [], stage2Top: [], stage3Top: [], stage4Top: [] },
  };
}
