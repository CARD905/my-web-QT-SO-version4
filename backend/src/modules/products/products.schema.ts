import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const createProductSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(100),
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).optional().nullable(),
  unitPrice: z.coerce.number().nonnegative('Unit price must be >= 0'),
  unit: z.string().max(50).default('pcs'),
  isActive: z.boolean().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export const listProductsSchema = paginationSchema.extend({
  isActive: z.coerce.boolean().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsSchema>;
