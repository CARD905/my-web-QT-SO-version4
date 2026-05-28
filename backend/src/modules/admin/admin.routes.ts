// backend/src/modules/admin/admin.routes.ts
// ════════════════════════════════════════════════════════════════════════════
// MASTER ADMIN ROUTER — รวมทุก admin endpoint ไว้ที่นี่
// mount ที่ /api/v1/admin ใน routes.ts
// ════════════════════════════════════════════════════════════════════════════
import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/role';
import { requirePermission, requireAnyPermission } from '../../middleware/permission';
import { asyncHandler } from '../../middleware/error';
import { AppError, success, created } from '../../utils/response';
import { validate } from '../../middleware/validate';
import { adminService } from './admin.service';

// ── ดึง sub-routers เดิมมาใช้ต่อ ────────────────────────────────────────────
import usersAdminRoutes from './users-admin/users-admin.routes';
import rolesAdminRoutes from './roles-admin/roles-admin.routes';
import { changeRequestsService } from './change-requests.service';

const router = Router();
router.use(authenticate);

// ─── Sub-routers เดิม — ยังใช้ได้เหมือนเดิมทุก endpoint ────────────────────
// /admin/users/* → users-admin.routes.ts (list, _roles, _teams, reset-password ฯลฯ)
router.use('/users', usersAdminRoutes);

// /admin/roles/* → roles-admin.routes.ts (list, _permissions, create, update ฯลฯ)
router.use('/roles', rolesAdminRoutes);

// ════════════════════════════════════════════════════════════════════════════
// ── NEW Admin endpoints ─── CEO ดูได้ Admin แก้ได้ ──────────────────────────
// ════════════════════════════════════════════════════════════════════════════

function requireUser(req: any) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
  return {
    id: req.user.id,
    roleCode: req.user.roleCode || req.user.role || 'ADMIN',
    roleId: req.user.roleId,
    name: req.user.name ?? '',
    email: req.user.email ?? '',
  };
}

function adminOnly(req: any) {
  const user = requireUser(req);
  if (!['ADMIN', 'CEO'].includes(user.roleCode)) {
    throw new AppError(403, 'FORBIDDEN', 'Admin/CEO only');
  }
  return user;
}

// ─── Quotation Settings (public read — any authenticated user) ────────────────
router.get('/quotation-settings',
  asyncHandler(async (_req, res) => {
    const data = await adminService.getQuotationSettings();
    return success(res, data);
  }),
);

// ─── System Settings ─────────────────────────────────────────────────────────
router.get('/settings',
  requireAnyPermission(['user', 'view', 'ALL']),
  asyncHandler(async (_req, res) => {
    const data = await adminService.getSystemSettings();
    return success(res, data);
  }),
);

router.patch('/settings',
  requireAnyPermission(['user', 'update', 'ALL']),
  asyncHandler(async (req, res) => {
    const user = adminOnly(req);
    const { updates } = req.body as { updates: { key: string; value: string }[] };
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new AppError(400, 'BAD_REQUEST', 'updates array required');
    }
    const data = await adminService.bulkUpdateSettings(updates, user, req);
    return success(res, data, 'Settings updated');
  }),
);

router.patch('/settings/:key',
  requireAnyPermission(['user', 'update', 'ALL']),
  asyncHandler(async (req, res) => {
    const user = adminOnly(req);
    const { value } = req.body as { value: string };
    const data = await adminService.updateSystemSetting(req.params.key, value, user, req);
    return success(res, data, 'Setting updated');
  }),
);

// ─── Approval Authority ───────────────────────────────────────────────────────
router.get('/approval-authority',
  requireAnyPermission(['user', 'view', 'ALL']),
  asyncHandler(async (_req, res) => {
    const data = await adminService.getApprovalAuthority();
    return success(res, data);
  }),
);

router.patch('/approval-authority/roles/:roleId',
  requireAnyPermission(['user', 'update', 'ALL']),
  asyncHandler(async (req, res) => {
    const user = adminOnly(req);
    const { limit } = req.body as { limit: number | null };
    const data = await adminService.updateRoleApprovalLimit(req.params.roleId, limit, user, req);
    return success(res, data, 'Approval limit updated');
  }),
);

