import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const listSaleOrdersSchema = paginationSchema.extend({
  status: z.enum(['DRAFT', 'PENDING_REVIEW', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  customerId: z.string().uuid().optional(),
});

export const updateSaleOrderSchema = z.object({
  // Customer info (snapshot fields)
  customerCompany: z.string().min(1).max(255).optional(),
  customerContactName: z.string().min(1).max(255).optional(),
  customerTaxId: z.string().max(50).nullable().optional(),
  customerEmail: z.string().email().nullable().optional().or(z.literal('')),
  customerPhone: z.string().max(50).nullable().optional(),
  customerBillingAddress: z.string().max(2000).nullable().optional(),
  customerShippingAddress: z.string().max(2000).nullable().optional(),

  // Document
  paymentTerms: z.string().max(500).nullable().optional(),
  conditions: z.string().max(2000).nullable().optional(),

  // Items (full replace)
  items: z
    .array(
      z.object({
        productId: z.string().uuid().nullable().optional(),
        productSku: z.string().max(100).nullable().optional(),
        productName: z.string().min(1).max(255),
        productDescription: z.string().max(2000).nullable().optional(),
        unit: z.string().max(50).default('pcs'),
        unitPrice: z.coerce.number().min(0),
        quantity: z.coerce.number().min(0),
        discount: z.coerce.number().min(0).default(0),
        discountType: z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'),
        sortOrder: z.coerce.number().int().min(0).optional(),
      }),
    )
    .optional(),
});

export const submitSaleOrderSchema = z.object({
  comment: z.string().max(1000).optional(),
});

export const reviewSaleOrderSchema = z.object({
  comment: z.string().max(1000).optional(),
});

export const confirmSaleOrderSchema = z.object({});

export type ListSaleOrdersQuery = z.infer<typeof listSaleOrdersSchema>;
export type UpdateSaleOrderInput = z.infer<typeof updateSaleOrderSchema>;
export type SubmitSaleOrderInput = z.infer<typeof submitSaleOrderSchema>;
export type ReviewSaleOrderInput = z.infer<typeof reviewSaleOrderSchema>;