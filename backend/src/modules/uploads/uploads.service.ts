import fs from 'fs/promises';
import path from 'path';
import { Request } from 'express';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/response';
import { logActivity } from '../../utils/activity-log';

interface CurrentUser {
  id: string;
  roleCode: string;
}

export const uploadsService = {
  async attachToQuotation(
    quotationId: string,
    file: Express.Multer.File,
    user: CurrentUser,
    req?: Request,
  ) {
    // Verify quotation exists & user has access
    const quotation = await prisma.quotation.findFirst({
      where: { id: quotationId, deletedAt: null },
    });

    if (!quotation) {
      await fs.unlink(file.path).catch(() => undefined);
      throw new AppError(404, 'QUOTATION_NOT_FOUND', 'Quotation not found');
    }

    // Officer must be the owner (legacy: SALES)
    const isOfficer = user.roleCode === 'OFFICER' || user.roleCode === 'SALES';
    if (isOfficer && quotation.createdById !== user.id) {
      await fs.unlink(file.path).catch(() => undefined);
      throw new AppError(403, 'FORBIDDEN', 'You can only attach to your own quotations');
    }

    const fileName = path.basename(file.path);
    const filePath = `attachments/${fileName}`;

    const attachment = await prisma.quotationAttachment.create({
      data: {
        quotationId,
        filename: fileName,
        originalName: file.originalname,
        filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedById: user.id,
      },
    });

    await logActivity(prisma, {
      userId: user.id,
      action: 'attachment.create',
      entityType: 'QuotationAttachment',
      entityId: attachment.id,
      description: `Uploaded attachment "${file.originalname}" to ${quotation.quotationNo}`,
      req,
    });

    return {
      ...attachment,
      url: `/uploads/${filePath}`,
    };
  },

  async listForQuotation(quotationId: string, user: CurrentUser) {
    const quotation = await prisma.quotation.findFirst({
      where: { id: quotationId, deletedAt: null },
      select: { id: true, createdById: true },
    });
    if (!quotation) throw new AppError(404, 'QUOTATION_NOT_FOUND', 'Quotation not found');

    const isOfficer = user.roleCode === 'OFFICER' || user.roleCode === 'SALES';
    if (isOfficer && quotation.createdById !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'No access');
    }

    const attachments = await prisma.quotationAttachment.findMany({
      where: { quotationId },
      orderBy: { createdAt: 'desc' },
    });

    return attachments.map((a) => ({
      ...a,
      url: `/uploads/${a.filePath}`,
    }));
  },

  async remove(attachmentId: string, user: CurrentUser, req?: Request) {
    const att = await prisma.quotationAttachment.findUnique({
      where: { id: attachmentId },
      include: { quotation: { select: { createdById: true, quotationNo: true } } },
    });
    if (!att) throw new AppError(404, 'NOT_FOUND', 'Attachment not found');

    const isOwner = att.uploadedById === user.id || att.quotation.createdById === user.id;
    const isAdmin = user.roleCode === 'ADMIN' || user.roleCode === 'CEO';
    if (!isOwner && !isAdmin) {
      throw new AppError(403, 'FORBIDDEN', 'Cannot delete this attachment');
    }

    await prisma.quotationAttachment.delete({ where: { id: attachmentId } });

    // Best-effort delete from disk
    const fullPath = path.join('./uploads', att.filePath);
    await fs.unlink(fullPath).catch(() => undefined);

    await logActivity(prisma, {
      userId: user.id,
      action: 'attachment.delete',
      entityType: 'QuotationAttachment',
      entityId: attachmentId,
      description: `Removed attachment "${att.originalName}" from ${att.quotation.quotationNo}`,
      req,
    });
  },
};