import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../config/prisma';

/** Convert Decimal|null to plain number */
export function toNum(v: Decimal | null | undefined): number {
  return v == null ? 0 : Number(v.toString());
}

/** Convert a monetary value to THB.
 *  If currency is 'USD', multiplies by rate (default 35).
 *  If currency is 'THB' (or missing), returns value as-is.
 */
export function toThb(value: number, currency?: string | null, rate: number = 35): number {
  return currency === 'USD' ? value * rate : value;
}

/** Fetch the configured USD→THB exchange rate from SystemSetting.
 *  Falls back to 35 if not configured.
 */
export async function getUsdRate(): Promise<number> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: 'currency.usdExchangeRate' },
    });
    return row ? (parseFloat(row.value) || 35) : 35;
  } catch {
    return 35;
  }
}

/** Convenience: reduce an array of records that have grandTotal + currency to a THB sum */
export function sumToThb(
  items: Array<{ grandTotal: Decimal | null | undefined; currency?: string | null }>,
  rate: number,
): number {
  return items.reduce((s, i) => s + toThb(toNum(i.grandTotal), i.currency, rate), 0);
}
