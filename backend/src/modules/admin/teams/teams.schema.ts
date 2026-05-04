import { z } from 'zod';

export const createTeamSchema = z.object({
  code: z.string().min(2).max(20).regex(/^[A-Z0-9_]+$/).optional().nullable(),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  departmentId: z.string().cuid(),
  managerId: z.string().cuid().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateTeamSchema = z.object({
  code: z.string().min(2).max(20).nullable().optional(),
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  departmentId: z.string().cuid().optional(),
  managerId: z.string().cuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;