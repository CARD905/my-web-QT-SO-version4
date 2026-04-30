import { Customer, Product, User, Role, Quotation, QuotationItem } from '@prisma/client';

export function snapshotCustomerToQuotation(customer: Customer) {
  return {
    customerCompany: customer.company,
    customerContactName: customer.contactName,
    customerTaxId: customer.taxId,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    customerBillingAddress: customer.billingAddress,
    customerShippingAddress: customer.shippingAddress,
  };
}

export function snapshotProductToItem(
  product: Product,
  override?: Partial<{ unitPrice: number; description: string | null }>,
) {
  return {
    productId: product.id,
    productSku: product.sku,
    productName: product.name,
    productDescription: override?.description ?? product.description,
    unit: product.unit,
    unitPrice: override?.unitPrice ?? Number(product.unitPrice),
  };
}

export function snapshotApprover(user: User & { role: Role }) {
  return {
    approverId: user.id,
    approverName: user.name,
    approverEmail: user.email,
    approverRoleId: user.role.id,
    approverRoleCode: user.role.code,
    approverRoleName: user.role.nameTh,
  };
}

export function snapshotUserForActivityLog(user: User & { role: Role }) {
  return {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userRoleCode: user.role.code,
  };
}

export function snapshotQuotationToSaleOrder(
  quotation: Quotation & { items: QuotationItem[] },
) {
  return {
    customerId: quotation.customerId,
    customerCompany: quotation.customerCompany,
    customerContactName: quotation.customerContactName,
    customerTaxId: quotation.customerTaxId,
    customerEmail: quotation.customerEmail,
    customerPhone: quotation.customerPhone,
    customerBillingAddress: quotation.customerBillingAddress,
    customerShippingAddress: quotation.customerShippingAddress,
    issueDate: quotation.issueDate,
    currency: quotation.currency,
    subtotal: quotation.subtotal,
    discountTotal: quotation.discountTotal,
    vatRate: quotation.vatRate,
    vatEnabled: quotation.vatEnabled,
    vatAmount: quotation.vatAmount,
    grandTotal: quotation.grandTotal,
    paymentTerms: quotation.paymentTerms,
    conditions: quotation.conditions,
    items: {
      create: quotation.items.map((item) => ({
        productId: item.productId,
        productSku: item.productSku,
        productName: item.productName,
        productDescription: item.productDescription,
        unit: item.unit,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        discount: item.discount,
        discountType: item.discountType,
        lineTotal: item.lineTotal,
        sortOrder: item.sortOrder,
      })),
    },
  };
}