import { z } from 'zod';

export const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(500).default(20),
    search: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .passthrough();

export type PaginationQuery = z.infer<typeof paginationSchema>;

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function getPaginationParams(query: PaginationQuery) {
  const page = query.page;
  const limit = query.limit;
  return {
    skip: (page - 1) * limit,
    take: limit,
    page,
    limit,
  };
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginatedResult<unknown>['meta'] {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}