router.patch('/approval-authority/manager-levels/:managerLevel',
  requireAnyPermission(['user', 'update', 'ALL']),
  asyncHandler(async (req, res) => {
    const user = adminOnly(req);
    const { limit } = req.body as { limit: number | null };
    const managerLevel = req.params.managerLevel as 'DIVISION' | 'DEPARTMENT' | 'SECTION';
    const data = await adminService.updateManagerLevelApprovalLimit(managerLevel, limit, user, req);
    return success(res, data, 'Manager level approval limit updated');
  }),
);

router.patch('/approval-authority/manager-levels/:managerLevel/discount-limit',
  requireAnyPermission(['user', 'update', 'ALL']),
  asyncHandler(async (req, res) => {
    const user = adminOnly(req);
    const { limit } = req.body as { limit: number | null };
    const managerLevel = req.params.managerLevel as 'DIVISION' | 'DEPARTMENT' | 'SECTION' | 'CEO';
    const data = await adminService.updateManagerLevelDiscountLimit(managerLevel, limit, user, req);
    return success(res, data, 'Manager level discount limit updated');
  }),
);

router.patch('/approval-authority/users/:userId',
  requireAnyPermission(['user', 'update', 'ALL']),
  asyncHandler(async (req, res) => {
    const user = adminOnly(req);
    const { limit } = req.body as { limit: number | null };
    const data = await adminService.updateUserApprovalLimit(req.params.userId, limit, user, req);
    return success(res, data, 'User approval limit updated');
  }),
);

// ─── Activity Logs ────────────────────────────────────────────────────────────
router.get('/activity-log-users',
  requireAnyPermission(['user', 'view', 'ALL']),
  asyncHandler(async (req, res) => {
    const data = await adminService.getActivityLogUsers(req.query as any);
    return success(res, data);
  }),
);

router.get('/activity-logs',
  requireAnyPermission(['user', 'view', 'ALL']),
  asyncHandler(async (req, res) => {
    const data = await adminService.getActivityLogs(req.query as any);
    return success(res, data.data, undefined, data.meta);
  }),
);

// ─── Login History ────────────────────────────────────────────────────────────
router.get('/login-history',
  requireAnyPermission(['user', 'view', 'ALL']),
  asyncHandler(async (req, res) => {
    const query = {
      ...req.query,
      success: req.query.success !== undefined
        ? req.query.success === 'true'
        : undefined,
    } as any;
    const data = await adminService.getLoginHistory(query);
    return success(res, data.data, undefined, data.meta);
  }),
);

// ─── Departments ──────────────────────────────────────────────────────────────
router.get('/departments',
  requireAnyPermission(['user', 'view', 'ALL']),
  asyncHandler(async (_req, res) => {
    const data = await adminService.getDepartments();
    return success(res, data);
  }),
);

router.post('/departments',
  requireAnyPermission(['user', 'update', 'ALL']),
  asyncHandler(async (req, res) => {
    const user = adminOnly(req);
    const data = await adminService.createDepartment(req.body, user, req);
    return created(res, data, 'Department created');
  }),
);

// ─── Teams ────────────────────────────────────────────────────────────────────
router.post('/teams',
  requireAnyPermission(['user', 'update', 'ALL']),
  asyncHandler(async (req, res) => {
    const user = adminOnly(req);
    const data = await adminService.createTeam(req.body, user, req);
    return created(res, data, 'Team created');
  }),
);

router.patch('/teams/:teamId/manager',
  requireAnyPermission(['user', 'update', 'ALL']),
  asyncHandler(async (req, res) => {
    const user = adminOnly(req);
    const { managerId, managerLevel } = req.body as { managerId: string; managerLevel?: 'DIVISION' | 'DEPARTMENT' | 'SECTION' };
    const data = await adminService.assignTeamManager(req.params.teamId, managerId, user, req, managerLevel);
    return success(res, data, 'Team manager assigned');
  }),
);

