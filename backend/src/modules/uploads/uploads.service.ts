import fs from 'fs/promises';
import path from 'path';
import { Request } from 'express';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/response';
import { logActivity } from '../../utils/activity-log';
import { UserRole } from '@prisma/client';

export const uploadsService = {
  async attachToQuotation(
    quotationId: string,
    file: Express.Multer.File,
    user: { id: string; role: UserRole },
    req?: Request,
  ) {
    // Verify quotation exists & user has access
    const quotation = await prisma.quotation.findFirst({
      where: { id: quotationId, deletedAt: null },
    });

    if (!quotation) {
      // Cleanup orphan file
      await fs.unlink(file.path).catch(() => undefined);
      throw new AppError(404, 'QUOTATION_NOT_FOUND', 'Quotation not found');
    }

    // Sales must be the owner
    if (user.role === 'SALES' && quotation.createdById !== user.id) {
      await fs.unlink(file.path).catch(() => undefined);
      throw new AppError(403, 'FORBIDDEN', 'You can only attach to your own quotations');
    }

    const fileName = path.basename(file.path);
    const fileUrl = `/uploads/attachments/${fileName}`;

    const attachment = await prisma.quotationAttachment.create({
      data: {
        quotationId,
        fileName: file.originalname,
        fileUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedById: user.id,
      },
    });

    await logActivity(prisma, {
      userId: user.id,
      action: 'CREATE',
      entityType: 'QuotationAttachment',
      entityId: attachment.id,
      description: `Uploaded attachment "${file.originalname}" to ${quotation.quotationNo}`,
      req,
    });

    return attachment;
  },

  async listForQuotation(
    quotationId: string,
    user: { id: string; role: UserRole },
  ) {
    const quotation = await prisma.quotation.findFirst({
      where: { id: quotationId, deletedAt: null },
      select: { id: true, createdById: true },
    });
    if (!quotation) throw new AppError(404, 'QUOTATION_NOT_FOUND', 'Quotation not found');

    if (user.role === 'SALES' && quotation.createdById !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'No access');
    }

    return prisma.quotationAttachment.findMany({
      where: { quotationId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async remove(
    attachmentId: string,
    user: { id: string; role: UserRole },
    req?: Request,
  ) {
    const att = await prisma.quotationAttachment.findUnique({
      where: { id: attachmentId },
      include: { quotation: { select: { createdById: true, quotationNo: true } } },
    });
    if (!att) throw new AppError(404, 'NOT_FOUND', 'Attachment not found');

    // Only uploader, the quotation owner, or admin can delete
    const isOwner = att.uploadedById === user.id || att.quotation.createdById === user.id;
    if (!isOwner && user.role !== 'ADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'Cannot delete this attachment');
    }

    await prisma.quotationAttachment.delete({ where: { id: attachmentId } });

    // Best-effort delete from disk
    const fileName = path.basename(att.fileUrl);
    const fullPath = path.join('./uploads/attachments', fileName);
    await fs.unlink(fullPath).catch(() => undefined);

    await logActivity(prisma, {
      userId: user.id,
      action: 'DELETE',
      entityType: 'QuotationAttachment',
      entityId: attachmentId,
      description: `Removed attachment "${att.fileName}" from ${att.quotation.quotationNo}`,
      req,
    });
  },
};
