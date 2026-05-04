import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/response';
import { buildPaginationMeta, getPaginationParams, PaginationQuery } from '../../utils/pagination';
import { logActivity } from '../../utils/activity-log';
import { CreateCustomerInput, UpdateCustomerInput } from './customers.schema';
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