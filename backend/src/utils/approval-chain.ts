import { PrismaClient } from '@prisma/client';

export interface ApproverResult {
  approverId: string;
  approverName: string;
  roleCode: string;
  exceedsLimit: boolean;
}

/**
 * หา approver คนถัดไปจาก userId ที่ส่งมา
 * ไล่ขึ้นไปตาม reportsTo chain
 * ถ้าไม่มี reportsTo → หา CEO
 *
 * grandTotal ต้องเป็น THB เสมอ (แปลงก่อนส่งมาถ้า currency=USD)
 */
export async function findNextApprover(
  prisma: PrismaClient,
  fromUserId: string,
  grandTotal: number,
  currency: 'THB' | 'USD' = 'THB',
  usdExchangeRate: number = 35,
): Promise<ApproverResult | null> {
  // แปลงเป็น THB ก่อนเปรียบเทียบกับ approvalLimit (ซึ่งเก็บเป็น THB เสมอ)
  const grandTotalTHB = currency === 'USD' ? grandTotal * usdExchangeRate : grandTotal;

  const fromUser = await prisma.user.findUnique({
    where: { id: fromUserId },
    include: {
      reportsTo: {
        include: { role: { select: { code: true } } },
      },
    },
  });
  if (!fromUser) return null;

  // ถ้ามี reportsTo → ใช้คนนั้นเป็น approver
  if (fromUser.reportsTo) {
    const manager = fromUser.reportsTo;
    const limit = Number(manager.approvalLimit ?? 0);
    const exceedsLimit = limit > 0 && grandTotalTHB > limit;
    return {
      approverId: manager.id,
      approverName: manager.name,
      roleCode: manager.role.code,
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
  return { approverId: ceo.id, approverName: ceo.name, roleCode: 'CEO', exceedsLimit: false };
}

/**
 * หา approver ถัดไปเมื่อ manager กด escalate
 * (ใช้ fromUserId = manager คนที่กำลัง escalate)
 */
export async function findEscalationTarget(
  prisma: PrismaClient,
  fromUserId: string,
  grandTotal: number,
  currency: 'THB' | 'USD' = 'THB',
  usdExchangeRate: number = 35,
): Promise<ApproverResult | null> {
  return findNextApprover(prisma, fromUserId, grandTotal, currency, usdExchangeRate);
}
