import { Request } from 'express';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/response';
import { logActivity } from '../../utils/activity-log';
import { uploadToCloudinary } from '../../utils/storage';
import { UpdateCompanyInput } from './company.schema';

const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5MB

export const companyService = {
  async get() {
    let settings = await prisma.companySettings.findFirst();
    // Auto-create default if not exists
    if (!settings) {
      settings = await prisma.companySettings.create({
        data: {
          companyName: 'Your Company Co., Ltd.',
          defaultVatRate: 7,
          defaultCurrency: 'THB',
          quotationPrefix: 'QT',
          saleOrderPrefix: 'SO',
        },
      });
    }
    return settings;
  },

  async update(input: UpdateCompanyInput, userId: string, req?: Request) {
    const existing = await this.get();

    const updated = await prisma.companySettings.update({
      where: { id: existing.id },
      data: {
        companyName: input.companyName,
        companyNameTh: input.companyNameTh || null,
        taxId: input.taxId || null,
        address: input.address || null,
        addressTh: input.addressTh || null,
        phone: input.phone || null,
        fax: input.fax || null,
        email: input.email || null,
        website: input.website || null,
        logoUrl: input.logoUrl || null,
        defaultVatRate: input.defaultVatRate,
        defaultPaymentTerms: input.defaultPaymentTerms || null,
        defaultCurrency: input.defaultCurrency,
        bankName: input.bankName || null,
        bankAccount: input.bankAccount || null,
        bankBranch: input.bankBranch || null,
      },
    });

    await logActivity(prisma, {
      userId,
      action: 'UPDATE',
      entityType: 'CompanySettings',
      entityId: updated.id,
      description: `Updated company settings: ${updated.companyName}`,
      req,
    });

    return updated;
  },

  async uploadLogo(file: Express.Multer.File, userId: string, req?: Request) {
    if (!ALLOWED_LOGO_TYPES.includes(file.mimetype)) {
      throw new AppError(400, 'BAD_REQUEST', 'รองรับเฉพาะ PNG, JPG, WebP');
    }
    if (file.size > MAX_LOGO_SIZE) {
      throw new AppError(400, 'BAD_REQUEST', 'ไฟล์ใหญ่เกิน 5 MB');
    }

    const result = await uploadToCloudinary(file.buffer, {
      folder: 'wisdom-company-logos',
      mimeType: file.mimetype,
    });

    const existing = await this.get();
    const updated = await prisma.companySettings.update({
      where: { id: existing.id },
      data: { logoUrl: result.secureUrl },
    });

    await logActivity(prisma, {
      userId,
      action: 'UPDATE',
      entityType: 'CompanySettings',
      entityId: updated.id,
      description: 'Uploaded company logo',
      req,
    });

    return updated;
  },
};