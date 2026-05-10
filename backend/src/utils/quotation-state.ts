import { QuotationStatus } from '@prisma/client';
import { AppError } from './response';

const ALLOWED_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['APPROVED', 'REJECTED', 'PENDING_BACKUP', 'PENDING_ESCALATED', 'CANCELLED'],
  PENDING_BACKUP: ['APPROVED', 'REJECTED', 'PENDING_ESCALATED', 'CANCELLED'],
  PENDING_ESCALATED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  REJECTED: ['DRAFT', 'CANCELLED'],
  APPROVED: ['PO_PENDING', 'SENT', 'CANCELLED'],
  SENT: ['SIGNED', 'EXPIRED', 'CANCELLED'],
  SIGNED: [],
  CANCELLED: [],
  EXPIRED: ['DRAFT'],
  // ─── PO workflow statuses ────────────────────────────────────────────
  PO_PENDING: ['PO_APPROVED', 'PO_REJECTED'],
  PO_APPROVED: [],
  PO_REJECTED: ['PO_PENDING'],
};

export function canTransition(
  from: QuotationStatus,
  to: QuotationStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: QuotationStatus,
  to: QuotationStatus,
): void {
  if (!canTransition(from, to)) {
    throw new AppError(
      409,
      'INVALID_TRANSITION',
      `Cannot transition from ${from} to ${to}`,
    );
  }
}

export function getAllowedTransitions(
  from: QuotationStatus,
): QuotationStatus[] {
  return ALLOWED_TRANSITIONS[from] ?? [];
}