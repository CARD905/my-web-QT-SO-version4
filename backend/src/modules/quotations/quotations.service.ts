import { Prisma, QuotationStatus } from '@prisma/client';
import { Request } from 'express';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/response';
import { buildPaginationMeta, getPaginationParams } from '../../utils/pagination';
import { logActivity } from '../../utils/activity-log';
import { createNotification, notifyByRole } from '../../utils/notification';
import { generateDocumentNumber } from '../../utils/number-generator';
import { calcQuotation } from '../../utils/calc';
import { buildScopeFilter, canActOnEntity } from '../../utils/scope-filter';

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

interface CurrentUser {
  id: string;
  roleCode: string;
  roleId: string;
}

const quotationDetailInclude = {
  items: { orderBy: { sortOrder: 'asc' as const } },
  customer: { select: { id: true, company: true, contactName: true } },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: { select: { code: true, nameTh: true } },
    },
  },
  approvedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: { select: { code: true, nameTh: true } },
    },
  },
  saleOrder: { select: { id: true, saleOrderNo: true, status: true } },
  comments: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: { select: { code: true, nameTh: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' as const },
    take: 50,
  },
  _count: { select: { versions: true, attachments: true } },
} satisfies Prisma.QuotationInclude;

function isOfficer(roleCode: string): boolean {
  return roleCode === 'OFFICER' || roleCode === 'SALES';
}

function isManager(roleCode: string): boolean {
  return roleCode === 'MANAGER' || roleCode === 'ADMIN' || roleCode === 'CEO';
}

