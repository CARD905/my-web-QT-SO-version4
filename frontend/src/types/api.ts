// API Response Types — Schema v2

export type Lang = 'th' | 'en';
export type Theme = 'light' | 'dark' | 'system';
export type Currency = 'THB' | 'USD';
export type DiscountType = 'PERCENTAGE' | 'FIXED';
export type PermissionScope = 'OWN' | 'TEAM' | 'DEPARTMENT' | 'ALL';

export type QuotationStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'PENDING_BACKUP'
  | 'PENDING_ESCALATED'
  | 'APPROVED'
  | 'REJECTED'
  | 'SENT'
  | 'SIGNED'
  | 'CANCELLED'
  | 'EXPIRED';

export type SaleOrderStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export type ApprovalAction =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ESCALATED'
  | 'DELEGATED'
  | 'SKIPPED'
  | 'WITHDRAWN';

export type ApproverType = 'PRIMARY' | 'BACKUP' | 'ESCALATION' | 'DELEGATE';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: { code: string; message: string };
}

// ============================================================
// IDENTITY
// ============================================================
export interface Role {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  description?: string | null;
  level: number;
  isSystem: boolean;
  isActive: boolean;
  defaultApprovalLimit?: string | number | null;
  themeColor?: string | null;
  version: number;
}

export interface Permission {
  id: string;
  code: string;
  resource: string;
  action: string;
  scope: PermissionScope;
  nameTh: string;
  nameEn: string;
  groupKey: string;
}

// ============================================================
// USER + ORG
// ============================================================
export interface Department {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
}

export interface Team {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  departmentId: string;
  managerId?: string | null;
  isActive: boolean;
  version: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
  roleId: string;
  role?: Role;
  reportsToId?: string | null;
  teamId?: string | null;
  team?: Team | null;
  approvalLimit?: string | number | null;
  preferredLang: Lang;
  preferredTheme: Theme;
  isActive: boolean;
  lastLoginAt?: string | Date | null;
  version: number;
}

// Compatibility alias for legacy code that used UserRole as enum
// Now it's just a string — use Role.code values
export type UserRole = string;

// ============================================================
// CUSTOMER & PRODUCT
// ============================================================
export interface Customer {
  id: string;
  contactName: string;
  company: string;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  notes?: string | null;
  isActive: boolean;
  _count?: { quotations: number; saleOrders: number };
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  unitPrice: string | number;
  unit: string;
  isActive: boolean;
}

// ============================================================
// QUOTATION
// ============================================================
export interface QuotationItem {
  id?: string;
  productId?: string | null;
  productSku?: string | null;
  productName: string;
  productDescription?: string | null;
  unit: string;
  unitPrice: string | number;
  quantity: string | number;
  discount: string | number;
  discountType: DiscountType;
  lineTotal: string | number;
  sortOrder?: number;
}

export interface Quotation {
  id: string;
  quotationNo: string;
  version: number;
  customerId: string;
  customerCompany: string;
  customerContactName: string;
  customerTaxId?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerBillingAddress?: string | null;
  customerShippingAddress?: string | null;
  issueDate: string | Date;
  expiryDate: string | Date;
  currency: Currency;
  subtotal: string | number;
  discountTotal: string | number;
  vatRate: string | number;
  vatEnabled: boolean;
  vatAmount: string | number;
  grandTotal: string | number;
  paymentTerms?: string | null;
  conditions?: string | null;
  status: QuotationStatus;
  primaryApproverId?: string | null;
  primaryApprover?: User | null;
  backupApproverId?: string | null;
  backupApprover?: User | null;
  currentStep: number;
  totalSteps: number;
  approvedById?: string | null;
  approvedBy?: User | null;
  approvedAt?: string | Date | null;
  rejectedById?: string | null;
  rejectedAt?: string | Date | null;
  rejectionReason?: string | null;
  submittedAt?: string | Date | null;
  cancelledAt?: string | Date | null;
  cancelledReason?: string | null;
  createdById: string;
  createdBy?: User;
  items?: QuotationItem[];
  saleOrder?: SaleOrder | null;
}

export interface QuotationComment {
  id: string;
  message: string;
  isInternal: boolean;
  createdAt: string | Date;
  user: { id: string; name: string; role: { code: string; nameTh: string } };
}

export interface QuotationApproval {
  id: string;
  step: number;
  totalSteps: number;
  approverType: ApproverType;
  status: ApprovalAction;
  comment?: string | null;
  approverId: string;
  approverName: string;
  approverEmail: string;
  approverRoleCode: string;
  approverRoleName: string;
  grandTotalAtAction: string | number;
  approverLimitAtAction?: string | number | null;
  exceedsLimit: boolean;
  quotationVersion: number;
  escalatedToId?: string | null;
  actedAt: string | Date;
}

// ============================================================
// SALE ORDER
// ============================================================
export interface SaleOrderItem {
  id?: string;
  productId?: string | null;
  productSku?: string | null;
  productName: string;
  productDescription?: string | null;
  unit: string;
  unitPrice: string | number;
  quantity: string | number;
  discount: string | number;
  discountType: DiscountType;
  lineTotal: string | number;
}

export interface SaleOrder {
  id: string;
  saleOrderNo: string;
  quotationId: string;
  quotation?: Quotation;
  customerId: string;
  customerCompany: string;
  customerContactName: string;
  customerTaxId?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerBillingAddress?: string | null;
  customerShippingAddress?: string | null;
  issueDate: string | Date;
  currency: Currency;
  subtotal: string | number;
  discountTotal: string | number;
  vatRate: string | number;
  vatEnabled: boolean;
  vatAmount: string | number;
  grandTotal: string | number;
  paymentTerms?: string | null;
  conditions?: string | null;
  status: SaleOrderStatus;
  items?: SaleOrderItem[];
}

// ============================================================
// COMPANY SETTINGS
// ============================================================
export interface CompanySettings {
  id: string;
  companyName: string;
  companyNameTh?: string | null;
  taxId?: string | null;
  address?: string | null;
  addressTh?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  defaultVatRate: string | number;
  defaultPaymentTerms?: string | null;
  defaultCurrency: Currency;
  quotationPrefix: string;
  saleOrderPrefix: string;
  bankName?: string | null;
  bankAccount?: string | null;
  bankBranch?: string | null;
}

// ============================================================
// DASHBOARD (legacy — for backward compat)
// ============================================================
export interface SalesDashboard {
  totals: {
    quotations: number;
    saleOrders: number;
    approvedValue: number;
  };
  byStatus: { draft: number; pending: number; approved: number; rejected: number };
  expiringSoon: Array<{
    id: string;
    quotationNo: string;
    customerCompany: string;
    grandTotal: string | number;
    expiryDate: string;
  }>;
  recent: Quotation[];
}

export interface ApproverDashboard {
  pending: { count: number; totalValue: number; highValueCount: number; expiringSoonCount: number };
  todayActivity: { approved: number; rejected: number };
  highValuePending: Array<Quotation & { createdBy: { name: string } }>;
  expiringSoon: Array<Quotation>;
  recentRequests: Array<Quotation & { createdBy: { name: string } }>;
}

// ============================================================
// NOTIFICATION
// ============================================================
export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string | Date;
}