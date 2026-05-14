import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/response';
import { logActivity } from '../../utils/activity-log';
import { buildPaginationMeta, getPaginationParams } from '../../utils/pagination';
import {
  AcceptInvitationInput,
  CreateInvitationInput,
  ListInvitationsQuery,
} from './invitations.schema';

const invitationInclude = {
  role: { select: { id: true, code: true, nameTh: true, nameEn: true, level: true } },
  team: { select: { id: true, name: true, code: true } },
  department: { select: { id: true, name: true, code: true } }, // ✅ เพิ่ม
  invitedBy: { select: { id: true, name: true, email: true } },
  acceptedBy: { select: { id: true, name: true, email: true } },
} as const;

interface CurrentUser {
  id: string;
  roleCode: string;
  roleId: string;
}

function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

const ALLOWED_INVITE_TARGET: Record<string, string | null> = {
  MANAGER: 'OFFICER',
  ADMIN: 'MANAGER',
  CEO: null,
};

export const invitationsService = {
  // ============================================================
  // LIST
  // ============================================================
  async list(query: ListInvitationsQuery, currentUser: CurrentUser) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.InvitationWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.teamId) where.teamId = query.teamId;

    if (currentUser.roleCode === 'MANAGER') {
      const managedTeams = await prisma.team.findMany({
        where: { managerId: currentUser.id, deletedAt: null },
        select: { id: true },
      });
      const teamIds = managedTeams.map((t) => t.id);
      where.OR = [
        { invitedById: currentUser.id },
        { teamId: { in: teamIds } },
      ];
    }

    if (currentUser.roleCode === 'ADMIN') {
      const managerRole = await prisma.role.findUnique({ where: { code: 'MANAGER' } });
      if (managerRole) where.roleId = managerRole.id;
    }

    const [data, total] = await Promise.all([
      prisma.invitation.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: invitationInclude,
      }),
      prisma.invitation.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  },

  // ============================================================
  // CREATE INVITATION
  // ============================================================
  async create(input: CreateInvitationInput, currentUser: CurrentUser, req?: Request) {
    const targetRoleCode = ALLOWED_INVITE_TARGET[currentUser.roleCode];
    if (targetRoleCode === null || targetRoleCode === undefined) {
      throw new AppError(403, 'FORBIDDEN', 'คุณไม่มีสิทธิ์สร้าง Account ให้ผู้ใช้งาน');
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: input.email, deletedAt: null },
    });
    if (existingUser) {
      throw new AppError(409, 'EMAIL_EXISTS', 'A user with this email already exists');
    }

    const existingPending = await prisma.invitation.findFirst({
      where: { email: input.email, status: 'PENDING' },
    });
    if (existingPending) {
      throw new AppError(
        409,
        'INVITATION_PENDING',
        'A pending invitation already exists for this email. Revoke it first.',
      );
    }

    const targetRole = await prisma.role.findUnique({ where: { code: targetRoleCode } });
    if (!targetRole || !targetRole.isActive) {
      throw new AppError(
        404,
        'ROLE_NOT_FOUND',
        `ไม่พบ Role ${targetRoleCode} กรุณาติดต่อ System Admin`,
      );
    }
    const roleId = targetRole.id;

    // MANAGER: ถ้าส่ง teamId มา ให้ตรวจว่าเป็นทีมของตัวเองเท่านั้น
    // ไม่บังคับต้องมี teamId — Manager ไม่มีทีมก็เชิญ Officer ได้
    if (currentUser.roleCode === 'MANAGER' && input.teamId) {
      const team = await prisma.team.findFirst({
        where: { id: input.teamId, managerId: currentUser.id },
      });
      if (!team) {
        throw new AppError(403, 'NOT_YOUR_TEAM', 'You can only invite users into teams you manage');
      }
    }

    // ADMIN invite MANAGER: ต้องระบุ departmentId ✅
    if (currentUser.roleCode === 'ADMIN' && targetRoleCode === 'MANAGER') {
      if (!input.departmentId) {
        throw new AppError(400, 'DEPARTMENT_REQUIRED', 'กรุณาเลือก Department สำหรับ Manager');
      }
      const dept = await prisma.department.findFirst({
        where: { id: input.departmentId, isActive: true, deletedAt: null },
      });
      if (!dept) {
        throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'ไม่พบ Department ที่เลือก');
      }
    }

    if (input.teamId) {
      const team = await prisma.team.findUnique({ where: { id: input.teamId } });
      if (!team) throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
    }

    if (input.reportsToId) {
      const supervisor = await prisma.user.findFirst({
        where: { id: input.reportsToId, deletedAt: null },
      });
      if (!supervisor) {
        throw new AppError(404, 'SUPERVISOR_NOT_FOUND', 'Supervisor not found');
      }
    }

    const token = generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

    const invitation = await prisma.invitation.create({
      data: {
        email: input.email,
        name: input.name,
        phone: input.phone,
        roleId,
        teamId: input.teamId,
        departmentId: input.departmentId ?? null, // ✅ บันทึก departmentId
        reportsToId: input.reportsToId,
        invitedById: currentUser.id,
        token,
        expiresAt,
        status: 'PENDING',
        channel: input.channel,
      },
      include: invitationInclude,
    });

    if (input.channel === 'EMAIL' || input.channel === 'BOTH') {
      console.log(`[TODO] Send email to ${input.email} with token ${token}`);
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { emailSentAt: new Date() },
      });
    }

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'invitation.create',
      entityType: 'Invitation',
      entityId: invitation.id,
      description: `Invited ${input.email} as ${targetRole.code}`,
      req,
    });

    return invitation;
  },

  // ============================================================
  // GET INVITATION BY TOKEN (public)
  // ============================================================
  async getByToken(token: string) {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: invitationInclude,
    });
    if (!invitation) {
      throw new AppError(404, 'NOT_FOUND', 'Invitation not found or invalid');
    }
    if (invitation.status === 'ACCEPTED') {
      throw new AppError(409, 'ALREADY_ACCEPTED', 'This invitation has already been accepted');
    }
    if (invitation.status === 'REVOKED') {
      throw new AppError(409, 'REVOKED', 'This invitation has been revoked');
    }
    if (invitation.expiresAt < new Date()) {
      if (invitation.status === 'PENDING') {
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        });
      }
      throw new AppError(410, 'EXPIRED', 'This invitation has expired');
    }
    return invitation;
  },

  // ============================================================
  // ACCEPT INVITATION — auto-create team สำหรับ MANAGER ✅
  // ============================================================
  async accept(input: AcceptInvitationInput, req?: Request) {
    const invitation = await this.getByToken(input.token);

    const existing = await prisma.user.findFirst({
      where: { email: invitation.email, deletedAt: null },
    });
    if (existing) {
      throw new AppError(409, 'EMAIL_TAKEN', 'This email is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const result = await prisma.$transaction(async (tx) => {
      // ─── สร้าง User ────────────────────────────────────────────
      const user = await tx.user.create({
        data: {
          email: invitation.email,
          password: passwordHash,
          name: input.name || invitation.name || invitation.email.split('@')[0],
          phone: input.phone || invitation.phone,
          roleId: invitation.roleId,
          teamId: invitation.teamId,
          reportsToId: invitation.reportsToId,
          isActive: true,
        },
        include: {
          role: { select: { code: true } },
        },
      });

      // ─── ถ้าเป็น MANAGER → auto-create team ✅ ────────────────
      if (user.role.code === 'MANAGER') {
        if (!invitation.departmentId) {
          throw new AppError(
            400,
            'DEPARTMENT_MISSING',
            'Invitation สำหรับ Manager ต้องมี Department กรุณาติดต่อ Admin',
          );
        }

        const team = await tx.team.create({
          data: {
            name: `ทีมของ ${user.name}`,
            departmentId: invitation.departmentId,
            managerId: user.id,
            isActive: true,
          },
        });

        console.log(`[Team] Auto-created team "${team.name}" (${team.id}) for manager ${user.email}`);
      }

      // ─── Mark invitation accepted ───────────────────────────────
      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          acceptedById: user.id,
        },
      });

      return user;
    });

    await logActivity(prisma, {
      userId: result.id,
      action: 'invitation.accept',
      entityType: 'User',
      entityId: result.id,
      description: `User ${result.email} accepted invitation${result.role.code === 'MANAGER' ? ' + auto-created team' : ''}`,
      req,
    });

    return { userId: result.id, email: result.email };
  },

  // ============================================================
  // REVOKE INVITATION
  // ============================================================
  async revoke(id: string, reason: string, currentUser: CurrentUser, req?: Request) {
    const invitation = await prisma.invitation.findUnique({ where: { id } });
    if (!invitation) throw new AppError(404, 'NOT_FOUND', 'Invitation not found');

    if (invitation.status !== 'PENDING') {
      throw new AppError(
        409,
        'NOT_PENDING',
        `Cannot revoke ${invitation.status.toLowerCase()} invitation`,
      );
    }

    if (currentUser.roleCode === 'CEO') {
      throw new AppError(403, 'FORBIDDEN', 'คุณไม่มีสิทธิ์จัดการ Invitation');
    }

    if (currentUser.roleCode === 'MANAGER' && invitation.invitedById !== currentUser.id) {
      throw new AppError(403, 'FORBIDDEN', 'You can only revoke invitations you sent');
    }

    const updated = await prisma.invitation.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'invitation.revoke',
      entityType: 'Invitation',
      entityId: id,
      description: `Revoked invitation to ${invitation.email}: ${reason}`,
      req,
    });

    return updated;
  },

  // ============================================================
  // GET INVITATION URL
  // ============================================================
  getInvitationUrl(token: string): string {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${baseUrl}/invite/${token}`;
  },
};