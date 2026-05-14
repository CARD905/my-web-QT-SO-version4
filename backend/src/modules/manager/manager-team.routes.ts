// ════════════════════════════════════════════════════════════════════════════
// backend/src/modules/manager/manager-team.routes.ts  (ไฟล์ใหม่)
// ════════════════════════════════════════════════════════════════════════════
import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/role';
import { asyncHandler } from '../../middleware/error';
import { AppError, success } from '../../utils/response';
import { prisma } from '../../config/prisma';
import { logActivity } from '../../utils/activity-log';

const router = Router();
router.use(authenticate);
router.use(requireRole('MANAGER', 'ADMIN', 'CEO'));

// ─── GET /manager/my-team ─────────────────────────────────────────────────
router.get('/my-team', asyncHandler(async (req, res) => {
  const user = req.user as { id: string; roleCode?: string };

  // หา team ที่ manager คนนี้ดูแล
  const team = await prisma.team.findFirst({
    where: { managerId: user.id, deletedAt: null },
    include: {
      members: {
        where: { deletedAt: null },
        select: {
          id: true, name: true, email: true, phone: true,
          isActive: true, isTeamLead: true, reportsToId: true,
          lastLoginAt: true,
          reportsTo: { select: { id: true, name: true } },
          role: { select: { code: true, nameTh: true } },
          _count: { select: { createdQuotations: true } },
        },
      },
    },
  });

  if (!team) throw new AppError(404, 'NO_TEAM', 'คุณยังไม่มีทีม กรุณาติดต่อ Admin');

  return success(res, team);
}));

// ─── PATCH /manager/team-members/:id/promote-lead ────────────────────────
router.patch('/team-members/:id/promote-lead', asyncHandler(async (req, res) => {
  const managerId = (req.user as any).id;
  const memberId = req.params.id;

  // ตรวจว่า member อยู่ในทีมของ manager นี้
  const member = await prisma.user.findFirst({
    where: { id: memberId, deletedAt: null },
    include: {
        team: true,
        role: true,   // ← เพิ่มบรรทัดนี้
    },
    });
  if (!member) throw new AppError(404, 'NOT_FOUND', 'ไม่พบ User');
  if (member.team?.managerId !== managerId) {
    throw new AppError(403, 'FORBIDDEN', 'User นี้ไม่ได้อยู่ในทีมของคุณ');
  }
  if (member.role?.code !== 'OFFICER') {
    throw new AppError(400, 'INVALID_ROLE', 'สามารถตั้ง Lead ได้เฉพาะ Officer เท่านั้น');
  }

  const updated = await prisma.user.update({
    where: { id: memberId },
    data: { isTeamLead: true },
    select: { id: true, name: true, isTeamLead: true },
  });

  await logActivity(prisma, {
    userId: managerId,
    action: 'team.promoteLeader',
    entityType: 'User',
    entityId: memberId,
    description: `Promoted ${member.name} to Officer Lead`,
    req,
  });

  return success(res, updated, `${member.name} เป็น Officer Lead แล้ว`);
}));

// ─── PATCH /manager/team-members/:id/demote-lead ─────────────────────────
router.patch('/team-members/:id/demote-lead', asyncHandler(async (req, res) => {
  const managerId = (req.user as any).id;
  const memberId = req.params.id;

  const member = await prisma.user.findFirst({
    where: { id: memberId, deletedAt: null },
    include: { team: true },
  });
  if (!member) throw new AppError(404, 'NOT_FOUND', 'ไม่พบ User');
  if (member.team?.managerId !== managerId) {
    throw new AppError(403, 'FORBIDDEN', 'User นี้ไม่ได้อยู่ในทีมของคุณ');
  }

  const updated = await prisma.user.update({
    where: { id: memberId },
    data: { isTeamLead: false },
    select: { id: true, name: true, isTeamLead: true },
  });

  await logActivity(prisma, {
    userId: managerId,
    action: 'team.demoteLeader',
    entityType: 'User',
    entityId: memberId,
    description: `Demoted ${member.name} from Officer Lead`,
    req,
  });

  return success(res, updated, `${member.name} ถูกถอดจาก Officer Lead แล้ว`);
}));

export default router;