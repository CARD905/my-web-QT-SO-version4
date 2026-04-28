import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const listNotificationsSchema = paginationSchema.extend({
  isRead: z.coerce.boolean().optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>;
