'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  FileText, ClipboardList, Plus, Upload, ArrowRight,
  Clock, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  FileEdit, Bell, ChevronRight, Inbox, Timer, Eye,
  AlertCircle, CircleDot, Hourglass, Ban, Send,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatDate, formatMoney, formatRelativeTime, getStatusClass } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import type { ApiResponse, SalesDashboard, Notification, SaleOrder } from '@/types/api';

const MANAGER_ROLES = ['MANAGER', 'CEO', 'ADMIN'];

interface OfficerTask {
  id: string;
  quotationNo: string;
  customerCompany: string;
  status: string;
  dueDate?: string | null;
  updatedAt: string;
  priority: 'high' | 'medium' | 'low';
  actionLabel: string;
  rejectionReason?: string | null;
}

interface OfficerDashboard extends SalesDashboard {
  byStatus: {
    draft: number;
    pending: number;
    approved: number;
    rejected: number;
    expiringSoon?: number;
    waitingCustomer?: number;
    needRevision?: number;
  };
  tasks?: OfficerTask[];
  waitingItems?: OfficerTask[];
  overdueItems?: OfficerTask[];
  rejectedItems?: OfficerTask[];
  recentActivity?: Array<{ id: string; action: string; entityRef?: string; entityId?: string; createdAt: string; userName?: string }>;
  notifications?: Notification[];
}

