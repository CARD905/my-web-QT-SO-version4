import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const createInvitationSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  roleId: z.string().cuid(),
  teamId: z.string().cuid().optional().nullable(),
  reportsToId: z.string().cuid().optional().nullable(),
  channel: z.enum(['MANUAL', 'EMAIL', 'BOTH']).default('MANUAL'),
  expiresInDays: z.number().int().min(1).max(30).default(3),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(72),
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
});

export const listInvitationsQuerySchema = paginationSchema.extend({
  status: z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED']).optional(),
  teamId: z.string().cuid().optional(),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type ListInvitationsQuery = z.infer<typeof listInvitationsQuerySchema>;