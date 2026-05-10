/**
 * PO Workflow Service
 * Path: backend/src/modules/quotations/po.service.ts
 */
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { prisma } from '../../config/prisma';
import {
  uploadToCloudinary,
  validatePoFile,
  generatePoFolder,
} from '../../utils/storage';
import { AppError } from '../../utils/response';
import { logActivity } from '../../utils/activity-log';
import { generateDocumentNumber } from '../../utils/number-generator';

const ELEVATED_ROLES = ['MANAGER', 'CEO', 'ADMIN', 'APPROVER'];

interface CurrentUser {
  id: string;
  roleCode: string;
  name?: string;
  email?: string;
}

interface UploadHistoryEntry {
  url: string | null;
  fileName: string | null;
  uploadedAt: string;
  rejectedAt?: string;
  rejectedById?: string;
  rejectedByName?: string;
  reason?: string;
}

function isElevated(roleCode: string): boolean {
  return ELEVATED_ROLES.includes(roleCode);
}

export const poService = {
  // ═══════════════════════════════════════════════════════════════════════
  // 1) UPLOAD PO FILE
  // ═══════════════════════════════════════════════════════════════════════
  async uploadPo(
    quotationId: string,
    user: CurrentUser,
    file: Express.Multer.File,
    req?: Request,
  ) {
    const v = validatePoFile(file.mimetype, file.size);
    if (!v.valid) throw new AppError(400, 'BAD_REQUEST', v.error!);

    const q = await prisma.quotation.findUnique({
      where: { id: quotationId },
      select: {
        id: true,
        quotationNo: true,
        status: true,
        createdById: true,
        deletedAt: true,
        poFileUrl: true,
        poFileMimeType: true,
      },
    });
    if (!q || q.deletedAt) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

    if (q.createdById !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'Only the quotation owner can upload PO');
    }

    if (!['APPROVED', 'PO_REJECTED'].includes(q.status)) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        `Cannot upload PO when quotation status is ${q.status}`,
      );
    }

    const result = await uploadToCloudinary(file.buffer, {
      folder: generatePoFolder(quotationId),
      mimeType: file.mimetype,
    });

    const updated = await prisma.quotation.update({
      where: { id: quotationId },
      data: {
        poFileUrl: result.secureUrl,
        poFileName: file.originalname,
        poFileSize: file.size,
        poFileMimeType: file.mimetype,
        poUploadedAt: new Date(),
        poUploadedById: user.id,
      },
    });

    await logActivity(prisma, {
      userId: user.id,
      action: 'quotation.poUpload',
      entityType: 'Quotation',
      entityId: q.id,
      description: `Uploaded PO for ${q.quotationNo} (${file.originalname})`,
      req,
    });

    return updated;
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 2) SUBMIT PO FOR REVIEW
  // ═══════════════════════════════════════════════════════════════════════
  async submitPo(quotationId: string, user: CurrentUser, req?: Request) {
    const q = await prisma.quotation.findUnique({
      where: { id: quotationId },
      select: {
        id: true,
        quotationNo: true,
        status: true,
        createdById: true,
        primaryApproverId: true,
        approvedById: true,
        poFileUrl: true,
        deletedAt: true,
      },
    });
    if (!q || q.deletedAt) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

    if (q.createdById !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'Only the owner can submit PO');
    }

    if (!q.poFileUrl) {
      throw new AppError(400, 'BAD_REQUEST', 'Please upload PO file first');
    }

    if (!['APPROVED', 'PO_REJECTED'].includes(q.status)) {
      throw new AppError(
        400,
        'BAD_REQUEST',
        `Cannot submit PO when status is ${q.status}`,
      );
    }

    const updated = await prisma.quotation.update({
      where: { id: quotationId },
      data: {
        status: 'PO_PENDING',
        poSubmittedAt: new Date(),
        poRejectedAt: null,
        poRejectedById: null,
        poRejectionReason: null,
      },
    });

    // ─── Notify approver ──────────────────────────────────────────────
    const notifyToId = q.primaryApproverId || q.approvedById;
    if (notifyToId) {
      await prisma.notification.create({
        data: {
          userId: notifyToId,
          // ใช้ QUOTATION_SUBMITTED แทน PO_SUBMITTED ที่ไม่มีใน enum
          type: 'QUOTATION_SUBMITTED',
          title: 'PO รอการตรวจสอบ',
          message: `${q.quotationNo} อัปโหลด PO รอการตรวจสอบ`,
          link: `/quotations/checklist/${quotationId}`,
        },
      });
    }

    await logActivity(prisma, {
      userId: user.id,
      action: 'quotation.poSubmit',
      entityType: 'Quotation',
      entityId: q.id,
      description: `Submitted PO for review: ${q.quotationNo}`,
      req,
    });

    return updated;
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 3) APPROVE PO (Manager+ — PO_PENDING → PO_APPROVED + create SaleOrder)
  // ═══════════════════════════════════════════════════════════════════════
  async approvePo(quotationId: string, user: CurrentUser, req?: Request) {
    if (!isElevated(user.roleCode)) {
      throw new AppError(403, 'FORBIDDEN', 'Only Manager+ can approve PO');
    }

    const result = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.findUnique({
        where: { id: quotationId },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
      if (!q || q.deletedAt) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

      if (q.status !== 'PO_PENDING') {
        throw new AppError(
          400,
          'BAD_REQUEST',
          `Cannot approve PO when status is ${q.status}`,
        );
      }

      const saleOrderNo = await generateDocumentNumber(tx, 'SO');

      const saleOrder = await tx.saleOrder.create({
        data: {
          saleOrderNo,
          quotationId: q.id,
          status: 'CONFIRMED',
          issueDate: new Date(),
          currency: q.currency,

          customerId: q.customerId,
          customerCompany: q.customerCompany,
          customerContactName: q.customerContactName,
          customerTaxId: q.customerTaxId,
          customerEmail: q.customerEmail,
          customerPhone: q.customerPhone,
          customerBillingAddress: q.customerBillingAddress,
          customerShippingAddress: q.customerShippingAddress,

          subtotal: q.subtotal,
          discountTotal: q.discountTotal,
          vatRate: q.vatRate,
          vatEnabled: q.vatEnabled,
          vatAmount: q.vatAmount,
          grandTotal: q.grandTotal,
          paymentTerms: q.paymentTerms,
          conditions: q.conditions,

          items: {
            create: q.items.map((it) => ({
              productId: it.productId,
              productSku: it.productSku,
              productName: it.productName,
              productDescription: it.productDescription,
              unit: it.unit,
              unitPrice: it.unitPrice,
              quantity: it.quantity,
              discount: it.discount,
              discountType: it.discountType,
              lineTotal: it.lineTotal,
              sortOrder: it.sortOrder,
            })),
          },
        },
      });

      const updated = await tx.quotation.update({
        where: { id: quotationId },
        data: {
          status: 'PO_APPROVED',
          poApprovedAt: new Date(),
          poApprovedById: user.id,
        },
      });

      await tx.notification.create({
        data: {
          userId: q.createdById,
          type: 'QUOTATION_APPROVED', // ใช้ type ที่มีใน enum
          title: 'PO อนุมัติแล้ว',
          message: `PO ของ ${q.quotationNo} อนุมัติ — Sale Order ${saleOrderNo} ถูกสร้าง`,
          link: `/sale-orders/${saleOrder.id}`,
        },
      });

      return { quotation: updated, saleOrder };
    });

    await logActivity(prisma, {
      userId: user.id,
      action: 'quotation.poApprove',
      entityType: 'Quotation',
      entityId: result.quotation.id,
      description: `Approved PO for ${result.quotation.quotationNo} → Sale Order ${result.saleOrder.saleOrderNo}`,
      req,
    });

    return result;
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 4) REJECT PO (Manager+ — PO_PENDING → PO_REJECTED)
  // ═══════════════════════════════════════════════════════════════════════
  async rejectPo(
    quotationId: string,
    user: CurrentUser,
    reason: string,
    req?: Request,
  ) {
    if (!isElevated(user.roleCode)) {
      throw new AppError(403, 'FORBIDDEN', 'Only Manager+ can reject PO');
    }

    if (!reason || reason.trim().length < 2) {
      throw new AppError(400, 'BAD_REQUEST', 'Rejection reason is required (min 2 chars)');
    }

    const q = await prisma.quotation.findUnique({
      where: { id: quotationId },
      select: {
        id: true,
        quotationNo: true,
        status: true,
        createdById: true,
        deletedAt: true,
        poFileUrl: true,
        poFileName: true,
        poFileMimeType: true,
        poUploadedAt: true,
        poUploadHistory: true,
      },
    });
    if (!q || q.deletedAt) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

    if (q.status !== 'PO_PENDING') {
      throw new AppError(
        400,
        'BAD_REQUEST',
        `Cannot reject PO when status is ${q.status}`,
      );
    }

    const history = (q.poUploadHistory as unknown as UploadHistoryEntry[] | null) || [];
    history.push({
      url: q.poFileUrl,
      fileName: q.poFileName,
      uploadedAt: q.poUploadedAt?.toISOString() ?? '',
      rejectedAt: new Date().toISOString(),
      rejectedById: user.id,
      rejectedByName: user.name,
      reason: reason.trim(),
    });

    const updated = await prisma.quotation.update({
      where: { id: quotationId },
      data: {
        status: 'PO_REJECTED',
        poRejectedAt: new Date(),
        poRejectedById: user.id,
        poRejectionReason: reason.trim(),
        poUploadHistory: history as unknown as Prisma.InputJsonValue,
        poFileUrl: null,
        poFileName: null,
        poFileSize: null,
        poFileMimeType: null,
        poUploadedAt: null,
        poUploadedById: null,
        poSubmittedAt: null,
      },
    });

    await prisma.notification.create({
      data: {
        userId: q.createdById,
        type: 'QUOTATION_REJECTED', // ใช้ type ที่มีใน enum
        title: 'PO ถูกปฏิเสธ',
        message: `PO ของ ${q.quotationNo} ถูกปฏิเสธ: ${reason}`,
        link: `/quotations/checklist/${quotationId}`,
      },
    });

    await logActivity(prisma, {
      userId: user.id,
      action: 'quotation.poReject',
      entityType: 'Quotation',
      entityId: q.id,
      description: `Rejected PO for ${q.quotationNo}: ${reason}`,
      req,
    });

    return updated;
  },

  // ═══════════════════════════════════════════════════════════════════════
  // 5) GET CHECKLIST
  // ═══════════════════════════════════════════════════════════════════════
  async getChecklist(
    user: CurrentUser,
    options: { status?: string; search?: string } = {},
  ) {
    const elevated = isElevated(user.roleCode);

    const validStatuses = ['APPROVED', 'PO_PENDING', 'PO_APPROVED', 'PO_REJECTED'];
    const where: Prisma.QuotationWhereInput = {
      deletedAt: null,
      status: options.status && validStatuses.includes(options.status)
        ? (options.status as any)
        : { in: validStatuses as any },
    };

    if (!elevated) {
      where.createdById = user.id;
    }

    if (options.search) {
      where.OR = [
        { quotationNo: { contains: options.search, mode: 'insensitive' } },
        { customerCompany: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    return prisma.quotation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        quotationNo: true,
        customerCompany: true,
        grandTotal: true,
        currency: true,
        status: true,
        approvedAt: true,
        poFileUrl: true,
        poFileName: true,
        poFileMimeType: true,
        poUploadedAt: true,
        poSubmittedAt: true,
        poApprovedAt: true,
        poRejectedAt: true,
        poRejectionReason: true,
        createdBy: { select: { id: true, name: true } },
        saleOrder: { select: { id: true, saleOrderNo: true } },
      },
    });
  },
};