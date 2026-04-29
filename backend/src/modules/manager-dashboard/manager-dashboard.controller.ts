import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, success } from '../../utils/response';

const HIGH_VALUE_THRESHOLD = 100000;

export const managerDashboardController = {
  /** Manager overview — entire company stats */
  async overview(_req: Request, res: Response) {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const [
      totalQuotations,
      pendingApproverCount,
      pendingManagerCount,
      pendingApproverValue,
      pendingManagerValue,
      approvedTodayCount,
      rejectedTodayCount,
      topSales,
      topApprovers,
      recentEscalated,
    ] = await Promise.all([
      prisma.quotation.count({ where: { deletedAt: null } }),
      prisma.quotation.count({ where: { status: 'PENDING', deletedAt: null } }),
      prisma.quotation.count({ where: { status: 'PENDING_MANAGER', deletedAt: null } }),
      prisma.quotation.aggregate({
        where: { status: 'PENDING', deletedAt: null },
        _sum: { grandTotal: true },
      }),
      prisma.quotation.aggregate({
        where: { status: 'PENDING_MANAGER', deletedAt: null },
        _sum: { grandTotal: true },
      }),
      prisma.quotation.count({
        where: { status: 'APPROVED', approvedAt: { gte: startOfDay } },
      }),
      prisma.quotation.count({
        where: { status: 'REJECTED', rejectedAt: { gte: startOfDay } },
      }),
      // Top sales by approved value
      prisma.quotation.groupBy({
        by: ['createdById'],
        where: { status: 'APPROVED', deletedAt: null },
        _sum: { grandTotal: true },
        _count: { id: true },
        orderBy: { _sum: { grandTotal: 'desc' } },
        take: 5,
      }),
      // Top approvers by approval count (this month)
      prisma.quotation.groupBy({
        by: ['approvedById'],
        where: {
          status: 'APPROVED',
          approvedAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      prisma.quotation.findMany({
        where: { status: 'PENDING_MANAGER', deletedAt: null },
        orderBy: { submittedAt: 'desc' },
        take: 10,
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      }),
    ]);

    // Resolve user names for top sales/approvers
    const salesIds = topSales.map((t) => t.createdById);
    const approverIds = topApprovers.map((t) => t.approvedById).filter(Boolean) as string[];
    const allIds = [...new Set([...salesIds, ...approverIds])];
    const users = await prisma.user.findMany({
      where: { id: { in: allIds } },
      select: { id: true, name: true, role: true, avatarUrl: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return success(res, {
      totals: {
        quotations: totalQuotations,
        pendingApprover: pendingApproverCount,
        pendingManager: pendingManagerCount,
        pendingApproverValue: Number(pendingApproverValue._sum.grandTotal ?? 0),
        pendingManagerValue: Number(pendingManagerValue._sum.grandTotal ?? 0),
      },
      todayActivity: {
        approved: approvedTodayCount,
        rejected: rejectedTodayCount,
      },
      topSales: topSales.map((t) => ({
        userId: t.createdById,
        user: userMap.get(t.createdById),
        approvedValue: Number(t._sum.grandTotal ?? 0),
        quotationCount: t._count.id,
      })),
      topApprovers: topApprovers
        .filter((t) => t.approvedById)
        .map((t) => ({
          userId: t.approvedById!,
          user: userMap.get(t.approvedById!),
          approvedCount: t._count.id,
        })),
      recentEscalated: recentEscalated.map((q) => ({
        id: q.id,
        quotationNo: q.quotationNo,
        customerCompany: q.customerCompany,
        grandTotal: Number(q.grandTotal),
        currency: q.currency,
        submittedAt: q.submittedAt,
        createdBy: q.createdBy,
      })),
    });
  },

  /** Drill-down a specific user */
  async userDetail(req: Request, res: Response) {
    const userId = req.params.userId;
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    const baseWhere: Prisma.QuotationWhereInput =
      user.role === 'SALES'
        ? { createdById: userId, deletedAt: null }
        : user.role === 'APPROVER' || user.role === 'MANAGER'
          ? { approvedById: userId }
          : {};

    const [
      totalQuotations,
      byStatus,
      totalValue,
      recent,
      thisMonthCount,
    ] = await Promise.all([
      prisma.quotation.count({ where: baseWhere }),
      prisma.quotation.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { id: true },
        _sum: { grandTotal: true },
      }),
      prisma.quotation.aggregate({
        where: { ...baseWhere, status: 'APPROVED' },
        _sum: { grandTotal: true },
      }),
      prisma.quotation.findMany({
        where: baseWhere,
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          quotationNo: true,
          customerCompany: true,
          grandTotal: true,
          currency: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.quotation.count({
        where: {
          ...baseWhere,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    return success(res, {
      user,
      totals: {
        quotations: totalQuotations,
        approvedValue: Number(totalValue._sum.grandTotal ?? 0),
        thisMonth: thisMonthCount,
      },
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
        totalValue: Number(s._sum.grandTotal ?? 0),
      })),
      recent: recent.map((q) => ({
        ...q,
        grandTotal: Number(q.grandTotal),
      })),
    });
  },

  /** List of all users for drill-down picker */
  async usersList(_req: Request, res: Response) {
    const users = await prisma.user.findMany({
      where: { deletedAt: null, role: { in: ['SALES', 'APPROVER'] } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        lastLoginAt: true,
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    // Add quick stats per user
    const userIds = users.map((u) => u.id);
    const stats = await prisma.quotation.groupBy({
      by: ['createdById', 'status'],
      where: { createdById: { in: userIds }, deletedAt: null },
      _count: { id: true },
      _sum: { grandTotal: true },
    });

    const statsMap = new Map<string, { total: number; approved: number; approvedValue: number }>();
    for (const s of stats) {
      const cur = statsMap.get(s.createdById) ?? {
        total: 0,
        approved: 0,
        approvedValue: 0,
      };
      cur.total += s._count.id;
      if (s.status === 'APPROVED') {
        cur.approved += s._count.id;
        cur.approvedValue += Number(s._sum.grandTotal ?? 0);
      }
      statsMap.set(s.createdById, cur);
    }

    return success(
      res,
      users.map((u) => ({
        ...u,
        stats: statsMap.get(u.id) ?? { total: 0, approved: 0, approvedValue: 0 },
      })),
    );
  },
};