import { PrismaClient } from '@prisma/client';

export interface ApproverResult {
  approverId: string;
  approverName: string;
  exceedsLimit: boolean;
}

/**
 * หา approver คนถัดไปจาก userId ที่ส่งมา
 * ไล่ขึ้นไปตาม reportsTo chain
 * ถ้าไม่มี reportsTo → หา CEO
 */
export async function findNextApprover(
  prisma: PrismaClient,
  fromUserId: string,
  grandTotal: number,
): Promise<ApproverResult | null> {
  const fromUser = await prisma.user.findUnique({
    where: { id: fromUserId },
    include: {
      reportsTo: { include: { role: true } },
    },
  });
  if (!fromUser) return null;

  // ถ้ามี reportsTo → ใช้คนนั้นเป็น approver
  if (fromUser.reportsTo) {
    const manager = fromUser.reportsTo;
    const limit = Number(manager.approvalLimit ?? 0);
    const exceedsLimit = limit > 0 && grandTotal > limit;
    return {
      approverId: manager.id,
      approverName: manager.name,
      exceedsLimit,
    };
  }

  // ไม่มี reportsTo → หา CEO
  const ceo = await prisma.user.findFirst({
    where: {
      role: { code: 'CEO' },
      isActive: true,
      deletedAt: null,
    },
  });
  if (!ceo) return null;
  return { approverId: ceo.id, approverName: ceo.name, exceedsLimit: false };
}

/**
 * หา approver ถัดไปเมื่อ manager กด escalate
 * (ใช้ fromUserId = manager คนที่กำลัง escalate)
 */
export async function findEscalationTarget(
  prisma: PrismaClient,
  fromUserId: string,
  grandTotal: number,
): Promise<ApproverResult | null> {
  // reuse logic เดิม — ไล่ขึ้นไปจาก fromUser
  return findNextApprover(prisma, fromUserId, grandTotal);
}