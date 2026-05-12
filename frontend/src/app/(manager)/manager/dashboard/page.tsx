'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp, Clock, CheckCircle2, XCircle,
  DollarSign, Users as UsersIcon, Inbox, Crown, Filter,
  Calendar, BarChart2, Flame, ArrowRight, Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/utils';
import { toast } from 'sonner';
import type { ApiResponse } from '@/types/api';
import { usePermissions } from '@/hooks/use-permissions';

type DashboardFilter = 'self' | 'team' | 'all' | 'user';
interface DashboardData {
  filter: DashboardFilter;
  filterUserId?: string;
  totals: { quotations: number; pending: number; escalated: number; approved: number; rejected: number; totalValue: number; pendingValue: number; };
  todayActivity: { approved: number; rejected: number };
  monthActivity?: { approved: number; rejected: number };
  allTimeActivity?: { approved: number; rejected: number };
  topOfficers: Array<{ userId: string; userName: string; userEmail: string; count: number; value: number }>;
  recentEscalated: Array<{ id: string; quotationNo: string; grandTotal: number; customerCompany: string; createdByName: string; submittedAt: string }>;
  statusBreakdown: Array<{ status: string; count: number }>;
  isApproverView?: boolean;
}
interface FilterableUser {
  id: string; name: string; email: string;
  role: { code: string; nameTh: string };
  reportsTo?: { id: string; name: string } | null;
}

const STATUS_CFG: Record<string, { color: string; label: string }> = {
  DRAFT: { color: 'bg-slate-400', label: 'Draft' },
  PENDING: { color: 'bg-amber-400', label: 'Pending' },
  PENDING_BACKUP: { color: 'bg-amber-500', label: 'Pending Backup' },
  PENDING_ESCALATED: { color: 'bg-rose-500', label: 'Escalated' },
  APPROVED: { color: 'bg-emerald-500', label: 'Approved' },
  REJECTED: { color: 'bg-red-500', label: 'Rejected' },
  CANCELLED: { color: 'bg-gray-400', label: 'Cancelled' },
  EXPIRED: { color: 'bg-gray-500', label: 'Expired' },
  PO_PENDING: { color: 'bg-amber-300', label: 'PO Pending' },
  PO_APPROVED: { color: 'bg-teal-500', label: 'PO Approved' },
  PO_REJECTED: { color: 'bg-red-400', label: 'PO Rejected' },
};


