import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Generates next document number atomically using DocumentCounter table.
 * Format: PREFIX-YYYY-NNNN  (e.g. QT-2026-0001)
 *
 * Reads DocumentCounterConfig for the active year and display prefix.
 * Falls back to type name and current year if no config exists.
 *
 * MUST be called inside a Prisma transaction to be safe under concurrency.
 */
export async function generateDocumentNumber(
  tx: Prisma.TransactionClient | PrismaClient,
  type: string,
  year?: number,
): Promise<string> {
  // Read config to get the admin-configured prefix and active year
  const config = await (tx as any).documentCounterConfig.findUnique({
    where: { type },
  });

  const targetYear = year ?? config?.year ?? new Date().getFullYear();
  const prefix = config?.prefix ?? type;

  const counter = await tx.documentCounter.upsert({
    where: { type_year: { type, year: targetYear } },
    create: { type, year: targetYear, counter: 1 },
    update: { counter: { increment: 1 } },
  });

  const padded = counter.counter.toString().padStart(4, '0');
  return `${prefix}-${targetYear}-${padded}`;
}