import { z } from 'zod';
import { paginationSchema } from '../../../utils/pagination';

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).nullable().optional(),
  roleId: z.string().cuid().optional(),
  reportsToId: z.string().cuid().nullable().optional(),
  teamId: z.string().cuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

// Extends paginationSchema (page, limit, search, sortBy, sortOrder)
export const listUsersQuerySchema = paginationSchema.extend({
  roleId: z.string().cuid().optional(),
  teamId: z.string().cuid().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8).max(72),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;