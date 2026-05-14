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

const NORMAL_DISCOUNT_MAX = 20;
const SPECIAL_DISCOUNT_MAX = 50;
const HIGH_VALUE_THRESHOLD = 100000;
const EXPIRING_SOON_DAYS = 7;

export interface CurrentUser {
  id: string;
  roleCode: string;
  roleId: string;
  name: string;
  email: string;
}

const quotationDetailInclude = {
  items: { orderBy: { sortOrder: 'asc' as const } },
  customer: { select: { id: true, company: true, contactName: true } },
  createdBy: {
    select: {
      id: true, name: true, email: true,
      role: { select: { code: true, nameTh: true } },
    },
  },
  approvedBy: {
    select: {
      id: true, name: true, email: true,
      role: { select: { code: true, nameTh: true } },
    },
  },
  saleOrder: { select: { id: true, saleOrderNo: true, status: true } },
  comments: {
    include: {
      user: {
        select: {
          id: true, name: true,
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

export const quotationsService = {
  // ============================================================
  // LIST
  // ============================================================
  async list(query: ListQuotationsQuery, currentUser: CurrentUser) {
    const { skip, take, page, limit } = getPaginationParams(query);
    const where: Prisma.QuotationWhereInput = { deletedAt: null };

    const scopeFilter = await buildScopeFilter(currentUser, 'quotation', 'view', 'createdById');
    if (!scopeFilter) return { data: [], meta: buildPaginationMeta(0, page, limit) };
    Object.assign(where, scopeFilter);

    if (query.createdById) where.createdById = query.createdById;
    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;

    if (query.expiringSoon) {
      const now = new Date();
      const future = new Date();
      future.setDate(future.getDate() + EXPIRING_SOON_DAYS);
      where.expiryDate = { gte: now, lte: future };
      where.status = where.status ?? 'PENDING';
    }

    if (query.highValue) where.grandTotal = { gte: HIGH_VALUE_THRESHOLD };

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
        where, orderBy, skip, take,
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

    const canView = await canActOnEntity(currentUser, 'quotation', 'view', quotation.createdById);
    if (!canView) throw new AppError(403, 'FORBIDDEN', 'You do not have access to this quotation');

    if (
      (quotation.status === 'DRAFT' || quotation.status === 'PENDING') &&
      new Date(quotation.expiryDate) < new Date()
    ) {
      return prisma.quotation.update({
        where: { id },
        data: { status: 'EXPIRED' },
        include: quotationDetailInclude,
      });
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
        quantity: i.quantity, unitPrice: i.unitPrice,
        discount: i.discount, discountType: i.discountType,
      })),
      input.vatEnabled,
      input.vatRate,
    );

    const quotation = await prisma.$transaction(async (tx) => {
      const quotationNo = await generateDocumentNumber(tx, 'QT');
      return tx.quotation.create({
        data: {
          quotationNo, status: 'DRAFT',
          issueDate: input.issueDate, expiryDate: input.expiryDate, currency: input.currency,
          customerId: customer.id,
          customerContactName: customer.contactName,
          customerCompany: customer.company,
          customerTaxId: customer.taxId,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          customerBillingAddress: customer.billingAddress,
          customerShippingAddress: customer.shippingAddress,
          subtotal, discountTotal, vatEnabled: input.vatEnabled,
          vatRate: input.vatRate, vatAmount, grandTotal,
          paymentTerms: input.paymentTerms, conditions: input.conditions,
          createdById: userId,
          items: {
            create: input.items.map((item, idx) => ({
              productId: item.productId || null,
              productSku: item.productSku || null,
              productName: item.productName,
              productDescription: item.description || null,
              quantity: item.quantity, unit: item.unit,
              unitPrice: item.unitPrice, discount: item.discount,
              discountType: item.discountType, lineTotal: itemTotals[idx],
              sortOrder: item.sortOrder ?? idx,
            })),
          },
        },
        include: quotationDetailInclude,
      });
    });

    await logActivity(prisma, {
      userId, action: 'quotation.create', entityType: 'Quotation', entityId: quotation.id,
      description: `Created quotation ${quotation.quotationNo}`, req,
    });

    // ✅ Detect special discount → notify CEO
    const maxPctDiscount = input.items
      .filter((it) => it.discountType === 'PERCENTAGE')
      .reduce((max, it) => Math.max(max, Number(it.discount)), 0);

    if (maxPctDiscount > NORMAL_DISCOUNT_MAX && (input as any).specialDiscountReason) {
      await prisma.quotation.update({
        where: { id: quotation.id },
        data: {
          specialDiscountRequested: true,
          specialDiscountPercent: maxPctDiscount,
          specialDiscountReason: (input as any).specialDiscountReason,
          specialDiscountStatus: 'PENDING_CEO',
        },
      });
      await notifyByRole(prisma, 'CEO', {
        type: 'QUOTATION_SUBMITTED',
        title: `⭐ ขออนุมัติ Special Discount ${maxPctDiscount}%`,
        message: `${quotation.quotationNo} จาก ${quotation.customerCompany} — ${(input as any).specialDiscountReason}`,
        link: `/special-discount/${quotation.id}`,
        metadata: { quotationId: quotation.id, requestedPct: maxPctDiscount },
      });
    }

    return quotation; // ← ปิด create() ถูกต้อง
  },

  // ============================================================
  // UPDATE
  // ============================================================
  async update(id: string, input: UpdateQuotationInput, userId: string, req?: Request) {
    const existing = await prisma.quotation.findFirst({
      where: { id, deletedAt: null }, include: { items: true },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');
    if (existing.createdById !== userId) throw new AppError(403, 'FORBIDDEN', 'You can only edit your own quotations');
    if (!['DRAFT', 'REJECTED'].includes(existing.status)) {
      throw new AppError(409, 'INVALID_STATUS', `Cannot edit quotation with status ${existing.status}`);
    // ✅ Block submit ถ้า Special Discount ยัง PENDING_CEO
    if ((existing as any).specialDiscountRequested && (existing as any).specialDiscountStatus === 'PENDING_CEO') {
      throw new AppError(
        409,
        'SPECIAL_DISCOUNT_PENDING',
        'ไม่สามารถส่งขออนุมัติได้ — รอ CEO ตอบกลับคำขอ Special Discount ก่อน',
      );
    }
    }

    const customer = await prisma.customer.findFirst({ where: { id: input.customerId, deletedAt: null } });
    if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
    if (input.expiryDate < input.issueDate) throw new AppError(400, 'INVALID_DATE', 'Expiry date must be after issue date');

    const { subtotal, discountTotal, vatAmount, grandTotal, itemTotals } = calcQuotation(
      input.items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount, discountType: i.discountType })),
      input.vatEnabled, input.vatRate,
    );

    const updated = await prisma.$transaction(async (tx) => {
      await tx.quotationVersion.create({
        data: {
          quotationId: existing.id, versionNumber: existing.version,
          snapshot: existing as unknown as Prisma.InputJsonValue,
          changedById: userId, changeReason: input.changeReason,
        },
      });
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });

      const newStatus: QuotationStatus = existing.status === 'REJECTED' ? 'DRAFT' : existing.status;

      return tx.quotation.update({
        where: { id },
        data: {
          version: existing.version + 1, status: newStatus,
          issueDate: input.issueDate, expiryDate: input.expiryDate, currency: input.currency,
          customerId: customer.id, customerContactName: customer.contactName,
          customerCompany: customer.company, customerTaxId: customer.taxId,
          customerEmail: customer.email, customerPhone: customer.phone,
          customerBillingAddress: customer.billingAddress, customerShippingAddress: customer.shippingAddress,
          subtotal, discountTotal, vatEnabled: input.vatEnabled, vatRate: input.vatRate, vatAmount, grandTotal,
          paymentTerms: input.paymentTerms, conditions: input.conditions,
          ...(existing.status === 'REJECTED' && { rejectedAt: null, rejectionReason: null, submittedAt: null }),
          items: {
            create: input.items.map((item, idx) => ({
              productId: item.productId || null, productSku: item.productSku || null,
              productName: item.productName, productDescription: item.description || null,
              quantity: item.quantity, unit: item.unit, unitPrice: item.unitPrice,
              discount: item.discount, discountType: item.discountType,
              lineTotal: itemTotals[idx], sortOrder: item.sortOrder ?? idx,
            })),
          },
        },
        include: quotationDetailInclude,
      });
    });

    await logActivity(prisma, {
      userId, action: 'quotation.update', entityType: 'Quotation', entityId: updated.id,
      description: `Updated quotation ${updated.quotationNo} (v${updated.version})`, req,
    });

    return updated;
  },

  // ============================================================
  // SUBMIT
  // ============================================================
  async submit(id: string, input: SubmitQuotationInput, userId: string, req?: Request) {
    const existing = await prisma.quotation.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');
    if (existing.createdById !== userId) throw new AppError(403, 'FORBIDDEN', 'You can only submit your own quotations');
    if (!['DRAFT', 'REJECTED'].includes(existing.status)) {
      throw new AppError(409, 'INVALID_STATUS', `Cannot submit quotation with status ${existing.status}`);
    }
    if (new Date(existing.expiryDate) < new Date()) {
      throw new AppError(409, 'EXPIRED', 'Quotation has expired. Please update expiry date first.');
    }

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
      await notifyByRole(tx, exceedsLimit ? 'CEO' : 'MANAGER', {
        type: exceedsLimit ? 'QUOTATION_ESCALATED' : isResubmit ? 'QUOTATION_RESUBMITTED' : 'QUOTATION_SUBMITTED',
        title: exceedsLimit ? `🔥 High-value quotation (>${approverLimit.toLocaleString()})` : isResubmit ? 'Quotation resubmitted' : 'New quotation pending approval',
        message: `${q.quotationNo} from ${q.customerCompany} (${q.grandTotal.toString()} ${q.currency})`,
        link: `/quotations/${q.id}`,
        metadata: { quotationId: q.id, exceedsLimit },
      });
      return q;
    });

    await logActivity(prisma, {
      userId, action: isResubmit ? 'quotation.resubmit' : 'quotation.submit',
      entityType: 'Quotation', entityId: updated.id,
      description: `${isResubmit ? 'Resubmitted' : 'Submitted'} quotation ${updated.quotationNo}${exceedsLimit ? ' (exceeds limit, escalated)' : ''}`,
      req,
    });

    return updated;
  },

  // ============================================================
  // APPROVE
  // ============================================================
  async approve(id: string, input: ApproveQuotationInput | string, approverId: string, req?: Request) {
    const approveInput: ApproveQuotationInput = typeof input === 'string' ? { comment: input } : input;
    const existing = await prisma.quotation.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

    const approverUser = await prisma.user.findUnique({ where: { id: approverId }, include: { role: true } });
    if (!approverUser) throw new AppError(404, 'USER_NOT_FOUND', 'Approver not found');
    const approverRoleCode = approverUser.role.code;

    if (existing.status === 'PENDING_ESCALATED') {
      if (approverRoleCode === 'OFFICER') throw new AppError(403, 'INSUFFICIENT_AUTHORITY', 'This quotation requires CEO/Admin approval');
      if (approverRoleCode === 'MANAGER') throw new AppError(403, 'EXCEEDS_LIMIT', 'รายการนี้เกินอำนาจอนุมัติของคุณ ต้องรอ CEO/Admin อนุมัติ');
    }

    if (!['PENDING', 'PENDING_ESCALATED', 'PENDING_BACKUP'].includes(existing.status)) {
      throw new AppError(409, 'INVALID_STATUS', `Only pending quotations can be approved (current: ${existing.status})`);
    }

    const managerRole = await prisma.role.findUnique({ where: { code: 'MANAGER' } });
    const approverLimit = Number(managerRole?.defaultApprovalLimit ?? HIGH_VALUE_THRESHOLD);
    if (approverRoleCode === 'MANAGER' && Number(existing.grandTotal) > approverLimit) {
      throw new AppError(403, 'EXCEEDS_LIMIT', `Quotation exceeds your approval limit (${approverLimit.toLocaleString()})`);
    }

    if (new Date(existing.expiryDate) < new Date()) {
      await prisma.quotation.update({ where: { id }, data: { status: 'EXPIRED' } });
      throw new AppError(409, 'EXPIRED', 'Cannot approve expired quotation');
    }

    const quotation = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.update({
        where: { id },
        data: { status: 'APPROVED', approvedAt: new Date(), approvedById: approverId },
        include: quotationDetailInclude,
      });
      if (approveInput.comment) {
        await tx.quotationComment.create({
          data: { quotationId: id, userId: approverId, message: approveInput.comment, isInternal: false },
        });
      }
      await createNotification(tx, {
        userId: q.createdById, type: 'QUOTATION_APPROVED',
        title: 'Quotation อนุมัติแล้ว ✓',
        message: `${q.quotationNo} อนุมัติแล้ว — กรุณาอัปโหลดใบ PO ที่หน้า Checklist`,
        link: `/quotations/checklist/${q.id}`,
        metadata: { quotationId: q.id },
      });
      return q;
    });

    await logActivity(prisma, {
      userId: approverId, action: 'quotation.approve', entityType: 'Quotation', entityId: id,
      description: `Approved quotation ${quotation.quotationNo} → awaiting PO upload`, req,
    });

    return quotation;
  },

  // ============================================================
  // REJECT
  // ============================================================
  async reject(id: string, input: RejectQuotationInput, approverId: string, req?: Request) {
    const existing = await prisma.quotation.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');
    if (!['PENDING', 'PENDING_ESCALATED', 'PENDING_BACKUP'].includes(existing.status)) {
      throw new AppError(409, 'INVALID_STATUS', `Only pending quotations can be rejected (current: ${existing.status})`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.update({
        where: { id },
        data: { status: 'REJECTED', rejectedAt: new Date(), rejectedById: approverId, rejectionReason: input.reason },
        include: quotationDetailInclude,
      });
      await tx.quotationComment.create({
        data: { quotationId: id, userId: approverId, message: `[Rejected] ${input.reason}`, isInternal: false },
      });
      await createNotification(tx, {
        userId: q.createdById, type: 'QUOTATION_REJECTED', title: 'Quotation rejected',
        message: `${q.quotationNo} was rejected. Reason: ${input.reason}`,
        link: `/quotations/${q.id}`, metadata: { quotationId: q.id },
      });
      return q;
    });

    await logActivity(prisma, {
      userId: approverId, action: 'quotation.reject', entityType: 'Quotation', entityId: id,
      description: `Rejected quotation ${updated.quotationNo}: ${input.reason}`, req,
    });

    return updated;
  },

  // ============================================================
  // CANCEL
  // ============================================================
  async cancel(id: string, input: CancelQuotationInput, userId: string, req?: Request) {
    const existing = await prisma.quotation.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');
    if (existing.createdById !== userId) throw new AppError(403, 'FORBIDDEN', 'You can only cancel your own quotations');
    if (!['DRAFT'].includes(existing.status)) {
      throw new AppError(409, 'INVALID_STATUS', `Only DRAFT quotations can be cancelled. Current: ${existing.status}`);
    }

    const updated = await prisma.quotation.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledReason: input.reason },
      include: quotationDetailInclude,
    });

    await logActivity(prisma, {
      userId, action: 'quotation.cancel', entityType: 'Quotation', entityId: id,
      description: `Cancelled DRAFT quotation ${updated.quotationNo}: ${input.reason}`, req,
    });

    return updated;
  },

  // ============================================================
  // BULK APPROVE
  // ============================================================
  async bulkApprove(ids: string[], currentUser: CurrentUser) {
    const result = {
      succeeded: [] as Array<{ id: string; quotationNo: string }>,
      failed: [] as Array<{ id: string; quotationNo?: string; reason: string }>,
    };

    const quotations = await prisma.quotation.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, quotationNo: true, status: true },
    });
    const qMap = new Map(quotations.map((q) => [q.id, q]));

    for (const id of ids) {
      const q = qMap.get(id);
      if (!q) { result.failed.push({ id, reason: 'Not found' }); continue; }
      if (!['PENDING', 'PENDING_ESCALATED'].includes(q.status)) {
        result.failed.push({ id, quotationNo: q.quotationNo, reason: `Cannot approve status ${q.status}` });
        continue;
      }
      try {
        await this.approve(id, 'Bulk approved', currentUser.id);
        result.succeeded.push({ id, quotationNo: q.quotationNo });
      } catch (err: any) {
        result.failed.push({ id, quotationNo: q.quotationNo, reason: err?.message || 'Unknown error' });
      }
    }

    await logActivity(prisma, {
      userId: currentUser.id, action: 'quotation.bulkApprove', entityType: 'Quotation',
      description: `Bulk approved ${result.succeeded.length}/${ids.length} quotations`,
    });

    return result;
  },

  // ============================================================
  // VERSIONS
  // ============================================================
  async getVersions(id: string, currentUser: CurrentUser) {
    await this.getById(id, currentUser);
    return prisma.quotationVersion.findMany({
      where: { quotationId: id }, orderBy: { versionNumber: 'desc' },
    });
  },

  // ============================================================
  // COMMENTS
  // ============================================================
  async getComments(id: string, currentUser: CurrentUser) {
    await this.getById(id, currentUser);
    return prisma.quotationComment.findMany({
      where: { quotationId: id, ...(isOfficer(currentUser.roleCode) && { isInternal: false }) },
      include: {
        user: { select: { id: true, name: true, role: { select: { code: true, nameTh: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  async addComment(id: string, input: AddCommentInput, user: CurrentUser, req?: Request) {
    const existing = await prisma.quotation.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

    const allowCommentStatuses: QuotationStatus[] = ['PENDING', 'PENDING_ESCALATED', 'PENDING_BACKUP', 'PO_PENDING'];
    if (!allowCommentStatuses.includes(existing.status)) {
      throw new AppError(409, 'INVALID_STATUS', `Cannot comment when status is ${existing.status}.`);
    }

    await this.getById(id, user);
    const isInternal = isOfficer(user.roleCode) ? false : input.isInternal;

    return prisma.quotationComment.create({
      data: { quotationId: id, userId: user.id, message: input.message, isInternal },
      include: {
        user: { select: { id: true, name: true, role: { select: { code: true, nameTh: true } } } },
      },
    });
  },

  async deleteComment(commentId: string, currentUser: CurrentUser) {
    const comment = await prisma.quotationComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new AppError(404, 'NOT_FOUND', 'Comment not found');
    const isOwner = comment.userId === currentUser.id;
    const isAdmin = currentUser.roleCode === 'ADMIN' || currentUser.roleCode === 'CEO';
    if (!isOwner && !isAdmin) throw new AppError(403, 'FORBIDDEN', 'Cannot delete other users comment');
    await prisma.quotationComment.delete({ where: { id: commentId } });
  },

  // ============================================================
  // ✅ SPECIAL DISCOUNT — CEO/Admin
  // ============================================================
  async listSpecialDiscountRequests(currentUser: CurrentUser) {
    return prisma.quotation.findMany({
      where: { deletedAt: null, specialDiscountRequested: true, specialDiscountStatus: 'PENDING_CEO' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, quotationNo: true, customerCompany: true, grandTotal: true, currency: true,
        specialDiscountPercent: true, specialDiscountReason: true, specialDiscountStatus: true, createdAt: true,
        createdBy: { select: { id: true, name: true, email: true } },
        items: { select: { productName: true, discount: true, discountType: true, lineTotal: true } },
      },
    });
  },

  async approveSpecialDiscount(id: string, currentUser: CurrentUser, req?: Request) {
    if (!['CEO'].includes(currentUser.roleCode)) {
      throw new AppError(403, 'FORBIDDEN', 'Only CEO/Admin can approve special discounts');
    }
    const q = await prisma.quotation.findFirst({ where: { id, deletedAt: null } });
    if (!q) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');
    if ((q as any).specialDiscountStatus !== 'PENDING_CEO') {
      throw new AppError(409, 'INVALID_STATUS', 'No pending special discount request');
    }

    const updated = await prisma.quotation.update({
      where: { id },
      data: {
        specialDiscountStatus: 'APPROVED',
        specialDiscountFinalPct: (q as any).specialDiscountPercent,
        specialDiscountById: currentUser.id,
        specialDiscountAt: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        userId: q.createdById, type: 'QUOTATION_APPROVED' as any,
        title: '✅ Special Discount อนุมัติแล้ว',
        message: `${q.quotationNo} ได้รับอนุมัติ Special Discount ${(q as any).specialDiscountPercent}% — สามารถส่งขออนุมัติได้เลย`,
        link: `/quotations/${q.id}`,
      },
    });

    await logActivity(prisma, {
      userId: currentUser.id, action: 'quotation.specialDiscount.approve',
      entityType: 'Quotation', entityId: id,
      description: `Approved special discount ${(q as any).specialDiscountPercent}% for ${q.quotationNo}`, req,
    });

    return updated;
  },

  async rejectSpecialDiscount(id: string, currentUser: CurrentUser, req?: Request) {
    if (!['CEO'].includes(currentUser.roleCode)) {
      throw new AppError(403, 'FORBIDDEN', 'Only CEO can reject special discounts');
    }
    const q = await prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!q) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');
    if ((q as any).specialDiscountStatus !== 'PENDING_CEO') {
      throw new AppError(409, 'INVALID_STATUS', 'No pending special discount request');
    }

    const cappedItems = q.items.map((it) => ({
      quantity: Number(it.quantity), unitPrice: Number(it.unitPrice),
      discount: it.discountType === 'PERCENTAGE' && Number(it.discount) > NORMAL_DISCOUNT_MAX
        ? NORMAL_DISCOUNT_MAX : Number(it.discount),
      discountType: it.discountType,
    }));
    const { subtotal, discountTotal, vatAmount, grandTotal, itemTotals } = calcQuotation(
      cappedItems, q.vatEnabled, Number(q.vatRate),
    );

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < q.items.length; i++) {
        await tx.quotationItem.update({
          where: { id: q.items[i].id },
          data: { discount: cappedItems[i].discount, lineTotal: itemTotals[i] },
        });
      }
      await tx.quotation.update({
        where: { id },
        data: {
          subtotal, discountTotal, vatAmount, grandTotal,
          specialDiscountStatus: 'REJECTED',
          specialDiscountFinalPct: NORMAL_DISCOUNT_MAX,
          specialDiscountById: currentUser.id,
          specialDiscountAt: new Date(),
        },
      });
    });

    await prisma.notification.create({
      data: {
        userId: q.createdById, type: 'QUOTATION_REJECTED' as any,
        title: '❌ Special Discount ถูกปฏิเสธ',
        message: `${q.quotationNo} — ส่วนลดถูกปรับเหลือ ${NORMAL_DISCOUNT_MAX}% อัตโนมัติ`,
        link: `/quotations/${q.id}`,
      },
    });

    await logActivity(prisma, {
      userId: currentUser.id, action: 'quotation.specialDiscount.reject',
      entityType: 'Quotation', entityId: id,
      description: `Rejected special discount for ${q.quotationNo} → auto-reduced to ${NORMAL_DISCOUNT_MAX}%`, req,
    });

    return { message: `Special discount rejected. Discounts auto-reduced to ${NORMAL_DISCOUNT_MAX}%` };
  },

  async modifySpecialDiscount(id: string, finalPercent: number, currentUser: CurrentUser, req?: Request) {
    if (!['CEO'].includes(currentUser.roleCode)) {
      throw new AppError(403, 'FORBIDDEN', 'Only CEO can modify special discounts');
    }
    if (finalPercent < 0 || finalPercent > SPECIAL_DISCOUNT_MAX) {
      throw new AppError(400, 'BAD_REQUEST', `Final percent must be between 0 and ${SPECIAL_DISCOUNT_MAX}`);
    }
    const q = await prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!q) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');
    if ((q as any).specialDiscountStatus !== 'PENDING_CEO') {
      throw new AppError(409, 'INVALID_STATUS', 'No pending special discount request');
    }

    const modifiedItems = q.items.map((it) => ({
      quantity: Number(it.quantity), unitPrice: Number(it.unitPrice),
      discount: it.discountType === 'PERCENTAGE' && Number(it.discount) > NORMAL_DISCOUNT_MAX
        ? finalPercent : Number(it.discount),
      discountType: it.discountType,
    }));
    const { subtotal, discountTotal, vatAmount, grandTotal, itemTotals } = calcQuotation(
      modifiedItems, q.vatEnabled, Number(q.vatRate),
    );

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < q.items.length; i++) {
        await tx.quotationItem.update({
          where: { id: q.items[i].id },
          data: { discount: modifiedItems[i].discount, lineTotal: itemTotals[i] },
        });
      }
      await tx.quotation.update({
        where: { id },
        data: {
          subtotal, discountTotal, vatAmount, grandTotal,
          specialDiscountStatus: 'MODIFIED',
          specialDiscountFinalPct: finalPercent,
          specialDiscountById: currentUser.id,
          specialDiscountAt: new Date(),
        },
      });
    });

    await prisma.notification.create({
      data: {
        userId: q.createdById, type: 'QUOTATION_APPROVED' as any,
        title: '🟡 Special Discount ได้รับการปรับ',
        message: `${q.quotationNo} — CEO อนุมัติ ${finalPercent}% (ขอ ${(q as any).specialDiscountPercent}%)`,
        link: `/quotations/${q.id}`,
      },
    });

    await logActivity(prisma, {
      userId: currentUser.id, action: 'quotation.specialDiscount.modify',
      entityType: 'Quotation', entityId: id,
      description: `Modified special discount for ${q.quotationNo}: ${(q as any).specialDiscountPercent}% → ${finalPercent}%`, req,
    });

    return { message: `Special discount modified to ${finalPercent}%` };
  },
};