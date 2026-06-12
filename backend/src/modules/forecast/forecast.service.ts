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
const AT_RISK_STATUSES: QuotationStatus[] = ['PENDING', 'PENDING_ESCALATED', 'APPROVED'];
const CONFIRMED_SO: SaleOrderStatus[] = ['CONFIRMED', 'COMPLETED'];
const LOST_STATUSES: QuotationStatus[] = ['REJECTED', 'CANCELLED', 'EXPIRED'];
// Win Rate นับเฉพาะ REJECTED = ลูกค้าปฏิเสธ, ไม่นับ CANCELLED/EXPIRED (ยกเลิกหรือหมดอายุ ≠ แพ้การขาย)
const WIN_LOST_STATUSES: QuotationStatus[] = ['REJECTED'];

function toNum(v: Decimal | null | undefined): number {
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

// Risk Score 0–100: expiry(40) + staleness(30) + value(20) + status_stall(10)
function assessRisk(q: {
  expiryDate: Date | null; updatedAt: Date; grandTotal: Decimal | null; currency?: string | null; status: string; createdAt: Date;
}, usdRate: number = 35): { riskType: string; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; daysUntilExpiry: number | null; daysSinceUpdate: number; riskScore: number } {
  const now = new Date();
  const daysSinceUpdate = Math.floor((now.getTime() - new Date(q.updatedAt).getTime()) / 86400000);
  const daysUntilExpiry = q.expiryDate ? Math.floor((new Date(q.expiryDate).getTime() - now.getTime()) / 86400000) : null;
  const value = toThb(toNum(q.grandTotal), q.currency, usdRate);

  let score = 0;

  // Expiry component (0–40 pts)
  if (daysUntilExpiry !== null) {
    if (daysUntilExpiry <= 0) score += 40;
    else if (daysUntilExpiry <= 3) score += 35;
    else if (daysUntilExpiry <= 7) score += 25;
    else if (daysUntilExpiry <= 14) score += 15;
    else if (daysUntilExpiry <= 30) score += 8;
  } else {
    score += 5; // no expiry date is mildly risky
  }

  // Staleness component (0–30 pts)
  if (daysSinceUpdate >= 30) score += 30;
  else if (daysSinceUpdate >= 21) score += 22;
  else if (daysSinceUpdate >= 14) score += 16;
  else if (daysSinceUpdate >= 7) score += 8;
  else if (daysSinceUpdate >= 3) score += 3;

  // Deal value component (0–20 pts)
  if (value >= 500000) score += 20;
  else if (value >= 200000) score += 15;
  else if (value >= 100000) score += 10;
  else if (value >= 50000) score += 5;

  // Status stall component (0–10 pts)
  if (['PENDING', 'PENDING_ESCALATED', 'PENDING_BACKUP'].includes(q.status)) {
    if (daysSinceUpdate > 14) score += 10;
    else if (daysSinceUpdate > 7) score += 6;
    else if (daysSinceUpdate > 3) score += 3;
  } else if (q.status === 'APPROVED') {
    if (daysSinceUpdate > 30) score += 10;
    else if (daysSinceUpdate > 14) score += 5;
  }

  const riskScore = Math.min(100, score);

  let riskType: string;
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  if (daysUntilExpiry !== null && daysUntilExpiry <= 3) { riskType = 'EXPIRING'; riskLevel = 'HIGH'; }
  else if (daysUntilExpiry !== null && daysUntilExpiry <= 7) { riskType = 'EXPIRING'; riskLevel = 'MEDIUM'; }
  else if (q.status === 'PENDING' && daysSinceUpdate > 14) { riskType = 'LONG_PENDING'; riskLevel = 'HIGH'; }
  else if (q.status === 'PENDING' && daysSinceUpdate > 7) { riskType = 'LONG_PENDING'; riskLevel = 'MEDIUM'; }
  else if (value > 200000 && daysSinceUpdate > 14) { riskType = 'HIGH_VALUE_STALE'; riskLevel = 'HIGH'; }
  else if (value > 100000 && daysSinceUpdate > 7) { riskType = 'HIGH_VALUE_STALE'; riskLevel = 'MEDIUM'; }
  else { riskType = 'LOW_ACTIVITY'; riskLevel = 'LOW'; }

  return { riskType, riskLevel, daysUntilExpiry, daysSinceUpdate, riskScore };
}

// ════════════════════════════════════════════════════════════════════════════
// SUMMARY (backward compat for existing /forecast/summary endpoint)
// ════════════════════════════════════════════════════════════════════════════
export const forecastService = {

  async getSummary() {
    const months = lastNMonths(12);
    const firstStart = months[0].start;
    const usdRate = await getUsdRate();

    const [confirmedOrders, targets, quotations, pipelineQuotations, customerRevenueRaw] = await Promise.all([
      prisma.saleOrder.findMany({
        where: { status: { in: CONFIRMED_SO }, deletedAt: null, issueDate: { gte: firstStart } },
        select: { grandTotal: true, issueDate: true, currency: true },
      }),
      prisma.forecastTarget.findMany({ where: { OR: months.map((m) => ({ year: m.year, month: m.month })) } }),
      prisma.quotation.findMany({
        where: { status: { in: LOST_STATUSES }, deletedAt: null, createdAt: { gte: firstStart } },
        select: { status: true, createdAt: true },
      }),
      prisma.quotation.findMany({
        where: { status: { in: ACTIVE_STATUSES }, deletedAt: null },
        select: { status: true, grandTotal: true, currency: true },
      }),
      prisma.saleOrder.findMany({
        where: { status: { in: CONFIRMED_SO }, deletedAt: null, issueDate: { gte: firstStart } },
        select: { grandTotal: true, currency: true, customerCompany: true },
      }),
    ]);

    // Manual grouping for top customers with currency conversion
    const customerRevenueMap = new Map<string, number>();
    for (const so of customerRevenueRaw) {
      const co = so.customerCompany;
      customerRevenueMap.set(co, (customerRevenueMap.get(co) ?? 0) + toThb(toNum(so.grandTotal), so.currency, usdRate));
    }
    const topCustomersSorted = Array.from(customerRevenueMap.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([company, total]) => ({ company, total }));

    const targetMap = new Map<string, number>();
    for (const t of targets) targetMap.set(`${t.year}-${t.month}`, toNum(t.target));

    const monthlyData = months.map((m) => {
      const soInMonth = confirmedOrders.filter((o) => { const d = new Date(o.issueDate!); return d >= m.start && d < m.end; });
      const actual = soInMonth.reduce((s, o) => s + toThb(toNum(o.grandTotal), o.currency, usdRate), 0);
      const soCount = soInMonth.length;
      const lostCount = quotations.filter((q) => { const d = new Date(q.createdAt); return d >= m.start && d < m.end; }).length;
      return { label: m.label, year: m.year, month: m.month, actual, target: targetMap.get(`${m.year}-${m.month}`) ?? null, winRate: soCount + lostCount > 0 ? Math.round((soCount / (soCount + lostCount)) * 100) : null, soCount, lostCount };
    });

    let pipelineWeighted = 0, pipelineTotal = 0;
    const pipelineByStage: Record<string, { count: number; value: number }> = {};
    for (const q of pipelineQuotations) {
      const val = toThb(toNum(q.grandTotal), q.currency, usdRate);
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
    const recentSO = confirmedOrders.filter((o) => new Date(o.issueDate!) >= last6mStart).length;
    const recentLost = quotations.filter((q) => new Date(q.createdAt) >= last6mStart).length;

    return {
      monthlyData,
      forecastMonths: nextMonths.map((m) => ({ label: m.label, year: m.year, month: m.month, forecast: Math.round(movingAvg), target: nextTargetMap.get(`${m.year}-${m.month}`) ?? null })),
      pipeline: { total: pipelineTotal, weighted: Math.round(pipelineWeighted), byStage: pipelineByStage, count: pipelineQuotations.length },
      winRate6m: recentSO + recentLost > 0 ? Math.round((recentSO / (recentSO + recentLost)) * 100) : null,
      movingAvg: Math.round(movingAvg),
      currentMonth: monthlyData[monthlyData.length - 1],
      topCustomers: topCustomersSorted,
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
  // ADVANCED — role-aware, all analytics sections
  // ════════════════════════════════════════════════════════════════════════════
  async getAdvancedData(userId: string, roleCode: string) {
    const baseWhere = await buildBaseWhere(userId, roleCode);
    const months12 = lastNMonths(12);
    const start12 = months12[0].start;
    const usdRate = await getUsdRate();

    const [quotations12m, activePipeline, atRiskRaw, forecastTargets] = await Promise.all([
      prisma.quotation.findMany({
        where: { ...baseWhere, createdAt: { gte: start12 } },
        select: {
          id: true, quotationNo: true, customerCompany: true, grandTotal: true, currency: true,
          status: true, createdAt: true, updatedAt: true, expiryDate: true,
          createdById: true,
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { grandTotal: 'desc' },
      }),
      prisma.quotation.findMany({
        where: { ...baseWhere, status: { in: ACTIVE_STATUSES } },
        select: {
          id: true, quotationNo: true, customerCompany: true, grandTotal: true, currency: true,
          status: true, createdAt: true, updatedAt: true, expiryDate: true,
          createdById: true,
          createdBy: { select: { id: true, name: true } },
        },
      }),
      prisma.quotation.findMany({
        where: { ...baseWhere, status: { in: AT_RISK_STATUSES } },
        select: {
          id: true, quotationNo: true, customerCompany: true, grandTotal: true, currency: true,
          status: true, createdAt: true, updatedAt: true, expiryDate: true,
          createdById: true,
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { grandTotal: 'desc' }, take: 100,
      }),
      prisma.forecastTarget.findMany({ where: { OR: months12.map((m) => ({ year: m.year, month: m.month })) } }),
    ]);

    const soWhere: Prisma.SaleOrderWhereInput = { deletedAt: null, status: { in: CONFIRMED_SO } };
    if (roleCode !== 'CEO' && roleCode !== 'ADMIN') {
      const allQuotationIds = await prisma.quotation.findMany({ where: { ...baseWhere }, select: { id: true } });
      soWhere.quotationId = { in: allQuotationIds.map((q) => q.id) };
    }

    const prevYearStart = new Date(start12);
    prevYearStart.setFullYear(prevYearStart.getFullYear() - 1);

    const [confirmedSO12m, prevYearSO, customerRevenueRaw] = await Promise.all([
      prisma.saleOrder.findMany({
        where: { ...soWhere, issueDate: { gte: start12 } },
        select: { grandTotal: true, issueDate: true, quotationId: true, currency: true },
      }),
      prisma.saleOrder.findMany({
        where: { ...soWhere, issueDate: { gte: prevYearStart, lt: start12 } },
        select: { grandTotal: true, issueDate: true, currency: true },
      }),
      prisma.saleOrder.findMany({
        where: { ...soWhere, issueDate: { gte: start12 } },
        select: { grandTotal: true, currency: true, customerCompany: true },
      }),
    ]);

    // Manual totals replacing aggregate/_sum and groupBy/_sum
    const totalRev12m = confirmedSO12m.reduce((s, o) => s + toThb(toNum(o.grandTotal), o.currency, usdRate), 0);
    const custRevMap = new Map<string, number>();
    for (const so of customerRevenueRaw) {
      custRevMap.set(so.customerCompany, (custRevMap.get(so.customerCompany) ?? 0) + toThb(toNum(so.grandTotal), so.currency, usdRate));
    }
    const customerConcentration = Array.from(custRevMap.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([company, total]) => ({
        company,
        total,
        pct: totalRev12m > 0 ? Math.round((total / totalRev12m) * 100) : 0,
      }));

    // Build lookup maps from quotations12m
    const qtCreatedByMap = new Map<string, { id: string; name: string }>();
    const qtCreatedAtMap = new Map<string, Date>();
    for (const q of quotations12m) {
      qtCreatedByMap.set(q.id, q.createdBy);
      qtCreatedAtMap.set(q.id, new Date(q.createdAt));
    }

    const targetMap = new Map<string, number>();
    for (const t of forecastTargets) targetMap.set(`${t.year}-${t.month}`, toNum(t.target));

    // ── Monthly actual revenue ─────────────────────────────────────────────
    const movingAvgData = months12.map((m) =>
      confirmedSO12m.filter((o) => { const d = new Date(o.issueDate!); return d >= m.start && d < m.end; }).reduce((s, o) => s + toThb(toNum(o.grandTotal), o.currency, usdRate), 0)
    );

    // ── Future forecast (next 3 months, moving avg of last 3 non-zero) ────
    const last3NonZero = movingAvgData.slice(-3).filter((v) => v > 0);
    const forecastAvg = last3NonZero.length > 0 ? Math.round(last3NonZero.reduce((a, b) => a + b, 0) / last3NonZero.length) : 0;
    const nextMonths3 = nextNMonths(3);
    const nextTargets3 = await prisma.forecastTarget.findMany({
      where: { OR: nextMonths3.map((m) => ({ year: m.year, month: m.month })) },
    });
    const nextTargetMap3 = new Map<string, number | null>();
    for (const t of nextTargets3) nextTargetMap3.set(`${t.year}-${t.month}`, toNum(t.target));
    const forecastMonths = nextMonths3.map((m) => ({
      label: m.label, year: m.year, month: m.month,
      actual: 0, target: nextTargetMap3.get(`${m.year}-${m.month}`) ?? null,
      forecast: forecastAvg, achievePct: null, gap: null, isFuture: true,
    }));

    // ── 1. Forecast vs Target ─────────────────────────────────────────────
    const fvtMonthly = months12.map((m, i) => {
      const actual = movingAvgData[i];
      const target = targetMap.get(`${m.year}-${m.month}`) ?? null;
      const prev3 = movingAvgData.slice(Math.max(0, i - 3), i).filter((v) => v > 0);
      const forecast = prev3.length > 0 ? Math.round(prev3.reduce((a, b) => a + b, 0) / prev3.length) : 0;
      const achievePct = target && target > 0 ? Math.round((actual / target) * 100) : null;
      return { label: m.label, year: m.year, month: m.month, actual, target, forecast, achievePct, gap: target != null ? actual - target : null };
    });

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
    // DRAFT/CANCELLED/EXPIRED ตัดออกจาก base — ยังไม่เข้ากระบวนการขาย หรือไม่ใช่ loss จากการขาย
    const excludedStatuses = ['DRAFT', 'CANCELLED', 'EXPIRED'];
    const cancelledExpiredQts = quotations12m.filter((q) => excludedStatuses.includes(q.status));
    const baseQts = quotations12m.filter((q) => !excludedStatuses.includes(q.status));
    const totalQts = baseQts.length;
    const totalQtVal = baseQts.reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate), 0);

    // ป้องกัน double-count: quotation ที่มี SO แล้ว ต้องอยู่ใน step "Sale Order" เท่านั้น ไม่ใช่ "อนุมัติแล้ว"
    const soQuotationIdSet = new Set(confirmedSO12m.filter((o) => o.quotationId).map((o) => o.quotationId!));
    const pendingQts = baseQts.filter((q) => ['PENDING', 'PENDING_ESCALATED', 'PENDING_BACKUP'].includes(q.status));
    const allApprovedQts = baseQts.filter((q) => ['APPROVED', 'PO_PENDING', 'PO_APPROVED', 'SIGNED'].includes(q.status));
    // อนุมัติแล้วแต่ยังไม่มี SO — ตัด overlap ออก
    const approvedQts = allApprovedQts.filter((q) => !soQuotationIdSet.has(q.id));
    // Quotations ที่มี confirmed SO แล้ว (mutually exclusive กับ approvedQts)
    const soLinkedQts = baseQts.filter((q) => soQuotationIdSet.has(q.id));
    const rejectedQts = baseQts.filter((q) => q.status === 'REJECTED');
    const soLinkedValue = soLinkedQts.reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate), 0);

    const conversionFunnel = [
      { label: 'Quotation', step: 1, count: totalQts, value: totalQtVal, conversionFromFirst: 100, conversionFromPrev: 100, isRejected: false, excludedCount: cancelledExpiredQts.length },
      { label: 'รออนุมัติ', step: 2, count: pendingQts.length, value: pendingQts.reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate), 0), conversionFromFirst: totalQts > 0 ? Math.round((pendingQts.length / totalQts) * 100) : 0, conversionFromPrev: totalQts > 0 ? Math.round((pendingQts.length / totalQts) * 100) : 0, isRejected: false, excludedCount: 0 },
      { label: 'อนุมัติแล้ว', step: 3, count: approvedQts.length, value: approvedQts.reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate), 0), conversionFromFirst: totalQts > 0 ? Math.round((approvedQts.length / totalQts) * 100) : 0, conversionFromPrev: pendingQts.length > 0 ? Math.round((allApprovedQts.length / pendingQts.length) * 100) : 0, isRejected: false, excludedCount: 0 },
      { label: 'Sale Order', step: 4, count: soLinkedQts.length, value: soLinkedValue, conversionFromFirst: totalQts > 0 ? Math.round((soLinkedQts.length / totalQts) * 100) : 0, conversionFromPrev: allApprovedQts.length > 0 ? Math.round((soLinkedQts.length / allApprovedQts.length) * 100) : 0, isRejected: false, excludedCount: 0 },
      { label: 'ถูกปฏิเสธ', step: 5, count: rejectedQts.length, value: rejectedQts.reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate), 0), conversionFromFirst: totalQts > 0 ? Math.round((rejectedQts.length / totalQts) * 100) : 0, conversionFromPrev: totalQts > 0 ? Math.round((rejectedQts.length / totalQts) * 100) : 0, isRejected: true, excludedCount: 0 },
    ];

    // ── 3. Deals At Risk (sorted by riskScore desc) ───────────────────────
    const now = new Date();
    const dealsAtRisk = atRiskRaw
      .map((q) => ({
        ...assessRisk(q, usdRate),
        id: q.id, quotationNo: q.quotationNo, customerCompany: q.customerCompany,
        grandTotal: toThb(toNum(q.grandTotal), q.currency, usdRate), status: q.status,
        expiryDate: q.expiryDate, updatedAt: q.updatedAt, createdAt: q.createdAt,
        salesName: q.createdBy.name,
        daysOpen: Math.floor((now.getTime() - new Date(q.createdAt).getTime()) / 86400000),
      }))
      .filter((q) => q.riskLevel !== 'LOW')
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 20);

    // ── 4. Forecast Accuracy — formula: 1 - |forecast - actual| / actual ─
    // Uses forecast (moving avg) vs actual, not target vs actual.
    // Only computed for months where actual > 0.
    const forecastAccuracy = fvtMonthly
      .filter((m) => m.actual > 0)
      .map((m) => ({
        label: m.label, month: m.month, year: m.year,
        actual: m.actual, target: m.target, forecast: m.forecast,
        accuracy: m.forecast > 0
          ? Math.round(Math.max(0, (1 - Math.abs(m.forecast - m.actual) / m.actual)) * 100)
          : null,
        targetAchievement: m.target && m.target > 0 ? Math.round((m.actual / m.target) * 100) : null,
      }));

    // ── 5. Top Sales Performance ──────────────────────────────────────────
    // lostCount = REJECTED + CANCELLED + EXPIRED (แสดงใน "ไม่ผ่าน")
    // rejectedCount = REJECTED only (ใช้คำนวณ Win Rate เหมือน Win Rate Trend)
    type PerfEntry = { userId: string; name: string; actualRevenue: number; quotationCount: number; pipelineCount: number; lostCount: number; rejectedCount: number; pendingCount: number; saleOrderCount: number; soValues: number[] };
    const perfMap = new Map<string, PerfEntry>();
    for (const q of quotations12m) {
      const uid = q.createdBy.id;
      if (!perfMap.has(uid)) perfMap.set(uid, { userId: uid, name: q.createdBy.name, actualRevenue: 0, quotationCount: 0, pipelineCount: 0, lostCount: 0, rejectedCount: 0, pendingCount: 0, saleOrderCount: 0, soValues: [] });
      const e = perfMap.get(uid)!;
      e.quotationCount++;
      if (['APPROVED', 'PO_PENDING', 'PO_APPROVED', 'SIGNED'].includes(q.status)) e.pipelineCount++;
      else if (LOST_STATUSES.includes(q.status as QuotationStatus)) {
        e.lostCount++;
        if (WIN_LOST_STATUSES.includes(q.status as QuotationStatus)) e.rejectedCount++;
      }
      else e.pendingCount++;
    }
    for (const so of confirmedSO12m) {
      if (!so.quotationId) continue;
      const cb = qtCreatedByMap.get(so.quotationId);
      if (!cb) continue;
      if (!perfMap.has(cb.id)) perfMap.set(cb.id, { userId: cb.id, name: cb.name, actualRevenue: 0, quotationCount: 0, pipelineCount: 0, lostCount: 0, rejectedCount: 0, pendingCount: 0, saleOrderCount: 0, soValues: [] });
      const e = perfMap.get(cb.id)!;
      const val = toThb(toNum(so.grandTotal), so.currency, usdRate);
      e.actualRevenue += val;
      e.saleOrderCount++;
      if (val > 0) e.soValues.push(val);
    }
    const topSalesPerformance = Array.from(perfMap.values())
      .map((e) => {
        // Win Rate นับเฉพาะ REJECTED เป็น loss (เหมือน Win Rate Trend)
        const closedDeals = e.saleOrderCount + e.rejectedCount;
        const winRate = closedDeals > 0 ? Math.round((e.saleOrderCount / closedDeals) * 100) : null;
        const avgDealSize = e.soValues.length > 0 ? Math.round(e.soValues.reduce((a, b) => a + b, 0) / e.soValues.length) : 0;
        return { userId: e.userId, name: e.name, actualRevenue: e.actualRevenue, quotationCount: e.quotationCount, pipelineCount: e.pipelineCount, lostCount: e.lostCount, pendingCount: e.pendingCount, saleOrderCount: e.saleOrderCount, closedDeals, winRate, lowSample: closedDeals < 3, avgDealSize };
      })
      .sort((a, b) => b.actualRevenue - a.actualRevenue).slice(0, 10);

    // ── 6. Revenue Trend (MoM / YoY) ─────────────────────────────────────
    const prevYearMap = new Map<string, number>();
    for (const so of prevYearSO) {
      const d = new Date(so.issueDate!);
      const key = `${d.getFullYear() + 1}-${d.getMonth() + 1}`;
      prevYearMap.set(key, (prevYearMap.get(key) ?? 0) + toThb(toNum(so.grandTotal), so.currency, usdRate));
    }
    const revenueTrend = movingAvgData.map((actual, i) => {
      const m = months12[i];
      const prevM = i > 0 ? movingAvgData[i - 1] : null;
      const prevY = prevYearMap.get(`${m.year}-${m.month}`) ?? null;
      const momGrowth = prevM != null && prevM > 0 ? parseFloat(((actual - prevM) / prevM * 100).toFixed(1)) : null;
      const yoyGrowth = prevY != null && prevY > 0 ? parseFloat(((actual - prevY) / prevY * 100).toFixed(1)) : null;
      // Flag extreme MoM values (prev month near zero inflates the percentage)
      const momIsExtreme = momGrowth !== null && Math.abs(momGrowth) > 300;
      return { label: m.label, month: m.month, year: m.year, actual, prevYearActual: prevY, momGrowth, yoyGrowth, momIsExtreme, trend: momGrowth == null ? 'FLAT' : momGrowth > 2 ? 'UP' : momGrowth < -2 ? 'DOWN' : 'FLAT' };
    });

    // ── 7. Pipeline Health ────────────────────────────────────────────────
    let pipeTotal = 0, pipeWeighted = 0;
    const byStatus: Record<string, { count: number; value: number; probability: number; weightedValue: number }> = {};
    const bySalesMap = new Map<string, { userId: string; name: string; count: number; value: number; weightedValue: number }>();
    const byCustomerMap = new Map<string, { company: string; count: number; value: number }>();

    for (const q of activePipeline) {
      const val = toThb(toNum(q.grandTotal), q.currency, usdRate);
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

    // Coverage Ratio: prefer current-month target as denominator, fallback to avg monthly
    const curMonthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const currentMonthTarget = targetMap.get(curMonthKey) ?? null;
    const lastNonZero = movingAvgData.slice(-6).filter((v) => v > 0);
    const avgMonthly = lastNonZero.length > 0 ? lastNonZero.reduce((a, b) => a + b, 0) / lastNonZero.length : 0;
    const coverageDenominator = currentMonthTarget && currentMonthTarget > 0 ? currentMonthTarget : avgMonthly;

    const pipelineHealth = {
      total: pipeTotal, weighted: Math.round(pipeWeighted),
      coverageRatio: coverageDenominator > 0 ? parseFloat((pipeWeighted / coverageDenominator).toFixed(2)) : null,
      coverageBase: currentMonthTarget && currentMonthTarget > 0 ? 'target' as const : 'avg_monthly' as const,
      byStatus: Object.entries(byStatus).map(([status, v]) => ({ status, ...v })),
      bySales: Array.from(bySalesMap.values()).sort((a, b) => b.value - a.value).slice(0, 10),
      byCustomer: Array.from(byCustomerMap.values()).sort((a, b) => b.value - a.value).slice(0, 8),
    };

    // ── 8. Top Opportunities ──────────────────────────────────────────────
    const topOpportunities = activePipeline
      .map((q) => {
        const prob = PIPELINE_WEIGHTS[q.status] ?? 0;
        const val = toThb(toNum(q.grandTotal), q.currency, usdRate);
        const daysOpen = Math.floor((now.getTime() - new Date(q.createdAt).getTime()) / 86400000);
        const risk = assessRisk(q, usdRate);
        return {
          id: q.id, quotationNo: q.quotationNo, customerCompany: q.customerCompany,
          grandTotal: val, status: q.status, probability: Math.round(prob * 100),
          forecastValue: Math.round(val * prob), expiryDate: q.expiryDate, createdAt: q.createdAt,
          salesName: q.createdBy.name, daysOpen, riskScore: risk.riskScore, riskLevel: risk.riskLevel,
        };
      })
      .sort((a, b) => b.forecastValue - a.forecastValue).slice(0, 15);

    // ── 9. Aging Pipeline ─────────────────────────────────────────────────
    const agingItems = activePipeline.map((q) => ({
      id: q.id, quotationNo: q.quotationNo, customerCompany: q.customerCompany,
      grandTotal: toThb(toNum(q.grandTotal), q.currency, usdRate), status: q.status,
      ageDays: Math.floor((now.getTime() - new Date(q.createdAt).getTime()) / 86400000),
      salesName: q.createdBy.name,
    }));
    const totalAgingVal = agingItems.reduce((s, i) => s + i.grandTotal, 0);
    const ageBuckets = [
      { label: '0–30 วัน', min: 0, max: 30 }, { label: '31–60 วัน', min: 31, max: 60 },
      { label: '61–90 วัน', min: 61, max: 90 }, { label: '> 90 วัน', min: 91, max: null },
    ];
    const agingPipeline = {
      buckets: ageBuckets.map((b) => {
        const items = agingItems.filter((i) => i.ageDays >= b.min && (b.max == null || i.ageDays <= b.max));
        const value = items.reduce((s, i) => s + i.grandTotal, 0);
        return { label: b.label, minDays: b.min, maxDays: b.max, count: items.length, value, pct: totalAgingVal > 0 ? Math.round((value / totalAgingVal) * 100) : 0 };
      }),
      items: agingItems.sort((a, b) => b.ageDays - a.ageDays).slice(0, 30),
    };

    // ── 10. Win Rate Trend (per month, 12 months) ─────────────────────────
    const winRateTrend = months12.map((m) => {
      const won = confirmedSO12m.filter((o) => { const d = new Date(o.issueDate!); return d >= m.start && d < m.end; }).length;
      // ใช้ updatedAt เป็น proxy ของวันที่ status เปลี่ยน, นับเฉพาะ REJECTED (ไม่นับ CANCELLED/EXPIRED)
      const lost = quotations12m.filter((q) => WIN_LOST_STATUSES.includes(q.status as QuotationStatus) && new Date(q.updatedAt) >= m.start && new Date(q.updatedAt) < m.end).length;
      return { label: m.label, month: m.month, year: m.year, won, lost, winRate: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null };
    });

    // ── 11. KPI Summary ───────────────────────────────────────────────────
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Expected closing this month = active deals with expiryDate in current month
    const expectedClosingDeals = activePipeline.filter((q) =>
      q.expiryDate && new Date(q.expiryDate) >= currentMonthStart && new Date(q.expiryDate) < currentMonthEnd
    );

    // Forecast Gap: forecastAvg vs next month's target (negative = below target)
    const nextMonthKey = `${nextMonths3[0].year}-${nextMonths3[0].month}`;
    const nextMonthTarget = nextTargetMap3.get(nextMonthKey) ?? null;
    const forecastGap = nextMonthTarget != null ? forecastAvg - nextMonthTarget : null;
    const forecastGapPct = nextMonthTarget && nextMonthTarget > 0 && forecastGap != null
      ? Math.round((forecastGap / nextMonthTarget) * 100)
      : null;

    // Avg Deal Size
    const allSoVals = confirmedSO12m.map((o) => toThb(toNum(o.grandTotal), o.currency, usdRate)).filter((v) => v > 0);
    const avgDealSizeSO = allSoVals.length > 0 ? Math.round(allSoVals.reduce((a, b) => a + b, 0) / allSoVals.length) : 0;
    const activePipelineVals = activePipeline.map((q) => toThb(toNum(q.grandTotal), q.currency, usdRate)).filter((v) => v > 0);
    const avgDealSizePipeline = activePipelineVals.length > 0 ? Math.round(activePipelineVals.reduce((a, b) => a + b, 0) / activePipelineVals.length) : 0;

    // Sales Cycle: avg days from quotation createdAt → SO issueDate
    const salesCycleDays: number[] = [];
    for (const so of confirmedSO12m) {
      if (!so.quotationId || !so.issueDate) continue;
      const qtDate = qtCreatedAtMap.get(so.quotationId);
      if (!qtDate) continue;
      const days = Math.floor((new Date(so.issueDate).getTime() - qtDate.getTime()) / 86400000);
      if (days >= 0 && days < 365) salesCycleDays.push(days);
    }
    const avgSalesCycle = salesCycleDays.length > 0
      ? Math.round(salesCycleDays.reduce((a, b) => a + b, 0) / salesCycleDays.length)
      : null;

    // Win Rate 6m
    const last6mStart2 = lastNMonths(6)[0].start;
    const won6m = confirmedSO12m.filter((o) => new Date(o.issueDate!) >= last6mStart2).length;
    const lost6m = quotations12m.filter((q) => WIN_LOST_STATUSES.includes(q.status as QuotationStatus) && new Date(q.updatedAt) >= last6mStart2).length;
    const winRate6m = won6m + lost6m > 0 ? Math.round((won6m / (won6m + lost6m)) * 100) : null;

    // Customer concentration — already computed above from customerRevenueRaw with currency conversion
    const top5Pct = customerConcentration.slice(0, 5).reduce((s, c) => s + c.pct, 0);

    const kpiSummary = {
      forecastGap, forecastGapPct,
      expectedClosingThisMonth: expectedClosingDeals.reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate), 0),
      expectedClosingCount: expectedClosingDeals.length,
      avgDealSizeSO, avgDealSizePipeline,
      avgSalesCycle, winRate6m,
      top5CustomerPct: customerConcentration.length > 0 ? top5Pct : null,
      totalRevenue12m: Math.round(totalRev12m),
    };

    // ── 12. Revenue At Risk (aggregate from full atRiskRaw, not capped list) ─
    const allAtRiskFull = atRiskRaw
      .map((q) => ({ ...assessRisk(q, usdRate), grandTotal: toThb(toNum(q.grandTotal), q.currency, usdRate), status: q.status }))
      .filter((r) => r.riskLevel !== 'LOW');
    const rarByLevel: Record<string, { count: number; value: number; weighted: number }> = {};
    for (const r of allAtRiskFull) {
      if (!rarByLevel[r.riskLevel]) rarByLevel[r.riskLevel] = { count: 0, value: 0, weighted: 0 };
      rarByLevel[r.riskLevel].count++;
      rarByLevel[r.riskLevel].value += r.grandTotal;
      rarByLevel[r.riskLevel].weighted += r.grandTotal * (PIPELINE_WEIGHTS[r.status] ?? 0);
    }
    const rarH = rarByLevel['HIGH'] ?? { count: 0, value: 0, weighted: 0 };
    const rarM = rarByLevel['MEDIUM'] ?? { count: 0, value: 0, weighted: 0 };
    const totalRarVal = rarH.value + rarM.value;
    const revenueAtRisk = {
      highCount: rarH.count, highValue: Math.round(rarH.value), highWeighted: Math.round(rarH.weighted),
      mediumCount: rarM.count, mediumValue: Math.round(rarM.value), mediumWeighted: Math.round(rarM.weighted),
      totalRiskValue: Math.round(totalRarVal),
      totalRiskWeighted: Math.round(rarH.weighted + rarM.weighted),
      riskPct: pipeTotal > 0 ? Math.round((totalRarVal / pipeTotal) * 100) : 0,
      safeValue: Math.round(Math.max(0, pipeTotal - totalRarVal)),
    };

    // ── 13. Pipeline Intake Trend + Deal Size Distribution ────────────────
    const intakeTrend = months12.map((m) => {
      const newQts = quotations12m.filter((q) => { const d = new Date(q.createdAt); return d >= m.start && d < m.end; });
      return {
        label: m.label, month: m.month, year: m.year,
        count: newQts.length,
        value: Math.round(newQts.reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate), 0)),
        activeCount: newQts.filter((q) => ACTIVE_STATUSES.includes(q.status as QuotationStatus)).length,
      };
    });
    const li = intakeTrend[intakeTrend.length - 1];
    const pi = intakeTrend[intakeTrend.length - 2];
    const intakeMoM = li && pi && pi.count > 0 ? Math.round(((li.count - pi.count) / pi.count) * 100) : null;

    const SIZE_BRACKETS = [
      { label: '< 500K', min: 0, max: 500_000 },
      { label: '500K–2M', min: 500_000, max: 2_000_000 },
      { label: '2M–10M', min: 2_000_000, max: 10_000_000 },
      { label: '> 10M', min: 10_000_000, max: Infinity },
    ] as const;
    const totalPipeCount = activePipeline.length;
    const dealSizeBuckets = SIZE_BRACKETS.map((b) => {
      const items = activePipeline.filter((q) => { const v = toThb(toNum(q.grandTotal), q.currency, usdRate); return v >= b.min && v < b.max; });
      return {
        label: b.label, count: items.length,
        value: Math.round(items.reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate), 0)),
        pct: totalPipeCount > 0 ? Math.round((items.length / totalPipeCount) * 100) : 0,
      };
    });
    const pipelineIntake = { trend: intakeTrend, intakeMoM, dealSizeBuckets };

    // ── 14. Forecast Insights (Target Hit Rate + Bias + Customer Retention) ─
    const fvtPast = fvtMonthly.filter((m) => m.actual > 0);
    const mWithTarget = fvtPast.filter((m) => m.target != null && m.target > 0);
    const mHit = mWithTarget.filter((m) => m.actual >= (m.target ?? 0));
    const targetHitRate = mWithTarget.length > 0 ? Math.round((mHit.length / mWithTarget.length) * 100) : null;
    // exclude เดือนที่ forecast=0 (ไม่มีประวัติ) เพื่อไม่ให้ bias เบี้ยว
    const accM2 = forecastAccuracy.filter((m) => m.actual > 0 && m.forecast > 0);
    const forecastBias = accM2.length > 0
      ? Math.round(accM2.reduce((s, m) => s + (m.forecast - m.actual), 0) / accM2.length)
      : null;
    const forecastBiasDir: 'OVER' | 'UNDER' | 'BALANCED' | null =
      forecastBias == null ? null : Math.abs(forecastBias) < 200_000 ? 'BALANCED' : forecastBias > 0 ? 'OVER' : 'UNDER';

    // Customer retention via quotationId → company lookup
    const qtCompanyMap2 = new Map(quotations12m.map((q) => [q.id, q.customerCompany]));
    const soCompanyList = confirmedSO12m
      .filter((o) => o.quotationId)
      .map((o) => qtCompanyMap2.get(o.quotationId!))
      .filter((c): c is string => c !== undefined);
    const custOrderCounts = soCompanyList.reduce(
      (acc, c) => { acc[c] = (acc[c] ?? 0) + 1; return acc; },
      {} as Record<string, number>
    );
    const uniqueCust12m = Object.keys(custOrderCounts).length;
    const repeatCust = Object.values(custOrderCounts).filter((n) => n > 1).length;

    const forecastInsights = {
      targetHitRate, monthsHit: mHit.length, monthsTotal: mWithTarget.length,
      forecastBias, forecastBiasDir,
      customerRetention: {
        uniqueCustomers: uniqueCust12m,
        repeatCustomers: repeatCust,
        newCustomers: uniqueCust12m - repeatCust,
        repeatRate: uniqueCust12m > 0 ? Math.round((repeatCust / uniqueCust12m) * 100) : 0,
      },
    };

    // ── 15. Month Progress ────────────────────────────────────────────────
    const daysTotal = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = now.getDate();
    const daysRemaining = daysTotal - daysElapsed;
    const currentActual = movingAvgData[movingAvgData.length - 1] ?? 0;
    const dailyRunRate = daysElapsed > 0 ? currentActual / daysElapsed : 0;
    const projectedEOM = Math.round(dailyRunRate * daysTotal);
    const requiredDailyRate =
      daysRemaining > 0 && currentMonthTarget != null && currentMonthTarget > currentActual
        ? Math.round((currentMonthTarget - currentActual) / daysRemaining)
        : null;
    const monthProgress = {
      daysElapsed, daysTotal, daysRemaining,
      actual: currentActual,
      target: currentMonthTarget ?? null,
      projectedEOM,
      dailyRunRate: Math.round(dailyRunRate),
      requiredDailyRate,
      onTrack: currentMonthTarget != null ? projectedEOM >= currentMonthTarget : null,
      pctElapsed: Math.round((daysElapsed / daysTotal) * 100),
      pctAchieved: currentMonthTarget && currentMonthTarget > 0
        ? Math.round((currentActual / currentMonthTarget) * 100)
        : null,
    };

    // ── 13. Scenario Forecast (next month) ────────────────────────────────
    const nextScenM = nextMonths3[0];
    const nextMonthPipeDeals = activePipeline.filter(
      (q) => q.expiryDate && new Date(q.expiryDate) >= nextScenM.start && new Date(q.expiryDate) < nextScenM.end
    );
    const nextMonthPipeWeighted = Math.round(
      nextMonthPipeDeals.reduce((s, q) => s + toThb(toNum(q.grandTotal), q.currency, usdRate) * (PIPELINE_WEIGHTS[q.status] ?? 0), 0)
    );
    const scenNmt = nextMonthTarget ?? null;
    const conservativeS = forecastAvg;
    const pipelineS = nextMonthPipeWeighted;
    const expectedS = pipelineS > 0 ? Math.round((conservativeS + pipelineS) / 2) : conservativeS;
    const optimisticS = pipelineS > 0
      ? Math.round(Math.max(conservativeS, pipelineS) * 1.1)
      : Math.round(conservativeS * 1.3);
    const pctVsTarget = (v: number) => scenNmt && scenNmt > 0 ? Math.round((v / scenNmt) * 100) : null;
    const scenarioForecast = {
      label: nextScenM.label,
      target: scenNmt,
      conservative: conservativeS,
      expected: expectedS,
      optimistic: optimisticS,
      pipelineDealsCount: nextMonthPipeDeals.length,
      pipelineWeighted: pipelineS,
      conservativeVsTarget: pctVsTarget(conservativeS),
      expectedVsTarget: pctVsTarget(expectedS),
      optimisticVsTarget: pctVsTarget(optimisticS),
      dataMonths: last3NonZero.length,
    };

    return {
      forecastVsTarget: {
        monthly: fvtMonthly, quarterly: fvtQuarterly, forecastMonths,
        yearly: { year: now.getFullYear(), actual: yActual, target: yTarget || null, forecast: yForecast, achievePct: yTarget > 0 ? Math.round((yActual / yTarget) * 100) : null, gap: yTarget > 0 ? yActual - yTarget : null },
      },
      conversionFunnel, dealsAtRisk, forecastAccuracy, topSalesPerformance,
      revenueTrend, pipelineHealth, topOpportunities, agingPipeline,
      winRateTrend, kpiSummary, customerConcentration, roleCode,
      monthProgress, scenarioForecast,
      revenueAtRisk, pipelineIntake, forecastInsights,
    };
  },
};