export const quotationsService = {
  // ============================================================
  // LIST
  // ============================================================
  async list(query: ListQuotationsQuery, currentUser: CurrentUser) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.QuotationWhereInput = { deletedAt: null };

    // Apply scope filter based on user's permissions
    const scopeFilter = await buildScopeFilter(
      currentUser,
      'quotation',
      'view',
      'createdById',
    );

    if (!scopeFilter) {
      // No permission to view any
      return { data: [], meta: buildPaginationMeta(0, page, limit) };
    }

    Object.assign(where, scopeFilter);

    // Drill-down filter (Manager/Admin only — restricted by scope filter above)
    if (query.createdById) {
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
  async getById(id: string, currentUser: CurrentUser) {
    const quotation = await prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      include: quotationDetailInclude,
    });

    if (!quotation) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

  const canView = await canActOnEntity(
    currentUser,
    'quotation',
    'view',
    quotation.createdById,
  );
  if (!canView) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this quotation');
  }

    // Auto-mark as expired if past expiry date
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
  // CREATE
  // ============================================================
  async create(input: CreateQuotationInput, userId: string, req?: Request) {
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
              productDescription: item.description || null,
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
      action: 'quotation.create',
      entityType: 'Quotation',
      entityId: quotation.id,
      description: `Created quotation ${quotation.quotationNo}`,
      req,
    });

    return quotation;
  },

  // ============================================================
  // UPDATE
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
      // Save current snapshot
      await tx.quotationVersion.create({
        data: {
          quotationId: existing.id,
          versionNumber: existing.version,
          snapshot: existing as unknown as Prisma.InputJsonValue,
          changedById: userId,
          changeReason: input.changeReason,
        },
      });

      await tx.quotationItem.deleteMany({ where: { quotationId: id } });

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
              productDescription: item.description || null,
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
      action: 'quotation.update',
      entityType: 'Quotation',
      entityId: updated.id,
      description: `Updated quotation ${updated.quotationNo} (v${updated.version})`,
      req,
    });

    return updated;
  },

  // ============================================================
  // SUBMIT
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

    // Determine target status based on grand total vs MANAGER role default limit
    const managerRole = await prisma.role.findUnique({ where: { code: 'MANAGER' } });
    const approverLimit = Number(managerRole?.defaultApprovalLimit ?? HIGH_VALUE_THRESHOLD);
    const grandTotal = Number(existing.grandTotal);
    const exceedsLimit = grandTotal > approverLimit;
    const targetStatus: QuotationStatus = exceedsLimit ? 'PENDING_ESCALATED' : 'PENDING';

    const isResubmit = existing.status === 'REJECTED';

    const updated = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.update({
        where: { id },
        data: { status: targetStatus, submittedAt: new Date() },
        include: quotationDetailInclude,
      });

      if (input.comment) {
        await tx.quotationComment.create({
          data: { quotationId: id, userId, message: input.comment, isInternal: false },
        });
      }

      // Notify the right role
      const notifyRoleCode = exceedsLimit ? 'CEO' : 'MANAGER';
      const notifyTitle = exceedsLimit
        ? `🔥 High-value quotation (>${approverLimit.toLocaleString()})`
        : isResubmit
          ? 'Quotation resubmitted'
          : 'New quotation pending approval';

      await notifyByRole(tx, notifyRoleCode, {
        type: exceedsLimit
          ? 'QUOTATION_ESCALATED'
          : isResubmit
            ? 'QUOTATION_RESUBMITTED'
            : 'QUOTATION_SUBMITTED',
        title: notifyTitle,
        message: `${q.quotationNo} from ${q.customerCompany} (${q.grandTotal.toString()} ${q.currency})`,
        link: `/quotations/${q.id}`,
        metadata: { quotationId: q.id, exceedsLimit },
      });

      return q;
    });

    await logActivity(prisma, {
      userId,
      action: isResubmit ? 'quotation.resubmit' : 'quotation.submit',
      entityType: 'Quotation',
      entityId: updated.id,
      description: `${isResubmit ? 'Resubmitted' : 'Submitted'} quotation ${updated.quotationNo}${
        exceedsLimit ? ' (exceeds limit, escalated)' : ''
      }`,
      req,
    });

    return updated;
  },

  // ============================================================
  // APPROVE
  // ============================================================
  async approve(id: string, input: ApproveQuotationInput, approverId: string, req?: Request) {
    const existing = await prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

    const approverUser = await prisma.user.findUnique({
      where: { id: approverId },
      include: { role: true },
    });
    if (!approverUser) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Approver not found');
    }

    const approverRoleCode = approverUser.role.code;
    const isMgrOrAbove =
      approverRoleCode === 'MANAGER' ||
      approverRoleCode === 'ADMIN' ||
      approverRoleCode === 'CEO';

    if (existing.status === 'PENDING_ESCALATED' && !isMgrOrAbove) {
      throw new AppError(
        403,
        'INSUFFICIENT_AUTHORITY',
        'This quotation requires Manager-level approval',
      );
    }

    if (
      existing.status !== 'PENDING' &&
      existing.status !== 'PENDING_ESCALATED' &&
      existing.status !== 'PENDING_BACKUP'
    ) {
      throw new AppError(
        409,
        'INVALID_STATUS',
        `Only pending quotations can be approved (current: ${existing.status})`,
      );
    }

    // Defensive limit check (using Role default)
    const managerRole = await prisma.role.findUnique({ where: { code: 'MANAGER' } });
    const approverLimit = Number(managerRole?.defaultApprovalLimit ?? HIGH_VALUE_THRESHOLD);
    if (
      approverRoleCode === 'MANAGER' &&
      Number(existing.grandTotal) > approverLimit
    ) {
      throw new AppError(
        403,
        'EXCEEDS_LIMIT',
        `Quotation exceeds your approval limit (${approverLimit.toLocaleString()})`,
      );
    }

    if (new Date(existing.expiryDate) < new Date()) {
      await prisma.quotation.update({
        where: { id },
        data: { status: 'EXPIRED' },
      });
      throw new AppError(409, 'EXPIRED', 'Cannot approve expired quotation');
    }

    const result = await prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedById: approverId,
        },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });

      if (input.comment) {
        await tx.quotationComment.create({
          data: { quotationId: id, userId: approverId, message: input.comment, isInternal: false },
        });
      }

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

          items: {
            create: quotation.items.map((item) => ({
              productId: item.productId,
              productSku: item.productSku,
              productName: item.productName,
              productDescription: item.productDescription,
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

      await createNotification(tx, {
        userId: quotation.createdById,
        type: 'QUOTATION_APPROVED',
        title: 'Quotation approved ✓',
        message: `${quotation.quotationNo} has been approved. Sale Order ${saleOrder.saleOrderNo} created.`,
        link: `/quotations/${quotation.id}`,
        metadata: { quotationId: quotation.id, saleOrderId: saleOrder.id },
      });

      await createNotification(tx, {
        userId: quotation.createdById,
        type: 'SALE_ORDER_CREATED',
        title: 'New Sale Order created',
        message: `Sale Order ${saleOrder.saleOrderNo} from ${quotation.quotationNo}`,
        link: `/sale-orders/${saleOrder.id}`,
        metadata: { saleOrderId: saleOrder.id, quotationId: quotation.id },
      });

      return { quotation, saleOrder };
    });

    await logActivity(prisma, {
      userId: approverId,
      action: 'quotation.approve',
      entityType: 'Quotation',
      entityId: id,
      description: `Approved quotation ${result.quotation.quotationNo}, created Sale Order ${result.saleOrder.saleOrderNo}`,
      req,
    });

    return result;
  },

  // ============================================================
  // REJECT
  // ============================================================
  async reject(id: string, input: RejectQuotationInput, approverId: string, req?: Request) {
    const existing = await prisma.quotation.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

    if (
      existing.status !== 'PENDING' &&
      existing.status !== 'PENDING_ESCALATED' &&
      existing.status !== 'PENDING_BACKUP'
    ) {
      throw new AppError(
        409,
        'INVALID_STATUS',
        `Only pending quotations can be rejected (current: ${existing.status})`,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          rejectedById: approverId,
          rejectionReason: input.reason,
        },
        include: quotationDetailInclude,
      });

      await tx.quotationComment.create({
        data: {
          quotationId: id,
          userId: approverId,
          message: `[Rejected] ${input.reason}`,
          isInternal: false,
        },
      });

      await createNotification(tx, {
        userId: q.createdById,
        type: 'QUOTATION_REJECTED',
        title: 'Quotation rejected',
        message: `${q.quotationNo} was rejected. Reason: ${input.reason}`,
        link: `/quotations/${q.id}`,
        metadata: { quotationId: q.id },
      });

      return q;
    });

    await logActivity(prisma, {
      userId: approverId,
      action: 'quotation.reject',
      entityType: 'Quotation',
      entityId: id,
      description: `Rejected quotation ${updated.quotationNo}: ${input.reason}`,
      req,
    });

    return updated;
  },

  // ============================================================
  // CANCEL
  // ============================================================
  async cancel(id: string, input: CancelQuotationInput, userId: string, req?: Request) {
    const existing = await prisma.quotation.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

    if (existing.createdById !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'You can only cancel your own quotations');
    }

    if (!['DRAFT', 'PENDING', 'PENDING_BACKUP', 'PENDING_ESCALATED'].includes(existing.status)) {
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
        cancelledReason: input.reason,
      },
      include: quotationDetailInclude,
    });

    if (existing.status !== 'DRAFT') {
      await notifyByRole(prisma, 'MANAGER', {
        type: 'QUOTATION_CANCELLED',
        title: 'Quotation cancelled',
        message: `${updated.quotationNo} has been cancelled by the officer`,
        link: `/quotations/${updated.id}`,
        metadata: { quotationId: updated.id },
      });
    }

    await logActivity(prisma, {
      userId,
      action: 'quotation.cancel',
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
  async getVersions(id: string, currentUser: CurrentUser) {
    await this.getById(id, currentUser);

    const versions = await prisma.quotationVersion.findMany({
      where: { quotationId: id },
      orderBy: { versionNumber: 'desc' },
    });

    return versions;
  },

  // ============================================================
  // COMMENTS
  // ============================================================
  async getComments(id: string, currentUser: CurrentUser) {
    await this.getById(id, currentUser);

    const comments = await prisma.quotationComment.findMany({
      where: {
        quotationId: id,
        ...(isOfficer(currentUser.roleCode) && { isInternal: false }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: { select: { code: true, nameTh: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return comments;
  },

  async addComment(
    id: string,
    input: AddCommentInput,
    user: CurrentUser,
    req?: Request,
  ) {
    await this.getById(id, user);

    const isInternal = isOfficer(user.roleCode) ? false : input.isInternal;

    const comment = await prisma.quotationComment.create({
      data: {
        quotationId: id,
        userId: user.id,
        message: input.message,
        isInternal,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: { select: { code: true, nameTh: true } },
          },
        },
      },
    });

    return comment;
  },
};