import { Prisma } from '@prisma/client';
import { Request } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/response';
import { buildPaginationMeta, getPaginationParams } from '../../utils/pagination';
import { logActivity } from '../../utils/activity-log';
import { createNotification, notifyByRole } from '../../utils/notification';
import { calcQuotation } from '../../utils/calc';
import {
  ListSaleOrdersQuery,
  UpdateSaleOrderInput,
  SubmitSaleOrderInput,
  ReviewSaleOrderInput,
} from './sale-orders.schema';
import { buildSaleOrderHtml } from './sale-order.template';
import { generatePdfFromHtml } from './pdf-generator';

interface CurrentUser {
  id: string;
  roleCode: string;
}

const saleOrderInclude = {
  items: { orderBy: { sortOrder: 'asc' as const } },
  customer: { select: { id: true, company: true, contactName: true } },
  quotation: { select: { id: true, quotationNo: true, expiryDate: true, createdById: true, poFileUrl: true } },
} satisfies Prisma.SaleOrderInclude;

function isOfficer(roleCode: string): boolean {
  return roleCode === 'OFFICER' || roleCode === 'SALES';
}

function isManagerOrAbove(roleCode: string): boolean {
  return ['MANAGER', 'ADMIN', 'CEO', 'APPROVER'].includes(roleCode);
}