// ─── Extra User actions (ที่ยังไม่มีใน users-admin) ─────────────────────────
router.patch('/users/:userId/toggle-active',
  requireAnyPermission(['user', 'update', 'ALL']),
  asyncHandler(async (req, res) => {
    const user = adminOnly(req);
    const data = await adminService.toggleUserActive(req.params.userId, user, req);
    return success(res, data, `User ${data.isActive ? 'activated' : 'deactivated'}`);
  }),
);

router.patch('/users/:userId/role',
  requireAnyPermission(['user', 'update', 'ALL']),
  asyncHandler(async (req, res) => {
    const user = adminOnly(req);
    const { roleId } = req.body as { roleId: string };
    const data = await adminService.assignRole(req.params.userId, roleId, user, req);
    return success(res, data, 'Role assigned');
  }),
);

// ─── Document Counters (Running Number) ───────────────────────────────────────
router.get('/document-counters',
  requireAnyPermission(['user', 'view', 'ALL']),
  asyncHandler(async (_req, res) => {
    const data = await adminService.getDocumentCounters();
    return success(res, data);
  }),
);

router.patch('/document-counters',
  requireAnyPermission(['user', 'update', 'ALL']),
  asyncHandler(async (req, res) => {
    const user = adminOnly(req);
    const { type, year, counter } = req.body as { type: string; year: number; counter: number };
    if (!type || !year || counter === undefined) {
      throw new AppError(400, 'BAD_REQUEST', 'type, year, counter required');
    }
    const data = await adminService.resetDocumentCounter(type, year, counter, user, req);
    return success(res, data, 'Counter reset successful');
  }),
);

router.patch('/document-counter-configs/:type',
  requireAnyPermission(['user', 'update', 'ALL']),
  asyncHandler(async (req, res) => {
    const user = adminOnly(req);
    const { type } = req.params;
    const { prefix, year } = req.body as { prefix: string; year: number };
    if (!prefix || !year) throw new AppError(400, 'BAD_REQUEST', 'prefix and year required');
    const data = await adminService.updateDocumentCounterConfig(type, prefix, Number(year), user, req);
    return success(res, data, 'Config updated');
  }),
);
router.patch('/users/:userId/team', requireAnyPermission(['user', 'update', 'ALL']),
  asyncHandler(async (req, res) => {
    const user = adminOnly(req);
    const { teamId } = req.body as { teamId?: string | null };
    const data = await adminService.assignUserToTeam(req.params.userId, teamId ?? null, user, req);
    return success(res, data, teamId ? 'Assigned to team' : 'Removed from team');
  }),
);

// ─── Change Requests ─────────────────────────────────────────────────────────

// GET /admin/change-requests/pending-count — admin badge
router.get('/change-requests/pending-count',
  asyncHandler(async (_req, res) => {
    const count = await changeRequestsService.pendingCount();
    return success(res, { count });
  }),
);

// GET /admin/change-requests — list (admin/CEO)
router.get('/change-requests',
  asyncHandler(async (req, res) => {
    adminOnly(req);
    const { data, meta } = await changeRequestsService.list({
      status: req.query.status as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return success(res, data, undefined, meta);
  }),
);

// POST /admin/change-requests — submit request (any authenticated user)
router.post('/change-requests',
  asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const { targetUserId, reason, changes } = req.body as {
      targetUserId: string; reason: string; changes: Record<string, unknown>;
    };
    if (!targetUserId) throw new AppError(400, 'VALIDATION', 'targetUserId required');
    const data = await changeRequestsService.submit(user.id, targetUserId, reason, changes as any, req);
    return created(res, data, 'ส่งคำขอแก้ไขเรียบร้อย');
  }),
);

// POST /admin/change-requests/:id/approve — admin only
router.post('/change-requests/:id/approve',
  asyncHandler(async (req, res) => {
    const user = adminOnly(req);
    await changeRequestsService.approve(req.params.id, user.id, req.body.note, req);
    return success(res, null, 'อนุมัติคำขอเรียบร้อย');
  }),
);

// POST /admin/change-requests/:id/reject — admin only
router.post('/change-requests/:id/reject',
  asyncHandler(async (req, res) => {
    const user = adminOnly(req);
    await changeRequestsService.reject(req.params.id, user.id, req.body.note, req);
    return success(res, null, 'ปฏิเสธคำขอเรียบร้อย');
  }),
);

export default router;
