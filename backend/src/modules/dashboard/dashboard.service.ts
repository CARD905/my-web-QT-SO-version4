import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

const HIGH_VALUE_THRESHOLD = 100000;
const EXPIRING_SOON_DAYS = 7;
const RECENT_ACTIVITY_LIMIT = 10;

export const dashboardService = {
  // ============================================================
  // SALES DASHBOARD
  // ============================================================
  async getSalesStats(salesUserId: string) {
    const baseWhere: Prisma.QuotationWhereInput = {
      createdById: salesUserId,
      deletedAt: null,
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
    ] = await Promise.all([
      prisma.quotation.count({ where: baseWhere }),
      prisma.quotation.count({ where: { ...baseWhere, status: 'DRAFT' } }),
      prisma.quotation.count({ where: { ...baseWhere, status: 'PENDING' } }),
      prisma.quotation.count({ where: { ...baseWhere, status: 'APPROVED' } }),
      prisma.quotation.count({ where: { ...baseWhere, status: 'REJECTED' } }),
      prisma.quotation.aggregate({
        where: { ...baseWhere, status: 'APPROVED' },
        _sum: { grandTotal: true },
      }),
      prisma.quotation.findMany({
        where: {
          ...baseWhere,
          status: { in: ['DRAFT', 'PENDING'] },
          expiryDate: {
            gte: new Date(),
            lte: addDays(new Date(), EXPIRING_SOON_DAYS),
          },
        },
        orderBy: { expiryDate: 'asc' },
        take: 5,
        select: {
          id: true,
          quotationNo: true,
          customerCompany: true,
          grandTotal: true,
          expiryDate: true,
          status: true,
        },
      }),
      prisma.quotation.findMany({
        where: baseWhere,
        orderBy: { updatedAt: 'desc' },
        take: RECENT_ACTIVITY_LIMIT,
        select: {
          id: true,
          quotationNo: true,
          customerCompany: true,
          grandTotal: true,
          status: true,
          updatedAt: true,
        },
      }),
      prisma.saleOrder.count({
        where: {
          deletedAt: null,
          quotation: { createdById: salesUserId },
        },
      }),
    ]);

    return {
      totals: {
        quotations: totalQuotations,
        saleOrders: mySaleOrders,
        approvedValue: Number(totalValueAggregate._sum.grandTotal ?? 0),
      },
      byStatus: {
        draft: draftCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
      expiringSoon: myExpiringSoon,
      recent: recentQuotations,
    };
  },

  // ============================================================
  // APPROVER DASHBOARD
  // ============================================================
  async getApproverStats() {
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
      prisma.quotation.aggregate({
        where: { status: 'PENDING', deletedAt: null },
        _sum: { grandTotal: true },
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
        totalValue: Number(pendingValueAgg._sum.grandTotal ?? 0),
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
