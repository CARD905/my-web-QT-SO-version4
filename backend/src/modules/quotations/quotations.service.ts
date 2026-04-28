import { Prisma, QuotationStatus, UserRole } from '@prisma/client';
import { Request } from 'express';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/response';
import { buildPaginationMeta, getPaginationParams } from '../../utils/pagination';
import { logActivity } from '../../utils/activity-log';
import { createNotification, notifyByRole } from '../../utils/notification';
import { generateDocumentNumber } from '../../utils/number-generator';
import { calcQuotation } from '../../utils/calc';
import {
  AddCommentInput,
  ApproveQuotationInput,
  CancelQuotationInput,
  CreateQuotationInput,
  ListQuotationsQuery,
  RejectQuotationInput,
  SubmitQuotationInput,
  UpdateQuotationInput,
} from './quotations.schema';

const HIGH_VALUE_THRESHOLD = 100000;
const EXPIRING_SOON_DAYS = 7;

const quotationDetailInclude = {
  items: { orderBy: { sortOrder: 'asc' as const } },
  customer: { select: { id: true, company: true, contactName: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  saleOrder: { select: { id: true, saleOrderNo: true, status: true } },
  comments: {
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'desc' as const },
    take: 50,
  },
  _count: { select: { versions: true, attachments: true } },
} satisfies Prisma.QuotationInclude;

export const quotationsService = {
  // ============================================================
  // LIST
  // ============================================================
  async list(query: ListQuotationsQuery, currentUser: { id: string; role: UserRole }) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.QuotationWhereInput = { deletedAt: null };

    // Sales users see only their own quotations
    if (currentUser.role === 'SALES') {
      where.createdById = currentUser.id;
    } else if (query.createdById) {
      where.createdById = query.createdById;
    }

    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;

    if (query.expiringSoon) {
      const now = new Date();
      const future = new Date();
      future.setDate(future.getDate() + EXPIRING_SOON_DAYS);
      where.expiryDate = { gte: now, lte: future };
      where.status = where.status ?? 'PENDING';
    }

    if (query.highValue) {
      where.grandTotal = { gte: HIGH_VALUE_THRESHOLD };
    }

    if (query.search) {
      where.OR = [
        { quotationNo: { contains: query.search, mode: 'insensitive' } },
        { customerCompany: { contains: query.search, mode: 'insensitive' } },
        { customerContactName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.QuotationOrderByWithRelationInput = query.sortBy
      ? { [query.sortBy]: query.sortOrder }
      : { createdAt: 'desc' };

    const [data, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          createdBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          customer: { select: { id: true, company: true } },
          saleOrder: { select: { id: true, saleOrderNo: true } },
          _count: { select: { items: true, comments: true } },
        },
      }),
      prisma.quotation.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  },

  // ============================================================
  // GET BY ID
  // ============================================================
  async getById(id: string, currentUser: { id: string; role: UserRole }) {
    const quotation = await prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      include: quotationDetailInclude,
    });

    if (!quotation) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

    // Sales can only see their own
    if (currentUser.role === 'SALES' && quotation.createdById !== currentUser.id) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have access to this quotation');
    }

    // Auto-mark as expired if past expiry date and still draft/pending
    if (
      (quotation.status === 'DRAFT' || quotation.status === 'PENDING') &&
      new Date(quotation.expiryDate) < new Date()
    ) {
      const updated = await prisma.quotation.update({
        where: { id },
        data: { status: 'EXPIRED' },
        include: quotationDetailInclude,
      });
      return updated;
    }

    return quotation;
  },

  // ============================================================
  // CREATE (DRAFT)
  // ============================================================
  async create(input: CreateQuotationInput, userId: string, req?: Request) {
    // Snapshot customer info
    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, deletedAt: null },
    });
    if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');

    if (input.expiryDate < input.issueDate) {
      throw new AppError(400, 'INVALID_DATE', 'Expiry date must be after issue date');
    }

    // Calculate totals
    const { subtotal, discountTotal, vatAmount, grandTotal, itemTotals } = calcQuotation(
      input.items.map((i) => ({
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
        discountType: i.discountType,
      })),
      input.vatEnabled,
      input.vatRate,
    );

    const quotation = await prisma.$transaction(async (tx) => {
      const quotationNo = await generateDocumentNumber(tx, 'QT');

      return tx.quotation.create({
        data: {
          quotationNo,
          status: 'DRAFT',
          issueDate: input.issueDate,
          expiryDate: input.expiryDate,
          currency: input.currency,

          customerId: customer.id,
          customerContactName: customer.contactName,
          customerCompany: customer.company,
          customerTaxId: customer.taxId,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          customerBillingAddress: customer.billingAddress,
          customerShippingAddress: customer.shippingAddress,

          subtotal,
          discountTotal,
          vatEnabled: input.vatEnabled,
          vatRate: input.vatRate,
          vatAmount,
          grandTotal,

          paymentTerms: input.paymentTerms,
          conditions: input.conditions,

          createdById: userId,

          items: {
            create: input.items.map((item, idx) => ({
              productId: item.productId || null,
              productSku: item.productSku || null,
              productName: item.productName,
              description: item.description || null,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              discount: item.discount,
              discountType: item.discountType,
              lineTotal: itemTotals[idx],
              sortOrder: item.sortOrder ?? idx,
            })),
          },
        },
        include: quotationDetailInclude,
      });
    });

    await logActivity(prisma, {
      userId,
      action: 'CREATE',
      entityType: 'Quotation',
      entityId: quotation.id,
      description: `Created quotation ${quotation.quotationNo}`,
      req,
    });

    return quotation;
  },

  // ============================================================
  // UPDATE (only DRAFT or REJECTED, owner only)
  // ============================================================
  async update(
    id: string,
    input: UpdateQuotationInput,
    userId: string,
    req?: Request,
  ) {
    const existing = await prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      include: { items: true },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

    if (existing.createdById !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'You can only edit your own quotations');
    }

    if (!['DRAFT', 'REJECTED'].includes(existing.status)) {
      throw new AppError(
        409,
        'INVALID_STATUS',
        `Cannot edit quotation with status ${existing.status}`,
      );
    }

    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, deletedAt: null },
    });
    if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');

    if (input.expiryDate < input.issueDate) {
      throw new AppError(400, 'INVALID_DATE', 'Expiry date must be after issue date');
    }

    const { subtotal, discountTotal, vatAmount, grandTotal, itemTotals } = calcQuotation(
      input.items.map((i) => ({
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
        discountType: i.discountType,
      })),
      input.vatEnabled,
      input.vatRate,
    );

    const updated = await prisma.$transaction(async (tx) => {
      // Save current snapshot to versions
      await tx.quotationVersion.create({
        data: {
          quotationId: existing.id,
          version: existing.version,
          snapshot: existing as unknown as Prisma.InputJsonValue,
          changedById: userId,
          changeReason: input.changeReason,
        },
      });

      // Delete old items, insert new
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });

      // If was REJECTED → reset to DRAFT (will need to resubmit)
      const newStatus: QuotationStatus =
        existing.status === 'REJECTED' ? 'DRAFT' : existing.status;

      return tx.quotation.update({
        where: { id },
        data: {
          version: existing.version + 1,
          status: newStatus,

          issueDate: input.issueDate,
          expiryDate: input.expiryDate,
          currency: input.currency,

          customerId: customer.id,
          customerContactName: customer.contactName,
          customerCompany: customer.company,
          customerTaxId: customer.taxId,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          customerBillingAddress: customer.billingAddress,
          customerShippingAddress: customer.shippingAddress,

          subtotal,
          discountTotal,
          vatEnabled: input.vatEnabled,
          vatRate: input.vatRate,
          vatAmount,
          grandTotal,

          paymentTerms: input.paymentTerms,
          conditions: input.conditions,

          // Clear rejection fields if was REJECTED
          ...(existing.status === 'REJECTED' && {
            rejectedAt: null,
            rejectionReason: null,
            submittedAt: null,
          }),

          items: {
            create: input.items.map((item, idx) => ({
              productId: item.productId || null,
              productSku: item.productSku || null,
              productName: item.productName,
              description: item.description || null,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              discount: item.discount,
              discountType: item.discountType,
              lineTotal: itemTotals[idx],
              sortOrder: item.sortOrder ?? idx,
            })),
          },
        },
        include: quotationDetailInclude,
      });
    });

    await logActivity(prisma, {
      userId,
      action: 'UPDATE',
      entityType: 'Quotation',
      entityId: updated.id,
      description: `Updated quotation ${updated.quotationNo} (v${updated.version})`,
      req,
    });

    return updated;
  },

  // ============================================================
  // SUBMIT FOR APPROVAL (DRAFT → PENDING)
  // ============================================================
  async submit(id: string, input: SubmitQuotationInput, userId: string, req?: Request) {
    const existing = await prisma.quotation.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

    if (existing.createdById !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'You can only submit your own quotations');
    }

    if (!['DRAFT', 'REJECTED'].includes(existing.status)) {
      throw new AppError(
        409,
        'INVALID_STATUS',
        `Cannot submit quotation with status ${existing.status}`,
      );
    }

    if (new Date(existing.expiryDate) < new Date()) {
      throw new AppError(409, 'EXPIRED', 'Quotation has expired. Please update expiry date first.');
    }

    const action = existing.status === 'REJECTED' ? 'RESUBMIT' : 'SUBMIT';

    const updated = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.update({
        where: { id },
        data: { status: 'PENDING', submittedAt: new Date() },
        include: quotationDetailInclude,
      });

      if (input.comment) {
        await tx.quotationComment.create({
          data: { quotationId: id, userId, message: input.comment, isInternal: false },
        });
      }

      // Notify all approvers
      await notifyByRole(tx, 'APPROVER', {
        type: action === 'RESUBMIT' ? 'QUOTATION_RESUBMITTED' : 'QUOTATION_SUBMITTED',
        title: action === 'RESUBMIT' ? 'Quotation resubmitted' : 'New quotation pending approval',
        message: `${q.quotationNo} from ${q.customerCompany} (${q.grandTotal.toString()} ${q.currency})`,
        link: `/approver/quotations/${q.id}`,
        metadata: { quotationId: q.id, quotationNo: q.quotationNo },
      });

      return q;
    });

    await logActivity(prisma, {
      userId,
      action,
      entityType: 'Quotation',
      entityId: updated.id,
      description: `${action === 'RESUBMIT' ? 'Resubmitted' : 'Submitted'} quotation ${updated.quotationNo}`,
      req,
    });

    return updated;
  },

  // ============================================================
  // APPROVE (PENDING → APPROVED + auto-create SaleOrder)
  // ============================================================
  async approve(id: string, input: ApproveQuotationInput, approverId: string, req?: Request) {
    const existing = await prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

    if (existing.status !== 'PENDING') {
      throw new AppError(
        409,
        'INVALID_STATUS',
        `Only PENDING quotations can be approved (current: ${existing.status})`,
      );
    }

    if (new Date(existing.expiryDate) < new Date()) {
      // Mark as expired and reject
      await prisma.quotation.update({
        where: { id },
        data: { status: 'EXPIRED' },
      });
      throw new AppError(409, 'EXPIRED', 'Cannot approve expired quotation');
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update quotation
      const quotation = await tx.quotation.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedById: approverId,
        },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });

      // 2. Add comment if provided
      if (input.comment) {
        await tx.quotationComment.create({
          data: { quotationId: id, userId: approverId, message: input.comment, isInternal: false },
        });
      }

      // 3. AUTO-CREATE SALE ORDER (snapshot)
      const saleOrderNo = await generateDocumentNumber(tx, 'SO');

      const saleOrder = await tx.saleOrder.create({
        data: {
          saleOrderNo,
          quotationId: quotation.id,
          status: 'PENDING',
          issueDate: new Date(),
          currency: quotation.currency,

          customerId: quotation.customerId,
          customerContactName: quotation.customerContactName,
          customerCompany: quotation.customerCompany,
          customerTaxId: quotation.customerTaxId,
          customerEmail: quotation.customerEmail,
          customerPhone: quotation.customerPhone,
          customerBillingAddress: quotation.customerBillingAddress,
          customerShippingAddress: quotation.customerShippingAddress,

          subtotal: quotation.subtotal,
          discountTotal: quotation.discountTotal,
          vatEnabled: quotation.vatEnabled,
          vatRate: quotation.vatRate,
          vatAmount: quotation.vatAmount,
          grandTotal: quotation.grandTotal,

          paymentTerms: quotation.paymentTerms,
          conditions: quotation.conditions,

          createdById: approverId,

          items: {
            create: quotation.items.map((item) => ({
              productId: item.productId,
              productSku: item.productSku,
              productName: item.productName,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              discount: item.discount,
              discountType: item.discountType,
              lineTotal: item.lineTotal,
              sortOrder: item.sortOrder,
            })),
          },
        },
      });

      // 4. Notify Sales user
      await createNotification(tx, {
        userId: quotation.createdById,
        type: 'QUOTATION_APPROVED',
        title: 'Quotation approved ✓',
        message: `${quotation.quotationNo} has been approved. Sale Order ${saleOrder.saleOrderNo} created.`,
        link: `/sales/quotations/${quotation.id}`,
        metadata: { quotationId: quotation.id, saleOrderId: saleOrder.id },
      });

      await createNotification(tx, {
        userId: quotation.createdById,
        type: 'SALE_ORDER_CREATED',
        title: 'New Sale Order created',
        message: `Sale Order ${saleOrder.saleOrderNo} from ${quotation.quotationNo}`,
        link: `/sales/sale-orders/${saleOrder.id}`,
        metadata: { saleOrderId: saleOrder.id, quotationId: quotation.id },
      });

      return { quotation, saleOrder };
    });

    await logActivity(prisma, {
      userId: approverId,
      action: 'APPROVE',
      entityType: 'Quotation',
      entityId: id,
      description: `Approved quotation ${result.quotation.quotationNo}, created Sale Order ${result.saleOrder.saleOrderNo}`,
      req,
    });

    return result;
  },

  // ============================================================
  // REJECT (PENDING → REJECTED, requires reason)
  // ============================================================
  async reject(id: string, input: RejectQuotationInput, approverId: string, req?: Request) {
    const existing = await prisma.quotation.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

    if (existing.status !== 'PENDING') {
      throw new AppError(
        409,
        'INVALID_STATUS',
        `Only PENDING quotations can be rejected (current: ${existing.status})`,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectionReason: input.reason,
        },
        include: quotationDetailInclude,
      });

      // Add rejection as a comment for visibility
      await tx.quotationComment.create({
        data: {
          quotationId: id,
          userId: approverId,
          message: `[Rejected] ${input.reason}`,
          isInternal: false,
        },
      });

      // Notify Sales
      await createNotification(tx, {
        userId: q.createdById,
        type: 'QUOTATION_REJECTED',
        title: 'Quotation rejected',
        message: `${q.quotationNo} was rejected. Reason: ${input.reason}`,
        link: `/sales/quotations/${q.id}`,
        metadata: { quotationId: q.id },
      });

      return q;
    });

    await logActivity(prisma, {
      userId: approverId,
      action: 'REJECT',
      entityType: 'Quotation',
      entityId: id,
      description: `Rejected quotation ${updated.quotationNo}: ${input.reason}`,
      req,
    });

    return updated;
  },

  // ============================================================
  // CANCEL (Sales owner, DRAFT or PENDING only)
  // ============================================================
  async cancel(id: string, input: CancelQuotationInput, userId: string, req?: Request) {
    const existing = await prisma.quotation.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

    if (existing.createdById !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'You can only cancel your own quotations');
    }

    if (!['DRAFT', 'PENDING'].includes(existing.status)) {
      throw new AppError(
        409,
        'INVALID_STATUS',
        `Cannot cancel quotation with status ${existing.status}`,
      );
    }

    const updated = await prisma.quotation.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: input.reason,
      },
      include: quotationDetailInclude,
    });

    // If was PENDING, notify approvers that it's no longer needed
    if (existing.status === 'PENDING') {
      await notifyByRole(prisma, 'APPROVER', {
        type: 'QUOTATION_CANCELLED',
        title: 'Quotation cancelled',
        message: `${updated.quotationNo} has been cancelled by the sales rep`,
        link: `/approver/quotations/${updated.id}`,
        metadata: { quotationId: updated.id },
      });
    }

    await logActivity(prisma, {
      userId,
      action: 'CANCEL',
      entityType: 'Quotation',
      entityId: id,
      description: `Cancelled quotation ${updated.quotationNo}: ${input.reason}`,
      req,
    });

    return updated;
  },

  // ============================================================
  // VERSIONS
  // ============================================================
  async getVersions(id: string, currentUser: { id: string; role: UserRole }) {
    await this.getById(id, currentUser); // permission check

    const versions = await prisma.quotationVersion.findMany({
      where: { quotationId: id },
      orderBy: { version: 'desc' },
    });

    return versions;
  },

  // ============================================================
  // COMMENTS
  // ============================================================
  async getComments(id: string, currentUser: { id: string; role: UserRole }) {
    await this.getById(id, currentUser);

    const comments = await prisma.quotationComment.findMany({
      where: {
        quotationId: id,
        // Hide internal comments from Sales
        ...(currentUser.role === 'SALES' && { isInternal: false }),
      },
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return comments;
  },

  async addComment(
    id: string,
    input: AddCommentInput,
    user: { id: string; role: UserRole },
    req?: Request,
  ) {
    await this.getById(id, user); // permission check

    // Sales cannot post internal comments
    const isInternal = user.role === 'SALES' ? false : input.isInternal;

    const comment = await prisma.quotationComment.create({
      data: {
        quotationId: id,
        userId: user.id,
        message: input.message,
        isInternal,
      },
      include: { user: { select: { id: true, name: true, role: true } } },
    });

    return comment;
  },
};
