import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

function toThb(value: number, currency?: string | null, rate: number = 35): number {
  return currency === 'USD' ? value * rate : value;
}
async function getUsdRate(): Promise<number> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: 'currency.usdExchangeRate' } });
    return row ? (parseFloat(row.value) || 35) : 35;
  } catch { return 35; }
}

const HIGH_VALUE_THRESHOLD = 100000;
const EXPIRING_SOON_DAYS = 7;
const RECENT_ACTIVITY_LIMIT = 10;

export const dashboardService = {
  // ============================================================
  // SALES DASHBOARD
  // ============================================================
  async getSalesStats(salesUserId: string) {
    const usdRate = await getUsdRate();
    const baseWhere: Prisma.QuotationWhereInput = {
      createdById: salesUserId,
      deletedAt: null,
    };

    const taskSelect = {
      id: true, quotationNo: true, customerCompany: true,
      status: true, expiryDate: true, updatedAt: true,
      rejectionReason: true, grandTotal: true,
    };

    const [
      totalQuotations,
      draftCount,
      pendingCount,
      approvedCount,
      rejectedCount,
      totalValueAggregate,
      myExpiringSoon,
      recentQuotations,
      mySaleOrders,
      taskItems,
      waitingItems,
      overdueItems,
      notifications,
    ] = await Promise.all([
      prisma.quotation.count({ where: baseWhere }),
      prisma.quotation.count({ where: { ...baseWhere, status: 'DRAFT' } }),
      prisma.quotation.count({ where: { ...baseWhere, status: 'PENDING' } }),
      prisma.quotation.count({ where: { ...baseWhere, status: 'APPROVED' } }),
      prisma.quotation.count({ where: { ...baseWhere, status: 'REJECTED' } }),
      prisma.quotation.findMany({
        where: { ...baseWhere, status: 'APPROVED' },
        select: { grandTotal: true, currency: true },
      }),
      prisma.quotation.findMany({
        where: {
          ...baseWhere,
          status: { in: ['DRAFT', 'PENDING'] },
          expiryDate: { gte: new Date(), lte: addDays(new Date(), EXPIRING_SOON_DAYS) },
        },
        orderBy: { expiryDate: 'asc' },
        take: 5,
        select: { id: true, quotationNo: true, customerCompany: true, grandTotal: true, expiryDate: true, status: true },
      }),
      prisma.quotation.findMany({
        where: baseWhere,
        orderBy: { updatedAt: 'desc' },
        take: RECENT_ACTIVITY_LIMIT,
        select: { id: true, quotationNo: true, customerCompany: true, grandTotal: true, status: true, updatedAt: true, expiryDate: true },
      }),
      prisma.saleOrder.count({ where: { deletedAt: null, quotation: { createdById: salesUserId } } }),
      // DRAFT + REJECTED → ต้องดำเนินการ
      prisma.quotation.findMany({
        where: { ...baseWhere, status: { in: ['DRAFT', 'REJECTED'] } },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        take: 20,
        select: taskSelect,
      }),
      // PENDING → รออยู่ที่คนอื่น
      prisma.quotation.findMany({
        where: { ...baseWhere, status: 'PENDING' },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: taskSelect,
      }),
      // EXPIRED → เกินกำหนด
      prisma.quotation.findMany({
        where: { ...baseWhere, status: 'EXPIRED' },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: taskSelect,
      }),
      // Notifications ของ user นี้
      prisma.notification.findMany({
        where: { userId: salesUserId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const toTask = (q: typeof taskItems[number], actionLabel: string, priority: 'high' | 'medium' | 'low') => ({
      id: q.id,
      quotationNo: q.quotationNo,
      customerCompany: q.customerCompany,
      status: q.status,
      dueDate: q.expiryDate,
      updatedAt: q.updatedAt,
      priority,
      actionLabel,
      rejectionReason: (q as any).rejectionReason ?? null,
    });

    return {
      totals: {
        quotations: totalQuotations,
        saleOrders: mySaleOrders,
        approvedValue: totalValueAggregate.reduce((s, q) => s + toThb(Number(q.grandTotal ?? 0), q.currency, usdRate), 0),
      },
      byStatus: {
        draft: draftCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
      expiringSoon: myExpiringSoon,
      recent: recentQuotations,
      tasks: [
        ...taskItems.filter((q) => q.status === 'REJECTED').map((q) => toTask(q, 'แก้ไข', 'high')),
        ...taskItems.filter((q) => q.status === 'DRAFT').map((q) => toTask(q, 'ดำเนินการ', 'medium')),
      ],
      waitingItems: waitingItems.map((q) => toTask(q, 'ติดตาม', 'low')),
      overdueItems: overdueItems.map((q) => toTask(q, 'ต่ออายุ', 'high')),
      notifications,
    };
  },

  // ============================================================
  // APPROVER DASHBOARD
  // ============================================================
  async getApproverStats() {
    const usdRate = await getUsdRate();
    const now = new Date();
    const expiringDate = addDays(now, EXPIRING_SOON_DAYS);

    const [
      pendingCount,
      pendingValueAgg,
      highValuePending,
      expiringSoon,
      recentRequests,
      approvedTodayCount,
      rejectedTodayCount,
    ] = await Promise.all([
      // Pending count
      prisma.quotation.count({
        where: { status: 'PENDING', deletedAt: null },
      }),

      // Total pending value
      prisma.quotation.findMany({
        where: { status: 'PENDING', deletedAt: null },
        select: { grandTotal: true, currency: true },
      }),

      // High-value pending
      prisma.quotation.findMany({
        where: {
          status: 'PENDING',
          deletedAt: null,
          grandTotal: { gte: HIGH_VALUE_THRESHOLD },
        },
        orderBy: { grandTotal: 'desc' },
        take: 5,
        select: {
          id: true,
          quotationNo: true,
          customerCompany: true,
          grandTotal: true,
          submittedAt: true,
          createdBy: { select: { id: true, name: true } },
        },
      }),

      // Expiring soon (still pending, expires within 7 days)
      prisma.quotation.findMany({
        where: {
          status: 'PENDING',
          deletedAt: null,
          expiryDate: { gte: now, lte: expiringDate },
        },
        orderBy: { expiryDate: 'asc' },
        take: 5,
        select: {
          id: true,
          quotationNo: true,
          customerCompany: true,
          grandTotal: true,
          expiryDate: true,
          createdBy: { select: { id: true, name: true } },
        },
      }),

      // Recent requests (latest submitted)
      prisma.quotation.findMany({
        where: { status: 'PENDING', deletedAt: null },
        orderBy: { submittedAt: 'desc' },
        take: RECENT_ACTIVITY_LIMIT,
        select: {
          id: true,
          quotationNo: true,
          customerCompany: true,
          grandTotal: true,
          submittedAt: true,
          expiryDate: true,
          createdBy: { select: { id: true, name: true } },
        },
      }),

      // Approved today (by anyone)
      prisma.quotation.count({
        where: {
          status: 'APPROVED',
          approvedAt: { gte: startOfDay(now) },
        },
      }),

      // Rejected today
      prisma.quotation.count({
        where: {
          status: 'REJECTED',
          rejectedAt: { gte: startOfDay(now) },
        },
      }),
    ]);

    return {
      pending: {
        count: pendingCount,
        totalValue: pendingValueAgg.reduce((s, q) => s + toThb(Number(q.grandTotal ?? 0), q.currency, usdRate), 0),
        highValueCount: highValuePending.length,
        expiringSoonCount: expiringSoon.length,
      },
      todayActivity: {
        approved: approvedTodayCount,
        rejected: rejectedTodayCount,
      },
      highValuePending,
      expiringSoon,
      recentRequests,
    };
  },
};

function addDays(date: Date, days: number): Date {
  const r = new Date(date);
  r.setDate(r.getDate() + days);
  return r;
}

function startOfDay(date: Date): Date {
  const r = new Date(date);
  r.setHours(0, 0, 0, 0);
  return r;
}
