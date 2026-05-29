import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/response';
import { buildPaginationMeta, getPaginationParams, PaginationQuery } from '../../utils/pagination';
import { logActivity } from '../../utils/activity-log';
import { CreateCustomerInput, EditRequestInput, UpdateCustomerInput } from './customers.schema';
import { Request } from 'express';

export const customersService = {
  async list(query: PaginationQuery) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
    };

    if (query.search) {
      where.OR = [
        { company: { contains: query.search, mode: 'insensitive' } },
        { contactName: { contains: query.search, mode: 'insensitive' } },
        { taxId: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.CustomerOrderByWithRelationInput = query.sortBy
      ? { [query.sortBy]: query.sortOrder }
      : { createdAt: 'desc' };

    const [data, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          _count: { select: { quotations: true, saleOrders: true } },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      data,
      meta: buildPaginationMeta(total, page, limit),
    };
  },

  async getById(id: string) {
    const customer = await prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { quotations: true, saleOrders: true } },
      },
    });
    if (!customer) {
      throw new AppError(404, 'NOT_FOUND', 'Customer not found');
    }
    return customer;
  },

  async create(input: CreateCustomerInput, userId: string, req?: Request) {
    const customer = await prisma.customer.create({
      data: {
        contactName: input.contactName,
        company: input.company,
        taxId: input.taxId || null,
        email: input.email || null,
        phone: input.phone || null,
        billingAddress: input.billingAddress || null,
        shippingAddress: input.shippingAddress || null,
        notes: input.notes || null,
        paymentTerm: input.paymentTerm ?? 'Net 30',
      },
    });

    await logActivity(prisma, {
      userId,
      action: 'CREATE',
      entityType: 'Customer',
      entityId: customer.id,
      description: `Created customer: ${customer.company}`,
      req,
    });

    return customer;
  },

  async update(id: string, input: UpdateCustomerInput, userId: string, req?: Request) {
    await this.getById(id); // throws if not found

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...(input.contactName !== undefined && { contactName: input.contactName }),
        ...(input.company !== undefined && { company: input.company }),
        ...(input.taxId !== undefined && { taxId: input.taxId || null }),
        ...(input.email !== undefined && { email: input.email || null }),
        ...(input.phone !== undefined && { phone: input.phone || null }),
        ...(input.billingAddress !== undefined && { billingAddress: input.billingAddress || null }),
        ...(input.shippingAddress !== undefined && { shippingAddress: input.shippingAddress || null }),
        ...(input.notes !== undefined && { notes: input.notes || null }),
        ...(input.paymentTerm !== undefined && { paymentTerm: input.paymentTerm }),
      },
    });

    await logActivity(prisma, {
      userId,
      action: 'UPDATE',
      entityType: 'Customer',
      entityId: updated.id,
      description: `Updated customer: ${updated.company}`,
      req,
    });

    return updated;
  },

  async editRequest(id: string, input: EditRequestInput, requesterId: string, requesterName: string, req?: Request) {
    const customer = await this.getById(id);

    const FIELD_LABELS: Record<string, string> = {
      contactName: 'Contact Name', company: 'บริษัท', taxId: 'Tax ID',
      email: 'Email', phone: 'เบอร์โทร',
      billingAddress: 'ที่อยู่ออกใบเสร็จ', shippingAddress: 'ที่อยู่จัดส่ง',
    };
    const changesText = Object.entries(input.changes)
      .map(([k, v]) => `${FIELD_LABELS[k] ?? k}: "${v ?? '(ลบออก)'}"`)
      .join(', ');

    // Persist the request in DB
    const cr = await prisma.customerChangeRequest.create({
      data: {
        customerId: id,
        requesterId,
        reason: input.reason,
        changes: input.changes as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });

    // Notify all admins
    const admins = await prisma.user.findMany({
      where: { deletedAt: null, isActive: true, role: { code: 'ADMIN' } },
      select: { id: true },
    });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: 'CUSTOMER_EDIT_REQUEST' as any,
          title: 'ขอแก้ไขข้อมูลลูกค้า',
          message: `${requesterName} ขอแก้ไขข้อมูลลูกค้า "${customer.company}" — ${changesText}`,
          link: `/customers`,
        })),
      });
    }

    await logActivity(prisma, {
      userId: requesterId,
      action: 'EDIT_REQUEST',
      entityType: 'Customer',
      entityId: id,
      description: `Edit request for customer "${customer.company}": ${changesText}`,
      req,
    });

    return cr;
  },

  async pendingEditRequestCount() {
    const count = await prisma.customerChangeRequest.count({ where: { status: 'PENDING' } });
    return { count };
  },

  async listEditRequests(customerId?: string, status?: string) {
    const where: Prisma.CustomerChangeRequestWhereInput = {};
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;

    return prisma.customerChangeRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        requester:  { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true } },
        customer:   { select: { id: true, company: true } },
      },
    });
  },

  async approveEditRequest(requestId: string, adminId: string, note?: string, req?: Request, skipApply = false) {
    const cr = await prisma.customerChangeRequest.findUnique({
      where: { id: requestId },
      include: { customer: true },
    });
    if (!cr) throw new AppError(404, 'NOT_FOUND', 'ไม่พบคำขอ');
    if (cr.status !== 'PENDING') throw new AppError(400, 'BAD_REQUEST', 'คำขอนี้ไม่ได้อยู่ในสถานะ PENDING');

    if (!skipApply) {
      const changes = cr.changes as Record<string, unknown>;
      const updateData: Prisma.CustomerUpdateInput = {};
      if (changes.contactName !== undefined) updateData.contactName = changes.contactName as string;
      if (changes.company     !== undefined) updateData.company     = changes.company as string;
      if (changes.taxId       !== undefined) updateData.taxId       = (changes.taxId as string) || null;
      if (changes.email       !== undefined) updateData.email       = (changes.email as string) || null;
      if (changes.phone       !== undefined) updateData.phone       = (changes.phone as string) || null;
      if (changes.billingAddress  !== undefined) updateData.billingAddress  = (changes.billingAddress as string) || null;
      if (changes.shippingAddress !== undefined) updateData.shippingAddress = (changes.shippingAddress as string) || null;
      if (Object.keys(updateData).length > 0) {
        await prisma.customer.update({ where: { id: cr.customerId }, data: updateData });
      }
    }

    await prisma.customerChangeRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED', adminNote: note ?? null, reviewedById: adminId, reviewedAt: new Date() },
    });

    await prisma.notification.create({
      data: {
        userId: cr.requesterId,
        type: 'CUSTOMER_EDIT_REQUEST' as any,
        title: 'คำขอแก้ไขลูกค้าได้รับการอนุมัติ',
        message: `คำขอแก้ไขข้อมูลลูกค้า "${cr.customer.company}" ได้รับการอนุมัติแล้ว`,
        link: `/customers`,
      },
    });

    await logActivity(prisma, {
      userId: adminId,
      action: 'APPROVE_EDIT_REQUEST',
      entityType: 'Customer',
      entityId: cr.customerId,
      description: `Approved edit request for customer "${cr.customer.company}"`,
      req,
    });
  },

  async rejectEditRequest(requestId: string, adminId: string, note: string, req?: Request) {
    if (!note?.trim()) throw new AppError(400, 'VALIDATION', 'กรุณาระบุเหตุผลที่ปฏิเสธ');
    const cr = await prisma.customerChangeRequest.findUnique({
      where: { id: requestId },
      include: { customer: true },
    });
    if (!cr) throw new AppError(404, 'NOT_FOUND', 'ไม่พบคำขอ');
    if (cr.status !== 'PENDING') throw new AppError(400, 'BAD_REQUEST', 'คำขอนี้ไม่ได้อยู่ในสถานะ PENDING');

    await prisma.customerChangeRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED', adminNote: note.trim(), reviewedById: adminId, reviewedAt: new Date() },
    });

    await prisma.notification.create({
      data: {
        userId: cr.requesterId,
        type: 'CUSTOMER_EDIT_REQUEST' as any,
        title: 'คำขอแก้ไขลูกค้าถูกปฏิเสธ',
        message: `คำขอแก้ไขข้อมูลลูกค้า "${cr.customer.company}" ถูกปฏิเสธ: ${note}`,
        link: `/customers`,
      },
    });

    await logActivity(prisma, {
      userId: adminId,
      action: 'REJECT_EDIT_REQUEST',
      entityType: 'Customer',
      entityId: cr.customerId,
      description: `Rejected edit request for customer "${cr.customer.company}": ${note}`,
      req,
    });
  },

  async softDelete(id: string, userId: string, req?: Request) {
    const customer = await this.getById(id);

    // Check if has active (non-cancelled, non-expired) quotations
    const activeQuotations = await prisma.quotation.count({
      where: {
        customerId: id,
        deletedAt: null,
        status: { in: ['DRAFT', 'PENDING', 'APPROVED'] },
      },
    });

    if (activeQuotations > 0) {
      throw new AppError(
        409,
        'HAS_ACTIVE_QUOTATIONS',
        `Cannot delete customer with ${activeQuotations} active quotation(s)`,
      );
    }

    await prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logActivity(prisma, {
      userId,
      action: 'DELETE',
      entityType: 'Customer',
      entityId: id,
      description: `Deleted customer: ${customer.company}`,
      req,
    });
  },
};