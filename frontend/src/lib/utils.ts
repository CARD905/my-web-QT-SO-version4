import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind class merger */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format money with thousands separator */
export function formatMoney(value: number | string, currency = 'THB'): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === 'THB' ? `฿${formatted}` : `$${formatted}`;
}

/** Format number only (no currency symbol) */
export function formatNumber(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format date to DD/MM/YYYY */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-EN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Format date to ISO YYYY-MM-DD (for input[type=date]) */
export function formatDateInput(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Format relative time (e.g. "2 hours ago") */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = Date.now();
  const diff = now - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}

/** Check if date is within `days` days from now (and not in the past) */
export function isExpiringSoon(date: Date | string | null | undefined, days = 7): boolean {
  if (!date) return false;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return false;
  const daysLeft = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysLeft <= days && daysLeft >= 0;
}

/** Get status color class */
export function getStatusClass(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'status-draft',
    PENDING: 'status-pending',
    PENDING_BACKUP: 'status-pending',
    PENDING_ESCALATED: 'status-pending',
    APPROVED: 'status-approved',
    REJECTED: 'status-rejected',
    CANCELLED: 'status-cancelled',
    EXPIRED: 'status-expired',
    SENT: 'status-approved',
    SIGNED: 'status-approved',
    CONFIRMED: 'status-approved',
    COMPLETED: 'status-approved',
  };
  return map[status] || 'status-draft';
}

/**
 * Get display name for a role.
 * Handles both legacy string ('SALES') and new Role object format ({ code, nameTh, nameEn }).
 *
 * Usage:
 *   <span>{getRoleDisplay(user.role)}</span>
 *   <span>{getRoleDisplay(user.role, 'en')}</span>
 */
export function getRoleDisplay(
  role:
    | string
    | { code?: string; nameTh?: string | null; nameEn?: string | null }
    | null
    | undefined,
  lang: 'th' | 'en' | 'code' = 'th',
): string {
  if (!role) return '-';
  if (typeof role === 'string') return role;
  if (lang === 'code') return role.code || '-';
  if (lang === 'en') return role.nameEn || role.nameTh || role.code || '-';
  return role.nameTh || role.nameEn || role.code || '-';
}

/** Get role code only (for permission/comparison logic) */
export function getRoleCode(
  role:
    | string
    | { code?: string }
    | null
    | undefined,
): string {
  if (!role) return '';
  if (typeof role === 'string') return role;
  return role.code || '';
}