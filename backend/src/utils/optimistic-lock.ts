import { AppError } from './response';

export class OptimisticLockError extends AppError {
  constructor(entity: string, id: string) {
    super(
      409,
      'OPTIMISTIC_LOCK_CONFLICT',
      `${entity} was modified by another user. Please refresh and try again.`,
    );
  }
}

/**
 * Update with version check (atomic)
 * Throws OptimisticLockError if version doesn't match.
 *
 * Usage:
 *   const updated = await updateWithLock(
 *     prisma.quotation,
 *     id,
 *     expectedVersion,
 *     { status: 'APPROVED' },
 *     'Quotation'
 *   );
 */
export async function updateWithLock<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  id: string,
  expectedVersion: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  entityName: string,
): Promise<T> {
  const result = await model.updateMany({
    where: { id, version: expectedVersion },
    data: {
      ...data,
      version: { increment: 1 },
    },
  });

  if (result.count === 0) {
    // Either record doesn't exist or version mismatch
    const exists = await model.findUnique({ where: { id } });
    if (!exists) {
      throw new AppError(404, 'NOT_FOUND', `${entityName} not found`);
    }
    throw new OptimisticLockError(entityName, id);
  }

  return model.findUnique({ where: { id } });
}