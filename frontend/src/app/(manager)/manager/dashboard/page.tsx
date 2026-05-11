'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp, AlertCircle, Clock, CheckCircle2, XCircle,
  DollarSign, Users as UsersIcon, Inbox, Crown, Filter,
  Calendar, BarChart2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/utils';
import { toast } from 'sonner';
import type { ApiResponse } from '@/types/api';
import { usePermissions } from '@/hooks/use-permissions';

// ─── Types ───────────────────────────────────────────────────────────────────
type DashboardFilter = 'self' | 'team' | 'all' | 'user';

interface DashboardData {
  filter: DashboardFilter;
  filterUserId?: string;
  totals: {
    quotations: number;
    pending: number;
    escalated: number;
    approved: number;
    rejected: number;
    totalValue: number;
    pendingValue: number;
  };
  todayActivity: { approved: number; rejected: number };
  monthActivity?: { approved: number; rejected: number };
  allTimeActivity?: { approved: number; rejected: number };
  topOfficers: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    count: number;
    value: number;
  }>;
  recentEscalated: Array<{
    id: string;
    quotationNo: string;
    grandTotal: number;
    customerCompany: string;
    createdByName: string;
    submittedAt: string;
  }>;
  statusBreakdown: Array<{ status: string; count: number }>;
}

interface FilterableUser {
  id: string;
  name: string;
  email: string;
  role: { code: string; nameTh: string };
  reportsTo?: { id: string; name: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500',
  PENDING: 'bg-amber-500',
  PENDING_BACKUP: 'bg-amber-600',
  PENDING_ESCALATED: 'bg-rose-500',
  APPROVED: 'bg-emerald-500',
  REJECTED: 'bg-red-500',
  CANCELLED: 'bg-gray-400',
  EXPIRED: 'bg-gray-600',
  SENT: 'bg-blue-500',
  SIGNED: 'bg-blue-600',
};

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function ManagerDashboardPage() {
  const t = useT();
  const { role, loading: permLoading } = usePermissions();

  const [data, setData] = useState<DashboardData | null>(null);
  const [users, setUsers] = useState<FilterableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterValue, setFilterValue] = useState<string>('self');

  const isExecutive = role?.code === 'CEO' || role?.code === 'ADMIN';
  const isManagerLike = role?.code === 'MANAGER' || isExecutive;

  // ─── Fetch filterable users ───────────────────────────────────────────────
  useEffect(() => {
    if (permLoading || !isManagerLike) return;
    (async () => {
      try {
        const res = await api.get<ApiResponse<FilterableUser[]>>(
          '/manager-dashboard/filterable-users',
        );
        setUsers(res.data.data ?? []);
      } catch (err) {
        console.error('Failed to load filterable users', err);
      }
    })();
  }, [permLoading, isManagerLike]);

