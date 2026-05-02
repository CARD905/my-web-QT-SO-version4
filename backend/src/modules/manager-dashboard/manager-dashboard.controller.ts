import { Request, Response } from 'express';
import { success } from '../../utils/response';

/**
 * Phase 1 stub — Manager Dashboard endpoints will be rebuilt in Phase 2
 * with proper team-scoped queries.
 */
export const managerDashboardController = {
  async overview(_req: Request, res: Response) {
    return success(res, {
      totals: {
        quotations: 0,
        pendingApprover: 0,
        pendingManager: 0,
        pendingApproverValue: 0,
        pendingManagerValue: 0,
      },
      todayActivity: { approved: 0, rejected: 0 },
      topSales: [],
      topApprovers: [],
      recentEscalated: [],
    });
  },

  async users(_req: Request, res: Response) {
    return success(res, []);
  },

  async userDetail(_req: Request, res: Response) {
    return success(res, {
      user: null,
      totals: { quotations: 0, approvedValue: 0, thisMonth: 0 },
      byStatus: [],
      recent: [],
    });
  },
};