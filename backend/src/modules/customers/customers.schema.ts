import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const createCustomerSchema = z.object({
  contactName: z.string().min(1, 'Contact name is required').max(255),
  company: z.string().min(1, 'Company is required').max(255),
  taxId: z.string().max(50).optional().nullable(),
  email: z.string().email('Invalid email').max(255).optional().nullable().or(z.literal('')),
  phone: z.string().max(50).optional().nullable(),
  billingAddress: z.string().max(2000).optional().nullable(),
  shippingAddress: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const listCustomersSchema = paginationSchema;

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