  // ─── Fetch dashboard data ─────────────────────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    if (permLoading) return;
    setLoading(true);
    try {
      let url = '/manager-dashboard/overview';
      if (filterValue.startsWith('user:')) {
        const userId = filterValue.slice(5);
        url += `?filter=user&userId=${encodeURIComponent(userId)}`;
      } else {
        url += `?filter=${filterValue}`;
      }
      const res = await api.get<ApiResponse<DashboardData>>(url);
      setData(res.data.data ?? null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [permLoading, filterValue]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (permLoading) {
    return (
      <div className="space-y-4 max-w-7xl">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  // ─── Filter display label ─────────────────────────────────────────────────
  const filterDisplay = (() => {
    if (filterValue === 'self') return 'Me';
    if (filterValue === 'team') return 'My Team';
    if (filterValue === 'all') return 'All users in the system';
    if (filterValue.startsWith('user:')) {
      const userId = filterValue.slice(5);
      const u = users.find((x) => x.id === userId);
      return u ? `${u.name} (${u.role.nameTh})` : 'User';
    }
    return '';
  })();

  // ─── Group users for dropdown ─────────────────────────────────────────────
  // แบ่ง managers vs subordinates (officers + ลูกน้องของลูกน้อง)
  const managers = users.filter((u) => u.role.code === 'MANAGER');
  const subordinates = users.filter((u) => u.role.code !== 'MANAGER');

  // เรียง subordinates ตาม hierarchy — คนที่มี reportsTo ขึ้นมาก่อน
  const sortedSubordinates = [...subordinates].sort((a, b) => {
    const aDepth = a.reportsTo ? 1 : 0;
    const bDepth = b.reportsTo ? 1 : 0;
    if (aDepth !== bDepth) return aDepth - bDepth;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-6 max-w-7xl">
      {/* ── Header + Filter ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" />
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            กำลังดู:{' '}
            <span className="font-medium text-foreground">{filterDisplay}</span>
            {role?.nameTh && ` · บทบาท: ${role.nameTh}`}
          </p>
        </div>

        {isManagerLike && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <select
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="flex h-10 min-w-[240px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="self">— Me (Default)</option>

              {role?.code === 'MANAGER' && (
                <option value="team">— My Team (ทั้งหมดในสายงาน)</option>
              )}

              {isExecutive && (
                <option value="all">— All Team</option>
              )}

              {/* Managers */}
              {managers.length > 0 && (
                <optgroup label="Managers">
                  {managers.map((u) => (
                    <option key={u.id} value={`user:${u.id}`}>
                      {u.name}
                    </option>
                  ))}
                </optgroup>
              )}

              {/* Subordinates — แสดง hierarchy ด้วย indent */}
              {sortedSubordinates.length > 0 && (
                <optgroup label={role?.code === 'MANAGER' ? 'Subordinates' : 'Officers'}>
                  {sortedSubordinates.map((u) => (
                    <option key={u.id} value={`user:${u.id}`}>
                      {u.reportsTo ? `↳ ${u.name}` : u.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            {isExecutive && (
              <Link
                href="/manager/users"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <UsersIcon className="h-4 w-4" />
                จัดการผู้ใช้
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {!loading && !data && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            ไม่สามารถโหลดข้อมูล Dashboard ได้
          </CardContent>
        </Card>
      )}

      {!loading && data && <DashboardContent data={data} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD CONTENT
// ════════════════════════════════════════════════════════════════════════════
function DashboardContent({ data }: { data: DashboardData }) {
  const totalActive = data.totals.pending + data.totals.escalated;

  // ─── วันนี้ ───────────────────────────────────────────────────────────────
  const todayTotal = data.todayActivity.approved + data.todayActivity.rejected;
  const todayRate = todayTotal > 0
    ? Math.round((data.todayActivity.approved / todayTotal) * 100)
    : null;

  // ─── เดือนนี้ ─────────────────────────────────────────────────────────────
  const monthApproved = data.monthActivity?.approved ?? 0;
  const monthRejected = data.monthActivity?.rejected ?? 0;
  const monthTotal = monthApproved + monthRejected;
  const monthRate = monthTotal > 0
    ? Math.round((monthApproved / monthTotal) * 100)
    : null;

  // ─── ทั้งหมด — ใช้ allTimeActivity (action ที่ manager ทำเอง) ─────────────
  const allApproved = data.allTimeActivity?.approved ?? data.totals.approved;
  const allRejected = data.allTimeActivity?.rejected ?? data.totals.rejected;
  const allTotal = allApproved + allRejected;
  const allRate = allTotal > 0
    ? Math.round((allApproved / allTotal) * 100)
    : null;

  // ─── KPI approval rate (จาก totals ของ filter ที่เลือก) ──────────────────
  const kpiDecided = data.totals.approved + data.totals.rejected;
  const kpiRate = kpiDecided > 0
    ? Math.round((data.totals.approved / kpiDecided) * 100)
    : 0;

  return (
    <>
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Inbox className="h-5 w-5" />}
          label="Pending"
          value={totalActive.toString()}
          accent="from-amber-500 to-orange-500"
          subtitle={`${formatMoney(data.totals.pendingValue)} value`}
        />
        <KpiCard
          icon={<AlertCircle className="h-5 w-5" />}
          label="Escalated"
          value={data.totals.escalated.toString()}
          accent="from-rose-500 to-pink-500"
          subtitle="ต้องรอ CEO อนุมัติ"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Approved"
          value={data.totals.approved.toString()}
          accent="from-emerald-500 to-teal-500"
          subtitle={`${kpiRate}% approval rate`}
        />
        <KpiCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Total Value"
          value={formatMoney(data.totals.totalValue)}
          accent="from-blue-500 to-cyan-500"
          subtitle={`${data.totals.quotations} quotations`}
        />
      </div>

      {/* ── Approval Activity ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-blue-500" />
            Approval Activity
            <span className="text-[10px] text-muted-foreground font-normal ml-1">
              (งานที่คุณอนุมัติ/ปฏิเสธเอง)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 divide-x divide-border">

            {/* วันนี้ */}
            <ActivityCol
              icon={<Clock className="h-3 w-3" />}
              label="วันนี้"
              approved={data.todayActivity.approved}
              rejected={data.todayActivity.rejected}
              rate={todayRate}
            />

            {/* เดือนนี้ */}
            <ActivityCol
              icon={<Calendar className="h-3 w-3" />}
              label="เดือนนี้"
              approved={monthApproved}
              rejected={monthRejected}
              rate={monthRate}
            />

            {/* ทั้งหมด */}
            <ActivityCol
              icon={<TrendingUp className="h-3 w-3" />}
              label="ทั้งหมด"
              approved={allApproved}
              rejected={allRejected}
              rate={allRate}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Team Overview + Status Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Team Overview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-blue-500" />
              Team Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topOfficers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                ยังไม่มีข้อมูล
              </p>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-4 text-[10px] text-muted-foreground uppercase px-2 pb-2 border-b">
                  <span className="col-span-2">ชื่อ</span>
                  <span className="text-center">QT</span>
                  <span className="text-right">มูลค่ารวม</span>
                </div>
                {data.topOfficers.map((o) => (
                  <Link
                    key={o.userId}
                    href={`/manager/users/${o.userId}`}
                    className="grid grid-cols-4 items-center p-2 rounded-md hover:bg-accent transition-colors"
                  >
                    <div className="col-span-2 min-w-0">
                      <div className="font-medium text-sm truncate">{o.userName}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {o.userEmail}
                      </div>
                    </div>
                    <div className="text-center">
                      <Badge variant="outline" className="text-xs">
                        {o.count}
                      </Badge>
                    </div>
                    <div className="text-right text-sm font-semibold">
                      {formatMoney(o.value)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-purple-500" />
              Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.statusBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                ไม่มีข้อมูล
              </p>
            ) : (
              <div className="space-y-2.5">
                {data.statusBreakdown.map((s) => {
                  const pct =
                    data.totals.quotations > 0
                      ? Math.round((s.count / data.totals.quotations) * 100)
                      : 0;
                  return (
                    <div key={s.status}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium">{s.status}</span>
                        <span className="text-muted-foreground">
                          {s.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full ${STATUS_COLORS[s.status] || 'bg-gray-500'} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ACTIVITY COLUMN — reusable สำหรับ วันนี้ / เดือนนี้ / ทั้งหมด
// ════════════════════════════════════════════════════════════════════════════
function ActivityCol({
  icon, label, approved, rejected, rate,
}: {
  icon: React.ReactNode;
  label: string;
  approved: number;
  rejected: number;
  rate: number | null;
}) {
  return (
    <div className="px-4 first:pl-0 last:pr-0 space-y-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="flex gap-4">
        <div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xl font-bold">{approved}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">Approved</div>
        </div>
        <div>
          <div className="flex items-center gap-1">
            <XCircle className="h-3.5 w-3.5 text-red-500" />
            <span className="text-xl font-bold">{rejected}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">Rejected</div>
        </div>
      </div>
      {rate !== null ? (
        <div className="text-xs font-medium text-emerald-600">{rate}% approval rate</div>
      ) : (
        <div className="text-xs text-muted-foreground">ยังไม่มีกิจกรรม</div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// KPI CARD
// ════════════════════════════════════════════════════════════════════════════
function KpiCard({
  icon, label, value, accent, subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  subtitle?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div
          className={`h-10 w-10 rounded-lg bg-gradient-to-br ${accent} text-white flex items-center justify-center mb-3 shadow-md`}
        >
          {icon}
        </div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        {subtitle && (
          <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>
        )}
      </CardContent>
    </Card>
  );
}