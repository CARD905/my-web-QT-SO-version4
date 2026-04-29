import { z } from 'zod';

export const updateCompanySchema = z.object({
  companyName: z.string().min(1).max(255),
  companyNameTh: z.string().max(255).optional().nullable(),
  taxId: z.string().max(50).optional().nullable(),
  address: z.string().max(2000).optional().nullable(),
  addressTh: z.string().max(2000).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  fax: z.string().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable().or(z.literal('')),
  website: z.string().max(255).optional().nullable().or(z.literal('')),
  logoUrl: z.string().max(500).optional().nullable(),

  defaultVatRate: z.coerce.number().min(0).max(100).default(7),
  defaultPaymentTerms: z.string().max(100).optional().nullable(),
  defaultCurrency: z.enum(['THB', 'USD']).default('THB'),

  // NEW: approval limits
  approverLimit: z.coerce.number().nonnegative().default(100000),
  managerLimit: z.coerce.number().nonnegative().default(0),

  bankName: z.string().max(255).optional().nullable(),
  bankAccount: z.string().max(100).optional().nullable(),
  bankBranch: z.string().max(255).optional().nullable(),
});

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;