import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

const itemSchema = z.object({
  id: z.string().uuid().optional(), // for updates
  productId: z.string().uuid().optional().nullable(),
  productSku: z.string().max(100).optional().nullable(),
  productName: z.string().min(1, 'Product name required').max(255),
  description: z.string().max(2000).optional().nullable(),
  quantity: z.coerce.number().positive('Quantity must be > 0'),
  unit: z.string().max(50).default('pcs'),
  unitPrice: z.coerce.number().nonnegative(),
  discount: z.coerce.number().nonnegative().default(0),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'),
  sortOrder: z.coerce.number().int().default(0),
});

const dateString = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)));

export const createQuotationSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  issueDate: dateString,
  expiryDate: dateString,
  currency: z.enum(['THB', 'USD']).default('THB'),
  vatEnabled: z.boolean().default(true),
  vatRate: z.coerce.number().min(0).max(100).default(7),
  paymentTerms: z.string().max(100).optional().nullable(),
  conditions: z.string().max(5000).optional().nullable(),
  items: z.array(itemSchema).min(1, 'At least one item required'),
});

export const updateQuotationSchema = createQuotationSchema.extend({
  changeReason: z.string().max(500).optional(),
});

export const submitQuotationSchema = z.object({
  comment: z.string().max(2000).optional(),
});

export const approveQuotationSchema = z.object({
  comment: z.string().max(2000).optional(),
});

export const rejectQuotationSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(2000),
});

export const cancelQuotationSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required').max(2000),
});

export const addCommentSchema = z.object({
  message: z.string().min(1).max(2000),
  isInternal: z.boolean().default(false),
});

export const listQuotationsSchema = paginationSchema.extend({
  status: z
    .enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'])
    .optional(),
  customerId: z.string().uuid().optional(),
  createdById: z.string().uuid().optional(),
  expiringSoon: z.coerce.boolean().optional(), // expires within 7 days
  highValue: z.coerce.boolean().optional(),    // grandTotal >= 100000
});

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>;
export type SubmitQuotationInput = z.infer<typeof submitQuotationSchema>;
export type ApproveQuotationInput = z.infer<typeof approveQuotationSchema>;
export type RejectQuotationInput = z.infer<typeof rejectQuotationSchema>;
export type CancelQuotationInput = z.infer<typeof cancelQuotationSchema>;
export type AddCommentInput = z.infer<typeof addCommentSchema>;
export type ListQuotationsQuery = z.infer<typeof listQuotationsSchema>;
