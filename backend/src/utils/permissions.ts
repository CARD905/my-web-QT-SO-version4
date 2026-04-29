import { UserRole } from '@prisma/client';

/**
 * Permission registry — ใช้ทั้ง backend (route guards) และ frontend (UI hide/show)
 * Format: <resource>:<action>
 */
export const PERMISSIONS = {
  // Quotation
  'quotation:view': ['SALES', 'APPROVER', 'MANAGER', 'ADMIN'],
  'quotation:viewAll': ['APPROVER', 'MANAGER', 'ADMIN'],
  'quotation:create': ['SALES', 'ADMIN'],
  'quotation:update': ['SALES', 'ADMIN'],
  'quotation:cancel': ['SALES', 'ADMIN'],
  'quotation:submit': ['SALES', 'ADMIN'],
  'quotation:approve': ['APPROVER', 'MANAGER', 'ADMIN'],
  'quotation:approveOverLimit': ['MANAGER', 'ADMIN'],
  'quotation:reject': ['APPROVER', 'MANAGER', 'ADMIN'],
  'quotation:comment': ['SALES', 'APPROVER', 'MANAGER', 'ADMIN'],

  // Sale Order
  'saleOrder:view': ['SALES', 'APPROVER', 'MANAGER', 'ADMIN'],
  'saleOrder:viewAll': ['APPROVER', 'MANAGER', 'ADMIN'],
  'saleOrder:exportPdf': ['SALES', 'APPROVER', 'MANAGER', 'ADMIN'],

  // Customer
  'customer:view': ['SALES', 'APPROVER', 'MANAGER', 'ADMIN'],
  'customer:create': ['MANAGER', 'ADMIN'],
  'customer:update': ['SALES', 'MANAGER', 'ADMIN'], // Sales แก้ได้
  'customer:delete': ['MANAGER', 'ADMIN'],

  // Product
  'product:view': ['SALES', 'APPROVER', 'MANAGER', 'ADMIN'],
  'product:create': ['MANAGER', 'ADMIN'],
  'product:update': ['MANAGER', 'ADMIN'],
  'product:delete': ['MANAGER', 'ADMIN'],

  // Company
  'company:view': ['SALES', 'APPROVER', 'MANAGER', 'ADMIN'],
  'company:update': ['MANAGER', 'ADMIN'],

  // Permissions / Limits
  'permissions:view': ['SALES', 'APPROVER', 'MANAGER', 'ADMIN'],
  'permissions:manage': ['MANAGER', 'ADMIN'],

  // Dashboard
  'dashboard:sales': ['SALES', 'MANAGER', 'ADMIN'],
  'dashboard:approver': ['APPROVER', 'MANAGER', 'ADMIN'],
  'dashboard:manager': ['MANAGER', 'ADMIN'],
  'dashboard:drillDown': ['MANAGER', 'ADMIN'],
} as const satisfies Record<string, UserRole[]>;

export type PermissionKey = keyof typeof PERMISSIONS;

/** Check if a role has a permission */
export function can(role: UserRole, permission: PermissionKey): boolean {
  const allowed = PERMISSIONS[permission] as readonly UserRole[];
  return allowed.includes(role);
}

/** Get all permissions for a role */
export function getRolePermissions(role: UserRole): PermissionKey[] {
  return (Object.keys(PERMISSIONS) as PermissionKey[]).filter((p) =>
    can(role, p),
  );
}

/** Human-readable labels for permissions (Thai) */
export const PERMISSION_LABELS: Record<PermissionKey, { th: string; en: string; group: string }> = {
  'quotation:view': { th: 'ดูใบเสนอราคา', en: 'View Quotations', group: 'quotation' },
  'quotation:viewAll': { th: 'ดูใบเสนอราคาทุกคน', en: 'View All Quotations', group: 'quotation' },
  'quotation:create': { th: 'สร้างใบเสนอราคา', en: 'Create Quotation', group: 'quotation' },
  'quotation:update': { th: 'แก้ไขใบเสนอราคา', en: 'Edit Quotation', group: 'quotation' },
  'quotation:cancel': { th: 'ยกเลิกใบเสนอราคา', en: 'Cancel Quotation', group: 'quotation' },
  'quotation:submit': { th: 'ส่งขออนุมัติ', en: 'Submit for Approval', group: 'quotation' },
  'quotation:approve': { th: 'อนุมัติใบเสนอราคา', en: 'Approve Quotation', group: 'quotation' },
  'quotation:approveOverLimit': { th: 'อนุมัติเกินวงเงิน', en: 'Approve Over Limit', group: 'quotation' },
  'quotation:reject': { th: 'ปฏิเสธใบเสนอราคา', en: 'Reject Quotation', group: 'quotation' },
  'quotation:comment': { th: 'แสดงความคิดเห็น', en: 'Add Comment', group: 'quotation' },

  'saleOrder:view': { th: 'ดูใบสั่งขาย', en: 'View Sale Orders', group: 'saleOrder' },
  'saleOrder:viewAll': { th: 'ดูใบสั่งขายทุกคน', en: 'View All Sale Orders', group: 'saleOrder' },
  'saleOrder:exportPdf': { th: 'ดาวน์โหลด PDF', en: 'Export PDF', group: 'saleOrder' },

  'customer:view': { th: 'ดูข้อมูลลูกค้า', en: 'View Customers', group: 'customer' },
  'customer:create': { th: 'เพิ่มลูกค้าใหม่', en: 'Create Customer', group: 'customer' },
  'customer:update': { th: 'แก้ไขข้อมูลลูกค้า', en: 'Edit Customer', group: 'customer' },
  'customer:delete': { th: 'ลบลูกค้า', en: 'Delete Customer', group: 'customer' },

  'product:view': { th: 'ดูข้อมูลสินค้า', en: 'View Products', group: 'product' },
  'product:create': { th: 'เพิ่มสินค้าใหม่', en: 'Create Product', group: 'product' },
  'product:update': { th: 'แก้ไขข้อมูลสินค้า', en: 'Edit Product', group: 'product' },
  'product:delete': { th: 'ลบสินค้า', en: 'Delete Product', group: 'product' },

  'company:view': { th: 'ดูข้อมูลบริษัท', en: 'View Company', group: 'company' },
  'company:update': { th: 'แก้ไขข้อมูลบริษัท', en: 'Edit Company', group: 'company' },

  'permissions:view': { th: 'ดูสิทธิ์การใช้งาน', en: 'View Permissions', group: 'permissions' },
  'permissions:manage': { th: 'จัดการสิทธิ์และวงเงิน', en: 'Manage Permissions & Limits', group: 'permissions' },

  'dashboard:sales': { th: 'Dashboard ฝ่ายขาย', en: 'Sales Dashboard', group: 'dashboard' },
  'dashboard:approver': { th: 'Dashboard ผู้อนุมัติ', en: 'Approver Dashboard', group: 'dashboard' },
  'dashboard:manager': { th: 'Dashboard ผู้จัดการ', en: 'Manager Dashboard', group: 'dashboard' },
  'dashboard:drillDown': { th: 'ดูข้อมูลรายบุคคล', en: 'Drill-down per User', group: 'dashboard' },
};