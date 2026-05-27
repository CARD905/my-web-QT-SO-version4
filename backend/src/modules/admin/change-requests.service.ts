import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/response';
import { logActivity } from '../../utils/activity-log';
import { buildPaginationMeta, getPaginationParams } from '../../utils/pagination';
import bcrypt from 'bcrypt';

export type ChangePayload = {
  name?: string;
  email?: string;
  phone?: string | null;
  roleId?: string;
  isActive?: boolean;
  approvalLimit?: number | null;
};

const crInclude = {
  targetUser: { select: { id: true, name: true, email: true, role: { select: { code: true, nameTh: true } } } },
  requester:  { select: { id: true, name: true, email: true } },
  reviewedBy: { select: { id: true, name: true } },
} as const;

export const changeRequestsService = {
  async submit(
    requesterId: string,
    targetUserId: string,
    reason: string,
    changes: ChangePayload,
    req?: Request,
  ) {
    if (!reason?.trim()) throw new AppError(400, 'VALIDATION', 'กรุณาระบุเหตุผล');
    if (!changes || Object.keys(changes).length === 0) {
      throw new AppError(400, 'NO_CHANGES', 'กรุณาระบุข้อมูลที่ต้องการเปลี่ยนแปลงอย่างน้อย 1 รายการ');
    }

    const target = await prisma.user.findFirst({
      where: { id: targetUserId, deletedAt: null },
      include: { role: { select: { code: true } } },
    });
    if (!target) throw new AppError(404, 'NOT_FOUND', 'ไม่พบ User ที่ต้องการแก้ไข');
    if (['ADMIN', 'CEO'].includes(target.role.code)) {
      throw new AppError(403, 'FORBIDDEN', 'ไม่สามารถยื่นคำขอแก้ไข Admin หรือ CEO ได้');
    }

    // Validate email uniqueness if changing email
    if (changes.email) {
      const taken = await prisma.user.findFirst({
        where: { email: changes.email, deletedAt: null, id: { not: targetUserId } },
      });
      if (taken) throw new AppError(409, 'EMAIL_EXISTS', `Email ${changes.email} ถูกใช้งานอยู่แล้ว`);
    }

    const cr = await prisma.userChangeRequest.create({
      data: {
        targetUserId,
        requesterId,
        reason: reason.trim(),
        changes: changes as Prisma.InputJsonValue,
        status: 'PENDING',
      },
      include: crInclude,
    });

    // Notify all admins
    const admins = await prisma.user.findMany({
      where: { deletedAt: null, isActive: true, role: { code: 'ADMIN' } },
      select: { id: true },
    });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: 'USER_EDIT_REQUEST' as const,
          title: 'คำขอแก้ไขข้อมูลผู้ใช้',
          message: `${cr.requester.name} ขอแก้ไขข้อมูลของ ${cr.targetUser.name}`,
          link: '/admin/change-requests',
        })),
      });
    }

    await logActivity(prisma, {
      userId: requesterId,
      action: 'change_request.submit',
      entityType: 'UserChangeRequest',
      entityId: cr.id,
      description: `Submitted change request for user: ${target.email}`,
      req,
    });

    return cr;
  },

  async list(query: { status?: string; page?: number; limit?: number }) {
    const { skip, take, page, limit } = getPaginationParams({ ...query, sortOrder: 'desc' } as any);
    const where: Prisma.UserChangeRequestWhereInput = {};
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      prisma.userChangeRequest.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: crInclude,
      }),
      prisma.userChangeRequest.count({ where }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  },

  async approve(id: string, adminId: string, note?: string, req?: Request) {
    const cr = await prisma.userChangeRequest.findUnique({ where: { id }, include: { targetUser: true } });
    if (!cr) throw new AppError(404, 'NOT_FOUND', 'ไม่พบคำขอ');
    if (cr.status !== 'PENDING') throw new AppError(400, 'BAD_REQUEST', 'คำขอนี้ไม่ได้อยู่ในสถานะ PENDING');

    const changes = cr.changes as ChangePayload;
    const updateData: Prisma.UserUpdateInput = {};
    if (changes.name     !== undefined) updateData.name     = changes.name;
    if (changes.email    !== undefined) updateData.email    = changes.email;
    if (changes.phone    !== undefined) updateData.phone    = changes.phone;
    if (changes.isActive !== undefined) updateData.isActive = changes.isActive;
    if (changes.roleId   !== undefined) updateData.role     = { connect: { id: changes.roleId } };
    if (changes.approvalLimit !== undefined) updateData.approvalLimit = changes.approvalLimit ?? null;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.user.update({ where: { id: cr.targetUserId }, data: updateData });
      }
      if (changes.isActive === false) {
        await tx.refreshToken.updateMany({
          where: { userId: cr.targetUserId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await tx.userChangeRequest.update({
        where: { id },
        data: { status: 'APPROVED', adminNote: note ?? null, reviewedById: adminId, reviewedAt: new Date() },
      });
    });

    await prisma.notification.create({
      data: {
        userId: cr.requesterId,
        type: 'USER_EDIT_REQUEST',
        title: 'คำขอแก้ไขได้รับการอนุมัติ',
        message: `คำขอแก้ไขข้อมูลของ ${cr.targetUser.name} ได้รับการอนุมัติแล้ว`,
        link: `/users/${cr.targetUserId}`,
      },
    });

    await logActivity(prisma, {
      userId: adminId,
      action: 'change_request.approve',
      entityType: 'UserChangeRequest',
      entityId: id,
      description: `Approved change request for ${cr.targetUser.email}`,
      req,
    });
  },

  async reject(id: string, adminId: string, note: string, req?: Request) {
    if (!note?.trim()) throw new AppError(400, 'VALIDATION', 'กรุณาระบุเหตุผลที่ปฏิเสธ');
    const cr = await prisma.userChangeRequest.findUnique({ where: { id }, include: { targetUser: true } });
    if (!cr) throw new AppError(404, 'NOT_FOUND', 'ไม่พบคำขอ');
    if (cr.status !== 'PENDING') throw new AppError(400, 'BAD_REQUEST', 'คำขอนี้ไม่ได้อยู่ในสถานะ PENDING');

    await prisma.userChangeRequest.update({
      where: { id },
      data: { status: 'REJECTED', adminNote: note.trim(), reviewedById: adminId, reviewedAt: new Date() },
    });

    await prisma.notification.create({
      data: {
        userId: cr.requesterId,
        type: 'USER_EDIT_REQUEST',
        title: 'คำขอแก้ไขถูกปฏิเสธ',
        message: `คำขอแก้ไขข้อมูลของ ${cr.targetUser.name} ถูกปฏิเสธ: ${note}`,
        link: `/users/${cr.targetUserId}`,
      },
    });

    await logActivity(prisma, {
      userId: adminId,
      action: 'change_request.reject',
      entityType: 'UserChangeRequest',
      entityId: id,
      description: `Rejected change request for ${cr.targetUser.email}: ${note}`,
      req,
    });
  },

  async pendingCount() {
    return prisma.userChangeRequest.count({ where: { status: 'PENDING' } });
  },
};
