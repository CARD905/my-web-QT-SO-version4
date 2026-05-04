import { z } from 'zod';

export const createRoleSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Code must be UPPERCASE letters/numbers/underscore'),
  nameTh: z.string().min(2).max(100),
  nameEn: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  level: z.coerce.number().int().min(1).max(99),
  themeColor: z.string().max(20).optional().nullable(),
  defaultApprovalLimit: z.coerce.number().min(0).optional().nullable(),
});

export const updateRoleSchema = z.object({
  nameTh: z.string().min(2).max(100).optional(),
  nameEn: z.string().min(2).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  level: z.coerce.number().int().min(1).max(99).optional(),
  themeColor: z.string().max(20).nullable().optional(),
  defaultApprovalLimit: z.coerce.number().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updatePermissionsSchema = z.object({
  permissionCodes: z.array(z.string()).min(0),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type UpdatePermissionsInput = z.infer<typeof updatePermissionsSchema>;