import { Request } from 'express';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/response';
import { logActivity } from '../../utils/activity-log';
import { UpdateCompanyInput } from './company.schema';

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
        approverLimit: input.approverLimit,
        managerLimit: input.managerLimit,
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
};