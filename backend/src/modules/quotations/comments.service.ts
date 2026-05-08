import { prisma } from '../../config/prisma';

interface CurrentUser {
  id: string;
  roleCode: string;
}

const ELEVATED_ROLES = ['MANAGER', 'CEO', 'ADMIN', 'APPROVER'];

function isElevated(roleCode: string): boolean {
  return ELEVATED_ROLES.includes(roleCode);
}

export const commentsService = {
  // ─── ดึง comments ของ quotation ─────────────────────────────────────────
  async list(quotationId: string, currentUser: CurrentUser) {
    const elevated = isElevated(currentUser.roleCode);

    const comments = await prisma.quotationComment.findMany({
      where: {
        quotationId,
        // Officer (non-elevated) เห็นเฉพาะ external (isInternal = false)
        ...(elevated ? {} : { isInternal: false }),
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: { select: { code: true, nameTh: true } },
          },
        },
      },
    });

    return comments.map((c) => ({
      id: c.id,
      message: c.message,
      isInternal: c.isInternal,
      createdAt: c.createdAt.toISOString(),
      user: {
        id: c.user.id,
        name: c.user.name,
        role: { code: c.user.role.code, nameTh: c.user.role.nameTh },
      },
    }));
  },

  // ─── สร้าง comment ใหม่ ──────────────────────────────────────────────────
  async create(
    quotationId: string,
    currentUser: CurrentUser,
    data: { message: string; isInternal?: boolean },
  ) {
    const elevated = isElevated(currentUser.roleCode);

    // Officer ส่ง internal ไม่ได้ — บังคับเป็น external
    const isInternal = elevated ? Boolean(data.isInternal) : false;

    const message = data.message.trim();
    if (!message) {
      throw new Error('Comment message is required');
    }

    // ตรวจว่า quotation มีอยู่จริง
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      select: { id: true, deletedAt: true },
    });
    if (!quotation || quotation.deletedAt) {
      throw new Error('NOT_FOUND: Quotation not found');
    }

    const comment = await prisma.quotationComment.create({
      data: {
        quotationId,
        userId: currentUser.id,
        message,
        isInternal,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: { select: { code: true, nameTh: true } },
          },
        },
      },
    });

    return {
      id: comment.id,
      message: comment.message,
      isInternal: comment.isInternal,
      createdAt: comment.createdAt.toISOString(),
      user: {
        id: comment.user.id,
        name: comment.user.name,
        role: { code: comment.user.role.code, nameTh: comment.user.role.nameTh },
      },
    };
  },

  // ─── ลบ comment (เจ้าของ + admin/CEO) ────────────────────────────────────
  async remove(commentId: string, currentUser: CurrentUser) {
    const comment = await prisma.quotationComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new Error('NOT_FOUND: Comment not found');

    // เจ้าของลบเองได้, หรือ admin/CEO
    const isOwner = comment.userId === currentUser.id;
    const isAdmin = ['ADMIN', 'CEO'].includes(currentUser.roleCode);
    if (!isOwner && !isAdmin) {
      throw new Error('FORBIDDEN: Cannot delete this comment');
    }

    await prisma.quotationComment.delete({ where: { id: commentId } });
    return { success: true };
  },
};