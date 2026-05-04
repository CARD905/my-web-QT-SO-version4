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
  quotation: { select: { id: true, quotationNo: true, expiryDate: true, createdById: true } },
} satisfies Prisma.SaleOrderInclude;

function isOfficer(roleCode: string): boolean {
  return roleCode === 'OFFICER' || roleCode === 'SALES';
}

function isManagerOrAbove(roleCode: string): boolean {
  return ['MANAGER', 'ADMIN', 'CEO'].includes(roleCode);
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

  // ============================================================
  // UPDATE — Officer (creator) only, status = DRAFT
  // ============================================================
  async update(id: string, input: UpdateSaleOrderInput, currentUser: CurrentUser, req?: Request) {
    const so = await this.getById(id, currentUser);

    if (so.status !== 'DRAFT') {
      throw new AppError(
        409,
        'INVALID_STATUS',
        `Can only edit DRAFT sale orders (current: ${so.status})`,
      );
    }

    // Only the quotation creator (Officer) can edit
    if (so.quotation.createdById !== currentUser.id) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Only the original officer can edit this sale order',
      );
    }

    // Build update data
    const updateData: Prisma.SaleOrderUpdateInput = {};

    if (input.customerCompany !== undefined) updateData.customerCompany = input.customerCompany;
    if (input.customerContactName !== undefined) updateData.customerContactName = input.customerContactName;
    if (input.customerTaxId !== undefined) updateData.customerTaxId = input.customerTaxId;
    if (input.customerEmail !== undefined) updateData.customerEmail = input.customerEmail || null;
    if (input.customerPhone !== undefined) updateData.customerPhone = input.customerPhone;
    if (input.customerBillingAddress !== undefined) updateData.customerBillingAddress = input.customerBillingAddress;
    if (input.customerShippingAddress !== undefined) updateData.customerShippingAddress = input.customerShippingAddress;
    if (input.paymentTerms !== undefined) updateData.paymentTerms = input.paymentTerms;
    if (input.conditions !== undefined) updateData.conditions = input.conditions;

    // If items provided — recalculate totals
    if (input.items && input.items.length > 0) {
      const { subtotal, discountTotal, vatAmount, grandTotal, itemTotals } = calcQuotation(
        input.items.map((i) => ({
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount,
          discountType: i.discountType,
        })),
        so.vatEnabled,
        Number(so.vatRate),
      );

      updateData.subtotal = subtotal;
      updateData.discountTotal = discountTotal;
      updateData.vatAmount = vatAmount;
      updateData.grandTotal = grandTotal;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Replace items if provided
      if (input.items && input.items.length > 0) {
        await tx.saleOrderItem.deleteMany({ where: { saleOrderId: id } });

        const { itemTotals } = calcQuotation(
          input.items.map((i) => ({
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount,
            discountType: i.discountType,
          })),
          so.vatEnabled,
          Number(so.vatRate),
        );

        await tx.saleOrderItem.createMany({
          data: input.items.map((item, idx) => ({
            saleOrderId: id,
            productId: item.productId || null,
            productSku: item.productSku || null,
            productName: item.productName,
            productDescription: item.productDescription || null,
            quantity: new Prisma.Decimal(item.quantity),
            unit: item.unit,
            unitPrice: new Prisma.Decimal(item.unitPrice),
            discount: new Prisma.Decimal(item.discount),
            discountType: item.discountType,
            lineTotal: new Prisma.Decimal(itemTotals[idx]),
            sortOrder: item.sortOrder ?? idx,
          })),
        });
      }

      return tx.saleOrder.update({
        where: { id },
        data: updateData,
        include: saleOrderInclude,
      });
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

  // ============================================================
  // SUBMIT — Officer submits for Manager review
  // ============================================================
  async submit(id: string, input: SubmitSaleOrderInput, currentUser: CurrentUser, req?: Request) {
    const so = await this.getById(id, currentUser);

    if (so.status !== 'DRAFT') {
      throw new AppError(
        409,
        'INVALID_STATUS',
        `Can only submit DRAFT sale orders (current: ${so.status})`,
      );
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
      title: 'Sale Order รอ review',
      message: `${updated.saleOrderNo} จาก ${updated.customerCompany} รอการตรวจสอบ${input.comment ? ` — ${input.comment}` : ''}`,
      link: `/sale-orders/${updated.id}`,
      metadata: { saleOrderId: updated.id },
    });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'saleOrder.submit',
      entityType: 'SaleOrder',
      entityId: id,
      description: `Submitted sale order ${updated.saleOrderNo} for review`,
      req,
    });

    return updated;
  },

  // ============================================================
  // REVIEW APPROVE — Manager approves the review → back to DRAFT
  // ============================================================
  async reviewApprove(id: string, input: ReviewSaleOrderInput, currentUser: CurrentUser, req?: Request) {
    const so = await prisma.saleOrder.findFirst({
      where: { id, deletedAt: null },
      include: saleOrderInclude,
    });
    if (!so) throw new AppError(404, 'NOT_FOUND', 'Sale Order not found');

    if (so.status !== 'PENDING_REVIEW') {
      throw new AppError(
        409,
        'INVALID_STATUS',
        `Can only review PENDING_REVIEW sale orders (current: ${so.status})`,
      );
    }

    if (!isManagerOrAbove(currentUser.roleCode)) {
      throw new AppError(403, 'FORBIDDEN', 'Only Manager+ can review sale orders');
    }

    const updated = await prisma.saleOrder.update({
      where: { id },
      data: { status: 'DRAFT' },
      include: saleOrderInclude,
    });

    // Notify the officer
    await createNotification(prisma, {
      userId: so.quotation.createdById,
      type: 'SALE_ORDER_CREATED',
      title: 'Sale Order ผ่าน review แล้ว',
      message: `${updated.saleOrderNo} ผ่าน review สามารถ confirm เพื่อทำใบทางการได้${input.comment ? ` — ${input.comment}` : ''}`,
      link: `/sale-orders/${updated.id}`,
      metadata: { saleOrderId: updated.id },
    });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'saleOrder.reviewApprove',
      entityType: 'SaleOrder',
      entityId: id,
      description: `Approved review for ${updated.saleOrderNo}`,
      req,
    });

    return updated;
  },

  // ============================================================
  // CONFIRM — Officer confirms → CONFIRMED (locked)
  // ============================================================
  async confirm(id: string, currentUser: CurrentUser, req?: Request) {
    const so = await this.getById(id, currentUser);

    if (so.status !== 'DRAFT') {
      throw new AppError(
        409,
        'INVALID_STATUS',
        `Can only confirm DRAFT sale orders (current: ${so.status})`,
      );
    }

    if (so.quotation.createdById !== currentUser.id) {
      throw new AppError(403, 'FORBIDDEN', 'Only the original officer can confirm');
    }

    const updated = await prisma.saleOrder.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      include: saleOrderInclude,
    });

    await notifyByRole(prisma, 'MANAGER', {
      type: 'SALE_ORDER_CREATED',
      title: 'Sale Order ยืนยันแล้ว',
      message: `${updated.saleOrderNo} ได้รับการยืนยันเป็นใบทางการ`,
      link: `/sale-orders/${updated.id}`,
      metadata: { saleOrderId: updated.id },
    });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'saleOrder.confirm',
      entityType: 'SaleOrder',
      entityId: id,
      description: `Confirmed sale order ${updated.saleOrderNo} (locked)`,
      req,
    });

    return updated;
  },

  // ============================================================
  // PDF generation (existing)
  // ============================================================
  async generatePdf(id: string, currentUser: CurrentUser, req?: Request) {
    const so = await this.getById(id, currentUser);
    const company = await prisma.companySettings.findFirst();

    if (!company) {
      throw new AppError(
        500,
        'COMPANY_NOT_CONFIGURED',
        'Company settings not configured. Please contact admin.',
      );
    }

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
};