import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, QuotationStatus, SaleOrderStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';

// ─── Probability weights by quotation status ──────────────────────────────────
export const PIPELINE_WEIGHTS: Record<string, number> = {
  PENDING:           0.25,
  PENDING_ESCALATED: 0.25,
  PENDING_BACKUP:    0.25,
  APPROVED:          0.70,
  PO_PENDING:        0.90,
  PO_APPROVED:       0.95,
};

const ACTIVE_STATUSES: QuotationStatus[] = ['APPROVED', 'PO_PENDING', 'PO_APPROVED', 'PENDING', 'PENDING_ESCALATED', 'PENDING_BACKUP'];
const AT_RISK_STATUSES: QuotationStatus[] = ['DRAFT', 'PENDING', 'PENDING_ESCALATED', 'APPROVED'];
const CONFIRMED_SO: SaleOrderStatus[] = ['CONFIRMED', 'COMPLETED'];
const WIN_LOSS: QuotationStatus[] = ['APPROVED', 'REJECTED'];

function toNum(v: Decimal | null | undefined): number {
  return v == null ? 0 : Number(v.toString());
}

function lastNMonths(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - (n - 1 - i));
    const end = new Date(d); end.setMonth(end.getMonth() + 1);
    return { label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), year: d.getFullYear(), month: d.getMonth() + 1, start: new Date(d), end };
  });
}

function nextNMonths(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() + 1 + i);
    const end = new Date(d); end.setMonth(end.getMonth() + 1);
    return { label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), year: d.getFullYear(), month: d.getMonth() + 1, start: new Date(d), end };
  });
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

async function buildBaseWhere(userId: string, roleCode: string): Promise<Prisma.QuotationWhereInput> {
  const base: Prisma.QuotationWhereInput = { deletedAt: null };
  if (roleCode === 'OFFICER') return { ...base, createdById: userId };
  if (roleCode === 'MANAGER') {
    const subIds = await getSubordinateIds(userId);
    return { ...base, createdById: { in: [userId, ...subIds] } };
  }
  return base;
}

function assessRisk(q: {
  expiryDate: Date | null; updatedAt: Date; grandTotal: Decimal | null; status: string; createdAt: Date;
}): { riskType: string; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; daysUntilExpiry: number | null; daysSinceUpdate: number } {
  const now = new Date();
  const daysSinceUpdate = Math.floor((now.getTime() - new Date(q.updatedAt).getTime()) / 86400000);
  const daysUntilExpiry = q.expiryDate ? Math.floor((new Date(q.expiryDate).getTime() - now.getTime()) / 86400000) : null;
  const value = toNum(q.grandTotal);

  if (daysUntilExpiry !== null && daysUntilExpiry <= 3) return { riskType: 'EXPIRING', riskLevel: 'HIGH', daysUntilExpiry, daysSinceUpdate };
  if (daysUntilExpiry !== null && daysUntilExpiry <= 7) return { riskType: 'EXPIRING', riskLevel: 'MEDIUM', daysUntilExpiry, daysSinceUpdate };
  if (q.status === 'PENDING' && daysSinceUpdate > 14) return { riskType: 'LONG_PENDING', riskLevel: 'HIGH', daysUntilExpiry, daysSinceUpdate };
  if (q.status === 'PENDING' && daysSinceUpdate > 7) return { riskType: 'LONG_PENDING', riskLevel: 'MEDIUM', daysUntilExpiry, daysSinceUpdate };
  if (value > 200000 && daysSinceUpdate > 14) return { riskType: 'HIGH_VALUE_STALE', riskLevel: 'HIGH', daysUntilExpiry, daysSinceUpdate };
  if (value > 100000 && daysSinceUpdate > 7) return { riskType: 'HIGH_VALUE_STALE', riskLevel: 'MEDIUM', daysUntilExpiry, daysSinceUpdate };
  return { riskType: 'LOW_ACTIVITY', riskLevel: 'LOW', daysUntilExpiry, daysSinceUpdate };
}

