export interface UserDetailData {
  user: {
    id: string; name: string; email: string; phone?: string | null;
    isActive: boolean; isTeamLead: boolean; lastLoginAt?: string | null;
    createdAt: string; approvalLimit?: string | null;
    managerLevel?: 'DIVISION' | 'DEPARTMENT' | 'SECTION' | null; // เพิ่มสำหรับ Manager
    role: { id: string; code: string; nameTh: string };
    team?: { id: string; name: string } | null;
    reportsTo?: { id: string; name: string } | null;
  } | null;
  totals: { quotations: number; approvedValue: number; thisMonth: number };
  byStatus: Array<{ status: string; count: number }>;
  recent: Array<{ id: string; quotationNo: string; status: string; grandTotal: number; createdAt: string }>;
}

export interface RoleOption { id: string; code: string; nameTh: string; level: number; }

// Props มาตรฐานที่ทุก role page รับ
export interface RolePageProps {
  data: UserDetailData;
  roles: RoleOption[];
  onReload: () => Promise<void>;
}