export const saleOrdersService = {
  async list(query: ListSaleOrdersQuery, currentUser: CurrentUser) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.SaleOrderWhereInput = { deletedAt: null };

    if (isOfficer(currentUser.roleCode)) {
      where.quotation = { createdById: currentUser.id };
    }

    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;

    if (query.search) {
      where.OR = [
        { saleOrderNo: { contains: query.search, mode: 'insensitive' } },
        { customerCompany: { contains: query.search, mode: 'insensitive' } },
        { customerContactName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.SaleOrderOrderByWithRelationInput = query.sortBy
      ? { [query.sortBy]: query.sortOrder }
      : { createdAt: 'desc' };

    const [data, total] = await Promise.all([
      prisma.saleOrder.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          customer: { select: { id: true, company: true } },
          quotation: { select: { id: true, quotationNo: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.saleOrder.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  },

  async getById(id: string, currentUser: CurrentUser) {
    const so = await prisma.saleOrder.findFirst({
      where: { id, deletedAt: null },
      include: saleOrderInclude,
    });

    if (!so) throw new AppError(404, 'NOT_FOUND', 'Sale Order not found');

    if (isOfficer(currentUser.roleCode)) {
      const q = await prisma.quotation.findFirst({
        where: { id: so.quotationId },
        select: { createdById: true },
      });
      if (q?.createdById !== currentUser.id) {
        throw new AppError(403, 'FORBIDDEN', 'You do not have access to this sale order');
      }
    }

    return so;
  },
    async updateDeadline(id: string, deadlineDate: string, currentUser: CurrentUser, req?: Request) {
    const so = await this.getById(id, currentUser);
 
    if (so.status !== 'REJECTED') {
      throw new AppError(409, 'INVALID_STATUS', `Can only edit deadline when status is REJECTED (current: ${so.status})`);
    }
 
    if (so.quotation.createdById !== currentUser.id) {
      throw new AppError(403, 'FORBIDDEN', 'Only the original officer can edit deadline');
    }
 
    const parsed = new Date(deadlineDate);
    if (isNaN(parsed.getTime())) {
      throw new AppError(400, 'BAD_REQUEST', 'Invalid date format');
    }
 
    const updated = await prisma.saleOrder.update({
      where: { id },
      data: { deadlineDate: parsed },
      include: saleOrderInclude,
    });
 
    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'saleOrder.updateDeadline',
      entityType: 'SaleOrder',
      entityId: id,
      description: `Updated deadline for ${updated.saleOrderNo} to ${deadlineDate}`,
      req,
    });
 
    return updated;
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SUBMIT — Officer กด "ส่งให้ Manager อนุมัติ" → PENDING_REVIEW
  // ═══════════════════════════════════════════════════════════════════════
  async submit(id: string, input: SubmitSaleOrderInput, currentUser: CurrentUser, req?: Request) {
    const so = await this.getById(id, currentUser);

    if (so.status !== 'DRAFT') {
      throw new AppError(409, 'INVALID_STATUS', `Can only submit DRAFT sale orders (current: ${so.status})`);
    }

    if (so.quotation.createdById !== currentUser.id) {
      throw new AppError(403, 'FORBIDDEN', 'Only the original officer can submit');
    }

    const updated = await prisma.saleOrder.update({
      where: { id },
      data: { status: 'PENDING_REVIEW' },
      include: saleOrderInclude,
    });

    // Notify Manager
    await notifyByRole(prisma, 'MANAGER', {
      type: 'SALE_ORDER_CREATED',
      title: 'Sale Order รอ อนุมัติ',
      message: `${updated.saleOrderNo} จาก ${updated.customerCompany} รอการอนุมัติ`,
      link: `/sale-orders/${updated.id}`,
      metadata: { saleOrderId: updated.id },
    });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'saleOrder.submit',
      entityType: 'SaleOrder',
      entityId: id,
      description: `Submitted sale order ${updated.saleOrderNo} for manager approval`,
      req,
    });

    return updated;
  },

  // ═══════════════════════════════════════════════════════════════════════
  // APPROVE — Manager อนุมัติ PENDING_REVIEW → CONFIRMED
  // ═══════════════════════════════════════════════════════════════════════
  async approve(id: string, currentUser: CurrentUser, comment?: string, req?: Request) {
    if (!isManagerOrAbove(currentUser.roleCode)) {
      throw new AppError(403, 'FORBIDDEN', 'Only Manager+ can approve sale orders');
    }

    const so = await prisma.saleOrder.findFirst({
      where: { id, deletedAt: null },
      include: saleOrderInclude,
    });
    if (!so) throw new AppError(404, 'NOT_FOUND', 'Sale Order not found');

    if (so.status !== 'PENDING_REVIEW') {
      throw new AppError(409, 'INVALID_STATUS', `Can only approve PENDING_REVIEW orders (current: ${so.status})`);
    }

    const updated = await prisma.saleOrder.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      include: saleOrderInclude,
    });

    // Notify Officer
    await createNotification(prisma, {
      userId: so.quotation.createdById,
      type: 'SALE_ORDER_CREATED',
      title: 'Sale Order อนุมัติแล้ว',
      message: `${updated.saleOrderNo} ได้รับการอนุมัติ${comment ? ` — ${comment}` : ''} สามารถ Save PDF ได้เลย`,
      link: `/sale-orders/${updated.id}`,
      metadata: { saleOrderId: updated.id },
    });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'saleOrder.approve',
      entityType: 'SaleOrder',
      entityId: id,
      description: `Approved sale order ${updated.saleOrderNo} → CONFIRMED`,
      req,
    });

    return updated;
  },

  // ═══════════════════════════════════════════════════════════════════════
  // REJECT — Manager ปฏิเสธ PENDING_REVIEW → REJECTED
  // ═══════════════════════════════════════════════════════════════════════
  async reject(id: string, currentUser: CurrentUser, reason: string, req?: Request) {
    if (!isManagerOrAbove(currentUser.roleCode)) {
      throw new AppError(403, 'FORBIDDEN', 'Only Manager+ can reject sale orders');
    }
    if (!reason || reason.trim().length < 2) {
      throw new AppError(400, 'BAD_REQUEST', 'Rejection reason is required');
    }

    const so = await prisma.saleOrder.findFirst({
      where: { id, deletedAt: null },
      include: saleOrderInclude,
    });
    if (!so) throw new AppError(404, 'NOT_FOUND', 'Sale Order not found');

    if (so.status !== 'PENDING_REVIEW') {
      throw new AppError(409, 'INVALID_STATUS', `Can only reject PENDING_REVIEW orders (current: ${so.status})`);
    }

    const updated = await prisma.saleOrder.update({
      where: { id },
      data: { status: 'REJECTED' },
      include: saleOrderInclude,
    });

    // Notify Officer
    await createNotification(prisma, {
      userId: so.quotation.createdById,
      type: 'SALE_ORDER_CREATED',
      title: 'Sale Order ถูกปฏิเสธ',
      message: `${updated.saleOrderNo} ถูกปฏิเสธ: ${reason}`,
      link: `/sale-orders/${updated.id}`,
      metadata: { saleOrderId: updated.id, reason },
    });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'saleOrder.reject',
      entityType: 'SaleOrder',
      entityId: id,
      description: `Rejected sale order ${updated.saleOrderNo}: ${reason}`,
      req,
    });

    return updated;
  },

  // ═══════════════════════════════════════════════════════════════════════
  // UPDATE — Officer แก้ DRAFT (ยังคงไว้ใช้ถ้าต้องการ)
  // ═══════════════════════════════════════════════════════════════════════
  async update(id: string, input: UpdateSaleOrderInput, currentUser: CurrentUser, req?: Request) {
    const so = await this.getById(id, currentUser);

    if (so.status !== 'DRAFT') {
      throw new AppError(409, 'INVALID_STATUS', `Can only edit DRAFT sale orders (current: ${so.status})`);
    }

    if (so.quotation.createdById !== currentUser.id) {
      throw new AppError(403, 'FORBIDDEN', 'Only the original officer can edit this sale order');
    }

    const updateData: Prisma.SaleOrderUpdateInput = {};
    if (input.paymentTerms !== undefined) updateData.paymentTerms = input.paymentTerms;
    if (input.conditions !== undefined) updateData.conditions = input.conditions;

    const updated = await prisma.saleOrder.update({
      where: { id },
      data: updateData,
      include: saleOrderInclude,
    });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'saleOrder.update',
      entityType: 'SaleOrder',
      entityId: id,
      description: `Updated DRAFT sale order ${updated.saleOrderNo}`,
      req,
    });

    return updated;
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PDF
  // ═══════════════════════════════════════════════════════════════════════
  async generatePdf(id: string, currentUser: CurrentUser, req?: Request) {
    const so = await this.getById(id, currentUser);
    const company = await prisma.companySettings.findFirst();

    if (!company) throw new AppError(500, 'COMPANY_NOT_CONFIGURED', 'Company settings not configured');

    const fileName = `${so.saleOrderNo}.pdf`;
    const html = buildSaleOrderHtml(so, company);
    const filePath = await generatePdfFromHtml(html, fileName);
    const fileUrl = `/uploads/pdfs/${fileName}`;

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'saleOrder.exportPdf',
      entityType: 'SaleOrder',
      entityId: id,
      description: `Generated PDF for ${so.saleOrderNo}`,
      req,
    });

    return { filePath, fileName, url: fileUrl };
  },

  async getPdfFile(id: string, currentUser: CurrentUser, req?: Request) {
    const so = await this.getById(id, currentUser);
    const fileName = `${so.saleOrderNo}.pdf`;
    const expectedPath = path.resolve(`./uploads/pdfs/${fileName}`);

    try {
      await fs.access(expectedPath);
      return { filePath: expectedPath, fileName };
    } catch {
      const result = await this.generatePdf(id, currentUser, req);
      return { filePath: path.resolve(result.filePath), fileName: result.fileName };
    }
  },

  // ─── Legacy (ไม่ได้ใช้แล้ว) ──────────────────────────────────────────────
  async reviewApprove(id: string, input: ReviewSaleOrderInput, currentUser: CurrentUser, req?: Request) {
    return this.approve(id, currentUser, input.comment, req);
  },
  async confirm(id: string, currentUser: CurrentUser, req?: Request) {
    throw new AppError(400, 'BAD_REQUEST', 'Please use /approve endpoint instead');
  },
};