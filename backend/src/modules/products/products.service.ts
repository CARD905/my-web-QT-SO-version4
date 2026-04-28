import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/response';
import { buildPaginationMeta, getPaginationParams } from '../../utils/pagination';
import { logActivity } from '../../utils/activity-log';
import {
  CreateProductInput,
  ListProductsQuery,
  UpdateProductInput,
} from './products.schema';

export const productsService = {
  async list(query: ListProductsQuery) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
    };

    if (query.isActive !== undefined) where.isActive = query.isActive;

    if (query.search) {
      where.OR = [
        { sku: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput = query.sortBy
      ? { [query.sortBy]: query.sortOrder }
      : { createdAt: 'desc' };

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take,
        include: { createdBy: { select: { id: true, name: true } } },
      }),
      prisma.product.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  },

  async getById(id: string) {
    const product = await prisma.product.findFirst({
      where: { id, deletedAt: null },
    });
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Product not found');
    return product;
  },

  async create(input: CreateProductInput, userId: string, req?: Request) {
    // Check SKU duplicate (including soft-deleted, since SKU is unique constraint)
    const existing = await prisma.product.findUnique({ where: { sku: input.sku } });
    if (existing) {
      throw new AppError(409, 'DUPLICATE_SKU', `SKU "${input.sku}" already exists`);
    }

    const product = await prisma.product.create({
      data: {
        sku: input.sku,
        name: input.name,
        description: input.description || null,
        unitPrice: input.unitPrice,
        unit: input.unit,
        isActive: input.isActive,
        createdById: userId,
      },
    });

    await logActivity(prisma, {
      userId,
      action: 'CREATE',
      entityType: 'Product',
      entityId: product.id,
      description: `Created product: ${product.sku} - ${product.name}`,
      req,
    });

    return product;
  },

  async update(id: string, input: UpdateProductInput, userId: string, req?: Request) {
    await this.getById(id);

    if (input.sku) {
      const existing = await prisma.product.findFirst({
        where: { sku: input.sku, NOT: { id } },
      });
      if (existing) {
        throw new AppError(409, 'DUPLICATE_SKU', `SKU "${input.sku}" already exists`);
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(input.sku !== undefined && { sku: input.sku }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description || null }),
        ...(input.unitPrice !== undefined && { unitPrice: input.unitPrice }),
        ...(input.unit !== undefined && { unit: input.unit }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    await logActivity(prisma, {
      userId,
      action: 'UPDATE',
      entityType: 'Product',
      entityId: updated.id,
      description: `Updated product: ${updated.sku}`,
      req,
    });

    return updated;
  },

  async softDelete(id: string, userId: string, req?: Request) {
    const product = await this.getById(id);

    await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await logActivity(prisma, {
      userId,
      action: 'DELETE',
      entityType: 'Product',
      entityId: id,
      description: `Deleted product: ${product.sku}`,
      req,
    });
  },
};
