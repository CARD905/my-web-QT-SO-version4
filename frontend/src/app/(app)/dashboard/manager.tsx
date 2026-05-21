
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp, Clock, CheckCircle2, XCircle, DollarSign,
  Users as UsersIcon, Inbox, Crown, Filter, Calendar,
  BarChart2, Flame, ArrowRight, Info, AlertTriangle,
  Timer, ChevronRight, Zap,
  RefreshCw, Activity,
  ShoppingCart, Target, TrendingDown, Award, PieChart, Percent,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/utils';
import { toast } from 'sonner';
import type { ApiResponse } from '@/types/api';
import { usePermissions } from '@/hooks/use-permissions';

// ─── Types ────────────────────────────────────────────────────────────────────
type DashboardFilter = 'self' | 'team' | 'all' | 'user';

interface DashboardData {
  filter: DashboardFilter;
  filterUserId?: string;
  isApproverView?: boolean;
  totals: {
    quotations: number;
    pending: number;
    escalated: number;
    approved: number;
    rejected: number;
    totalValue: number;
    pendingValue: number;
    poVerificationPending?: number;
    soConfirmed?: number;
    soPending?: number;
    conversionRate?: number;
    waitingPo?: number;
  };
  todayActivity: { approved: number; rejected: number };
  monthActivity?: { approved: number; rejected: number };
  allTimeActivity?: { approved: number; rejected: number };
  avgApprovalHours?: number | null;
  topOfficers: Array<{
    userId: string; userName: string; userEmail: string;
    count: number; value: number; soValue?: number;
    conversionRate?: number; pendingCount?: number;
    winRate?: number; avgDealSize?: number; approvedCount?: number; approvedValue?: number;
  }>;
  recentEscalated: Array<{
    id: string; quotationNo: string; grandTotal: number;
    customerCompany: string; createdByName: string; submittedAt: string;
  }>;
  statusBreakdown: Array<{ status: string; count: number }>;
  trendData?: Array<{ month: string; approved: number; rejected: number }>;
  revenueTrend?: Array<{ month: string; value: number }>;
  expiringQuotations?: Array<{
    id: string; quotationNo: string; customerCompany: string;
    grandTotal: number; expiryDate: string; status: string;
  }>;
  alerts?: Array<{ type: 'danger' | 'warning' | 'info'; title: string; desc: string }>;
  rejectionReasons?: Array<{ reason: string; count: number }>;
  bottlenecks?: Array<{
    type: string; count: number; value: number;
    reason: string; priority: 'high' | 'medium' | 'low';
  }>;
  marginAnalysis?: {
    totalDiscountGiven: number;
    totalApprovedSubtotal: number;
    avgDiscountRate: number;
    specialDiscountCount: number;
    approvedCount: number;
  };
  customerInsights?: Array<{
    customerId: string;
    customerCompany: string;
    qtCount: number;
    totalValue: number;
  }>;
  agingBuckets?: {
    lt1d:  { count: number; value: number };
    d1to3: { count: number; value: number };
    d3to7: { count: number; value: number };
    gt7d:  { count: number; value: number };
  };
  soExecution?: {
    statusBreakdown: Array<{ status: string; count: number; value: number }>;
    overdueCount: number;
    totalSos: number;
    completedValue: number;
    completedCount: number;
  };
  forecast?: {
    nextMonthForecast: number;
    pipelineCoverage: number;
    avgMonthlyRevenue: number;
  };
}

interface FilterableUser {
  id: string; name: string; email: string;
  role: { code: string; nameTh: string };
  reportsTo?: { id: string; name: string } | null;
}

const STATUS_CFG: Record<string, { color: string; hex: string; label: string }> = {
  DRAFT:             { color: 'bg-slate-400',   hex: '#94a3b8', label: 'Draft' },
  PENDING:           { color: 'bg-amber-400',   hex: '#fbbf24', label: 'Pending' },
  PENDING_BACKUP:    { color: 'bg-amber-500',   hex: '#f59e0b', label: 'Pending Backup' },
  PENDING_ESCALATED: { color: 'bg-rose-500',    hex: '#f43f5e', label: 'Escalated' },
  APPROVED:          { color: 'bg-emerald-500', hex: '#10b981', label: 'Approved' },
  REJECTED:          { color: 'bg-red-500',     hex: '#ef4444', label: 'Rejected' },
  CANCELLED:         { color: 'bg-gray-400',    hex: '#9ca3af', label: 'Cancelled' },
  EXPIRED:           { color: 'bg-gray-500',    hex: '#6b7280', label: 'Expired' },
  PO_PENDING:        { color: 'bg-amber-300',   hex: '#fcd34d', label: 'PO Pending' },
  PO_APPROVED:       { color: 'bg-teal-500',    hex: '#14b8a6', label: 'PO Approved' },
  PO_REJECTED:       { color: 'bg-red-400',     hex: '#f87171', label: 'PO Rejected' },
};