// ════════════════════════════════════════════════════════════════════════════
// SUMMARY (backward compat for existing /forecast/summary endpoint)
// ════════════════════════════════════════════════════════════════════════════
export const forecastService = {

  async getSummary() {
    const months = lastNMonths(12);
    const firstStart = months[0].start;

    const [confirmedOrders, targets, quotations, pipelineQuotations, customerRevenue] = await Promise.all([
      prisma.saleOrder.findMany({
        where: { status: { in: CONFIRMED_SO }, deletedAt: null, issueDate: { gte: firstStart } },
        select: { grandTotal: true, issueDate: true },
      }),
      prisma.forecastTarget.findMany({ where: { OR: months.map((m) => ({ year: m.year, month: m.month })) } }),
      prisma.quotation.findMany({
        where: { status: { in: WIN_LOSS }, deletedAt: null, createdAt: { gte: firstStart } },
        select: { status: true, createdAt: true },
      }),
      prisma.quotation.findMany({
        where: { status: { in: ACTIVE_STATUSES }, deletedAt: null },
        select: { status: true, grandTotal: true },
      }),
      prisma.saleOrder.groupBy({
        by: ['customerCompany'],
        where: { status: { in: CONFIRMED_SO }, deletedAt: null, issueDate: { gte: firstStart } },
        _sum: { grandTotal: true }, orderBy: { _sum: { grandTotal: 'desc' } }, take: 8,
      }),
    ]);

    const targetMap = new Map<string, number>();
    for (const t of targets) targetMap.set(`${t.year}-${t.month}`, toNum(t.target));

    const monthlyData = months.map((m) => {
      const actual = confirmedOrders.filter((o) => { const d = new Date(o.issueDate!); return d >= m.start && d < m.end; }).reduce((s, o) => s + toNum(o.grandTotal), 0);
      const approved = quotations.filter((q) => q.status === 'APPROVED' && new Date(q.createdAt) >= m.start && new Date(q.createdAt) < m.end).length;
      const rejected = quotations.filter((q) => q.status === 'REJECTED' && new Date(q.createdAt) >= m.start && new Date(q.createdAt) < m.end).length;
      return { label: m.label, year: m.year, month: m.month, actual, target: targetMap.get(`${m.year}-${m.month}`) ?? null, winRate: approved + rejected > 0 ? Math.round((approved / (approved + rejected)) * 100) : null, approved, rejected };
    });

    let pipelineWeighted = 0, pipelineTotal = 0;
    const pipelineByStage: Record<string, { count: number; value: number }> = {};
    for (const q of pipelineQuotations) {
      const val = toNum(q.grandTotal);
      pipelineWeighted += val * (PIPELINE_WEIGHTS[q.status] ?? 0);
      pipelineTotal += val;
      if (!pipelineByStage[q.status]) pipelineByStage[q.status] = { count: 0, value: 0 };
      pipelineByStage[q.status].count++; pipelineByStage[q.status].value += val;
    }

    const nonZero = monthlyData.slice(-6).map((m) => m.actual).filter((v) => v > 0);
    const movingAvg = nonZero.length > 0 ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;

    const nextMonths = nextNMonths(3);
    const nextTargets = await prisma.forecastTarget.findMany({ where: { OR: nextMonths.map((m) => ({ year: m.year, month: m.month })) } });
    const nextTargetMap = new Map<string, number>();
    for (const t of nextTargets) nextTargetMap.set(`${t.year}-${t.month}`, toNum(t.target));

    const last6mStart = lastNMonths(6)[0].start;
    const recentApproved = quotations.filter((q) => q.status === 'APPROVED' && new Date(q.createdAt) >= last6mStart).length;
    const recentRejected = quotations.filter((q) => q.status === 'REJECTED' && new Date(q.createdAt) >= last6mStart).length;

    return {
      monthlyData,
      forecastMonths: nextMonths.map((m) => ({ label: m.label, year: m.year, month: m.month, forecast: Math.round(movingAvg), target: nextTargetMap.get(`${m.year}-${m.month}`) ?? null })),
      pipeline: { total: pipelineTotal, weighted: Math.round(pipelineWeighted), byStage: pipelineByStage, count: pipelineQuotations.length },
      winRate6m: recentApproved + recentRejected > 0 ? Math.round((recentApproved / (recentApproved + recentRejected)) * 100) : null,
      movingAvg: Math.round(movingAvg),
      currentMonth: monthlyData[monthlyData.length - 1],
      topCustomers: customerRevenue.map((c) => ({ company: c.customerCompany, total: toNum(c._sum?.grandTotal) })),
    };
  },

  // ─── Targets ───────────────────────────────────────────────────────────────
  async getTargets() {
    return prisma.forecastTarget.findMany({ orderBy: [{ year: 'desc' }, { month: 'desc' }], include: { createdBy: { select: { name: true } } } });
  },

  async upsertTarget(userId: string, year: number, month: number, target: number, notes?: string) {
    return prisma.forecastTarget.upsert({
      where: { year_month: { year, month } },
      update: { target, notes, createdById: userId },
      create: { year, month, target, notes, createdById: userId },
    });
  },

  async deleteTarget(year: number, month: number) {
    return prisma.forecastTarget.delete({ where: { year_month: { year, month } } });
  },

  // ════════════════════════════════════════════════════════════════════════════
  // ADVANCED — role-aware, all 9 analytics sections
  // ════════════════════════════════════════════════════════════════════════════
  async getAdvancedData(userId: string, roleCode: string) {
    const baseWhere = await buildBaseWhere(userId, roleCode);
    const months12 = lastNMonths(12);
    const start12 = months12[0].start;

    // SaleOrder filter: for OFFICER/MANAGER we filter through quotationId set
    // We'll compute applicable quotationIds from quotations12m after the fact

    // ── Parallel queries ────────────────────────────────────────────────────
    const [quotations12m, activePipeline, atRiskRaw, forecastTargets] = await Promise.all([
      // All quotations last 12 months — includes createdBy
      prisma.quotation.findMany({
        where: { ...baseWhere, createdAt: { gte: start12 } },
        select: {
          id: true, quotationNo: true, customerCompany: true, grandTotal: true,
          status: true, createdAt: true, updatedAt: true, expiryDate: true,
          createdById: true,
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { grandTotal: 'desc' },
      }),
      // Active pipeline (all time)
      prisma.quotation.findMany({
        where: { ...baseWhere, status: { in: ACTIVE_STATUSES } },
        select: {
          id: true, quotationNo: true, customerCompany: true, grandTotal: true,
          status: true, createdAt: true, updatedAt: true, expiryDate: true,
          createdById: true,
          createdBy: { select: { id: true, name: true } },
        },
      }),
      // At-risk quotations
      prisma.quotation.findMany({
        where: { ...baseWhere, status: { in: AT_RISK_STATUSES } },
        select: {
          id: true, quotationNo: true, customerCompany: true, grandTotal: true,
          status: true, createdAt: true, updatedAt: true, expiryDate: true,
          createdById: true,
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { grandTotal: 'desc' }, take: 100,
      }),
      // Forecast targets for 12 months
      prisma.forecastTarget.findMany({ where: { OR: months12.map((m) => ({ year: m.year, month: m.month })) } }),
    ]);

    // SaleOrder queries filtered via quotationId IN scoped set
    const soWhere: Prisma.SaleOrderWhereInput = { deletedAt: null, status: { in: CONFIRMED_SO } };
    if (roleCode !== 'CEO' && roleCode !== 'ADMIN') {
      // Scope by quotations owned by this user/team
      const allQuotationIds = await prisma.quotation.findMany({
        where: { ...baseWhere }, select: { id: true },
      });
      const scopedIds = allQuotationIds.map((q) => q.id);
      soWhere.quotationId = { in: scopedIds };
    }

    const prevYearStart = new Date(start12);
    prevYearStart.setFullYear(prevYearStart.getFullYear() - 1);

    const [confirmedSO12m, prevYearSO, soCount12m, soValueAgg] = await Promise.all([
      prisma.saleOrder.findMany({
        where: { ...soWhere, issueDate: { gte: start12 } },
        select: { grandTotal: true, issueDate: true, quotationId: true },
      }),
      prisma.saleOrder.findMany({
        where: { ...soWhere, issueDate: { gte: prevYearStart, lt: start12 } },
        select: { grandTotal: true, issueDate: true },
      }),
      prisma.saleOrder.count({ where: { deletedAt: null, createdAt: { gte: start12 }, ...(soWhere.quotationId ? { quotationId: soWhere.quotationId } : {}) } }),
      prisma.saleOrder.aggregate({
        where: { ...soWhere, issueDate: { gte: start12 } },
        _sum: { grandTotal: true },
      }),
    ]);

    // Build quotationId → createdBy map from quotations12m
    const qtCreatedByMap = new Map<string, { id: string; name: string }>();
    for (const q of quotations12m) qtCreatedByMap.set(q.id, q.createdBy);

    const targetMap = new Map<string, number>();
    for (const t of forecastTargets) targetMap.set(`${t.year}-${t.month}`, toNum(t.target));

    // ── Monthly actual revenue ─────────────────────────────────────────────
    const movingAvgData = months12.map((m) =>
      confirmedSO12m.filter((o) => { const d = new Date(o.issueDate!); return d >= m.start && d < m.end; }).reduce((s, o) => s + toNum(o.grandTotal), 0)
    );

    // ── 1. Forecast vs Target ─────────────────────────────────────────────
    const fvtMonthly = months12.map((m, i) => {
      const actual = movingAvgData[i];
      const target = targetMap.get(`${m.year}-${m.month}`) ?? null;
      const prev3 = movingAvgData.slice(Math.max(0, i - 3), i).filter((v) => v > 0);
      const forecast = prev3.length > 0 ? Math.round(prev3.reduce((a, b) => a + b, 0) / prev3.length) : 0;
      const achievePct = target && target > 0 ? Math.round((actual / target) * 100) : null;
      return { label: m.label, year: m.year, month: m.month, actual, target, forecast, achievePct, gap: target != null ? actual - target : null };
    });

    // Quarterly
    const qMap = new Map<string, { label: string; year: number; quarter: number; actual: number; target: number; forecast: number }>();
    for (const m of fvtMonthly) {
      const q = Math.ceil(m.month / 3);
      const key = `${m.year}-Q${q}`;
      const ex = qMap.get(key) ?? { label: `Q${q}/${m.year}`, year: m.year, quarter: q, actual: 0, target: 0, forecast: 0 };
      ex.actual += m.actual; ex.target += m.target ?? 0; ex.forecast += m.forecast;
      qMap.set(key, ex);
    }
    const fvtQuarterly = Array.from(qMap.values()).map((q) => ({
      ...q, achievePct: q.target > 0 ? Math.round((q.actual / q.target) * 100) : null,
      gap: q.target > 0 ? q.actual - q.target : null,
    }));

    const yActual = movingAvgData.reduce((a, b) => a + b, 0);
    const yTarget = fvtMonthly.reduce((s, m) => s + (m.target ?? 0), 0);
    const yForecast = fvtMonthly.reduce((s, m) => s + m.forecast, 0);

    // ── 2. Conversion Funnel ──────────────────────────────────────────────
    const totalQts = quotations12m.length;
    const totalQtVal = quotations12m.reduce((s, q) => s + toNum(q.grandTotal), 0);
    const pendingQts = quotations12m.filter((q) => ['PENDING', 'PENDING_ESCALATED', 'PENDING_BACKUP'].includes(q.status));
    const approvedQts = quotations12m.filter((q) => ['APPROVED', 'PO_PENDING', 'PO_APPROVED', 'SIGNED'].includes(q.status));
    const soValue = toNum(soValueAgg._sum?.grandTotal);

    const conversionFunnel = [
      { label: 'Quotation', step: 1, count: totalQts, value: totalQtVal, conversionFromFirst: 100, conversionFromPrev: 100 },
      { label: 'รออนุมัติ', step: 2, count: pendingQts.length, value: pendingQts.reduce((s, q) => s + toNum(q.grandTotal), 0), conversionFromFirst: totalQts > 0 ? Math.round((pendingQts.length / totalQts) * 100) : 0, conversionFromPrev: totalQts > 0 ? Math.round((pendingQts.length / totalQts) * 100) : 0 },
      { label: 'อนุมัติแล้ว', step: 3, count: approvedQts.length, value: approvedQts.reduce((s, q) => s + toNum(q.grandTotal), 0), conversionFromFirst: totalQts > 0 ? Math.round((approvedQts.length / totalQts) * 100) : 0, conversionFromPrev: pendingQts.length > 0 ? Math.round((approvedQts.length / pendingQts.length) * 100) : 0 },
      { label: 'Sale Order', step: 4, count: soCount12m, value: soValue, conversionFromFirst: totalQts > 0 ? Math.round((soCount12m / totalQts) * 100) : 0, conversionFromPrev: approvedQts.length > 0 ? Math.round((soCount12m / approvedQts.length) * 100) : 0 },
    ];

    // ── 3. Deals At Risk ──────────────────────────────────────────────────
    const dealsAtRisk = atRiskRaw
      .map((q) => ({ ...assessRisk(q), id: q.id, quotationNo: q.quotationNo, customerCompany: q.customerCompany, grandTotal: toNum(q.grandTotal), status: q.status, expiryDate: q.expiryDate, updatedAt: q.updatedAt, createdAt: q.createdAt, salesName: q.createdBy.name }))
      .filter((q) => q.riskLevel !== 'LOW')
      .sort((a, b) => ({ HIGH: 0, MEDIUM: 1, LOW: 2 }[a.riskLevel] - { HIGH: 0, MEDIUM: 1, LOW: 2 }[b.riskLevel]))
      .slice(0, 20);

    // ── 4. Forecast Accuracy ──────────────────────────────────────────────
    const forecastAccuracy = fvtMonthly
      .filter((m) => m.target !== null)
      .map((m) => ({
        label: m.label, month: m.month, year: m.year, actual: m.actual, target: m.target, forecast: m.forecast,
        accuracy: m.target && m.target > 0 ? Math.round(Math.max(0, (1 - Math.abs(m.actual - m.target) / m.target)) * 100) : null,
      }));

    // ── 5. Top Sales Performance ──────────────────────────────────────────
    // Win     = Sale Order ที่ CONFIRMED/COMPLETED (ยอดขายจริง)
    // Loss    = REJECTED + CANCELLED + EXPIRED (ไม่ปิดดีล)
    // Pipeline = APPROVED, PO_PENDING, PO_APPROVED, SIGNED (ยังอยู่ในกระบวนการ ≠ Win ยัง)
    // Pending  = DRAFT, PENDING, PENDING_ESCALATED, PENDING_BACKUP (รอการพิจารณา)
    // Win Rate = saleOrderCount ÷ (saleOrderCount + lostCount)
    type PerfEntry = { userId: string; name: string; actualRevenue: number; quotationCount: number; pipelineCount: number; lostCount: number; pendingCount: number; saleOrderCount: number };
    const perfMap = new Map<string, PerfEntry>();
    for (const q of quotations12m) {
      const uid = q.createdBy.id;
      if (!perfMap.has(uid)) perfMap.set(uid, { userId: uid, name: q.createdBy.name, actualRevenue: 0, quotationCount: 0, pipelineCount: 0, lostCount: 0, pendingCount: 0, saleOrderCount: 0 });
      const e = perfMap.get(uid)!;
      e.quotationCount++;
      if (['APPROVED', 'PO_PENDING', 'PO_APPROVED', 'SIGNED'].includes(q.status)) e.pipelineCount++;
      else if (['REJECTED', 'CANCELLED', 'EXPIRED'].includes(q.status)) e.lostCount++;
      else e.pendingCount++;
    }
    for (const so of confirmedSO12m) {
      if (!so.quotationId) continue;
      const cb = qtCreatedByMap.get(so.quotationId);
      if (!cb) continue;
      if (!perfMap.has(cb.id)) perfMap.set(cb.id, { userId: cb.id, name: cb.name, actualRevenue: 0, quotationCount: 0, pipelineCount: 0, lostCount: 0, pendingCount: 0, saleOrderCount: 0 });
      const e = perfMap.get(cb.id)!;
      e.actualRevenue += toNum(so.grandTotal);
      e.saleOrderCount++;
    }
    const topSalesPerformance = Array.from(perfMap.values())
      .map((e) => {
        // Win Rate: SO ที่ปิดสำเร็จ ÷ (SO + ดีลที่ไม่ผ่าน)
        // ไม่นับ pipeline/pending เพราะยังไม่รู้ผล
        const closedDeals = e.saleOrderCount + e.lostCount;
        const winRate = closedDeals > 0 ? Math.round((e.saleOrderCount / closedDeals) * 100) : null;
        return { ...e, closedDeals, winRate, lowSample: closedDeals < 3 };
      })
      .sort((a, b) => b.actualRevenue - a.actualRevenue).slice(0, 10);

    // ── 6. Revenue Trend (MoM / YoY) ─────────────────────────────────────
    const prevYearMap = new Map<string, number>();
    for (const so of prevYearSO) {
      const d = new Date(so.issueDate!);
      const key = `${d.getFullYear() + 1}-${d.getMonth() + 1}`;
      prevYearMap.set(key, (prevYearMap.get(key) ?? 0) + toNum(so.grandTotal));
    }
    const revenueTrend = movingAvgData.map((actual, i) => {
      const m = months12[i];
      const prevM = i > 0 ? movingAvgData[i - 1] : null;
      const prevY = prevYearMap.get(`${m.year}-${m.month}`) ?? null;
      const momGrowth = prevM != null && prevM > 0 ? parseFloat(((actual - prevM) / prevM * 100).toFixed(1)) : null;
      const yoyGrowth = prevY != null && prevY > 0 ? parseFloat(((actual - prevY) / prevY * 100).toFixed(1)) : null;
      return { label: m.label, month: m.month, year: m.year, actual, prevYearActual: prevY, momGrowth, yoyGrowth, trend: momGrowth == null ? 'FLAT' : momGrowth > 2 ? 'UP' : momGrowth < -2 ? 'DOWN' : 'FLAT' };
    });

    // ── 7. Pipeline Health ────────────────────────────────────────────────
    let pipeTotal = 0, pipeWeighted = 0;
    const byStatus: Record<string, { count: number; value: number; probability: number; weightedValue: number }> = {};
    const bySalesMap = new Map<string, { userId: string; name: string; count: number; value: number; weightedValue: number }>();
    const byCustomerMap = new Map<string, { company: string; count: number; value: number }>();

    for (const q of activePipeline) {
      const val = toNum(q.grandTotal);
      const prob = PIPELINE_WEIGHTS[q.status] ?? 0;
      const wv = val * prob;
      pipeTotal += val; pipeWeighted += wv;
      if (!byStatus[q.status]) byStatus[q.status] = { count: 0, value: 0, probability: Math.round(prob * 100), weightedValue: 0 };
      byStatus[q.status].count++; byStatus[q.status].value += val; byStatus[q.status].weightedValue += wv;
      const uid = q.createdBy.id;
      if (!bySalesMap.has(uid)) bySalesMap.set(uid, { userId: uid, name: q.createdBy.name, count: 0, value: 0, weightedValue: 0 });
      const se = bySalesMap.get(uid)!; se.count++; se.value += val; se.weightedValue += wv;
      const co = q.customerCompany;
      if (!byCustomerMap.has(co)) byCustomerMap.set(co, { company: co, count: 0, value: 0 });
      const ce = byCustomerMap.get(co)!; ce.count++; ce.value += val;
    }

    const lastNonZero = movingAvgData.slice(-6).filter((v) => v > 0);
    const avgMonthly = lastNonZero.length > 0 ? lastNonZero.reduce((a, b) => a + b, 0) / lastNonZero.length : 0;

    const pipelineHealth = {
      total: pipeTotal, weighted: Math.round(pipeWeighted),
      coverageRatio: avgMonthly > 0 ? parseFloat((pipeWeighted / avgMonthly).toFixed(2)) : null,
      byStatus: Object.entries(byStatus).map(([status, v]) => ({ status, ...v })),
      bySales: Array.from(bySalesMap.values()).sort((a, b) => b.value - a.value).slice(0, 10),
      byCustomer: Array.from(byCustomerMap.values()).sort((a, b) => b.value - a.value).slice(0, 8),
    };

    // ── 8. Top Opportunities ──────────────────────────────────────────────
    const topOpportunities = activePipeline
      .map((q) => {
        const prob = PIPELINE_WEIGHTS[q.status] ?? 0;
        const val = toNum(q.grandTotal);
        return { id: q.id, quotationNo: q.quotationNo, customerCompany: q.customerCompany, grandTotal: val, status: q.status, probability: Math.round(prob * 100), forecastValue: Math.round(val * prob), expiryDate: q.expiryDate, createdAt: q.createdAt, salesName: q.createdBy.name };
      })
      .sort((a, b) => b.forecastValue - a.forecastValue).slice(0, 15);

    // ── 9. Aging Pipeline ─────────────────────────────────────────────────
    const now = new Date();
    const agingItems = activePipeline.map((q) => ({ id: q.id, quotationNo: q.quotationNo, customerCompany: q.customerCompany, grandTotal: toNum(q.grandTotal), status: q.status, ageDays: Math.floor((now.getTime() - new Date(q.createdAt).getTime()) / 86400000), salesName: q.createdBy.name }));
    const ageBuckets = [
      { label: '0–30 วัน', min: 0, max: 30 }, { label: '31–60 วัน', min: 31, max: 60 },
      { label: '61–90 วัน', min: 61, max: 90 }, { label: '> 90 วัน', min: 91, max: null },
    ];
    const agingPipeline = {
      buckets: ageBuckets.map((b) => {
        const items = agingItems.filter((i) => i.ageDays >= b.min && (b.max == null || i.ageDays <= b.max));
        return { label: b.label, minDays: b.min, maxDays: b.max, count: items.length, value: items.reduce((s, i) => s + i.grandTotal, 0) };
      }),
      items: agingItems.sort((a, b) => b.ageDays - a.ageDays).slice(0, 30),
    };

    return {
      forecastVsTarget: {
        monthly: fvtMonthly, quarterly: fvtQuarterly,
        yearly: { year: new Date().getFullYear(), actual: yActual, target: yTarget || null, forecast: yForecast, achievePct: yTarget > 0 ? Math.round((yActual / yTarget) * 100) : null, gap: yTarget > 0 ? yActual - yTarget : null },
      },
      conversionFunnel, dealsAtRisk, forecastAccuracy, topSalesPerformance,
      revenueTrend, pipelineHealth, topOpportunities, agingPipeline, roleCode,
    };
  },
};
