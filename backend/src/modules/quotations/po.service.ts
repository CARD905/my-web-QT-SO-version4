/**
 * PO Workflow Service
 * Path: backend/src/modules/quotations/po.service.ts
 *
 * Workflow:
 *   APPROVED → [Officer upload PO] → APPROVED (with poFileUrl)
 *           → [Officer submits] → PO_PENDING
 *           → [Manager approves] → PO_APPROVED + creates SaleOrder
 *           → [Manager rejects] → PO_REJECTED → Officer uploads new PO → PO_PENDING
 */
import { NotificationType, Prisma } from '@prisma/client';
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
  // 1) UPLOAD PO FILE (Officer only — owner of quotation)
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
  // 2) SUBMIT PO FOR REVIEW (Officer only — APPROVED → PO_PENDING)
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

    // ─── Notify the approver who approved this quotation ─────────────────
    const notifyToId = q.primaryApproverId || q.approvedById;
    if (notifyToId) {
      await prisma.notification.create({
        data: {
          userId: notifyToId,
          type: 'PO_SUBMITTED' as NotificationType,
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

      // ─── Generate SaleOrder number ─────────────────────────────────────
      const saleOrderNo = await generateDocumentNumber(tx, 'SO');

      // ─── Create SaleOrder ──────────────────────────────────────────────
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

      // ─── Update quotation status ───────────────────────────────────────
      const updated = await tx.quotation.update({
        where: { id: quotationId },
        data: {
          status: 'PO_APPROVED',
          poApprovedAt: new Date(),
          poApprovedById: user.id,
        },
      });

      // ─── Notify Officer ────────────────────────────────────────────────
      await tx.notification.create({
        data: {
          userId: q.createdById,
          type: 'PO_APPROVED' as NotificationType,
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

    // ─── Save current PO to history before clearing ──────────────────────
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
        // เคลียร์ไฟล์เดิม → Officer ต้องอัปโหลดใหม่
        poFileUrl: null,
        poFileName: null,
        poFileSize: null,
        poFileMimeType: null,
        poUploadedAt: null,
        poUploadedById: null,
        poSubmittedAt: null,
      },
    });

    // ─── Notify Officer ────────────────────────────────────────────────
    await prisma.notification.create({
      data: {
        userId: q.createdById,
        type: 'PO_REJECTED' as NotificationType,
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
// 6) CANCEL PO (Manager+ — PO_PENDING → CANCELLED)
//    ใช้กรณีลูกค้าต้องการยกเลิก ขณะรอ Manager ตรวจสอบ PO
// ═══════════════════════════════════════════════════════════════════════
async cancelPo(
  quotationId: string,
  user: CurrentUser,
  reason: string,
  req?: Request,
) {
  if (!isElevated(user.roleCode)) {
    throw new AppError(403, 'FORBIDDEN', 'Only Manager+ can cancel a pending PO');
  }

  if (!reason || reason.trim().length < 2) {
    throw new AppError(400, 'BAD_REQUEST', 'Cancellation reason is required');
  }

  const q = await prisma.quotation.findUnique({
    where: { id: quotationId },
    select: {
      id: true, quotationNo: true, status: true,
      createdById: true, deletedAt: true,
    },
  });
  if (!q || q.deletedAt) throw new AppError(404, 'NOT_FOUND', 'Quotation not found');

  if (q.status !== 'PO_PENDING') {
    throw new AppError(400, 'BAD_REQUEST', `Cannot cancel when status is ${q.status}`);
  }

  const updated = await prisma.quotation.update({
    where: { id: quotationId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledReason: reason.trim(),
    },
  });

  // Notify Officer
  await prisma.notification.create({
    data: {
      userId: q.createdById,
      type: 'QUOTATION_CANCELLED' as any,
      title: 'ใบเสนอราคาถูกยกเลิก',
      message: `${q.quotationNo} ถูกยกเลิก: ${reason}`,
      link: `/quotations/${quotationId}`,
    },
  });

  await logActivity(prisma, {
    userId: user.id,
    action: 'quotation.cancelPo',
    entityType: 'Quotation',
    entityId: q.id,
    description: `Cancelled PO of ${q.quotationNo}: ${reason}`,
    req,
  });

  return updated;
},

  // ═══════════════════════════════════════════════════════════════════════
  // 5) GET CHECKLIST (list of approved + PO_* quotations)
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
        ? (options.status as Prisma.EnumQuotationStatusFilter)
        : { in: validStatuses as any },
    };

    // Officer เห็นเฉพาะของตัวเอง
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