// ════════════════════════════════════════════════════════════════════════════
// OUTER PAGE — filter state + data fetching (unchanged logic)
// ════════════════════════════════════════════════════════════════════════════
export default function ManagerDashboardPage() {
  const { role, loading: permLoading } = usePermissions();
  const [data, setData] = useState<DashboardData | null>(null);
  const [users, setUsers] = useState<FilterableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterValue, setFilterValue] = useState<string>('self');
  const [spinning, setSpinning] = useState(false);

  const isExecutive = role?.code === 'CEO' || role?.code === 'ADMIN';
  const isManagerLike = role?.code === 'MANAGER' || isExecutive;

  useEffect(() => {
    if (permLoading || !isManagerLike) return;
    api.get<ApiResponse<FilterableUser[]>>('/manager-dashboard/filterable-users')
      .then((r) => setUsers(r.data.data ?? []))
      .catch(console.error);
  }, [permLoading, isManagerLike]);

  const fetchDashboard = useCallback(async () => {
    if (permLoading) return;
    setLoading(true);
    try {
      let url = '/manager-dashboard/overview';
      if (filterValue.startsWith('user:')) {
        url += '?filter=user&userId=' + encodeURIComponent(filterValue.slice(5));
      } else {
        url += '?filter=' + filterValue;
      }
      const res = await api.get<ApiResponse<DashboardData>>(url);
      setData(res.data.data ?? null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [permLoading, filterValue]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const handleRefresh = async () => {
    setSpinning(true);
    await fetchDashboard();
    setTimeout(() => setSpinning(false), 600);
  };

  if (permLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0,1,2,3,4,5,6,7].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const managers = users.filter((u) => u.role.code === 'MANAGER');
  const subordinates = users.filter((u) => u.role.code !== 'MANAGER');
  const selectedUser = filterValue.startsWith('user:')
    ? users.find((u) => u.id === filterValue.slice(5)) : null;
  const filterLabel = filterValue === 'self' ? 'Me (Default)'
    : filterValue === 'team' ? 'My Team'
    : filterValue === 'all' ? 'ทั้งระบบ'
    : selectedUser ? `${selectedUser.name} (${selectedUser.role.nameTh})` : 'User';
  const isTeamView = filterValue === 'team' || filterValue === 'all';
  const isUserView = filterValue.startsWith('user:');
  const isSelfView = filterValue === 'self';

  return (
    <div className="space-y-0 max-w-7xl">

      {/* ── SECTION 1: Dark gradient header banner ── */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 rounded-2xl px-6 py-5 mb-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2.5 text-white">
              <Crown className="h-6 w-6 text-amber-400" />
              Sales Dashboard
            </h1>
            <p className="text-sm text-blue-200/80 mt-1">
              กำลังดู: <span className="font-semibold text-white">{filterLabel}</span>
              {role?.nameTh && <span className="text-blue-200/60"> · {role.nameTh}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-blue-300 shrink-0" />
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="h-9 min-w-[200px] rounded-lg border border-white/20 bg-white/10 text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 backdrop-blur"
              >
                <option value="self" className="text-black bg-white">— Me (Default)</option>
                {role?.code === 'MANAGER' && <option value="team" className="text-black bg-white">— My Team</option>}
                {isExecutive && (
                  <>
                    <option value="team" className="text-black bg-white">— My Team</option>
                    <option value="all" className="text-black bg-white">— All Team (ทั้งระบบ)</option>
                  </>
                )}
                {managers.length > 0 && (
                  <optgroup label="Managers">
                    {managers.map((u) => <option key={u.id} value={`user:${u.id}`} className="text-black bg-white">{u.name}</option>)}
                  </optgroup>
                )}
                {subordinates.length > 0 && (
                  <optgroup label="Officers / Sales">
                    {subordinates.map((u) => (
                      <option key={u.id} value={`user:${u.id}`} className="text-black bg-white">
                        {u.reportsTo ? `↳ ${u.name}` : u.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <button
              onClick={handleRefresh}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${spinning ? 'animate-spin' : ''}`} />
            </button>
            {isExecutive && (
              <Button asChild variant="outline" size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <Link href="/manager/users"><UsersIcon className="h-4 w-4" />จัดการผู้ใช้</Link>
              </Button>
            )}
          </div>
        </div>

        {/* User context banner inside header */}
        {isUserView && selectedUser && (
          <div className="mt-3 flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-lg px-3 py-2 text-sm text-blue-100">
            <Info className="h-4 w-4 text-blue-300 shrink-0" />
            <span>กำลังดูข้อมูลของ <span className="font-semibold text-white">{selectedUser.name}</span>
              <span className="text-blue-200/70 ml-1">({selectedUser.role.nameTh})</span>
            </span>
          </div>
        )}
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[0,1,2,3,4,5,6,7].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      )}

      {!loading && !data && (
        <Card className="rounded-2xl">
          <CardContent className="py-20 text-center text-muted-foreground">
            ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง
          </CardContent>
        </Card>
      )}

      {!loading && data && (
        <DashboardContent
          data={data}
          isTeamView={isTeamView}
          isUserView={isUserView}
          isSelfView={isSelfView}
          selectedUserName={selectedUser?.name}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD CONTENT — redesigned
// ════════════════════════════════════════════════════════════════════════════
function DashboardContent({
  data, isTeamView, isUserView, isSelfView, selectedUserName,
}: {
  data: DashboardData;
  isTeamView: boolean;
  isUserView: boolean;
  isSelfView: boolean;
  selectedUserName?: string;
}) {
  // ── Derived values ────────────────────────────────────────────────────────
  const conversionRate = data.totals.conversionRate ??
    (data.totals.quotations > 0 && data.totals.approved > 0
      ? Math.round((data.totals.approved / data.totals.quotations) * 100) : 0);

  const monthApproved = data.monthActivity?.approved ?? 0;
  const monthRejected = data.monthActivity?.rejected ?? 0;
  const monthTotal = monthApproved + monthRejected;
  const monthRate = monthTotal > 0 ? Math.round((monthApproved / monthTotal) * 100) : null;

  const allApproved = data.allTimeActivity?.approved ?? data.totals.approved;
  const allRejected = data.allTimeActivity?.rejected ?? data.totals.rejected;
  const allTotal = allApproved + allRejected;
  const allRate = allTotal > 0 ? Math.round((allApproved / allTotal) * 100) : null;

  const todayTotal = data.todayActivity.approved + data.todayActivity.rejected;
  const todayRate = todayTotal > 0 ? Math.round((data.todayActivity.approved / todayTotal) * 100) : null;

  const noKpiData = data.totals.quotations === 0 && data.totals.pending === 0 &&
    data.totals.approved === 0 && data.totals.rejected === 0;

  const trendData = data.trendData ?? [];
  const revenueTrendData = data.revenueTrend ?? [];
  const reasons = data.rejectionReasons ?? [];
  const maxReason = Math.max(...reasons.map((r) => r.count), 1);

  const alerts: Array<{ type: 'danger' | 'warning' | 'info'; title: string; desc: string }> =
    data.alerts ?? [
      ...(data.totals.escalated > 0
        ? [{ type: 'danger' as const, title: `${data.totals.escalated} escalated case${data.totals.escalated > 1 ? 's' : ''} รอ CEO อนุมัติ`, desc: 'ใบเสนอราคามูลค่าสูงเกินอำนาจอนุมัติ' }]
        : []),
      ...(data.totals.pending > 5
        ? [{ type: 'warning' as const, title: `${data.totals.pending} ใบรออนุมัติ`, desc: 'ตรวจสอบว่ามีรายการเกิน SLA 48 ชั่วโมงหรือไม่' }]
        : []),
      ...((data.totals.poVerificationPending ?? 0) > 0
        ? [{ type: 'warning' as const, title: `${data.totals.poVerificationPending} PO รอตรวจสอบ`, desc: 'มีไฟล์ PO ที่ Officer อัปโหลดแล้ว รอการอนุมัติ' }]
        : []),
    ];

  const bottlenecks = data.bottlenecks ?? [
    ...(data.totals.pending > 0
      ? [{ type: 'QT Pending Approval', count: data.totals.pending, value: data.totals.pendingValue, reason: 'รอ Manager อนุมัติ', priority: 'high' as const }]
      : []),
    ...((data.totals.poVerificationPending ?? 0) > 0
      ? [{ type: 'PO Validation Pending', count: data.totals.poVerificationPending!, value: 0, reason: 'PO รอตรวจสอบความถูกต้อง', priority: 'medium' as const }]
      : []),
    ...(data.totals.escalated > 0
      ? [{ type: 'Escalated Cases', count: data.totals.escalated, value: 0, reason: 'มูลค่าเกินอำนาจอนุมัติ — รอ CEO', priority: 'high' as const }]
      : []),
  ];

  // Approved value (approved + po_approved sum)
  const approvedValue = data.totals.totalValue; // backend already filters APPROVED+PO_APPROVED

  return (
    <div className="space-y-5">

      {/* ══ SECTION 2: KPI Cards — Row 1 (Financial) ══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Total QT Value"
          value={formatMoney(data.totals.totalValue)}
          gradient="from-blue-600 to-indigo-700"
          subtitle={`${data.totals.quotations} ใบเสนอราคา`}
          isText
        />
        <KpiCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Approved Value"
          value={formatMoney(approvedValue)}
          gradient="from-emerald-500 to-teal-700"
          subtitle={`${data.totals.approved} รายการอนุมัติแล้ว`}
          isText
        />
        <KpiCard
          icon={<Clock className="h-5 w-5" />}
          label="Pending Value"
          value={formatMoney(data.totals.pendingValue)}
          gradient="from-amber-500 to-orange-600"
          subtitle={`${data.totals.pending} รายการรออนุมัติ`}
          isText
        />
        <KpiCard
          icon={<Activity className="h-5 w-5" />}
          label="Avg Approval Time"
          value={data.totals !== undefined && (data as any).avgApprovalHours != null
            ? `${(data as any).avgApprovalHours} ชม.`
            : '— ชม.'}
          gradient="from-purple-600 to-violet-700"
          subtitle="เฉลี่ย submittedAt → approvedAt"
          isText
        />
      </div>

      {/* ══ KPI Cards — Row 2 (Pipeline) ══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<BarChart2 className="h-5 w-5" />}
          label="Total Quotations"
          value={data.totals.quotations}
          gradient="from-slate-600 to-slate-800"
          subtitle="ทั้งหมดในระบบ"
        />
        <KpiCard
          icon={<Inbox className="h-5 w-5" />}
          label="Pending Review"
          value={data.totals.pending}
          gradient="from-amber-500 to-yellow-600"
          subtitle={data.totals.escalated > 0 ? `${data.totals.escalated} Escalated` : 'ไม่มีรายการด่วน'}
          alertRing={data.totals.pending > 5}
        />
        <KpiCard
          icon={<Flame className="h-5 w-5" />}
          label="CEO Escalated"
          value={data.totals.escalated}
          gradient="from-rose-500 to-red-700"
          subtitle="ต้องรอ CEO อนุมัติ"
          alertRing={data.totals.escalated > 0}
        />
        <KpiCard
          icon={<Zap className="h-5 w-5" />}
          label="Conversion Rate"
          value={`${conversionRate}%`}
          gradient="from-cyan-500 to-blue-600"
          subtitle="QT Issued → SO Confirmed"
          isText
        />
      </div>

      {/* hint เมื่อ KPI ว่าง */}
      {noKpiData && (isUserView || isSelfView) && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm">
          <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <span className="text-muted-foreground">
            {isUserView
              ? `ไม่พบข้อมูลใบเสนอราคาของ ${selectedUserName ?? 'บุคคลนี้'}`
              : 'ไม่มีข้อมูลใน queue ขณะนี้ — ลองเปลี่ยน filter เป็น "My Team" หรือ "All Team"'}
          </span>
        </div>
      )}

      {/* ══ SECTION 3: Sales Funnel + Revenue Area Chart (2 columns) ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* LEFT: Sales Pipeline Funnel */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <div className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Sales Pipeline
          </div>
          <SalesFunnel data={data} conversionRate={conversionRate} />
        </div>

        {/* RIGHT: Revenue Area Chart */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <div className="text-sm font-semibold flex items-center gap-2 text-foreground mb-1">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Revenue Trend (6 เดือน)
          </div>
          <p className="text-xs text-muted-foreground mb-3">มูลค่าที่อนุมัติแล้วรายเดือน</p>
          {revenueTrendData.length > 0
            ? <RevenueAreaChart data={revenueTrendData} />
            : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-xs">
                ยังไม่มีข้อมูล revenue
              </div>
            )
          }
        </div>
      </div>

      {/* ══ SECTION 4: Status Breakdown + Expiring Quotations ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* LEFT: Status Breakdown */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <div className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
            <BarChart2 className="h-4 w-4 text-purple-500" />
            Status Breakdown
          </div>
          {data.statusBreakdown.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">ไม่มีข้อมูลใน filter นี้</p>
              {isSelfView && <p className="text-xs mt-1 opacity-70">ลองเปลี่ยน filter เป็น "My Team" หรือ "All Team"</p>}
            </div>
          ) : (
            <div className="space-y-3">
              {data.statusBreakdown.map((s) => {
                const pct = data.totals.quotations > 0 ? Math.round((s.count / data.totals.quotations) * 100) : 0;
                const cfg = STATUS_CFG[s.status];
                return (
                  <div key={s.status}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ background: cfg?.hex ?? '#9ca3af' }} />
                        {cfg?.label ?? s.status}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {s.count} <span className="text-[10px]">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 2)}%`, background: cfg?.hex ?? '#9ca3af' }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t flex justify-between text-xs mt-1">
                <span className="text-muted-foreground">รวมทั้งหมด</span>
                <span className="font-semibold">{data.totals.quotations} ใบ</span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Expiring Quotations */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <div className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
            <Timer className="h-4 w-4 text-rose-500" />
            Expiring Soon (7 วัน)
            {(data.expiringQuotations?.length ?? 0) > 0 && (
              <Badge variant="outline" className="ml-auto text-[10px] bg-rose-50 text-rose-700 border-rose-300">
                {data.expiringQuotations!.length} รายการ
              </Badge>
            )}
          </div>
          {!data.expiringQuotations || data.expiringQuotations.length === 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              ไม่มีใบเสนอราคาที่ใกล้หมดอายุ
            </div>
          ) : (
            <div className="space-y-2">
              {data.expiringQuotations.map((q) => {
                const daysLeft = Math.ceil((new Date(q.expiryDate).getTime() - Date.now()) / 86400000);
                const urgency = daysLeft < 1 ? 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                  : daysLeft <= 3 ? 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
                  : 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
                const dayLabel = daysLeft < 1 ? 'วันนี้!' : `${daysLeft} วัน`;
                return (
                  <Link key={q.id} href={`/quotations/${q.id}`}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-opacity hover:opacity-80 gap-3 ${urgency}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm">{q.quotationNo}</div>
                      <div className="text-xs opacity-75 truncate">{q.customerCompany}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold">{dayLabel}</div>
                      <div className="text-[10px] opacity-75">{formatMoney(q.grandTotal)}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══ SECTION 5: Approval Activity (3-column card) ══ */}
      <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
        <div className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
          <BarChart2 className="h-4 w-4 text-primary" />
          Approval Activity
          <span className="text-[10px] text-muted-foreground font-normal ml-1">(งานที่คุณอนุมัติ/ปฏิเสธเอง)</span>
        </div>
        <div className="grid grid-cols-3 gap-4 divide-x divide-border">
          <ActivityCol
            icon={<Clock className="h-3.5 w-3.5" />}
            label="วันนี้"
            iconBg="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
            approved={data.todayActivity.approved}
            rejected={data.todayActivity.rejected}
            rate={todayRate}
          />
          <ActivityCol
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="เดือนนี้"
            iconBg="bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400"
            approved={monthApproved}
            rejected={monthRejected}
            rate={monthRate}
          />
          <ActivityCol
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="ทั้งหมด"
            iconBg="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
            approved={allApproved}
            rejected={allRejected}
            rate={allRate}
          />
        </div>
      </div>

      {/* ══ SECTION 6: Bottlenecks + Alerts ══ */}
      {bottlenecks.length > 0 && (
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <div className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Bottleneck — จุดติดขัดที่ต้องจัดการ
            <Badge variant="outline" className="ml-auto text-[10px] bg-amber-50 text-amber-700 border-amber-300">
              {bottlenecks.length} รายการ
            </Badge>
          </div>
          <div className="space-y-2">
            {bottlenecks.map((b, i) => (
              <div key={i} className={`flex items-center gap-4 p-3 rounded-xl border ${
                b.priority === 'high' ? 'bg-red-500/5 border-red-500/30'
                : b.priority === 'medium' ? 'bg-amber-500/5 border-amber-500/30'
                : 'bg-blue-500/5 border-blue-500/30'
              }`}>
                <div className={`w-1 h-10 rounded-full shrink-0 ${
                  b.priority === 'high' ? 'bg-red-500'
                  : b.priority === 'medium' ? 'bg-amber-500'
                  : 'bg-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{b.type}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{b.reason}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-xl">{b.count}</div>
                  {b.value > 0 && <div className="text-xs text-muted-foreground">{formatMoney(b.value)}</div>}
                </div>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${
                  b.priority === 'high' ? 'bg-red-50 text-red-700 border-red-300'
                  : b.priority === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-blue-50 text-blue-700 border-blue-300'
                }`}>
                  {b.priority.toUpperCase()}
                </Badge>
                <Button asChild size="sm" variant="outline" className="h-7 text-xs shrink-0">
                  <Link href="/quotations">ดู <ChevronRight className="h-3 w-3 ml-0.5" /></Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <div className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Action Required — ต้องดูแลเป็นพิเศษ
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 ml-auto">
              {alerts.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-2.5 p-3 rounded-xl border text-sm ${
                a.type === 'danger' ? 'bg-red-500/5 border-red-500/30'
                : a.type === 'warning' ? 'bg-amber-500/5 border-amber-500/30'
                : 'bg-blue-500/5 border-blue-500/30'
              }`}>
                <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${
                  a.type === 'danger' ? 'text-red-500'
                  : a.type === 'warning' ? 'text-amber-500'
                  : 'text-blue-500'
                }`} />
                <div>
                  <div className="font-medium text-foreground">{a.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{a.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ SECTION 7: Escalated Cases ══ */}
      {data.recentEscalated.length > 0 && (
        <div className="bg-gradient-to-br from-rose-500/10 to-red-600/5 border border-rose-500/40 rounded-2xl shadow-sm p-5">
          <div className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Flame className="h-4 w-4 text-rose-500" />
            <span className="text-rose-700 dark:text-rose-400">Escalated — รอ CEO อนุมัติ</span>
            <Badge variant="outline" className="text-xs bg-rose-100 text-rose-800 border-rose-300 ml-auto">
              {data.recentEscalated.length} รายการ
            </Badge>
          </div>
          <div className="space-y-2">
            {data.recentEscalated.map((q) => (
              <Link key={q.id} href={`/quotations/${q.id}`}
                className="flex items-center justify-between p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 hover:border-rose-400 transition-colors gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{q.quotationNo}</span>
                    <Badge variant="outline" className="text-[10px] bg-rose-100 text-rose-700 border-rose-300">ESCALATED</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {q.customerCompany} · โดย {q.createdByName}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">ส่งเมื่อ {formatDate(q.submittedAt)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-rose-700 dark:text-rose-400">{formatMoney(q.grandTotal)}</div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto mt-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ══ SECTION 8: Sales Team Performance + Rejection Reasons ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Sales Team Performance */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <div className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
            <UsersIcon className="h-4 w-4 text-blue-500" />
            Sales Team Performance
          </div>
          {data.topOfficers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UsersIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">
                {isTeamView ? 'ยังไม่มีข้อมูลในช่วงนี้'
                  : isSelfView ? 'เลือก "My Team" เพื่อดูข้อมูลทีม'
                  : 'ไม่มีข้อมูลสำหรับบุคคลนี้'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[24px_1fr_auto_auto_auto_auto] text-[10px] text-muted-foreground uppercase px-2 pb-2 border-b gap-2 items-center">
                <span>#</span><span>ชื่อ</span><span className="text-center">QT</span>
                <span className="text-right">Win%</span><span className="text-right">Avg Deal</span><span className="text-right">Value</span>
              </div>
              {data.topOfficers.map((o, idx) => {
                const maxVal = Math.max(...data.topOfficers.map((x) => x.value), 1);
                const barPct = Math.round((o.value / maxVal) * 100);
                const winRate = o.winRate ?? (o.conversionRate ?? 0);
                const avgDeal = o.avgDealSize ?? (o.count > 0 ? Math.round(o.value / o.count) : 0);
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                const rankColor = idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-orange-400' : 'text-muted-foreground';
                return (
                  <Link key={o.userId} href={`/manager/users/${o.userId}`}
                    className="block p-2 rounded-xl hover:bg-accent transition-colors"
                  >
                    <div className="grid grid-cols-[24px_1fr_auto_auto_auto_auto] items-center gap-2 mb-1.5">
                      <span className={`text-xs font-bold text-center ${rankColor}`}>{medal ?? (idx + 1)}</span>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{o.userName}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{o.userEmail}</div>
                      </div>
                      <Badge variant="outline" className="text-xs">{o.count}</Badge>
                      <div className="text-xs text-right font-semibold text-emerald-600">{winRate}%</div>
                      <div className="text-xs text-right text-muted-foreground">{formatMoney(avgDeal)}</div>
                      <div className="text-sm font-semibold text-right">{formatMoney(o.value)}</div>
                    </div>
                    <div className="ml-7 h-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                        style={{ width: `${barPct}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Rejection Reasons */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <div className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
            <XCircle className="h-4 w-4 text-red-500" />
            Top Rejection Reasons
          </div>
          {reasons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <XCircle className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">ยังไม่มีข้อมูล rejection</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reasons.map((r, i) => {
                const pct = Math.round((r.count / maxReason) * 100);
                const redShades = ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2'];
                const shade = redShades[Math.min(i, redShades.length - 1)];
                return (
                  <div key={r.reason}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-foreground truncate max-w-[70%]">{r.reason}</span>
                      <span className="text-muted-foreground ml-2 shrink-0 tabular-nums">{r.count} ครั้ง</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: shade }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══ SECTION 9: Approval Trend Chart ══ */}
      <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
        <div className="text-sm font-semibold flex items-center gap-2 text-foreground mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          Approval Trend — 6 เดือนล่าสุด
        </div>
        <div className="flex gap-5 mb-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-0.5 bg-emerald-500 rounded" />Approved
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 border-t-2 border-dashed border-red-500" />Rejected
          </span>
        </div>
        {trendData.length > 0
          ? <TrendChart data={trendData} />
          : (
            <div className="flex items-center justify-center h-44 text-muted-foreground text-xs">
              ยังไม่มีข้อมูล trend
            </div>
          )
        }
      </div>

      {/* ══ SECTION 10: Customer Insight + Margin Analysis ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Customer Insight */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <div className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
            <Target className="h-4 w-4 text-violet-500" />
            Customer Insight — Top ลูกค้า
            <Badge variant="outline" className="ml-auto text-[10px]">{data.customerInsights?.length ?? 0} ราย</Badge>
          </div>
          {!data.customerInsights || data.customerInsights.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">ยังไม่มีข้อมูลลูกค้า</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(() => {
                const maxVal = Math.max(...data.customerInsights!.map((c) => c.totalValue), 1);
                return data.customerInsights!.map((c, i) => {
                  const pct = Math.round((c.totalValue / maxVal) * 100);
                  const gradients = ['from-violet-500 to-purple-600','from-blue-500 to-indigo-600','from-cyan-500 to-blue-600','from-teal-500 to-emerald-600','from-amber-500 to-orange-600'];
                  const grad = gradients[i % gradients.length];
                  return (
                    <div key={c.customerId}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium truncate max-w-[60%]">{c.customerCompany}</span>
                        <span className="text-muted-foreground tabular-nums ml-2 shrink-0">{c.qtCount} QT · {formatMoney(c.totalValue)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-700`} style={{ width: `${Math.max(pct, 5)}%` }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>

        {/* Margin / Discount Analysis */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <div className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
            <Percent className="h-4 w-4 text-amber-500" />
            Margin &amp; Discount Analysis
          </div>
          {!data.marginAnalysis ? (
            <div className="text-center py-8 text-muted-foreground text-sm">ยังไม่มีข้อมูล</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'ส่วนลดรวม (Approved)', value: formatMoney(data.marginAnalysis.totalDiscountGiven), color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
                  { label: 'Avg Discount Rate', value: `${data.marginAnalysis.avgDiscountRate.toFixed(1)}%`, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                  { label: 'Special Discount Req.', value: data.marginAnalysis.specialDiscountCount, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
                  { label: 'QT Approved ทั้งหมด', value: data.marginAnalysis.approvedCount, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                ].map((item) => (
                  <div key={item.label} className={`rounded-xl p-3 ${item.bg}`}>
                    <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>
              {data.marginAnalysis.totalApprovedSubtotal > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Net Revenue vs ส่วนลดที่ให้</span>
                    <span>{data.marginAnalysis.avgDiscountRate.toFixed(1)}% discount rate</span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700"
                      style={{ width: `${Math.max(100 - data.marginAnalysis.avgDiscountRate, 0)}%` }} />
                    <div className="h-full bg-gradient-to-r from-rose-400 to-red-500 transition-all duration-700"
                      style={{ width: `${Math.min(data.marginAnalysis.avgDiscountRate, 100)}%` }} />
                  </div>
                  <div className="flex gap-4 mt-1.5 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Net Revenue</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />Discount Given</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ SECTION 11: Quotation Aging + SO Execution ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Quotation Aging */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <div className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
            <Clock className="h-4 w-4 text-orange-500" />
            Quotation Aging — Pending ค้างนานแค่ไหน
            {data.agingBuckets && (data.agingBuckets.gt7d.count > 0) && (
              <Badge variant="outline" className="ml-auto text-[10px] bg-red-50 text-red-700 border-red-300">
                {data.agingBuckets.gt7d.count} เกิน 7 วัน
              </Badge>
            )}
          </div>
          {!data.agingBuckets ? (
            <div className="text-center py-8 text-muted-foreground text-sm">ไม่มีข้อมูล</div>
          ) : (() => {
            const total = data.agingBuckets.lt1d.count + data.agingBuckets.d1to3.count + data.agingBuckets.d3to7.count + data.agingBuckets.gt7d.count;
            if (total === 0) return (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" /> ไม่มี QT ค้างอยู่ในระบบ
              </div>
            );
            const buckets = [
              { label: '< 1 วัน', sublabel: 'Fresh', ...data.agingBuckets.lt1d, color: '#10b981', bg: 'bg-emerald-500/10' },
              { label: '1–3 วัน', sublabel: 'Normal', ...data.agingBuckets.d1to3, color: '#f59e0b', bg: 'bg-amber-500/10' },
              { label: '3–7 วัน', sublabel: 'Attention', ...data.agingBuckets.d3to7, color: '#f97316', bg: 'bg-orange-500/10' },
              { label: '> 7 วัน', sublabel: 'Critical', ...data.agingBuckets.gt7d, color: '#ef4444', bg: 'bg-red-500/10' },
            ];
            const maxCount = Math.max(...buckets.map((b) => b.count), 1);
            return (
              <div className="space-y-3">
                {buckets.map((b) => (
                  <div key={b.label} className={`p-3 rounded-xl ${b.bg} flex items-center gap-3`}>
                    <div className="w-1.5 h-10 rounded-full shrink-0" style={{ background: b.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold">{b.label}</span>
                        <span className="text-muted-foreground">{b.count} QT · {formatMoney(b.value)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/50 dark:bg-black/20 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(Math.round((b.count / maxCount) * 100), b.count > 0 ? 10 : 0)}%`, background: b.color }} />
                      </div>
                    </div>
                    <div className="text-xl font-bold shrink-0" style={{ color: b.color }}>{b.count}</div>
                  </div>
                ))}
                <div className="pt-2 border-t flex justify-between text-xs text-muted-foreground">
                  <span>QT Pending รวม</span><span className="font-semibold">{total} ใบ</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* SO Execution */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <div className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
            <ShoppingCart className="h-4 w-4 text-teal-500" />
            SO Execution — การส่งมอบ Sales Order
            {(data.soExecution?.overdueCount ?? 0) > 0 && (
              <Badge variant="outline" className="ml-auto text-[10px] bg-rose-50 text-rose-700 border-rose-300">
                {data.soExecution!.overdueCount} เกินกำหนด
              </Badge>
            )}
          </div>
          {!data.soExecution || data.soExecution.totalSos === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">ยังไม่มี Sales Order</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'SO ทั้งหมด', value: data.soExecution.totalSos, color: 'text-slate-600', bg: 'bg-slate-500/10' },
                  { label: 'Completed', value: data.soExecution.completedCount, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
                  { label: 'เกินกำหนด', value: data.soExecution.overdueCount, color: data.soExecution.overdueCount > 0 ? 'text-red-600' : 'text-slate-400', bg: data.soExecution.overdueCount > 0 ? 'bg-red-500/10' : 'bg-muted' },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl p-3 text-center ${s.bg}`}>
                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
              {data.soExecution.completedValue > 0 && (
                <div className="p-3 rounded-xl bg-emerald-500/10 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">มูลค่า SO ที่ Completed แล้ว</span>
                  <span className="text-sm font-bold text-emerald-600">{formatMoney(data.soExecution.completedValue)}</span>
                </div>
              )}
              <div className="space-y-1.5">
                {data.soExecution.statusBreakdown.map((s) => {
                  const pct = data.soExecution!.totalSos > 0 ? Math.round((s.count / data.soExecution!.totalSos) * 100) : 0;
                  const soColors: Record<string, string> = { DRAFT: '#94a3b8', PENDING_REVIEW: '#fbbf24', CONFIRMED: '#3b82f6', COMPLETED: '#10b981', CANCELLED: '#9ca3af', REJECTED: '#ef4444' };
                  const soLabels: Record<string, string> = { DRAFT: 'Draft', PENDING_REVIEW: 'Pending Review', CONFIRMED: 'Confirmed', COMPLETED: 'Completed', CANCELLED: 'Cancelled', REJECTED: 'Rejected' };
                  return (
                    <div key={s.status} className="flex items-center gap-2">
                      <span className="w-20 text-xs text-muted-foreground truncate">{soLabels[s.status] ?? s.status}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(pct, 5)}%`, background: soColors[s.status] ?? '#9ca3af' }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-6 text-right">{s.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ SECTION 12: Revenue Forecast ══ */}
      <div className="bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-cyan-500/10 border border-indigo-500/30 rounded-2xl shadow-sm p-5">
        <div className="text-sm font-semibold flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-indigo-500" />
          <span className="text-indigo-700 dark:text-indigo-400">Revenue Forecast — การคาดการณ์รายได้</span>
        </div>
        {!data.forecast ? (
          <div className="text-center py-8 text-muted-foreground text-sm">ยังไม่มีข้อมูล</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: <BarChart2 className="h-5 w-5" />,
                label: 'Avg Revenue / เดือน',
                value: formatMoney(data.forecast.avgMonthlyRevenue),
                sub: 'เฉลี่ย 6 เดือนที่ผ่านมา',
                gradient: 'from-blue-500 to-indigo-600',
              },
              {
                icon: <TrendingUp className="h-5 w-5" />,
                label: 'Forecast เดือนหน้า',
                value: formatMoney(data.forecast.nextMonthForecast),
                sub: 'ประมาณการ +5% growth',
                gradient: 'from-violet-500 to-purple-600',
              },
              {
                icon: <Zap className="h-5 w-5" />,
                label: 'Pipeline Coverage',
                value: formatMoney(data.forecast.pipelineCoverage),
                sub: 'มูลค่า pending × conv. rate',
                gradient: 'from-cyan-500 to-teal-600',
              },
            ].map((f) => (
              <div key={f.label} className={`rounded-2xl p-4 text-white bg-gradient-to-br ${f.gradient} shadow`}>
                <div className="flex items-center gap-2 mb-2 opacity-80">{f.icon}<span className="text-xs font-medium uppercase tracking-wide">{f.label}</span></div>
                <div className="text-2xl font-bold">{f.value}</div>
                <div className="text-xs text-white/60 mt-1">{f.sub}</div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SALES FUNNEL
// ════════════════════════════════════════════════════════════════════════════
function SalesFunnel({ data, conversionRate }: { data: DashboardData; conversionRate: number }) {
  const base = Math.max(data.totals.quotations, 1);
  const stages = [
    {
      label: 'Quotation Issued',
      count: data.totals.quotations,
      color: '#3b82f6',
      pct: 100,
    },
    {
      label: 'Approved',
      count: data.totals.approved,
      color: '#06b6d4',
      pct: Math.round((data.totals.approved / base) * 100),
    },
    {
      label: 'PO Received',
      count: data.totals.poVerificationPending ?? 0,
      color: '#14b8a6',
      pct: Math.round(((data.totals.poVerificationPending ?? 0) / base) * 100),
    },
    {
      label: 'SO Confirmed',
      count: data.totals.soConfirmed ?? 0,
      color: '#10b981',
      pct: conversionRate,
    },
  ];

  return (
    <div className="space-y-1.5">
      {stages.map((s) => {
        const w = `${Math.max(s.pct, s.count > 0 ? 15 : 5)}%`;
        return (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-32 text-xs text-right text-muted-foreground hidden sm:block truncate">{s.label}</span>
            <div className="flex-1 h-9 bg-muted rounded-lg overflow-hidden relative">
              <div
                className="h-full rounded-lg flex items-center px-3 gap-2 transition-all duration-700"
                style={{ width: w, background: `linear-gradient(to right, ${s.color}, ${s.color}cc)` }}
              >
                <span className="text-white text-xs font-semibold whitespace-nowrap">
                  {s.count > 0 ? `${s.count} รายการ` : ''}
                </span>
              </div>
            </div>
            <span className="w-12 text-right text-sm font-bold" style={{ color: s.color }}>{s.pct}%</span>
          </div>
        );
      })}
      <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground mt-2">
        <span>QT → SO Conversion</span>
        <span className="font-bold text-emerald-600 text-base">{conversionRate}%</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// REVENUE AREA CHART (SVG)
// ════════════════════════════════════════════════════════════════════════════
function RevenueAreaChart({ data }: { data: Array<{ month: string; value: number }> }) {
  const W = 500; const H = 160; const PL = 55; const PR = 16; const PT = 10; const PB = 28;
  const cW = W - PL - PR; const cH = H - PT - PB;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const xi = (i: number) => PL + (i / Math.max(data.length - 1, 1)) * cW;
  const yv = (v: number) => PT + cH - (v / maxVal) * cH;

  const points = data.map((d, i) => ({ x: xi(i), y: yv(d.value) }));

  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const cp1x = (points[i - 1].x + points[i].x) / 2;
    pathD += ` C ${cp1x} ${points[i - 1].y} ${cp1x} ${points[i].y} ${points[i].x} ${points[i].y}`;
  }
  const areaD = `${pathD} L ${points[points.length - 1].x} ${PT + cH} L ${points[0].x} ${PT + cH} Z`;

  const yGrids = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      <defs>
        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {yGrids.map((t) => {
        const gy = PT + cH * (1 - t);
        const val = maxVal * t;
        return (
          <g key={t}>
            <line x1={PL} y1={gy} x2={W - PR} y2={gy} stroke="currentColor" strokeOpacity={0.07} strokeWidth={1} />
            <text x={PL - 6} y={gy + 4} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.45}>
              {val >= 1000000 ? `${(val / 1000000).toFixed(1)}M`
                : val >= 1000 ? `${(val / 1000).toFixed(0)}K`
                : val.toFixed(0)}
            </text>
          </g>
        );
      })}
      <path d={areaD} fill="url(#revenueGrad)" />
      <path d={pathD} fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#10b981" stroke="white" strokeWidth={1.5}>
          <title>{data[i].month}: {formatMoney(data[i].value)}</title>
        </circle>
      ))}
      {data.map((d, i) => (
        <text key={i} x={xi(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.5}>
          {d.month}
        </text>
      ))}
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TREND CHART — SVG with area fill for approved
// ════════════════════════════════════════════════════════════════════════════
function TrendChart({ data }: { data: Array<{ month: string; approved: number; rejected: number }> }) {
  const W = 600; const H = 180; const PL = 36; const PR = 16; const PT = 12; const PB = 28;
  const cW = W - PL - PR; const cH = H - PT - PB;
  const maxVal = Math.max(...data.flatMap((d) => [d.approved, d.rejected]), 1);
  const xStep = cW / Math.max(data.length - 1, 1);
  const y = (v: number) => PT + cH - (v / maxVal) * cH;
  const x = (i: number) => PL + i * xStep;

  // Build smooth path for approved
  const approvedPts = data.map((d, i) => ({ x: x(i), y: y(d.approved) }));
  let approvedPath = `M ${approvedPts[0].x} ${approvedPts[0].y}`;
  for (let i = 1; i < approvedPts.length; i++) {
    const cp1x = (approvedPts[i - 1].x + approvedPts[i].x) / 2;
    approvedPath += ` C ${cp1x} ${approvedPts[i - 1].y} ${cp1x} ${approvedPts[i].y} ${approvedPts[i].x} ${approvedPts[i].y}`;
  }
  const approvedArea = `${approvedPath} L ${approvedPts[approvedPts.length - 1].x} ${PT + cH} L ${approvedPts[0].x} ${PT + cH} Z`;

  const polyRejected = data.map((d, i) => `${x(i)},${y(d.rejected)}`).join(' ');
  const yTicks = [0, Math.round(maxVal * 0.5), maxVal];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 180 }}>
      <defs>
        <linearGradient id="approvedAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PL} y1={y(v)} x2={W - PR} y2={y(v)} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
          <text x={PL - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill="currentColor" fillOpacity={0.45}>{v}</text>
        </g>
      ))}
      {/* Approved area */}
      <path d={approvedArea} fill="url(#approvedAreaGrad)" />
      {/* Approved line */}
      <path d={approvedPath} fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinejoin="round" />
      {/* Approved dots */}
      {approvedPts.map((p, i) => (
        <circle key={`a${i}`} cx={p.x} cy={p.y} r={3.5} fill="#10b981" stroke="white" strokeWidth={1.5}>
          <title>{data[i].month}: Approved {data[i].approved}</title>
        </circle>
      ))}
      {/* Rejected line (dashed) */}
      <polyline points={polyRejected} fill="none" stroke="#ef4444" strokeWidth={2} strokeLinejoin="round" strokeDasharray="5 4" />
      {data.map((d, i) => (
        <circle key={`r${i}`} cx={x(i)} cy={y(d.rejected)} r={3.5} fill="#ef4444" stroke="white" strokeWidth={1.5}>
          <title>{data[i].month}: Rejected {data[i].rejected}</title>
        </circle>
      ))}
      {/* X labels */}
      {data.map((d, i) => (
        <text key={`l${i}`} x={x(i)} y={H - 6} textAnchor="middle" fontSize={11} fill="currentColor" fillOpacity={0.5}>
          {d.month}
        </text>
      ))}
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// KPI CARD — premium gradient design
// ════════════════════════════════════════════════════════════════════════════
function KpiCard({
  icon, label, value, gradient, subtitle, alertRing = false, isText = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  gradient: string;
  subtitle?: string;
  alertRing?: boolean;
  isText?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br ${gradient} ${
      alertRing && Number(value) > 0 ? 'ring-2 ring-white/50 ring-offset-2 ring-offset-background' : ''
    }`}>
      {/* Decorative circle */}
      <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-white/10" />
      {/* Icon + label */}
      <div className="relative flex items-center gap-2 mb-3">
        <span className="opacity-90">{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wider text-white/70">{label}</span>
      </div>
      {/* Value */}
      <div className={`relative font-bold leading-none ${isText ? 'text-xl' : 'text-3xl'}`}>
        {value}
      </div>
      {/* Subtitle */}
      {subtitle && <div className="relative mt-1.5 text-xs text-white/60">{subtitle}</div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ACTIVITY COLUMN
// ════════════════════════════════════════════════════════════════════════════
function ActivityCol({
  icon, label, iconBg, approved, rejected, rate,
}: {
  icon: React.ReactNode;
  label: string;
  iconBg: string;
  approved: number;
  rejected: number;
  rate: number | null;
}) {
  const total = approved + rejected;
  return (
    <div className="px-4 first:pl-0 last:pr-0">
      <div className={`inline-flex items-center gap-1.5 text-xs mb-3 px-2 py-1 rounded-lg ${iconBg}`}>
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      <div className="flex gap-5">
        <div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="text-2xl font-bold">{approved}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">Approved</div>
        </div>
        <div>
          <div className="flex items-center gap-1">
            <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <span className="text-2xl font-bold">{rejected}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">Rejected</div>
        </div>
      </div>
      {total > 0 && (
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.round((approved / total) * 100)}%` }} />
        </div>
      )}
      <div className="mt-1">
        {rate !== null
          ? <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{rate}% approval</span>
          : <span className="text-xs text-muted-foreground">ยังไม่มีกิจกรรม</span>}
      </div>
    </div>
  );
}
