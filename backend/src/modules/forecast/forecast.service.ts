import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../config/prisma';

// Conversion probability weights
const PIPELINE_WEIGHTS: Record<string, number> = {
  APPROVED: 0.70,
  PO_PENDING: 0.90,
  PO_APPROVED: 0.95,
  PENDING: 0.25,
  PENDING_ESCALATED: 0.25,
  PENDING_BACKUP: 0.25,
};

function toNum(v: Decimal | null | undefined): number {
  if (v == null) return 0;
  return Number(v.toString());
}

// Generate last N months as { label, year, month, start, end }
function lastNMonths(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - (n - 1 - i));
    const end = new Date(d);
    end.setMonth(end.getMonth() + 1);
    return {
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      start: new Date(d),
      end,
    };
  });
}

// Generate next N months
function nextNMonths(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() + 1 + i);
    const end = new Date(d);
    end.setMonth(end.getMonth() + 1);
    return {
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      start: new Date(d),
      end,
    };
  });
}

export const forecastService = {

  // ─── Summary: monthly actual + targets + pipeline + win rate ──────────────
  async getSummary() {
    const months = lastNMonths(12);
    const firstStart = months[0].start;

    // 1. SaleOrders confirmed/completed in last 12 months
    const confirmedOrders = await prisma.saleOrder.findMany({
      where: {
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        deletedAt: null,
        issueDate: { gte: firstStart },
      },
      select: { grandTotal: true, issueDate: true },
    });

    // 2. ForecastTargets for the same months
    const targets = await prisma.forecastTarget.findMany({
      where: {
        OR: months.map((m) => ({ year: m.year, month: m.month })),
      },
    });
    const targetMapFixed = new Map<string, number>();
    for (const t of targets) {
      targetMapFixed.set(`${t.year}-${t.month}`, toNum(t.target));
    }

    // 3. Quotations for win-rate (last 12 months)
    const quotations = await prisma.quotation.findMany({
      where: {
        status: { in: ['APPROVED', 'REJECTED'] },
        deletedAt: null,
        createdAt: { gte: firstStart },
      },
      select: { status: true, createdAt: true },
    });

    // 4. Pipeline: active quotations (not yet SO)
    const pipelineQuotations = await prisma.quotation.findMany({
      where: {
        status: { in: ['APPROVED', 'PO_PENDING', 'PO_APPROVED', 'PENDING', 'PENDING_ESCALATED', 'PENDING_BACKUP'] },
        deletedAt: null,
      },
      select: { status: true, grandTotal: true },
    });

    // 5. Top customers (last 12 months confirmed SO)
    const customerRevenue = await prisma.saleOrder.groupBy({
      by: ['customerCompany'],
      where: {
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        deletedAt: null,
        issueDate: { gte: firstStart },
      },
      _sum: { grandTotal: true },
      orderBy: { _sum: { grandTotal: 'desc' } },
      take: 8,
    });

    // ─── Compute monthly actual ───────────────────────────────────────────────
    const monthlyData = months.map((m) => {
      const actual = confirmedOrders
        .filter((o) => {
          const d = new Date(o.issueDate!);
          return d >= m.start && d < m.end;
        })
        .reduce((sum, o) => sum + toNum(o.grandTotal), 0);

      const approved = quotations.filter((q) => {
        const d = new Date(q.createdAt);
        return q.status === 'APPROVED' && d >= m.start && d < m.end;
      }).length;

      const rejected = quotations.filter((q) => {
        const d = new Date(q.createdAt);
        return q.status === 'REJECTED' && d >= m.start && d < m.end;
      }).length;

      const winRate = approved + rejected > 0
        ? Math.round((approved / (approved + rejected)) * 100)
        : null;

      return {
        label: m.label,
        year: m.year,
        month: m.month,
        actual,
        target: targetMapFixed.get(`${m.year}-${m.month}`) ?? null,
        winRate,
        approved,
        rejected,
      };
    });

    // ─── Pipeline weighted value ──────────────────────────────────────────────
    let pipelineWeighted = 0;
    let pipelineTotal = 0;
    const pipelineByStage: Record<string, { count: number; value: number }> = {};
    for (const q of pipelineQuotations) {
      const val = toNum(q.grandTotal);
      const weight = PIPELINE_WEIGHTS[q.status] ?? 0;
      pipelineWeighted += val * weight;
      pipelineTotal += val;
      if (!pipelineByStage[q.status]) pipelineByStage[q.status] = { count: 0, value: 0 };
      pipelineByStage[q.status].count++;
      pipelineByStage[q.status].value += val;
    }

    // ─── Next 3 months forecast (3-month moving average of last 6 actuals) ───
    const last6 = monthlyData.slice(-6).map((m) => m.actual);
    const nonZero = last6.filter((v) => v > 0);
    const movingAvg = nonZero.length > 0
      ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length
      : 0;

    const nextMonths = nextNMonths(3);
    const nextTargets = await prisma.forecastTarget.findMany({
      where: { OR: nextMonths.map((m) => ({ year: m.year, month: m.month })) },
    });
    const nextTargetMap = new Map<string, number>();
    for (const t of nextTargets) nextTargetMap.set(`${t.year}-${t.month}`, toNum(t.target));

    const forecastMonths = nextMonths.map((m) => ({
      label: m.label,
      year: m.year,
      month: m.month,
      forecast: Math.round(movingAvg),
      target: nextTargetMap.get(`${m.year}-${m.month}`) ?? null,
    }));

    // ─── Overall win rate (last 6 months) ────────────────────────────────────
    const last6m = lastNMonths(6);
    const last6Start = last6m[0].start;
    const recentApproved = quotations.filter((q) => q.status === 'APPROVED' && new Date(q.createdAt) >= last6Start).length;
    const recentRejected = quotations.filter((q) => q.status === 'REJECTED' && new Date(q.createdAt) >= last6Start).length;
    const winRate6m = recentApproved + recentRejected > 0
      ? Math.round((recentApproved / (recentApproved + recentRejected)) * 100)
      : null;

    // ─── This month actual ────────────────────────────────────────────────────
    const currentMonthData = monthlyData[monthlyData.length - 1];

    return {
      monthlyData,
      forecastMonths,
      pipeline: {
        total: pipelineTotal,
        weighted: Math.round(pipelineWeighted),
        byStage: pipelineByStage,
        count: pipelineQuotations.length,
      },
      winRate6m,
      movingAvg: Math.round(movingAvg),
      currentMonth: currentMonthData,
      topCustomers: customerRevenue.map((c) => ({
        company: c.customerCompany,
        total: toNum(c._sum.grandTotal),
      })),
    };
  },

  // ─── Get all targets ──────────────────────────────────────────────────────
  async getTargets() {
    return prisma.forecastTarget.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: { createdBy: { select: { name: true } } },
    });
  },

  // ─── Upsert a monthly target ──────────────────────────────────────────────
  async upsertTarget(userId: string, year: number, month: number, target: number, notes?: string) {
    return prisma.forecastTarget.upsert({
      where: { year_month: { year, month } },
      update: { target, notes, createdById: userId },
      create: { year, month, target, notes, createdById: userId },
    });
  },

  // ─── Delete a target ──────────────────────────────────────────────────────
  async deleteTarget(year: number, month: number) {
    return prisma.forecastTarget.delete({
      where: { year_month: { year, month } },
    });
  },
};
