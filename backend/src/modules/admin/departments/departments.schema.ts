import { z } from 'zod';

export const createDepartmentSchema = z.object({
  code: z.string().min(2).max(20).regex(/^[A-Z0-9_]+$/, 'Use UPPERCASE letters/numbers/underscore'),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateDepartmentSchema = z.object({
  code: z.string().min(2).max(20).optional(),
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;