export default function ManagerDashboardPage() {
  const { role, loading: permLoading } = usePermissions();
  const [data, setData] = useState<DashboardData | null>(null);
  const [users, setUsers] = useState<FilterableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterValue, setFilterValue] = useState<string>('self');
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

  if (permLoading) return <div className="space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-64 w-full" /></div>;

  const managers = users.filter((u) => u.role.code === 'MANAGER');
  const subordinates = users.filter((u) => u.role.code !== 'MANAGER');

  // ─── หา selected user name ───────────────────────────────────────────────
  const selectedUser = filterValue.startsWith('user:')
    ? users.find((u) => u.id === filterValue.slice(5))
    : null;

  const filterLabel = filterValue === 'self' ? 'Me (Default)'
    : filterValue === 'team' ? 'My Team'
    : filterValue === 'all' ? 'ทั้งระบบ'
    : selectedUser ? selectedUser.name + ' (' + selectedUser.role.nameTh + ')'
    : 'User';

  const isTeamView = filterValue === 'team' || filterValue === 'all';
  const isUserView = filterValue.startsWith('user:');
  const isSelfView = filterValue === 'self';

  return (
    <div className="space-y-5 max-w-7xl">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" />
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            กำลังดู: <span className="font-semibold text-foreground">{filterLabel}</span>
            {role?.nameTh && <span> · บทบาท: {role.nameTh}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <select
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className="h-10 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="self">— Me (Default)</option>
            {role?.code === 'MANAGER' && <option value="team">— My Team</option>}
            {isExecutive && (
              <>
                <option value="team">— My Team</option>
                <option value="all">— All Team (ทั้งระบบ)</option>
              </>
            )}
            {managers.length > 0 && (
              <optgroup label="Managers">
                {managers.map((u) => <option key={u.id} value={'user:' + u.id}>{u.name}</option>)}
              </optgroup>
            )}
            {subordinates.length > 0 && (
              <optgroup label="Officers / Sales">
                {subordinates.map((u) => <option key={u.id} value={'user:' + u.id}>{u.reportsTo ? '↳ ' + u.name : u.name}</option>)}
              </optgroup>
            )}
          </select>
          {isExecutive && (
            <Button asChild variant="outline" size="sm">
              <Link href="/manager/users"><UsersIcon className="h-4 w-4" />จัดการผู้ใช้</Link>
            </Button>
          )}
        </div>
      </div>

      {/* ── Context info banner ── */}
      {isUserView && selectedUser && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-blue-700 dark:text-blue-300">กำลังดูข้อมูลของ {selectedUser.name}</span>
            <span className="text-muted-foreground ml-1">({selectedUser.role.nameTh})</span>
            <span className="text-muted-foreground ml-2">— แสดงผลงานและสถานะใบเสนอราคาของบุคคลนี้</span>
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[0,1,2,3].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-40" />
          <div className="grid grid-cols-2 gap-4"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
        </div>
      )}
      {!loading && !data && (
        <Card><CardContent className="py-20 text-center text-muted-foreground">ไม่สามารถโหลดข้อมูลได้</CardContent></Card>
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

function DashboardContent({ data, isTeamView, isUserView, isSelfView, selectedUserName }: {
  data: DashboardData;
  isTeamView: boolean;
  isUserView: boolean;
  isSelfView: boolean;
  selectedUserName?: string;
}) {
  const kpiDecided = data.totals.approved + data.totals.rejected;
  const kpiRate = kpiDecided > 0 ? Math.round((data.totals.approved / kpiDecided) * 100) : 0;
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

  // ─── ตรวจว่า KPI ว่างหรือเปล่า (เพื่อแสดง hint) ────────────────────────
  const noKpiData =
  data.totals.quotations === 0 &&
  data.totals.pending === 0 &&
  data.totals.approved === 0 &&
  data.totals.rejected === 0 &&
  data.totals.totalValue === 0;

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<Inbox className="h-5 w-5" />} label="รออนุมัติ" value={data.totals.pending}
          accent="from-amber-500 to-orange-500"
          subtitle={data.totals.escalated > 0 ? data.totals.escalated + ' Escalated' : 'ไม่มีรายการด่วน'}
          alert={data.totals.escalated > 0} />
        <KpiCard icon={<Flame className="h-5 w-5" />} label="Escalated" value={data.totals.escalated}
          accent="from-rose-500 to-pink-500" subtitle="ต้องรอ CEO อนุมัติ" alert={data.totals.escalated > 0} />
        <KpiCard icon={<CheckCircle2 className="h-5 w-5" />} label="อนุมัติแล้ว" value={data.totals.approved}
          accent="from-emerald-500 to-teal-500" subtitle={kpiRate + '% approval rate'} />
        <KpiCard icon={<DollarSign className="h-5 w-5" />} label="มูลค่ารวม" value={formatMoney(data.totals.totalValue)}
          accent="from-blue-500 to-cyan-500" subtitle={data.totals.quotations + ' ใบเสนอราคา'} isText />
      </div>

      {/* ─── hint เมื่อ KPI ว่างทั้งหมด ─── */}
      {noKpiData && (isUserView || isSelfView) && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
          <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <span className="text-muted-foreground">
            {isUserView
              ? 'ไม่พบข้อมูลใบเสนอราคาของ ' + (selectedUserName ?? 'บุคคลนี้') + ' — อาจยังไม่มีใบเสนอราคา หรือ filter ยังไม่รองรับการดูข้อมูลของบุคคลอื่น'
              : 'ไม่มีข้อมูลใบเสนอราคาใน queue ขณะนี้ — ลองเปลี่ยน filter เป็น "My Team" หรือ "All Team"'}
          </span>
        </div>
      )}

      {/* Approval Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" />
            Approval Activity
            <span className="text-[10px] text-muted-foreground font-normal ml-1">
              {isSelfView ? '(งานที่คุณอนุมัติ/ปฏิเสธเอง)' : isUserView ? '(งานของคุณ ไม่ใช่ของบุคคลที่เลือก)' : '(งานที่คุณอนุมัติ/ปฏิเสธเอง)'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 divide-x divide-border">
            <ActivityCol icon={<Clock className="h-3 w-3" />} label="วันนี้" approved={data.todayActivity.approved} rejected={data.todayActivity.rejected} rate={todayRate} />
            <ActivityCol icon={<Calendar className="h-3 w-3" />} label="เดือนนี้" approved={monthApproved} rejected={monthRejected} rate={monthRate} />
            <ActivityCol icon={<TrendingUp className="h-3 w-3" />} label="ทั้งหมด" approved={allApproved} rejected={allRejected} rate={allRate} />
          </div>
        </CardContent>
      </Card>

      {/* Escalated Quotations */}
      {data.recentEscalated.length > 0 && (
        <Card className="border-rose-500/40 bg-rose-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Flame className="h-4 w-4 text-rose-500" />
              <span className="text-rose-700 dark:text-rose-400">Escalated — รอ CEO อนุมัติ</span>
              <Badge variant="outline" className="text-xs bg-rose-100 text-rose-800 border-rose-300 ml-auto">
                {data.recentEscalated.length} รายการ
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentEscalated.map((q) => (
                <Link key={q.id} href={'/quotations/' + q.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 hover:border-rose-400 transition-colors gap-4"
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
          </CardContent>
        </Card>
      )}

      {/* Team Overview + Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-blue-500" />Team Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topOfficers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UsersIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">
                  {isTeamView ? 'ยังไม่มีข้อมูลในช่วงนี้'
                    : isSelfView ? 'เลือก "My Team" เพื่อดูข้อมูลทีม'
                    : 'ไม่มีข้อมูลสำหรับบุคคลนี้'}
                </p>
                {isSelfView && <p className="text-xs mt-1 opacity-70">ปัจจุบันดูข้อมูลเฉพาะตัวคุณ</p>}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_auto_auto] text-[10px] text-muted-foreground uppercase px-2 pb-2 border-b gap-4">
                  <span>ชื่อ</span><span className="text-center">QT</span><span className="text-right">มูลค่ารวม</span>
                </div>
                {data.topOfficers.map((o, idx) => (
                  <Link key={o.userId} href={'/manager/users/' + o.userId}
                    className="grid grid-cols-[1fr_auto_auto] items-center p-2 rounded-md hover:bg-accent transition-colors gap-4"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4 shrink-0">{idx + 1}</span>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{o.userName}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{o.userEmail}</div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">{o.count}</Badge>
                    <div className="text-sm font-semibold text-right">{formatMoney(o.value)}</div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-purple-500" />Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.statusBreakdown.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">ไม่มีข้อมูลใน filter นี้</p>
                <p className="text-xs mt-1 opacity-70">
                  {isSelfView ? 'ลองเปลี่ยน filter เป็น "My Team" หรือ "All Team"'
                    : isUserView ? 'ระบบยังไม่รองรับการดู breakdown ของบุคคลอื่น'
                    : 'ไม่มีข้อมูล'}
                </p>
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
                          <span className={'inline-block w-2 h-2 rounded-full ' + (cfg?.color ?? 'bg-gray-400')} />
                          {cfg?.label ?? s.status}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {s.count} <span className="text-[10px]">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={'h-full rounded-full transition-all duration-500 ' + (cfg?.color ?? 'bg-gray-400')}
                          style={{ width: Math.max(pct, 2) + '%' }} />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 border-t flex justify-between text-xs">
                  <span className="text-muted-foreground">รวมทั้งหมด</span>
                  <span className="font-semibold">{data.totals.quotations} ใบ</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, accent, subtitle, alert = false, isText = false }: {
  icon: React.ReactNode; label: string; value: number | string;
  accent: string; subtitle?: string; alert?: boolean; isText?: boolean;
}) {
  return (
    <Card className={alert && Number(value) > 0 ? 'border-rose-500/40 bg-rose-500/5' : ''}>
      <CardContent className="p-4">
        <div className={'h-10 w-10 rounded-xl bg-gradient-to-br ' + accent + ' text-white flex items-center justify-center mb-3 shadow-md'}>
          {icon}
        </div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</div>
        <div className={'font-bold mt-1 ' + (isText ? 'text-xl' : 'text-3xl') + (alert && Number(value) > 0 ? ' text-rose-600 dark:text-rose-400' : '')}>
          {value}
        </div>
        {subtitle && <div className="text-[10px] text-muted-foreground mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}

function ActivityCol({ icon, label, approved, rejected, rate }: {
  icon: React.ReactNode; label: string; approved: number; rejected: number; rate: number | null;
}) {
  const total = approved + rejected;
  return (
    <div className="px-4 first:pl-0 last:pr-0">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">{icon}{label}</div>
      <div className="flex gap-5">
        <div>
          <div className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /><span className="text-2xl font-bold">{approved}</span></div>
          <div className="text-[10px] text-muted-foreground">Approved</div>
        </div>
        <div>
          <div className="flex items-center gap-1"><XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" /><span className="text-2xl font-bold">{rejected}</span></div>
          <div className="text-[10px] text-muted-foreground">Rejected</div>
        </div>
      </div>
      {total > 0 && (
        <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: Math.round((approved / total) * 100) + '%' }} />
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

function isAllZero(data: DashboardData): boolean {
  const t = data.totals;
  return t.quotations === 0 && t.pending === 0 && t.approved === 0 && t.rejected === 0 && t.totalValue === 0;
}