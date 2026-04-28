import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const listSaleOrdersSchema = paginationSchema.extend({
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  customerId: z.string().uuid().optional(),
});

export type ListSaleOrdersQuery = z.infer<typeof listSaleOrdersSchema>;
