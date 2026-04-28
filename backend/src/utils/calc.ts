/**
 * Quotation calculation utilities
 * - All calculations use number, but Prisma stores Decimal for accuracy.
 * - Round to 2 decimals at the end.
 */

import { DiscountType } from '@prisma/client';

export interface ItemInput {
  quantity: number;
  unitPrice: number;
  discount: number;
  discountType: DiscountType;
}

export interface CalcResult {
  subtotal: number;
  discountTotal: number;
  vatAmount: number;
  grandTotal: number;
  itemTotals: number[];
}

export function calcLineTotal(item: ItemInput): number {
  const gross = item.quantity * item.unitPrice;
  let discountAmount = 0;

  if (item.discount > 0) {
    if (item.discountType === 'PERCENTAGE') {
      discountAmount = (gross * item.discount) / 100;
    } else {
      discountAmount = item.discount;
    }
  }

  return round2(gross - discountAmount);
}

export function calcQuotation(
  items: ItemInput[],
  vatEnabled: boolean,
  vatRate: number,
): CalcResult {
  let grossSubtotal = 0; // before line discount
  let discountTotal = 0;
  const itemTotals: number[] = [];

  for (const item of items) {
    const gross = item.quantity * item.unitPrice;
    grossSubtotal += gross;

    let lineDiscount = 0;
    if (item.discount > 0) {
      lineDiscount =
        item.discountType === 'PERCENTAGE'
          ? (gross * item.discount) / 100
          : item.discount;
    }
    discountTotal += lineDiscount;
    itemTotals.push(round2(gross - lineDiscount));
  }

  const subtotal = round2(grossSubtotal); // before discount
  const discountRounded = round2(discountTotal);
  const afterDiscount = subtotal - discountRounded;
  const vatAmount = vatEnabled ? round2((afterDiscount * vatRate) / 100) : 0;
  const grandTotal = round2(afterDiscount + vatAmount);

  return {
    subtotal,
    discountTotal: discountRounded,
    vatAmount,
    grandTotal,
    itemTotals,
  };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
