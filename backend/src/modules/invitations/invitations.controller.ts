import { Request, Response } from 'express';
import { z } from 'zod';
import { invitationsService } from './invitations.service';
import { AppError, created, success } from '../../utils/response';

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Not authenticated');
  const u = req.user as { id: string; role?: string; roleCode?: string; roleId?: string };
  return {
    id: u.id,
    roleCode: u.roleCode || u.role || 'OFFICER',
    roleId: u.roleId || '',
  };
}

const revokeSchema = z.object({
  reason: z.string().min(2).max(500),
});

export const invitationsController = {
  async list(req: Request, res: Response) {
    const user = requireUser(req);
    const result = await invitationsService.list(req.query as never, user);
    return success(res, result.data, undefined, result.meta);
  },

  async create(req: Request, res: Response) {
    const user = requireUser(req);
    const invitation = await invitationsService.create(req.body, user, req);
    const url = invitationsService.getInvitationUrl(invitation.token);
    return created(
      res,
      { ...invitation, invitationUrl: url },
      'Invitation created',
    );
  },

  async getByToken(req: Request, res: Response) {
    // Public endpoint — no auth required
    const invitation = await invitationsService.getByToken(req.params.token);
    // Return only safe fields
    return success(res, {
      email: invitation.email,
      name: invitation.name,
      role: invitation.role,
      team: invitation.team,
      invitedBy: invitation.invitedBy,
      expiresAt: invitation.expiresAt,
    });
  },

  async accept(req: Request, res: Response) {
    // Public endpoint — no auth required
    const result = await invitationsService.accept(req.body, req);
    return success(res, result, 'Account created successfully. Please log in.');
  },

  async revoke(req: Request, res: Response) {
    const user = requireUser(req);
    const { reason } = revokeSchema.parse(req.body);
    const data = await invitationsService.revoke(req.params.id, reason, user, req);
    return success(res, data, 'Invitation revoked');
  },
};