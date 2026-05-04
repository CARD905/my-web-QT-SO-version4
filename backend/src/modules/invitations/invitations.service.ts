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

export const invitationsService = {
  // ============================================================
  // LIST — Admin/CEO see all, Manager see own team's invitations
  // ============================================================
  async list(query: ListInvitationsQuery, currentUser: CurrentUser) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.InvitationWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.teamId) where.teamId = query.teamId;

    // Manager scope: only see invitations they sent or to their team
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
    // Check email already used / pending invitation
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

    // Validate role
    const role = await prisma.role.findUnique({ where: { id: input.roleId } });
    if (!role || !role.isActive) throw new AppError(404, 'ROLE_NOT_FOUND', 'Role not found');

    // Manager can only invite OFFICER role + into their own team
    if (currentUser.roleCode === 'MANAGER') {
      if (role.code !== 'OFFICER') {
        throw new AppError(
          403,
          'INVALID_ROLE',
          'Managers can only invite OFFICER-level users',
        );
      }
      if (!input.teamId) {
        throw new AppError(400, 'TEAM_REQUIRED', 'Team is required when inviting');
      }
      const team = await prisma.team.findFirst({
        where: { id: input.teamId, managerId: currentUser.id },
      });
      if (!team) {
        throw new AppError(
          403,
          'NOT_YOUR_TEAM',
          'You can only invite users into teams you manage',
        );
      }
    }

    // Validate team
    if (input.teamId) {
      const team = await prisma.team.findUnique({ where: { id: input.teamId } });
      if (!team) throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
    }

    // Validate reports-to
    if (input.reportsToId) {
      const supervisor = await prisma.user.findFirst({
        where: { id: input.reportsToId, deletedAt: null },
      });
      if (!supervisor) {
        throw new AppError(404, 'SUPERVISOR_NOT_FOUND', 'Supervisor not found');
      }
    }

    // Create invitation
    const token = generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

    const invitation = await prisma.invitation.create({
      data: {
        email: input.email,
        name: input.name,
        phone: input.phone,
        roleId: input.roleId,
        teamId: input.teamId,
        reportsToId: input.reportsToId,
        invitedById: currentUser.id,
        token,
        expiresAt,
        status: 'PENDING',
        channel: input.channel,
      },
      include: invitationInclude,
    });

    // TODO Phase 6: Actually send email if channel === 'EMAIL' or 'BOTH'
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
      description: `Invited ${input.email} as ${role.code}`,
      req,
    });

    return invitation;
  },

  // ============================================================
  // GET INVITATION BY TOKEN (public — for accept page)
  // ============================================================
  async getByToken(token: string) {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: invitationInclude,
    });
    if (!invitation) {
      throw new AppError(404, 'NOT_FOUND', 'Invitation not found or invalid');
    }

    // Check status
    if (invitation.status === 'ACCEPTED') {
      throw new AppError(409, 'ALREADY_ACCEPTED', 'This invitation has already been accepted');
    }
    if (invitation.status === 'REVOKED') {
      throw new AppError(409, 'REVOKED', 'This invitation has been revoked');
    }
    if (invitation.expiresAt < new Date()) {
      // Auto-mark as expired
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

    // Double-check email not taken (race condition)
    const existing = await prisma.user.findFirst({
      where: { email: invitation.email, deletedAt: null },
    });
    if (existing) {
      throw new AppError(409, 'EMAIL_TAKEN', 'This email is already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    // Create user + mark invitation accepted (in transaction)
    const result = await prisma.$transaction(async (tx) => {
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
      throw new AppError(
        409,
        'NOT_PENDING',
        `Cannot revoke ${invitation.status.toLowerCase()} invitation`,
      );
    }

    // Manager can only revoke their own invitations
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
  // GET INVITATION URL — return manual link
  // ============================================================
  getInvitationUrl(token: string): string {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${baseUrl}/invite/${token}`;
  },
};