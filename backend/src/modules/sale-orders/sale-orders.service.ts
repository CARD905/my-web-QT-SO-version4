import { Prisma, UserRole } from '@prisma/client';
import { Request } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/response';
import { buildPaginationMeta, getPaginationParams } from '../../utils/pagination';
import { logActivity } from '../../utils/activity-log';
import { ListSaleOrdersQuery } from './sale-orders.schema';
import { buildSaleOrderHtml } from './sale-order.template';
import { generatePdfFromHtml } from './pdf-generator';

const saleOrderInclude = {
  items: { orderBy: { sortOrder: 'asc' as const } },
  customer: { select: { id: true, company: true, contactName: true } },
  createdBy: { select: { id: true, name: true } },
  quotation: { select: { id: true, quotationNo: true, expiryDate: true } },
} satisfies Prisma.SaleOrderInclude;

export const saleOrdersService = {
  async list(query: ListSaleOrdersQuery, currentUser: { id: string; role: UserRole }) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.SaleOrderWhereInput = { deletedAt: null };

    // Sales sees only sale orders from their own quotations
    if (currentUser.role === 'SALES') {
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
          createdBy: { select: { id: true, name: true } },
          customer: { select: { id: true, company: true } },
          quotation: { select: { id: true, quotationNo: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.saleOrder.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  },

  async getById(id: string, currentUser: { id: string; role: UserRole }) {
    const so = await prisma.saleOrder.findFirst({
      where: { id, deletedAt: null },
      include: saleOrderInclude,
    });

    if (!so) throw new AppError(404, 'NOT_FOUND', 'Sale Order not found');

    if (currentUser.role === 'SALES') {
      // Need to verify quotation owner
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

  /**
   * Generate (or regenerate) PDF for the sale order
   */
  async generatePdf(id: string, currentUser: { id: string; role: UserRole }, req?: Request) {
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
    await prisma.saleOrder.update({
      where: { id },
      data: {
        pdfGenerated: true,
        pdfUrl: fileUrl,
        pdfGeneratedAt: new Date(),
      },
    });

    await logActivity(prisma, {
      userId: currentUser.id,
      action: 'EXPORT_PDF',
      entityType: 'SaleOrder',
      entityId: id,
      description: `Generated PDF for ${so.saleOrderNo}`,
      req,
    });

    return { filePath, fileName, url: fileUrl };
  },

  /**
   * Get PDF file path - generates if not yet exists
   */
  async getPdfFile(id: string, currentUser: { id: string; role: UserRole }, req?: Request) {
    const so = await this.getById(id, currentUser);

    const fileName = `${so.saleOrderNo}.pdf`;
    const expectedPath = path.resolve(`./uploads/pdfs/${fileName}`);

    // Check if file exists on disk
    try {
      await fs.access(expectedPath);
      return { filePath: expectedPath, fileName };
    } catch {
      // Generate fresh
      const result = await this.generatePdf(id, currentUser, req);
      return { filePath: path.resolve(result.filePath), fileName: result.fileName };
    }
  },
};
