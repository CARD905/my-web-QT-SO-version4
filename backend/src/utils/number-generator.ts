import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Generates next document number atomically using DocumentCounter table.
 * Format: PREFIX-YYYY-NNNN  (e.g. QT-2026-0001)
 *
 * MUST be called inside a Prisma transaction to be safe under concurrency.
 */
export async function generateDocumentNumber(
  tx: Prisma.TransactionClient | PrismaClient,
  prefix: string,
  year?: number,
): Promise<string> {
  const targetYear = year ?? new Date().getFullYear();

  const counter = await tx.documentCounter.upsert({
    where: { type_year: { type: prefix, year: targetYear } },
    create: { type: prefix, year: targetYear, counter: 1 },
    update: { counter: { increment: 1 } },
  });

  const padded = counter.counter.toString().padStart(4, '0');
  return `${prefix}-${targetYear}-${padded}`;
}