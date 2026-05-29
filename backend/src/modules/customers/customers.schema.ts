import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const PAYMENT_TERMS = ['Prepaid', 'COD', 'Net 7', 'Net 15', 'Net 30', 'Net 60', 'Net 90'] as const;
export type PaymentTerm = typeof PAYMENT_TERMS[number];

export const createCustomerSchema = z.object({
  contactName: z.string().min(1, 'Contact name is required').max(255),
  company: z.string().min(1, 'Company is required').max(255),
  taxId: z.string().max(50).optional().nullable(),
  email: z.string().email('Invalid email').max(255).optional().nullable().or(z.literal('')),
  phone: z.string().max(50).optional().nullable(),
  billingAddress: z.string().max(2000).optional().nullable(),
  shippingAddress: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  paymentTerm: z.enum(PAYMENT_TERMS).default('Net 30'),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const listCustomersSchema = paginationSchema;

export const editRequestSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(2000),
  changes: z.object({
    contactName:     z.string().min(1).max(255).optional(),
    company:         z.string().min(1).max(255).optional(),
    taxId:           z.string().max(50).optional().nullable(),
    email:           z.string().email().max(255).optional().nullable().or(z.literal('')),
    phone:           z.string().max(50).optional().nullable(),
    billingAddress:  z.string().max(2000).optional().nullable(),
    shippingAddress: z.string().max(2000).optional().nullable(),
  }),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type EditRequestInput = z.infer<typeof editRequestSchema>;
