import { Request, Response } from 'express';
import { managerDashboardService, DashboardFilter } from './manager-dashboard.service';
import { AppError, success } from '../../utils/response';

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
  const u = req.user as { id: string; role?: string; roleCode?: string; roleId?: string };
  return {
    id: u.id,
    roleCode: u.roleCode || u.role || 'OFFICER',
    roleId: u.roleId || '',
  };
}

// ─── Whitelist filter values ──────────────────────────────────────────────
const VALID_FILTERS: DashboardFilter[] = ['self', 'team', 'all', 'user'];

function parseFilter(raw: unknown): DashboardFilter {
  if (typeof raw === 'string' && (VALID_FILTERS as string[]).includes(raw)) {
    return raw as DashboardFilter;
  }
  return 'self'; // default
}

function parseUserId(raw: unknown): string | undefined {
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return undefined;
}

export const managerDashboardController = {
  // ── Overview (with filter support) ──
  async overview(req: Request, res: Response) {
    const user = requireUser(req);
    const filter = parseFilter(req.query.filter);
    const userId = parseUserId(req.query.userId);

    try {
      const data = await managerDashboardService.overview(user, { filter, userId });
      return success(res, data);
    } catch (err: any) {
      // Service throws "FORBIDDEN: ..." for permission errors
      if (err?.message?.startsWith('FORBIDDEN')) {
        throw new AppError(403, 'FORBIDDEN', err.message);
      }
      throw err;
    }
  },

  // ── Filterable users dropdown ──
  async filterableUsers(req: Request, res: Response) {
    const user = requireUser(req);
    const data = await managerDashboardService.filterableUsers(user);
    return success(res, data);
  },

  async users(req: Request, res: Response) {
    const user = requireUser(req);
    const data = await managerDashboardService.usersList(user);
    return success(res, data);
  },

  async userDetail(req: Request, res: Response) {
    const user = requireUser(req);
    const data = await managerDashboardService.userDetail(req.params.userId, user);
    return success(res, data);
  },
};