// ─── Task types สำหรับ Sale Order ────────────────────────────────────────────
interface SoTask {
  id: string;
  saleOrderNo: string;
  customerCompany: string;
  status: string;
  grandTotal: string | number;
  currency: string;
  issueDate: string | Date;
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function SalesDashboardPage() {
  const t = useT();
  const router = useRouter();
  const { data: session } = useSession();
  const { role, loading: permLoading } = usePermissions();

  const [stats, setStats] = useState<OfficerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  // ✅ Sale Order tasks state
  const [soTasks, setSoTasks] = useState<SoTask[]>([]);
  const [soLoading, setSoLoading] = useState(true);

  useEffect(() => {
    if (permLoading) return;
    if (role?.code && MANAGER_ROLES.includes(role.code)) {
      setRedirecting(true);
      router.replace('/manager/dashboard');
    }
  }, [role, permLoading, router]);

  // Fetch dashboard data
  useEffect(() => {
    if (permLoading || redirecting) return;
    if (role?.code && MANAGER_ROLES.includes(role.code)) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<ApiResponse<OfficerDashboard>>('/dashboard/sales');
        if (!cancelled && res.data.data) setStats(res.data.data);
      } catch (err) {
        console.error(getApiErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [permLoading, redirecting, role]);

  // ✅ Fetch Sale Orders ที่ต้องทำ (DRAFT + REJECTED)
  useEffect(() => {
    if (permLoading || redirecting) return;
    if (role?.code && MANAGER_ROLES.includes(role.code)) return;

    let cancelled = false;
    (async () => {
      setSoLoading(true);
      try {
        const [draftRes, rejectedRes] = await Promise.all([
          api.get<ApiResponse<SaleOrder[]>>('/sale-orders?status=DRAFT&limit=10'),
          api.get<ApiResponse<SaleOrder[]>>('/sale-orders?status=REJECTED&limit=10'),
        ]);
        if (!cancelled) {
          const drafts = (draftRes.data.data ?? []).map((so) => ({
            id: so.id,
            saleOrderNo: so.saleOrderNo,
            customerCompany: so.customerCompany,
            status: so.status,
            grandTotal: so.grandTotal,
            currency: so.currency,
            issueDate: so.issueDate,
          }));
          const rejected = (rejectedRes.data.data ?? []).map((so) => ({
            id: so.id,
            saleOrderNo: so.saleOrderNo,
            customerCompany: so.customerCompany,
            status: so.status,
            grandTotal: so.grandTotal,
            currency: so.currency,
            issueDate: so.issueDate,
          }));
          setSoTasks([...rejected, ...drafts]); // REJECTED ขึ้นก่อน (สำคัญกว่า)
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setSoLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [permLoading, redirecting, role]);

  if (permLoading || redirecting) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground">
            {redirecting ? 'กำลังเปิด Manager Dashboard...' : 'กำลังโหลด...'}
          </p>
        </div>
      </div>
    );
  }

  const firstName = session?.user?.name?.split(' ')[0] || 'คุณ';

  // รวม tasks ทั้งหมดสำหรับ badge
  const qtTasks = stats?.tasks ?? [];
  const totalTasks = qtTasks.length + soTasks.length;

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard {firstName}</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Online · {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/quotations/new"><Plus className="h-4 w-4" />สร้างใบเสนอราคา</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link href="/quotations/checklist"><Upload className="h-4 w-4" />อัปโหลด PO</Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[0,1,2,3,4,5].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryCard label="Draft" value={stats?.byStatus.draft ?? 0} icon={<FileEdit className="h-4 w-4" />} color="text-slate-500" bg="bg-slate-100 dark:bg-slate-800" href="/quotations?status=DRAFT" />
          <SummaryCard label="รออนุมัติ" value={stats?.byStatus.pending ?? 0} icon={<Hourglass className="h-4 w-4" />} color="text-amber-600" bg="bg-amber-50 dark:bg-amber-900/30" href="/quotations?status=PENDING" />
          <SummaryCard label="ต้องแก้ไข" value={stats?.byStatus.needRevision ?? stats?.byStatus.rejected ?? 0} icon={<RefreshCw className="h-4 w-4" />} color="text-red-600" bg="bg-red-50 dark:bg-red-900/30" href="/quotations?status=REJECTED" alert />
          <SummaryCard label="อนุมัติแล้ว" value={stats?.byStatus.approved ?? 0} icon={<CheckCircle2 className="h-4 w-4" />} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-900/30" href="/quotations?status=APPROVED" />
          <SummaryCard label="ใกล้หมดอายุ" value={stats?.expiringSoon.length ?? 0} icon={<AlertCircle className="h-4 w-4" />} color="text-orange-600" bg="bg-orange-50 dark:bg-orange-900/30" href="/quotations" alert={(stats?.expiringSoon.length ?? 0) > 0} />
          <SummaryCard label="SO รอดำเนินการ" value={soTasks.length} icon={<ClipboardList className="h-4 w-4" />} color="text-violet-600" bg="bg-violet-50 dark:bg-violet-900/30" href="/sale-orders" alert={soTasks.length > 0} />
        </div>
      )}

      {/* ✅ งานที่ต้องทำ — แยก QT / SO */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CircleDot className="h-4 w-4 text-primary" />
            งานที่ต้องทำตอนนี้
            {totalTasks > 0 && (
              <Badge variant="destructive" className="text-[10px] ml-1">{totalTasks}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {loading && soLoading ? (
            <TaskSkeleton count={4} />
          ) : totalTasks === 0 ? (
            <EmptyState icon={<Inbox className="h-8 w-8" />} message="ไม่มีงานที่รออยู่ตอนนี้ 🎉" sub="ทุกอย่างเรียบร้อยดี" />
          ) : (
            <>
              {/* ── ใบเสนอราคา QT ── */}
              {(loading || qtTasks.length > 0) && (
                <div>
                  <div className="flex items-center gap-2 py-2 border-b mb-1">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ใบเสนอราคา (Quotation)</span>
                    {qtTasks.length > 0 && (
                      <Badge variant="outline" className="text-[10px] ml-auto">{qtTasks.length}</Badge>
                    )}
                    <Link href="/quotations" className="text-[11px] text-primary hover:underline flex items-center gap-0.5 ml-1">
                      ดูทั้งหมด <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                  {loading ? (
                    <TaskSkeleton count={2} />
                  ) : qtTasks.length === 0 ? (
                    <div className="py-3 text-center text-xs text-muted-foreground">ไม่มีใบเสนอราคาที่รออยู่</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {qtTasks.map((task) => (
                        <TaskRow key={task.id} task={task} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Sale Order SO ── */}
              <div className="mt-3">
                <div className="flex items-center gap-2 py-2 border-b mb-1">
                  <ClipboardList className="h-3.5 w-3.5 text-violet-500" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sale Order</span>
                  {soTasks.length > 0 && (
                    <Badge variant="outline" className="text-[10px] ml-auto text-violet-600 border-violet-300">{soTasks.length}</Badge>
                  )}
                  <Link href="/sale-orders" className="text-[11px] text-primary hover:underline flex items-center gap-0.5 ml-1">
                    ดูทั้งหมด <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                {soLoading ? (
                  <TaskSkeleton count={2} />
                ) : soTasks.length === 0 ? (
                  <div className="py-3 text-center text-xs text-muted-foreground">ไม่มี Sale Order ที่รออยู่</div>
                ) : (
                  <div className="divide-y divide-border">
                    {soTasks.map((so) => (
                      <SoTaskRow key={so.id} so={so} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Overdue */}
      {(loading || (stats?.overdueItems && stats.overdueItems.length > 0)) && (
        <SectionCard title="เกินกำหนด / หมดอายุ" icon={<Ban className="h-4 w-4 text-red-500" />} badge={stats?.overdueItems?.length} badgeVariant="destructive" urgent>
          {loading ? <TaskSkeleton count={2} /> : (
            <div className="divide-y divide-border">
              {stats?.overdueItems?.map((item) => <TaskRow key={item.id} task={item} isOverdue />)}
            </div>
          )}
        </SectionCard>
      )}

      {/* Rejected / Need Revision */}
      {(loading || (stats?.byStatus.rejected ?? 0) > 0) && (
        <SectionCard title="ถูกปฏิเสธ — ต้องแก้ไข" icon={<XCircle className="h-4 w-4 text-red-500" />} badge={stats?.byStatus.rejected} badgeVariant="destructive">
          {loading ? <TaskSkeleton count={2} /> : stats?.rejectedItems && stats.rejectedItems.length > 0 ? (
            <div className="divide-y divide-border">
              {stats.rejectedItems.map((item) => <RejectedRow key={item.id} task={item} />)}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {stats?.recent.filter((q) => q.status === 'REJECTED').slice(0, 5).map((q) => (
                <RejectedRow key={q.id} task={{ id: q.id, quotationNo: q.quotationNo, customerCompany: q.customerCompany, status: q.status, updatedAt: '', priority: 'high', actionLabel: 'แก้ไขและส่งใหม่', rejectionReason: q.rejectionReason ?? undefined }} />
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* Waiting on Others */}
      <SectionCard title="รออยู่ที่คนอื่น" icon={<Hourglass className="h-4 w-4 text-amber-500" />} badge={stats?.waitingItems?.length}>
        {loading ? <TaskSkeleton count={3} /> : !stats?.waitingItems || stats.waitingItems.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-1">
            <WaitingBlock label="รอ Manager อนุมัติ" count={stats?.byStatus.pending ?? 0} icon={<Hourglass className="h-5 w-5 text-amber-500" />} href="/quotations?status=PENDING" />
            <WaitingBlock label="รอลูกค้าตอบกลับ" count={stats?.byStatus.waitingCustomer ?? 0} icon={<Clock className="h-5 w-5 text-blue-500" />} href="/quotations?status=SENT" />
            <WaitingBlock label="รออัปโหลด PO" count={stats?.byStatus.approved ?? 0} icon={<Upload className="h-5 w-5 text-violet-500" />} href="/quotations/checklist" />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {stats.waitingItems.map((item) => <TaskRow key={item.id} task={item} />)}
          </div>
        )}
      </SectionCard>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <SectionCard title="ใบเสนอราคาล่าสุด" icon={<FileText className="h-4 w-4 text-primary" />} viewAllHref="/quotations">
            {loading ? <TaskSkeleton count={5} /> : !stats?.recent || stats.recent.length === 0 ? (
              <EmptyState icon={<FileText className="h-8 w-8" />} message="ยังไม่มีใบเสนอราคา" sub="กด 'สร้างใบเสนอราคา' เพื่อเริ่มต้น" />
            ) : (
              <div className="divide-y divide-border">
                {stats.recent.slice(0, 8).map((q) => (
                  <Link key={q.id} href={`/quotations/${q.id}`}
                    className="flex items-center gap-3 py-2.5 px-1 hover:bg-accent/40 rounded-md transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{q.quotationNo}</span>
                        <Badge className={getStatusClass(q.status)} variant="outline">{q.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{q.customerCompany}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold">{formatMoney(q.grandTotal)}</div>
                      {q.expiryDate && <div className="text-[10px] text-muted-foreground">หมด {formatDate(q.expiryDate)}</div>}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />การแจ้งเตือนล่าสุด
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <div className="space-y-2">{[0,1,2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
                : !stats?.notifications || stats.notifications.length === 0 ? (
                  <EmptyState icon={<Bell className="h-7 w-7" />} message="ไม่มีการแจ้งเตือน" />
                ) : (
                  <div className="space-y-2">
                    {stats.notifications.slice(0, 5).map((n) => (
                      <Link key={n.id} href={n.link ?? '#'}
                        className={`block p-2.5 rounded-lg border transition-colors hover:border-primary/40 ${!n.isRead ? 'bg-primary/5 border-primary/20' : 'border-border'}`}>
                        <div className="text-xs font-medium text-foreground line-clamp-1">{n.title}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{n.message}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">{formatRelativeTime(n.createdAt)}</div>
                      </Link>
                    ))}
                    <Button asChild variant="ghost" size="sm" className="w-full text-xs mt-1">
                      <Link href="/notifications">ดูทั้งหมด <ArrowRight className="h-3 w-3 ml-1" /></Link>
                    </Button>
                  </div>
                )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Timer className="h-4 w-4 text-orange-500" />ใกล้หมดอายุ
                {(stats?.expiringSoon.length ?? 0) > 0 && (
                  <Badge variant="outline" className="ml-auto text-[10px] bg-orange-50 text-orange-700 border-orange-300">{stats!.expiringSoon.length} ใบ</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <div className="space-y-2">{[0,1,2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
                : stats?.expiringSoon.length === 0 ? (
                  <EmptyState icon={<CheckCircle2 className="h-7 w-7 text-emerald-400" />} message="ไม่มีใบใกล้หมดอายุ" />
                ) : (
                  <div className="space-y-2">
                    {stats?.expiringSoon.map((q) => (
                      <Link key={q.id} href={`/quotations/${q.id}`}
                        className="flex items-center justify-between p-2 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10 hover:border-orange-400 transition-colors gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold truncate">{q.quotationNo}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{q.customerCompany}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] font-medium text-orange-600">{formatDate(q.expiryDate)}</div>
                          <div className="text-[10px] text-muted-foreground">{formatMoney(q.grandTotal)}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

// ✅ Sale Order Task Row
function SoTaskRow({ so }: { so: SoTask }) {
  const isDraft = so.status === 'DRAFT';
  const isRejected = so.status === 'REJECTED';
  return (
    <div className={`flex items-center gap-3 py-2.5 ${isRejected ? '-mx-4 px-4 border-l-2 border-red-400 bg-red-50/50 dark:bg-red-900/10' : ''}`}>
      <div className={`h-2 w-2 rounded-full shrink-0 ${isRejected ? 'bg-red-500' : 'bg-violet-400'}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{so.saleOrderNo}</span>
          <Badge
            variant="outline"
            className={isRejected
              ? 'text-[10px] bg-red-100 text-red-700 border-red-300'
              : 'text-[10px] bg-violet-100 text-violet-700 border-violet-300'
            }
          >
            {so.status}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">{so.customerCompany}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{formatMoney(so.grandTotal, so.currency as any)}</div>
      </div>
      <div className="shrink-0">
        <Button asChild size="sm" variant="outline" className={`h-7 text-xs gap-1 ${isRejected ? 'border-red-300 text-red-700 hover:bg-red-50' : 'border-violet-300 text-violet-700 hover:bg-violet-50'}`}>
          <Link href={`/sale-orders/${so.id}`}>
            {isRejected
              ? <><RefreshCw className="h-3 w-3" />แก้ไข</>
              : <><Send className="h-3 w-3" />ส่งอนุมัติ</>
            }
          </Link>
        </Button>
      </div>
    </div>
  );
}

function SectionCard({ title, icon, badge, badgeVariant = 'secondary', urgent = false, viewAllHref, children }: {
  title: string; icon: React.ReactNode; badge?: number;
  badgeVariant?: 'secondary' | 'destructive'; urgent?: boolean;
  viewAllHref?: string; children: React.ReactNode;
}) {
  return (
    <Card className={urgent ? 'border-red-500/40' : ''}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon}{title}
          {badge != null && badge > 0 && <Badge variant={badgeVariant} className="text-[10px] ml-1">{badge}</Badge>}
          {viewAllHref && (
            <Link href={viewAllHref} className="ml-auto text-[11px] text-primary hover:underline flex items-center gap-0.5">
              ดูทั้งหมด <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function TaskRow({ task, isOverdue = false }: { task: OfficerTask; isOverdue?: boolean }) {
  const priorityBadge = {
    high: <Badge className="text-[10px] bg-red-100 text-red-700 border-red-300" variant="outline">High</Badge>,
    medium: <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-300" variant="outline">Medium</Badge>,
    low: <Badge className="text-[10px] bg-gray-100 text-gray-600 border-gray-300" variant="outline">Low</Badge>,
  }[task.priority];
  return (
    <div className={`flex items-center gap-3 py-2.5 ${isOverdue ? 'bg-red-50/50 dark:bg-red-900/10 -mx-4 px-4 border-l-2 border-red-500' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{task.quotationNo}</span>
          {priorityBadge}
          <Badge className={getStatusClass(task.status)} variant="outline">{task.status}</Badge>
        </div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">{task.customerCompany}</div>
        {task.dueDate && (
          <div className={`text-[10px] mt-0.5 flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
            {isOverdue && <AlertTriangle className="h-3 w-3" />}
            {isOverdue ? 'หมดอายุแล้ว: ' : 'ครบกำหนด: '}{formatDate(task.dueDate)}
          </div>
        )}
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        {task.updatedAt && <div className="text-[10px] text-muted-foreground">{formatRelativeTime(task.updatedAt)}</div>}
        <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1">
          <Link href={`/quotations/${task.id}`}><Eye className="h-3 w-3" />{task.actionLabel}</Link>
        </Button>
      </div>
    </div>
  );
}

function RejectedRow({ task }: { task: OfficerTask }) {
  return (
    <div className="py-2.5 flex items-start gap-3">
      <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{task.quotationNo}</span>
          <span className="text-xs text-muted-foreground">{task.customerCompany}</span>
        </div>
        {task.rejectionReason && <div className="text-xs text-red-600 dark:text-red-400 mt-0.5 line-clamp-2">เหตุผล: {task.rejectionReason}</div>}
        {task.updatedAt && <div className="text-[10px] text-muted-foreground mt-1">{formatRelativeTime(task.updatedAt)}</div>}
      </div>
      <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0 border-red-300 text-red-700 hover:bg-red-50">
        <Link href={`/quotations/${task.id}/edit`}><RefreshCw className="h-3 w-3" />แก้ไข</Link>
      </Button>
    </div>
  );
}

function WaitingBlock({ label, count, icon, href }: { label: string; count: number; icon: React.ReactNode; href: string }) {
  return (
    <Link href={href} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-border bg-muted/30 hover:border-primary/40 hover:bg-accent/30 transition-colors text-center">
      {icon}
      <div className="text-2xl font-bold">{count}</div>
      <div className="text-xs text-muted-foreground leading-snug">{label}</div>
    </Link>
  );
}

function SummaryCard({ label, value, icon, color, bg, href, alert = false }: {
  label: string; value: number; icon: React.ReactNode; color: string; bg: string; href: string; alert?: boolean;
}) {
  return (
    <Link href={href}>
      <Card className={`hover:border-primary/40 transition-all cursor-pointer ${alert && value > 0 ? 'border-red-400/50 dark:border-red-600/50' : ''}`}>
        <CardContent className="p-3">
          <div className={`inline-flex p-1.5 rounded-lg ${bg} ${color} mb-2`}>{icon}</div>
          <div className={`text-2xl font-bold ${alert && value > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{value}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState({ icon, message, sub }: { icon: React.ReactNode; message: string; sub?: string }) {
  return (
    <div className="py-8 flex flex-col items-center text-center gap-2 text-muted-foreground">
      <div className="opacity-30">{icon}</div>
      <p className="text-sm font-medium">{message}</p>
      {sub && <p className="text-xs opacity-70">{sub}</p>}
    </div>
  );
}

function TaskSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-32" /></div>
          <Skeleton className="h-7 w-20" />
        </div>
      ))}
    </div>
  );
}