import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/response';

export const categoriesService = {
  async list(includeInactive = false) {
    return prisma.productCategory.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  },

  async create(data: { name: string; description?: string | null }) {
    const existing = await prisma.productCategory.findUnique({ where: { name: data.name } });
    if (existing) throw new AppError(409, 'DUPLICATE_NAME', `Category "${data.name}" already exists`);

    return prisma.productCategory.create({
      data: {
        id: crypto.randomUUID(),
        name: data.name,
        description: data.description ?? null,
      },
    });
  },

  async update(id: string, data: { name?: string; description?: string | null; isActive?: boolean }) {
    const cat = await prisma.productCategory.findUnique({ where: { id } });
    if (!cat) throw new AppError(404, 'NOT_FOUND', 'Category not found');

    if (data.name && data.name !== cat.name) {
      const dup = await prisma.productCategory.findUnique({ where: { name: data.name } });
      if (dup) throw new AppError(409, 'DUPLICATE_NAME', `Category "${data.name}" already exists`);
    }

    return prisma.productCategory.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  },

  async remove(id: string) {
    const cat = await prisma.productCategory.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!cat) throw new AppError(404, 'NOT_FOUND', 'Category not found');
    if (cat._count.products > 0) {
      throw new AppError(400, 'CATEGORY_IN_USE', `Cannot delete category with ${cat._count.products} product(s). Remove products first or reassign them.`);
    }
    await prisma.productCategory.delete({ where: { id } });
  },
};
