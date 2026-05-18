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

const ALLOWED_INVITE_TARGET: Record<string, string | string[] | null> = {
  MANAGER: 'OFFICER',
  ADMIN: ['OFFICER', 'MANAGER', 'CEO'],
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
      // Admin เห็นทุก invitation
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
    // ─── ตรวจสิทธิ์ ────────────────────────────────────────────────────────
    const allowed = ALLOWED_INVITE_TARGET[currentUser.roleCode];
  if (allowed === null || allowed === undefined) {
    throw new AppError(403, 'FORBIDDEN', 'คุณไม่มีสิทธิ์สร้าง Account ให้ผู้ใช้งาน');
  }

  let roleId: string;

  if (currentUser.roleCode === 'ADMIN') {
    // Admin ส่ง roleId มาใน input โดยตรง
    const inputRoleId = (input as any).roleId as string | undefined;
    if (!inputRoleId) throw new AppError(400, 'BAD_REQUEST', 'roleId required for Admin');
    const role = await prisma.role.findUnique({ where: { id: inputRoleId } });
    if (!role || !role.isActive) throw new AppError(404, 'ROLE_NOT_FOUND', 'Role not found');
    roleId = role.id;
  } else {
    // Manager ใช้ targetRoleCode จาก ALLOWED_INVITE_TARGET
    const targetRole = await prisma.role.findUnique({ where: { code: allowed as string } });
    if (!targetRole || !targetRole.isActive) {
      throw new AppError(404, 'ROLE_NOT_FOUND', `ไม่พบ Role กรุณาติดต่อ System Admin`);
    }
    roleId = targetRole.id;
  }

    if (currentUser.roleCode === 'MANAGER' && input.teamId) {
      const team = await prisma.team.findFirst({
        where: { id: input.teamId, managerId: currentUser.id },
      });
      if (!team) {
        throw new AppError(403, 'NOT_YOUR_TEAM', 'You can only invite users into teams you manage');
      }
    }

    let reportsToId = input.reportsToId;
    if (currentUser.roleCode === 'MANAGER' && !input.teamId && !reportsToId) {
      reportsToId = currentUser.id;
    }

    if (input.teamId) {
      const team = await prisma.team.findUnique({ where: { id: input.teamId } });
      if (!team) throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
    }

    if (reportsToId) {
      const supervisor = await prisma.user.findFirst({ where: { id: reportsToId, deletedAt: null } });
      if (!supervisor) throw new AppError(404, 'SUPERVISOR_NOT_FOUND', 'Supervisor not found');
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
        reportsToId,
        invitedById: currentUser.id,
        token,
        expiresAt,
        status: 'PENDING',
        channel: input.channel,
        // ✅ เก็บ managerLevel และ approvalLimit ถ้า Admin ส่งมา
        managerLevel: (input as any).managerLevel ?? null,
        approvalLimit: (input as any).approvalLimit ?? null,
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
      description: `Invited ${input.email} (roleId: ${roleId})`,
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
  // ACCEPT INVITATION (public — creates user)
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
      // ─── สร้าง User ────────────────────────────────────────────────────────
      const user = await tx.user.create({
        data: {
          email: invitation.email,
          password: passwordHash,
          name: input.name || invitation.name || invitation.email.split('@')[0],
          phone: input.phone || invitation.phone,
          roleId: invitation.roleId,
          teamId: invitation.teamId ?? null,
          reportsToId: invitation.reportsToId ?? null,
          isActive: true,
          // ✅ ใส่ managerLevel และ approvalLimit จาก invitation
          managerLevel: (invitation as any).managerLevel ?? null,
          approvalLimit: (invitation as any).approvalLimit ?? null,
        },
      });

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
      description: `User ${result.email} accepted invitation`,
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
      throw new AppError(409, 'NOT_PENDING', `Cannot revoke ${invitation.status.toLowerCase()} invitation`);
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