// =====================================================
// API Response wrapper types (matches backend)
// =====================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    details?: unknown;
  };
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unreadCount?: number;
}

// =====================================================
// Domain types
// =====================================================

export type UserRole = 'SALES' | 'APPROVER' | 'ADMIN';
export type QuotationStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED';
export type SaleOrderStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
export type DiscountType = 'PERCENTAGE' | 'FIXED';
export type Currency = 'THB' | 'USD';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string | null;
  phone?: string | null;
  preferredLang?: string;
  preferredTheme?: string;
}

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
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface QuotationItem {
  id: string;
  productId?: string | null;
  productSku?: string | null;
  productName: string;
  description?: string | null;
  quantity: string | number;
  unit: string;
  unitPrice: string | number;
  discount: string | number;
  discountType: DiscountType;
  lineTotal: string | number;
  sortOrder: number;
}

export interface Quotation {
  id: string;
  quotationNo: string;
  version: number;
  status: QuotationStatus;
  issueDate: string;
  expiryDate: string;
  currency: Currency;

  customerId: string;
  customerContactName: string;
  customerCompany: string;
  customerTaxId?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerBillingAddress?: string | null;
  customerShippingAddress?: string | null;

  subtotal: string | number;
  discountTotal: string | number;
  vatEnabled: boolean;
  vatRate: string | number;
  vatAmount: string | number;
  grandTotal: string | number;

  paymentTerms?: string | null;
  conditions?: string | null;

  submittedAt?: string | null;
  approvedAt?: string | null;
  approvedById?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;

  createdById: string;
  createdAt: string;
  updatedAt: string;

  items?: QuotationItem[];
  createdBy?: { id: string; name: string };
  approvedBy?: { id: string; name: string } | null;
  customer?: { id: string; company: string };
  saleOrder?: { id: string; saleOrderNo: string; status: SaleOrderStatus } | null;
  comments?: QuotationComment[];
  _count?: { items?: number; comments?: number; versions?: number; attachments?: number };
}

export interface QuotationComment {
  id: string;
  quotationId: string;
  userId: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
  user: { id: string; name: string; role: UserRole };
}

export interface SaleOrder {
  id: string;
  saleOrderNo: string;
  quotationId: string;
  status: SaleOrderStatus;
  issueDate: string;
  currency: Currency;

  customerId: string;
  customerContactName: string;
  customerCompany: string;
  customerTaxId?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerBillingAddress?: string | null;
  customerShippingAddress?: string | null;

  subtotal: string | number;
  discountTotal: string | number;
  vatEnabled: boolean;
  vatRate: string | number;
  vatAmount: string | number;
  grandTotal: string | number;

  paymentTerms?: string | null;
  conditions?: string | null;

  pdfGenerated: boolean;
  pdfUrl?: string | null;
  pdfGeneratedAt?: string | null;

  createdAt: string;
  updatedAt: string;

  items?: QuotationItem[];
  quotation?: { id: string; quotationNo: string; expiryDate: string };
  createdBy?: { id: string; name: string };
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  readAt?: string | null;
}
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
// Dashboard
export interface SalesDashboard {
  totals: { quotations: number; saleOrders: number; approvedValue: number };
  byStatus: { draft: number; pending: number; approved: number; rejected: number };
  expiringSoon: Array<{
    id: string;
    quotationNo: string;
    customerCompany: string;
    grandTotal: string | number;
    expiryDate: string;
    status: QuotationStatus;
  }>;
  recent: Array<{
    id: string;
    quotationNo: string;
    customerCompany: string;
    grandTotal: string | number;
    status: QuotationStatus;
    updatedAt: string;
  }>;
}

export interface ApproverDashboard {
  pending: {
    count: number;
    totalValue: number;
    highValueCount: number;
    expiringSoonCount: number;
  };
  todayActivity: { approved: number; rejected: number };
  highValuePending: Array<{
    id: string;
    quotationNo: string;
    customerCompany: string;
    grandTotal: string | number;
    submittedAt: string | null;
    createdBy: { id: string; name: string };
  }>;
  expiringSoon: Array<{
    id: string;
    quotationNo: string;
    customerCompany: string;
    grandTotal: string | number;
    expiryDate: string;
    createdBy: { id: string; name: string };
  }>;
  recentRequests: Array<{
    id: string;
    quotationNo: string;
    customerCompany: string;
    grandTotal: string | number;
    submittedAt: string | null;
    expiryDate: string;
    createdBy: { id: string; name: string };
  }>;
}
