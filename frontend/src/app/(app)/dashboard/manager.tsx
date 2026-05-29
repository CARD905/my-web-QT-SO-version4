
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  TrendingUp, Clock, CheckCircle2, XCircle, DollarSign,
  Users as UsersIcon, Inbox, Crown, Filter, Calendar,
  BarChart2, Flame, ArrowRight, Info, AlertTriangle,
  Timer, ChevronRight, Zap, FileText,
  RefreshCw, Activity,
  ShoppingCart, Target, TrendingDown, Award, PieChart, Percent,
  ChevronDown, Building2,
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
  pipelineDetail?: {
    approvedOnlyValue: number;
    poPendingValue: number;
    soConfirmedValue: number;
    stage1AvgHours: number | null;
    stage2AvgHours: number | null;
    stage3AvgHours: number | null;
    stage1Top: Array<{ id: string; quotationNo: string; grandTotal: number; submittedAt: string | null; customerCompany: string }>;
    stage2Top: Array<{ id: string; quotationNo: string; grandTotal: number; approvedAt: string | null; customerCompany: string }>;
    stage3Top: Array<{ id: string; quotationNo: string; grandTotal: number; poUploadedAt: string | null; customerCompany: string }>;
    stage4Top: Array<{ id: string; saleOrderNo: string; grandTotal: number; createdAt: string; customerCompany: string }>;
  };
  bottlenecks?: Array<{
    type: string; count: number; value: number;
    reason: string; priority: 'high' | 'medium' | 'low';
  }>;
  marginAnalysis?: {
    totalDiscountGiven: number;
    totalApprovedSubtotal: number;
    avgDiscountRate: number;
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
  team?: { id: string; name: string; code?: string } | null;
  managerLevel?: string | null;
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
export default function ManagerDashboardPage({ initialFilter }: { initialFilter?: string } = {}) {
  const { role, loading: permLoading } = usePermissions();
  const [data, setData] = useState<DashboardData | null>(null);
  const [users, setUsers] = useState<FilterableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterValue, setFilterValue] = useState<string>(initialFilter ?? 'team');
  const [spinning, setSpinning] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isCeo = role?.code === 'CEO';
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

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

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
  const subordinates = users.filter((u) => u.role.code !== 'MANAGER' && (!isCeo || u.role.code !== 'ADMIN'));

  // For CEO: group ALL users by team.id, fallback to reportsTo link for officers without team
  const teamGroups = isCeo
    ? [...new Set([
        ...managers.map((m) => m.team?.id ?? `solo:${m.id}`),
      ])].map((tid) => {
        const isSolo = tid.startsWith('solo:');
        const teamManagers = isSolo
          ? managers.filter((m) => !m.team?.id && `solo:${m.id}` === tid)
          : managers.filter((m) => m.team?.id === tid);
        const first = teamManagers[0];
        const managerIds = new Set(teamManagers.map((m) => m.id));
        const officers = subordinates.filter((s) =>
          (s.team?.id != null && s.team.id === (isSolo ? null : tid)) ||
          (s.reportsTo?.id != null && managerIds.has(s.reportsTo.id))
        );
        return {
          teamId: tid,
          teamCode: isSolo ? '' : (first.team?.code ?? ''),
          teamName: isSolo ? first.name : (first.team?.name ?? first.name),
          managers: teamManagers,
          officers,
        };
      })
    : [];
  const assignedOfficerIds = new Set(teamGroups.flatMap((g) => g.officers.map((o) => o.id)));
  const unassignedOfficers = isCeo
    ? subordinates.filter((s) => !assignedOfficerIds.has(s.id))
    : [];

  const selectedUser = filterValue.startsWith('user:')
    ? users.find((u) => u.id === filterValue.slice(5)) : null;
  const filterLabel = filterValue === 'team' ? 'My Team'
    : filterValue === 'all' ? 'ทั้งระบบ'
    : selectedUser
      ? isCeo && selectedUser.role.code === 'MANAGER'
        ? `ทีม ${selectedUser.team?.name ?? selectedUser.name}`
        : `${selectedUser.name} (${selectedUser.role.nameTh})`
      : 'My Team';
  const isTeamView = filterValue === 'team' || filterValue === 'all';
  const isUserView = filterValue.startsWith('user:');
  const isSelfView = false;
  // Any manager/CEO selecting an individual officer/sales → show officer's own dashboard
  const MANAGER_LEVEL_ROLES = ['MANAGER', 'CEO', 'ADMIN', 'APPROVER'];
  const isCeoViewingOfficer = isUserView && selectedUser != null && !MANAGER_LEVEL_ROLES.includes(selectedUser.role.code);

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

              {/* ── Custom card dropdown for CEO ── */}
              {isCeo ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen((v) => !v)}
                    className="h-9 min-w-[220px] max-w-[280px] rounded-lg border border-white/20 bg-white/10 text-white px-3 text-sm flex items-center justify-between gap-2 hover:bg-white/20 transition-colors"
                  >
                    <span className="truncate">{filterLabel}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 opacity-70 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-1.5 z-50 w-[380px] bg-white dark:bg-slate-950 border border-border rounded-2xl shadow-2xl max-h-[75vh] overflow-y-auto p-2.5 space-y-2">

                      {/* All Team pill */}
                      <button
                        onClick={() => { setFilterValue('all'); setDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-sm flex items-center gap-2.5 transition-all border-2
                          ${filterValue === 'all'
                            ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                            : 'border-border bg-slate-50 dark:bg-slate-900 hover:border-blue-300 hover:bg-blue-50/50 text-foreground'}`}
                      >
                        <UsersIcon className="h-4 w-4 text-blue-500 shrink-0" />
                        <span>ทั้งระบบ (All Team)</span>
                        {filterValue === 'all' && <span className="ml-auto text-[10px] font-medium text-blue-500 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">เลือกอยู่</span>}
                      </button>

                      {/* Team cards */}
                      {teamGroups.map(({ teamId, teamCode, teamName, managers: teamMgrs, officers: teamOfficers }) => {
                        const teamIsActive = teamMgrs.some((m) => filterValue === `user:${m.id}`) || teamOfficers.some((o) => filterValue === `user:${o.id}`);
                        return (
                          <div key={teamId} className={`rounded-xl border-2 overflow-hidden transition-all ${teamIsActive ? 'border-amber-300 dark:border-amber-700' : 'border-border'}`}>

                            {/* Team header */}
                            <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 flex items-center gap-2 border-b border-border">
                              <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                              <span className="font-semibold text-sm text-foreground">{teamName}</span>
                              {teamCode && <span className="ml-1 text-[10px] font-mono text-slate-400 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">{teamCode}</span>}
                              <span className="ml-auto text-[10px] text-slate-400">{teamOfficers.length} officers</span>
                            </div>

                            {/* Managers section */}
                            <div className="px-3 py-2 space-y-1">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Crown className="h-3 w-3 text-amber-400" />
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Managers</span>
                              </div>
                              {teamMgrs.map((mgr) => {
                                const isActive = filterValue === `user:${mgr.id}`;
                                const lvl = mgr.managerLevel ?? '';
                                const roleColor = (lvl === 'DIVISION' || mgr.role.nameTh.toLowerCase().includes('division'))
                                  ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700'
                                  : (lvl === 'DEPARTMENT' || mgr.role.nameTh.toLowerCase().includes('department'))
                                  ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700'
                                  : 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700';
                                return (
                                  <button
                                    key={mgr.id}
                                    onClick={() => { setFilterValue(`user:${mgr.id}`); setDropdownOpen(false); }}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-all
                                      ${isActive ? 'bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                  >
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${roleColor}`}>
                                      {mgr.role.nameTh}
                                    </span>
                                    <span className={`truncate text-sm ${isActive ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>{mgr.name}</span>
                                    {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Officers section */}
                            <div className="border-t border-border px-3 py-2">
                              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                                OFFICERS ในทีม ({teamOfficers.length})
                              </div>
                              {teamOfficers.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-1">ยังไม่มี Officer ในทีมนี้</p>
                              ) : (
                                <div className="space-y-1">
                                  {teamOfficers.map((off) => {
                                    const isActive = filterValue === `user:${off.id}`;
                                    const initial = off.name.charAt(0).toUpperCase();
                                    return (
                                      <button
                                        key={off.id}
                                        onClick={() => { setFilterValue(`user:${off.id}`); setDropdownOpen(false); }}
                                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm flex items-center gap-2.5 transition-all
                                          ${isActive ? 'bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                      >
                                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0
                                          ${isActive ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                          {initial}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className={`truncate text-sm ${isActive ? 'font-semibold text-blue-700 dark:text-blue-400' : 'text-foreground'}`}>{off.name}</div>
                                          <div className="text-[10px] text-muted-foreground truncate">{off.email}</div>
                                        </div>
                                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Unassigned officers */}
                      {unassignedOfficers.length > 0 && (
                        <div className="rounded-xl border-2 border-border overflow-hidden">
                          <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-border flex items-center gap-2">
                            <UsersIcon className="h-4 w-4 text-slate-400" />
                            <span className="font-semibold text-sm text-foreground">ไม่ได้สังกัดทีม</span>
                          </div>
                          <div className="px-3 py-2 space-y-1">
                            {unassignedOfficers.map((off) => {
                              const isActive = filterValue === `user:${off.id}`;
                              return (
                                <button
                                  key={off.id}
                                  onClick={() => { setFilterValue(`user:${off.id}`); setDropdownOpen(false); }}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm flex items-center gap-2.5 transition-all
                                    ${isActive ? 'bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                >
                                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0
                                    ${isActive ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                    {off.name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className={`truncate ${isActive ? 'font-semibold text-blue-700 dark:text-blue-400' : 'text-foreground'}`}>{off.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* ── Custom dropdown for Manager / Admin ── */
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen((v) => !v)}
                    className="h-9 min-w-[200px] max-w-[260px] rounded-lg border border-white/20 bg-white/10 text-white px-3 text-sm flex items-center justify-between gap-2 hover:bg-white/20 transition-colors"
                  >
                    <span className="truncate">{filterLabel}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 opacity-70 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-1.5 z-50 w-[260px] rounded-xl border border-border bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
                      {/* My Team */}
                      {['team', 'all'].map((val) => {
                        if (val === 'all' && !isExecutive) return null;
                        const label = val === 'team' ? '— My Team' : '— All Team (ทั้งระบบ)';
                        const isActive = filterValue === val;
                        return (
                          <button key={val}
                            onClick={() => { setFilterValue(val); setDropdownOpen(false); }}
                            className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center gap-2.5 transition-colors border-b border-border
                              ${isActive ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-foreground'}`}
                          >
                            <UsersIcon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-500' : 'text-slate-400'}`} />
                            <span>{label}</span>
                            {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />}
                          </button>
                        );
                      })}

                      {/* Managers group */}
                      {managers.length > 0 && (
                        <div>
                          <div className="px-3 pt-2 pb-1 flex items-center gap-1.5">
                            <Crown className="h-3 w-3 text-amber-400" />
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Managers</span>
                          </div>
                          {managers.map((u) => {
                            const isActive = filterValue === `user:${u.id}`;
                            return (
                              <button key={u.id}
                                onClick={() => { setFilterValue(`user:${u.id}`); setDropdownOpen(false); }}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors
                                  ${isActive ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-semibold' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-foreground'}`}
                              >
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0
                                  ${isActive ? 'bg-amber-400 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                  {u.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate">{u.name}</div>
                                  <div className="text-[10px] text-muted-foreground">{u.role.nameTh}</div>
                                </div>
                                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Officers group */}
                      {subordinates.length > 0 && (
                        <div className="border-t border-border">
                          <div className="px-3 pt-2 pb-1 flex items-center gap-1.5">
                            <UsersIcon className="h-3 w-3 text-blue-400" />
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Officers / Sales</span>
                          </div>
                          {subordinates.map((u) => {
                            const isActive = filterValue === `user:${u.id}`;
                            return (
                              <button key={u.id}
                                onClick={() => { setFilterValue(`user:${u.id}`); setDropdownOpen(false); }}
                                className={`w-full text-left pl-5 pr-3 py-2 text-sm flex items-center gap-2.5 transition-colors
                                  ${isActive ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 font-semibold' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-muted-foreground hover:text-foreground'}`}
                              >
                                <span className="text-slate-300 dark:text-slate-600 shrink-0 text-xs">↳</span>
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0
                                  ${isActive ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                  {u.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate">{u.name}</div>
                                  <div className="text-[10px] text-muted-foreground truncate">{u.email}</div>
                                </div>
                                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={handleRefresh}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${spinning ? 'animate-spin' : ''}`} />
            </button>
            {isExecutive && !isCeo && (
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

      {/* Manager/CEO viewing individual officer → analytics view */}
      {isCeoViewingOfficer && selectedUser && (
        <OfficerAnalyticsView userId={selectedUser.id} selectedUser={selectedUser} />
      )}

      {/* Normal manager/team dashboard */}
      {!isCeoViewingOfficer && (
        <>
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
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// OFFICER ANALYTICS VIEW — shown when manager drills into an officer
// ════════════════════════════════════════════════════════════════════════════
interface OfficerAnalyticsData {
  user: {
    id: string; name: string; email: string; phone?: string | null;
    role: { code: string; nameTh: string };
    team?: { id: string; name: string; size?: number } | null;
    isActive: boolean; lastLoginAt?: string | null;
    position?: string; isTeamLead?: boolean;
  };
  totals: {
    quotations: number; approvedValue: number; thisMonth: number;
    approvedCount: number; rejectedCount: number; soCount: number; soValue: number;
    totalValue?: number; pendingValue?: number;
    pendingCount?: number; poPendingCount?: number; approvedCount2?: number;
  };
  byStatus: Array<{ status: string; count: number }>;
  recent: Array<{ id: string; quotationNo: string; status: string; grandTotal: number; createdAt: string; customerCompany: string }>;
  recentSos: Array<{ id: string; saleOrderNo: string; status: string; grandTotal: number; createdAt: string; customerCompany: string }>;
  monthlyTrend: Array<{ month: string; count: number; value: number }>;
  expiringQuotations?: Array<{ id: string; quotationNo: string; customerCompany: string; grandTotal: number; expiryDate: string; status: string }>;
  topCustomers?: Array<{ customerId: string; customerCompany: string; qtCount: number; totalValue: number }>;
}

function OfficerAnalyticsView({ userId, selectedUser }: {
  userId: string;
  selectedUser: { name: string; email: string; role: { code: string; nameTh: string } };
}) {
  const [data, setData] = useState<OfficerAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [trendTab, setTrendTab] = useState<'count' | 'value'>('value');

  useEffect(() => {
    setLoading(true);
    setData(null);
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<ApiResponse<OfficerAnalyticsData>>(`/manager-dashboard/users/${userId}`);
        if (!cancelled && res.data?.data) setData(res.data.data);
      } catch (err) { console.error(getApiErrorMessage(err)); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );

  if (!data) return (
    <div className="bg-card border rounded-2xl p-10 text-center text-muted-foreground text-sm">ไม่สามารถโหลดข้อมูลได้</div>
  );

  const { totals, byStatus, recent, recentSos, monthlyTrend } = data;
  const winRate = totals.quotations > 0 ? Math.round((totals.approvedCount / totals.quotations) * 100) : 0;
  const maxTrend = Math.max(...monthlyTrend.map((m) => trendTab === 'count' ? m.count : m.value), 1);

  // Monthly trend derived stats
  const totalRevenue    = monthlyTrend.reduce((s, m) => s + m.value, 0);
  const totalDocs       = monthlyTrend.reduce((s, m) => s + m.count, 0);
  const activeMonths    = monthlyTrend.filter((m) => m.count > 0);
  const avgMonthRevenue = activeMonths.length > 0 ? Math.round(totalRevenue / activeMonths.length) : 0;
  const avgPerOrder     = totalDocs > 0 ? Math.round(totalRevenue / totalDocs) : 0;
  const bestMonthEntry  = monthlyTrend.reduce<typeof monthlyTrend[0] | null>((b, m) => (!b || m.value > b.value ? m : b), null);
  const lastM  = monthlyTrend[monthlyTrend.length - 1];
  const prevM  = monthlyTrend[monthlyTrend.length - 2];
  const revenueGrowth = prevM && prevM.value > 0 ? Math.round(((lastM.value - prevM.value) / prevM.value) * 100) : null;
  const countGrowth   = prevM && prevM.count > 0 ? Math.round(((lastM.count - prevM.count) / prevM.count) * 100) : null;
  const bestCustomer  = data.topCustomers?.[0]?.customerCompany ?? null;

  const STATUS_COLORS: Record<string, string> = {
    DRAFT: '#94a3b8', PENDING: '#f59e0b', PENDING_ESCALATED: '#ef4444',
    APPROVED: '#10b981', REJECTED: '#ef4444', CANCELLED: '#6b7280',
    EXPIRED: '#9ca3af', PO_PENDING: '#8b5cf6', PO_APPROVED: '#06b6d4',
  };
  const STATUS_LABELS: Record<string, string> = {
    DRAFT: 'Draft', PENDING: 'รออนุมัติ', PENDING_ESCALATED: 'Escalated',
    APPROVED: 'อนุมัติแล้ว', REJECTED: 'ปฏิเสธ', CANCELLED: 'ยกเลิก',
    EXPIRED: 'หมดอายุ', PO_PENDING: 'รอ PO', PO_APPROVED: 'PO อนุมัติ',
  };

  return (
    <div className="space-y-5">

      {/* ── KPI Row 1 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <BarChart2 className="h-5 w-5" />, label: 'Total QT', value: totals.quotations, sub: `เดือนนี้ ${totals.thisMonth} ใบ`, gradient: 'from-slate-600 to-slate-800', isText: false },
          { icon: <CheckCircle2 className="h-5 w-5" />, label: 'Approved Value', value: formatMoney(totals.approvedValue), sub: `${totals.approvedCount} ใบอนุมัติแล้ว`, gradient: 'from-emerald-500 to-teal-700', isText: true },
          { icon: <Activity className="h-5 w-5" />, label: 'Win Rate', value: `${winRate}%`, sub: `ปฏิเสธ ${totals.rejectedCount} ใบ`, gradient: winRate >= 50 ? 'from-green-500 to-emerald-700' : 'from-orange-500 to-red-600', isText: true },
          { icon: <ShoppingCart className="h-5 w-5" />, label: 'SO Confirmed', value: formatMoney(totals.soValue), sub: `${totals.soCount} SO ยืนยันแล้ว`, gradient: 'from-blue-500 to-indigo-700', isText: true },
        ].map((k) => (
          <div key={k.label} className={`bg-gradient-to-br ${k.gradient} rounded-2xl p-4 text-white shadow`}>
            <div className="flex items-center gap-2 mb-2 opacity-80">{k.icon}<span className="text-xs font-medium uppercase tracking-wide">{k.label}</span></div>
            <div className="text-2xl font-bold">{k.value}</div>
            <div className="text-xs text-white/60 mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Monthly Trend (full width, redesigned) ── */}
      <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-semibold">แนวโน้มรายเดือน</span>
            <span className="text-[11px] text-muted-foreground">6 เดือนล่าสุด</span>
          </div>
          <div className="flex bg-muted rounded-lg p-0.5">
            {(['value', 'count'] as const).map((t) => (
              <button key={t} onClick={() => setTrendTab(t)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${trendTab === t ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {t === 'value' ? 'Revenue' : 'Documents'}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPI Mini Cards ── */}
        {(() => {
          const growth = trendTab === 'value' ? revenueGrowth : countGrowth;
          const growthColor = growth == null ? 'text-muted-foreground' : growth > 0 ? 'text-emerald-600 dark:text-emerald-400' : growth < 0 ? 'text-rose-500' : 'text-muted-foreground';
          const growthLabel = growth == null ? 'N/A' : `${growth > 0 ? '+' : ''}${growth}%`;
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide mb-1">Revenue Total</div>
                <div className="text-base font-bold tabular-nums truncate">{formatMoney(totalRevenue)}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">6 เดือนล่าสุด</div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide mb-1">Avg / Month</div>
                <div className="text-base font-bold tabular-nums truncate">{formatMoney(avgMonthRevenue)}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{activeMonths.length} เดือนที่มีข้อมูล</div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide mb-1">Total Documents</div>
                <div className="text-base font-bold tabular-nums">{totalDocs} ใบ</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">QT + SO ทั้งหมด</div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide mb-1">Growth %</div>
                <div className={`text-base font-bold tabular-nums ${growthColor}`}>{growthLabel}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">vs เดือนก่อน</div>
              </div>
            </div>
          );
        })()}

        {/* ── Line Chart ── */}
        {monthlyTrend.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-xs">ยังไม่มีข้อมูล</div>
        ) : (() => {
          const vals    = monthlyTrend.map((m) => trendTab === 'count' ? m.count : m.value);
          const max     = Math.max(...vals, 1);
          const H       = 140;
          const PB      = 24;
          const PL      = 48;
          const PR      = 12;
          const PT      = 10;
          const chartH  = H - PB - PT;
          const n       = vals.length;
          const VW      = 480;
          const chartW  = VW - PL - PR;
          const cx      = (i: number) => PL + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
          const cy      = (v: number) => PT + chartH - (v / max) * chartH * 0.88;
          const fmt     = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : String(v);
          const yTicks  = [0, 0.25, 0.5, 0.75, 1];
          const pathD   = n >= 2 ? `M ${vals.map((v, i) => `${cx(i)},${cy(v)}`).join(' L ')}` : '';
          const areaD   = n >= 2 ? `${pathD} L ${cx(n - 1)},${PT + chartH} L ${cx(0)},${PT + chartH} Z` : '';
          const lineColor = trendTab === 'value' ? '#10b981' : '#6366f1';
          const areaColor = trendTab === 'value' ? '#10b98122' : '#6366f122';
          const dotColor  = trendTab === 'value' ? '#10b981' : '#6366f1';
          return (
            <svg viewBox={`0 0 ${VW} ${H}`} className="w-full" style={{ height: H }}>
              {/* Y grid + labels */}
              {yTicks.map((t) => {
                const gy = PT + chartH - t * chartH * 0.88;
                return (
                  <g key={t}>
                    <line x1={PL - 4} y1={gy} x2={VW - PR} y2={gy} stroke="currentColor" strokeOpacity={0.06} strokeWidth={1} />
                    {t > 0 && (
                      <text x={PL - 8} y={gy + 4} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.4}>
                        {fmt(max * t)}
                      </text>
                    )}
                  </g>
                );
              })}
              {/* Area fill */}
              {areaD && <path d={areaD} fill={areaColor} />}
              {/* Line */}
              {pathD && <path d={pathD} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
              {/* Dots + value labels + x labels */}
              {vals.map((v, i) => {
                const isLast = i === n - 1;
                const x = cx(i);
                const y = cy(v);
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r={isLast ? 4 : 3} fill={isLast ? dotColor : 'var(--background)'} stroke={dotColor} strokeWidth={2} />
                    {(isLast || n <= 4) && v > 0 && (
                      <text x={x} y={y - 8} textAnchor="middle" fontSize={9} fill="currentColor" fillOpacity={0.6}>
                        {trendTab === 'value' ? fmt(v) : v}
                      </text>
                    )}
                    <text x={x} y={H - 5} textAnchor="middle" fontSize={10} fill="currentColor"
                      fillOpacity={isLast ? 0.85 : 0.45} fontWeight={isLast ? '600' : '400'}>
                      {monthlyTrend[i].month}
                    </text>
                  </g>
                );
              })}
            </svg>
          );
        })()}

        {/* ── Insights Row ── */}
        {monthlyTrend.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Best Month</span>
              <span className="text-sm font-bold">{bestMonthEntry?.month ?? '—'}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">{bestMonthEntry ? formatMoney(bestMonthEntry.value) : '—'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Avg per Order</span>
              <span className="text-sm font-bold tabular-nums">{formatMoney(avgPerOrder)}</span>
              <span className="text-[10px] text-muted-foreground">ต่อใบเสนอราคา</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Conversion Rate</span>
              <span className={`text-sm font-bold tabular-nums ${winRate >= 50 ? 'text-emerald-600 dark:text-emerald-400' : winRate >= 25 ? 'text-amber-500' : 'text-rose-500'}`}>{winRate}%</span>
              <span className="text-[10px] text-muted-foreground">QT → Approved</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Best Customer</span>
              <span className="text-sm font-bold truncate">{bestCustomer ?? '—'}</span>
              <span className="text-[10px] text-muted-foreground">{bestCustomer ? `${data.topCustomers![0].qtCount} QT` : 'ยังไม่มีข้อมูล'}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Status Breakdown ── */}
      <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold">Status Breakdown</span>
          <span className="ml-auto text-xs text-muted-foreground">{totals.quotations} ใบทั้งหมด</span>
        </div>
        {byStatus.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-xs">ยังไม่มีข้อมูล</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {byStatus.sort((a, b) => b.count - a.count).map(({ status, count }) => {
              const pct = totals.quotations > 0 ? Math.round((count / totals.quotations) * 100) : 0;
              const color = STATUS_COLORS[status] ?? '#94a3b8';
              return (
                <div key={status}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="font-medium">{STATUS_LABELS[status] ?? status}</span>
                    </span>
                    <span className="text-muted-foreground tabular-nums">{count} ใบ · {pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Recent Quotations ── */}
      <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold">ใบเสนอราคาล่าสุด</span>
          <Badge variant="outline" className="ml-auto text-[10px]">{recent.length} รายการ</Badge>
        </div>
        {recent.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">ยังไม่มีใบเสนอราคา</div>
        ) : (
          <div className="space-y-1">
            {recent.map((q) => {
              const color = STATUS_COLORS[q.status] ?? '#94a3b8';
              return (
                <Link key={q.id} href={`/quotations/${q.id}`}
                  className="group flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/60 transition-colors"
                >
                  <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[12px] font-semibold tabular-nums w-28 shrink-0">{q.quotationNo}</span>
                  <span className="text-[11px] text-muted-foreground truncate flex-1">{q.customerCompany}</span>
                  <span className="text-[11px] font-medium tabular-nums shrink-0">{formatMoney(q.grandTotal)}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{STATUS_LABELS[q.status] ?? q.status}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground/60 shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Recent Sale Orders ── */}
      {recentSos.length > 0 && (
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-semibold">Sale Orders ล่าสุด</span>
            <Badge variant="outline" className="ml-auto text-[10px]">{recentSos.length} รายการ</Badge>
          </div>
          <div className="space-y-1">
            {recentSos.map((so) => {
              const color = so.status === 'CONFIRMED' || so.status === 'COMPLETED' ? '#10b981' : so.status === 'REJECTED' ? '#ef4444' : '#f59e0b';
              return (
                <Link key={so.id} href={`/sale-orders/${so.id}`}
                  className="group flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/60 transition-colors"
                >
                  <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[12px] font-semibold tabular-nums w-28 shrink-0">{so.saleOrderNo}</span>
                  <span className="text-[11px] text-muted-foreground truncate flex-1">{so.customerCompany}</span>
                  <span className="text-[11px] font-medium tabular-nums shrink-0">{formatMoney(so.grandTotal)}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{so.status}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground/60 shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ Extra sections — Sales Pipeline, Performance, Expiring, Customers ══ */}
      {(() => {
        const pendingCnt = totals.pendingCount ?? 0;
        const approvedCnt2 = totals.approvedCount2 ?? totals.approvedCount;
        const poPendingCnt = totals.poPendingCount ?? 0;
        const totalVal = totals.totalValue ?? 0;
        const pendingVal = totals.pendingValue ?? 0;
        const expiring = data.expiringQuotations ?? [];
        const customers = data.topCustomers ?? [];

        const pipelineStages = [
          { label: 'รออนุมัติ', count: pendingCnt, value: pendingVal, color: '#f59e0b' },
          { label: 'อนุมัติแล้ว', count: approvedCnt2, value: totals.approvedValue, color: '#10b981' },
          { label: 'รอ PO', count: poPendingCnt, value: 0, color: '#8b5cf6' },
          { label: 'SO', count: totals.soCount, value: totals.soValue, color: '#06b6d4' },
        ].filter((s) => s.count > 0);

        const winColor = winRate >= 50 ? 'text-emerald-600 dark:text-emerald-400' : winRate >= 25 ? 'text-amber-500' : 'text-rose-500';

        return (
          <>
            {/* ── Sales Pipeline ── */}
            <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
              <div className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Sales Pipeline
                <span className="ml-auto text-xs text-muted-foreground font-normal">มูลค่ารวม {formatMoney(totalVal)}</span>
              </div>
              {pipelineStages.length === 0 ? (
                <div className="flex items-center justify-center h-20 text-muted-foreground text-xs">ยังไม่มีข้อมูล</div>
              ) : (
                <div className="space-y-2.5">
                  {pipelineStages.map((s) => {
                    const pct = totalVal > 0 && s.value > 0 ? Math.round((s.value / totalVal) * 100) : 0;
                    return (
                      <div key={s.label}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                            <span className="font-medium">{s.label}</span>
                            <span className="text-muted-foreground">({s.count} ใบ)</span>
                          </span>
                          <span className="tabular-nums text-muted-foreground">{s.value > 0 ? formatMoney(s.value) : '—'} {pct > 0 ? `· ${pct}%` : ''}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(pct, s.count > 0 ? 4 : 0)}%`, backgroundColor: s.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Sales Performance (this officer) ── */}
            <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
              <div className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
                <UsersIcon className="h-4 w-4 text-blue-500" />
                Sales Performance
              </div>
              <div>
                <div className="grid grid-cols-[1fr_40px_100px_100px_44px] gap-x-3 px-3 pb-2 border-b items-center">
                  <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">ชื่อ</span>
                  <span className="text-[10px] font-bold text-muted-foreground/60 uppercase text-center">QT</span>
                  <span className="text-[10px] font-bold text-muted-foreground/60 uppercase text-right">มูลค่า QT</span>
                  <span className="text-[10px] font-bold text-muted-foreground/60 uppercase text-right">SO มูลค่า</span>
                  <span className="text-[10px] font-bold text-muted-foreground/60 uppercase text-right">Win%</span>
                </div>
                <div className="grid grid-cols-[1fr_40px_100px_100px_44px] gap-x-3 px-3 pt-2.5 pb-1.5 items-center">
                  <div className="min-w-0">
                    <div className="font-semibold text-[13px] truncate leading-tight">{data.user.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{data.user.email}</div>
                  </div>
                  <div className="text-center">
                    <span className="text-[13px] font-bold tabular-nums">{totals.quotations}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[13px] font-bold tabular-nums">{formatMoney(totalVal)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[12px] text-muted-foreground tabular-nums">{formatMoney(totals.soValue)}</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-[13px] font-bold tabular-nums ${winColor}`}>{winRate}%</span>
                  </div>
                </div>
                <div className="mx-3 mb-2 h-[3px] rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700" style={{ width: '100%' }} />
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-border/50">
                  {[
                    { label: 'QT ทั้งหมด', value: `${totals.quotations} ใบ`, color: 'text-foreground' },
                    { label: 'Approved', value: `${approvedCnt2} ใบ`, color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Pending', value: `${pendingCnt} ใบ`, color: 'text-amber-500' },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <div className={`text-sm font-bold tabular-nums ${s.color}`}>{s.value}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Expiring Soon + Customer Insight ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Expiring Soon */}
              <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
                <div className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
                  <Timer className="h-4 w-4 text-rose-500" />
                  Expiring Soon (7 วัน)
                  {expiring.length > 0 && (
                    <Badge variant="outline" className="ml-auto text-[10px] bg-rose-50 text-rose-700 border-rose-300">
                      {expiring.length} รายการ
                    </Badge>
                  )}
                </div>
                {expiring.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ไม่มีใบเสนอราคาที่ใกล้หมดอายุ
                  </div>
                ) : (
                  <div className="space-y-2">
                    {expiring.map((q) => {
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

              {/* Customer Insight */}
              <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
                <div className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
                  <Target className="h-4 w-4 text-violet-500" />
                  Customer Insight — Top ลูกค้า
                  <Badge variant="outline" className="ml-auto text-[10px]">{customers.length} ราย</Badge>
                </div>
                {customers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">ยังไม่มีข้อมูลลูกค้า</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(() => {
                      const maxVal = Math.max(...customers.map((c) => c.totalValue), 1);
                      return customers.map((c, i) => {
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
            </div>
          </>
        );
      })()}

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

  const alerts: Array<{ type: 'danger' | 'warning' | 'info'; title: string; desc: string }> =
    data.alerts ?? [
      ...(data.totals.escalated > 0
        ? [{ type: 'danger' as const, title: `${data.totals.escalated} รายการเกินอำนาจการอนุมัติ`, desc: 'เกินวงเงินหรือสิทธิ์ส่วนลด — ต้องส่งต่อผู้มีอำนาจถัดไป' }]
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
      ? [{ type: 'Escalated Cases', count: data.totals.escalated, value: 0, reason: 'เกินวงเงินหรือสิทธิ์ส่วนลด — ต้องส่งต่อ', priority: 'high' as const }]
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

      {/* ══ SECTION 3: Sales Funnel + Revenue Trend + Forecast (grouped) ══ */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* LEFT: Sales Pipeline Funnel */}
          <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
            <div className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Sales Pipeline
            </div>
            <SalesFunnel data={data} conversionRate={conversionRate} />
          </div>

          {/* RIGHT: Combined Trend Card */}
          <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
            <TrendOverviewCard trendData={trendData} revenueTrendData={revenueTrendData} />
          </div>
        </div>

        {/* Revenue Forecast — การคาดการณ์รายได้ */}
        <div className="bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-cyan-500/10 border border-indigo-500/30 rounded-2xl shadow-sm p-5">
          <div className="text-sm font-semibold flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            <span className="text-indigo-700 dark:text-indigo-400">Revenue Forecast — การคาดการณ์รายได้</span>
          </div>
          {!data.forecast ? (
            <div className="text-center py-4 text-muted-foreground text-sm">ยังไม่มีข้อมูล</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: <BarChart2 className="h-5 w-5" />, label: 'Avg Revenue / เดือน', value: formatMoney(data.forecast.avgMonthlyRevenue), sub: 'เฉลี่ย 6 เดือนที่ผ่านมา', gradient: 'from-blue-500 to-indigo-600' },
                { icon: <TrendingUp className="h-5 w-5" />, label: 'Forecast เดือนหน้า', value: formatMoney(data.forecast.nextMonthForecast), sub: 'ประมาณการ +5% growth', gradient: 'from-violet-500 to-purple-600' },
                { icon: <Zap className="h-5 w-5" />, label: 'Pipeline Coverage', value: formatMoney(data.forecast.pipelineCoverage), sub: 'มูลค่า pending × conv. rate', gradient: 'from-cyan-500 to-teal-600' },
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

      {/* ══ SECTION 6-7: Action Required (unified — no duplication) ══ */}
      {(() => {
        const hasEscalated   = data.recentEscalated.length > 0;
        const pendingCount   = data.totals.pending ?? 0;
        const pendingVal     = data.totals.pendingValue ?? 0;
        const poCount        = data.totals.poVerificationPending ?? 0;
        const escalatedCount = data.totals.escalated ?? data.recentEscalated.length;
        const escalatedVal   = data.recentEscalated.reduce((s, q) => s + (q.grandTotal ?? 0), 0);

        // badge = all actionable items including escalated
        const actionableCount = pendingCount + poCount + escalatedCount;
        const hasAny = actionableCount > 0 || hasEscalated;
        if (!hasAny) return null;

        return (
          <div className="rounded-2xl border border-border/60 shadow-sm overflow-hidden bg-card">
            {/* ── Card header ── */}
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b bg-muted/30">
              <div className="h-6 w-6 rounded-md bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <span className="text-sm font-semibold">ต้องดำเนินการ</span>
              {actionableCount > 0 && (
                <span className="ml-1 h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {actionableCount}
                </span>
              )}
              <Link href="/approval-queue" className="ml-auto flex items-center gap-1 text-[11px] text-primary hover:underline">
                รายการที่ต้องดำเนินการ <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="divide-y divide-border/50">

              {/* ── ROW 1: QT Pending Approval (manager can act directly) ── */}
              {pendingCount > 0 && (
                <div>
                  <div className="flex items-center gap-3 px-5 py-3.5 bg-red-500/[0.03]">
                    <div className="w-[3px] h-8 rounded-full bg-red-500 shrink-0" />
                    <div className="h-8 w-8 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold">QT รออนุมัติ</div>
                      <div className="text-[11px] text-muted-foreground">ใบเสนอราคาที่รอให้คุณอนุมัติ</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold tabular-nums text-red-600">{pendingCount}</div>
                      {pendingVal > 0 && (
                        <div className="text-[11px] text-muted-foreground tabular-nums">{formatMoney(pendingVal)}</div>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                      HIGH
                    </span>
                    <Button asChild size="sm" variant="outline" className="h-7 px-3 text-[11px] shrink-0 hover:border-red-300 hover:text-red-600">
                      <Link href="/quotations">อนุมัติ <ChevronRight className="h-3 w-3 ml-0.5" /></Link>
                    </Button>
                  </div>
                  {/* Show top pending QTs from pipeline */}
                  {(() => {
                    const qtItems = (data.pipelineDetail?.stage1Top ?? []).filter((q) =>
                      !data.recentEscalated.some((e) => e.id === q.id)
                    );
                    return (
                      <>
                        {qtItems.slice(0, 4).map((q) => (
                          <Link key={q.id} href={`/quotations/${q.id}`}
                            className="group flex items-center gap-4 px-5 py-2.5 hover:bg-red-50/60 dark:hover:bg-red-900/10 transition-colors border-t border-border/30"
                          >
                            <div className="w-[3px] h-6 rounded-full bg-red-200 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-[12px] font-semibold tabular-nums">{q.quotationNo}</span>
                              <div className="text-[11px] text-muted-foreground truncate mt-px">{q.customerCompany}</div>
                            </div>
                            <div className="text-[13px] font-bold text-red-700 tabular-nums shrink-0">{formatMoney(q.grandTotal)}</div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-red-400 transition-colors shrink-0" />
                          </Link>
                        ))}
                        {pendingCount > 4 && (
                          <Link href="/approval-queue"
                            className="flex items-center justify-center gap-1 px-5 py-2 text-[11px] text-red-600 hover:bg-red-50/60 dark:hover:bg-red-900/10 transition-colors border-t border-border/30"
                          >
                            ดูทั้งหมด {pendingCount} รายการ <ChevronRight className="h-3 w-3" />
                          </Link>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* ── ROW 2: PO Validation Pending ── */}
              {poCount > 0 && (
                <div>
                  <div className="flex items-center gap-3 px-5 py-3.5 bg-amber-500/[0.03]">
                    <div className="w-[3px] h-8 rounded-full bg-amber-500 shrink-0" />
                    <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold">PO รอตรวจสอบ</div>
                      <div className="text-[11px] text-muted-foreground">PO ที่รออนุมัติความถูกต้อง</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold tabular-nums text-amber-600">{poCount}</div>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      MED
                    </span>
                    <Button asChild size="sm" variant="outline" className="h-7 px-3 text-[11px] shrink-0 hover:border-amber-300 hover:text-amber-600">
                      <Link href="/quotations?status=PO_PENDING">ดูทั้งหมด <ChevronRight className="h-3 w-3 ml-0.5" /></Link>
                    </Button>
                  </div>
                  {/* Individual PO items */}
                  {(data.pipelineDetail?.stage3Top ?? []).slice(0, 4).map((q) => (
                    <Link key={q.id} href={`/quotations/${q.id}`}
                      className="group flex items-center gap-4 px-5 py-2.5 hover:bg-amber-50/60 dark:hover:bg-amber-900/10 transition-colors border-t border-border/30"
                    >
                      <div className="w-[3px] h-6 rounded-full bg-amber-200 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[12px] font-semibold tabular-nums">{q.quotationNo}</span>
                        <div className="text-[11px] text-muted-foreground truncate mt-px">
                          {q.customerCompany}
                          {q.poUploadedAt && (
                            <span className="ml-2 text-amber-600">· อัปโหลด {formatDate(q.poUploadedAt)}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-[13px] font-bold text-amber-700 tabular-nums shrink-0">{formatMoney(q.grandTotal)}</div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-amber-400 transition-colors shrink-0" />
                    </Link>
                  ))}
                  {poCount > 4 && (
                    <Link href="/quotations?status=PO_PENDING"
                      className="flex items-center justify-center gap-1 px-5 py-2 text-[11px] text-amber-600 hover:bg-amber-50/60 transition-colors border-t border-border/30"
                    >
                      ดูทั้งหมด {poCount} รายการ <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              )}

              {/* ── ROW 3: Escalated — monitoring only (manager already forwarded to CEO) ── */}
              {hasEscalated && (
                <div>
                  <div className="flex items-center gap-3 px-5 py-3 bg-orange-500/[0.04]">
                    <div className="w-[3px] h-8 rounded-full bg-orange-400 shrink-0" />
                    <Flame className="h-4 w-4 text-orange-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-orange-700 dark:text-orange-400">
                        ส่งต่อ CEO แล้ว — รอผลอนุมัติ
                      </div>
                      <div className="text-[11px] text-muted-foreground">เกินวงเงิน/สิทธิ์ส่วนลด · ติดตามสถานะ</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[13px] font-bold text-orange-600 tabular-nums">{formatMoney(escalatedVal)}</div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">{data.recentEscalated.length} รายการ</div>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                      ติดตาม
                    </span>
                  </div>
                  <div className="divide-y divide-border/30">
                    {data.recentEscalated.map((q) => (
                      <Link key={q.id} href={`/quotations/${q.id}`}
                        className="group flex items-center gap-4 px-5 py-2.5 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-colors"
                      >
                        <div className="w-[3px] h-6 rounded-full bg-orange-200 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold tabular-nums">{q.quotationNo}</span>
                            <span className="text-[9px] font-bold px-1.5 py-px rounded bg-orange-100 text-orange-700 border border-orange-200">
                              ESCALATED
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate mt-px">
                            {q.customerCompany} · {q.createdByName} · {formatDate(q.submittedAt)}
                          </div>
                        </div>
                        <div className="text-[13px] font-bold text-orange-700 dark:text-orange-400 tabular-nums shrink-0">
                          {formatMoney(q.grandTotal)}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-orange-400 transition-colors shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        );
      })()}

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
          ) : (() => {
            // COL: # | ชื่อ | QT | Value (total QT) | SO Value (confirmed SO) | Win%
            const COL = 'grid-cols-[26px_1fr_36px_96px_96px_44px]';
            const maxVal = Math.max(...data.topOfficers.map((x) => x.value), 1);
            return (
              <div>
                {/* ── Header ── */}
                <div className={`grid ${COL} gap-x-3 px-3 pb-2 border-b items-center`}>
                  <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">#</span>
                  <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">ชื่อ</span>
                  <span className="text-[10px] font-bold text-muted-foreground/60 uppercase text-center">QT</span>
                  <span className="text-[10px] font-bold text-muted-foreground/60 uppercase text-right">มูลค่า QT</span>
                  <span className="text-[10px] font-bold text-muted-foreground/60 uppercase text-right">SO อนุมัติ</span>
                  <span className="text-[10px] font-bold text-muted-foreground/60 uppercase text-right">Win%</span>
                </div>

                {/* ── Rows ── */}
                <div className="divide-y divide-border/40">
                  {data.topOfficers.map((o, idx) => {
                    const barPct   = Math.round((o.value / maxVal) * 100);
                    const winRate  = o.winRate ?? 0;
                    // avgDealSize = total SO confirmed value (from backend)
                    const soValue  = o.avgDealSize ?? 0;
                    const medal    = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                    const numColor = idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-orange-400' : 'text-muted-foreground/50';
                    const barColor = idx === 0 ? 'from-amber-400 to-yellow-300' : idx === 1 ? 'from-slate-400 to-slate-300' : idx === 2 ? 'from-orange-400 to-amber-300' : 'from-blue-500 to-cyan-400';
                    const winColor = winRate >= 50 ? 'text-emerald-600 dark:text-emerald-400' : winRate >= 25 ? 'text-amber-500' : 'text-rose-500';
                    return (
                      <Link key={o.userId} href={`/manager/team/${o.userId}`}
                        className="group block hover:bg-accent/50 transition-colors rounded-xl"
                      >
                        <div className={`grid ${COL} gap-x-3 px-3 pt-2.5 pb-1.5 items-center`}>
                          {/* # */}
                          <div className={`text-xs font-bold text-center ${numColor}`}>
                            {medal ?? <span className="text-[11px]">{idx + 1}</span>}
                          </div>
                          {/* Name */}
                          <div className="min-w-0">
                            <div className="font-semibold text-[13px] truncate group-hover:text-primary transition-colors leading-tight">
                              {o.userName}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">{o.userEmail}</div>
                          </div>
                          {/* QT */}
                          <div className="text-center">
                            <span className="text-[13px] font-bold tabular-nums">{o.count}</span>
                          </div>
                          {/* Value */}
                          <div className="text-right">
                            <span className="text-[13px] font-bold tabular-nums">{formatMoney(o.value)}</span>
                          </div>
                          {/* SO อนุมัติ */}
                          <div className="text-right">
                            <span className="text-[12px] text-muted-foreground tabular-nums">{formatMoney(soValue)}</span>
                          </div>
                          {/* Win% */}
                          <div className="text-right">
                            <span className={`text-[13px] font-bold tabular-nums ${winColor}`}>{winRate}%</span>
                          </div>
                        </div>
                        {/* Value bar */}
                        <div className="mx-3 mb-2 h-[3px] rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
                            style={{ width: `${barPct}%` }} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Top Rejection Reasons — Donut Chart */}
        <RejectionDonutCard reasons={reasons} />
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


    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SALES FUNNEL — with value, aging, bottleneck alerts, drilldown
// ════════════════════════════════════════════════════════════════════════════
function SalesFunnel({ data, conversionRate }: { data: DashboardData; conversionRate: number }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const pd = data.pipelineDetail;

  function fmtAge(hours: number | null | undefined): string {
    if (!hours || hours <= 0) return '—';
    if (hours < 24) return `${Math.round(hours)}ชม.`;
    return `${Math.round(hours / 24)}วัน`;
  }
  function ageLevel(h: number | null | undefined, warnH: number, critH: number): 'ok' | 'warn' | 'crit' {
    if (!h) return 'ok';
    if (h >= critH) return 'crit';
    if (h >= warnH) return 'warn';
    return 'ok';
  }

  const totalQt   = Math.max(data.totals.quotations, 1);
  const totalVal  = (data.totals.totalValue ?? 0) + (data.totals.pendingValue ?? 0);
  const pendingCount = (data.totals.pending ?? 0) + (data.totals.escalated ?? 0);

  // isBaseline = stage 0, bar always 100%, no aging, drilldown = link to /quotations
  const stages = [
    {
      label: 'Quotation Issued',
      sublabel: 'จุดเริ่มต้น — QT ทั้งหมด (baseline 100%)',
      count: data.totals.quotations,
      value: totalVal,
      color: '#3b82f6',
      grad: 'from-blue-500 to-indigo-600',
      avgH: null as number | null | undefined,
      warnH: 0, critH: 0,
      top: [] as any[],
      dateKey: null as string | null,
      isBaseline: true,
    },
    {
      label: 'Pending Approval',
      sublabel: 'รอผู้จัดการอนุมัติ',
      count: pendingCount,
      value: data.totals.pendingValue,
      color: '#f59e0b',
      grad: 'from-amber-500 to-orange-500',
      avgH: pd?.stage1AvgHours,
      warnH: 48, critH: 168,
      top: pd?.stage1Top ?? [],
      dateKey: 'submittedAt',
      isBaseline: false,
    },
    {
      label: 'Approved → Waiting PO',
      sublabel: 'อนุมัติแล้ว รอรับ PO จากลูกค้า',
      count: data.totals.approved,
      value: pd?.approvedOnlyValue ?? 0,
      color: '#06b6d4',
      grad: 'from-cyan-500 to-blue-500',
      avgH: pd?.stage2AvgHours,
      warnH: 72, critH: 168,
      top: pd?.stage2Top ?? [],
      dateKey: 'approvedAt',
      isBaseline: false,
    },
    {
      label: 'PO Received',
      sublabel: 'รับ PO แล้ว รอยืนยัน SO',
      count: data.totals.poVerificationPending ?? 0,
      value: pd?.poPendingValue ?? 0,
      color: '#14b8a6',
      grad: 'from-teal-500 to-emerald-500',
      avgH: pd?.stage3AvgHours,
      warnH: 48, critH: 120,
      top: pd?.stage3Top ?? [],
      dateKey: 'poUploadedAt',
      isBaseline: false,
    },
    {
      label: 'SO Confirmed',
      sublabel: 'ได้รับคำสั่งซื้อแล้ว',
      count: data.totals.soConfirmed ?? 0,
      value: pd?.soConfirmedValue ?? 0,
      color: '#10b981',
      grad: 'from-emerald-500 to-green-600',
      avgH: null as number | null | undefined,
      warnH: 0, critH: 0,
      top: pd?.stage4Top ?? [],
      dateKey: 'createdAt',
      isBaseline: false,
    },
  ];

  return (
    <div className="space-y-1.5">
      {stages.map((s, i) => {
        // bar width: stage 0 = 100%; others = count / totalQt
        const pct = s.isBaseline ? 100 : Math.round((s.count / totalQt) * 100);
        const barW = Math.max(pct, s.count > 0 ? 8 : 0);
        const lvl = ageLevel(s.avgH, s.warnH, s.critH);
        const isOpen = expanded === i;
        const hasAlert = !s.isBaseline && lvl !== 'ok' && s.count > 0;
        const ageBadge = {
          ok:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
          warn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
          crit: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        }[lvl];

        return (
          <div key={i}>
            <button onClick={() => setExpanded(isOpen ? null : i)} className="w-full text-left">
              <div className={`rounded-xl border transition-all duration-200 ${
                isOpen ? 'border-border bg-accent/40' : 'border-transparent hover:border-border/60 hover:bg-accent/20'
              } ${hasAlert ? 'ring-1 ring-amber-400/50' : ''} ${s.isBaseline ? 'ring-1 ring-blue-400/30' : ''}`}>

                {/* ── Main row — fixed-column grid ── */}
                <div className="grid items-center gap-2 px-3 py-2.5"
                  style={{ gridTemplateColumns: '20px 120px 52px 1fr 48px 88px 56px 14px' }}>

                  {/* Col 1: Stage number */}
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ background: s.color }}>{i + 1}</div>

                  {/* Col 2: Labels */}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold leading-tight truncate">{s.label}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">{s.sublabel}</div>
                  </div>

                  {/* Col 3: Count badge — always same width */}
                  <div className="flex items-center justify-center">
                    <span className="text-xs font-bold text-white rounded-full px-2 py-0.5 tabular-nums whitespace-nowrap"
                      style={{ background: s.count > 0 ? s.color : '#94a3b8', minWidth: 28, textAlign: 'center' }}>
                      {s.count}
                    </span>
                  </div>

                  {/* Col 4: Bar — same flex container, fill varies */}
                  <div className="h-6 bg-muted/70 rounded-md overflow-hidden">
                    <div
                      className={`h-full rounded-md transition-all duration-700 bg-gradient-to-r ${s.grad}`}
                      style={{ width: `${barW}%`, minWidth: s.count > 0 ? 6 : 0 }}
                    />
                  </div>

                  {/* Col 5: % */}
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums" style={{ color: s.color }}>{pct}%</div>
                    <div className="text-[9px] text-muted-foreground">{s.isBaseline ? '' : 'of QT'}</div>
                  </div>

                  {/* Col 6: Value — always present */}
                  <div className="text-right">
                    <div className="text-[11px] font-bold tabular-nums leading-tight" style={{ color: s.color }}>{formatMoney(s.value)}</div>
                    <div className="text-[9px] text-muted-foreground">มูลค่า</div>
                  </div>

                  {/* Col 7: Aging — fixed width, always rendered */}
                  <div className="flex items-center justify-center">
                    {s.avgH != null && s.avgH > 0 ? (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${ageBadge}`}>
                        avg {fmtAge(s.avgH)}
                      </span>
                    ) : hasAlert ? (
                      <span className={`w-2 h-2 rounded-full animate-pulse ${lvl === 'crit' ? 'bg-red-500' : 'bg-amber-400'}`} />
                    ) : <span />}
                  </div>

                  {/* Col 8: Chevron */}
                  <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                </div>

                {/* ── Bottleneck alert (open only) ── */}
                {isOpen && hasAlert && (
                  <div className={`mx-3 mb-2 flex items-center gap-2 p-2 rounded-lg text-xs ${
                    lvl === 'crit'
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                      : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                  }`}>
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      <span className="font-semibold">{lvl === 'crit' ? 'Bottleneck วิกฤต' : 'Bottleneck เตือน'}:</span>
                      {' '}งานเฉลี่ยค้างอยู่ <span className="font-semibold">{fmtAge(s.avgH)}</span>
                      {s.value > 0 && <> · มูลค่า <span className="font-semibold">{formatMoney(s.value)}</span> ติดอยู่ที่ stage นี้</>}
                    </span>
                  </div>
                )}

                {/* ── Drilldown ── */}
                {isOpen && (
                  <div className="mx-3 mb-3">
                    {s.isBaseline ? (
                      <Link href="/quotations" onClick={(e) => e.stopPropagation()}
                        className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-400 hover:bg-blue-100 transition-colors">
                        <ArrowRight className="h-3.5 w-3.5" />
                        ดู Quotation ทั้งหมด ({data.totals.quotations} ใบ)
                      </Link>
                    ) : s.top.length === 0 ? (
                      <p className="text-center py-3 text-xs text-muted-foreground">ไม่มีรายการใน stage นี้</p>
                    ) : (
                      <>
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold mb-1.5 px-1">Top รายการ (by มูลค่า)</div>
                        <div className="space-y-1">
                          {(s.top as any[]).map((item) => {
                            const docNo = (item.quotationNo ?? item.saleOrderNo) as string;
                            const rawDate = s.dateKey ? (item[s.dateKey] as string | null | undefined) : null;
                            const ageHrs = rawDate ? (Date.now() - new Date(rawDate).getTime()) / (1000 * 60 * 60) : null;
                            const href = item.quotationNo ? `/quotations/${item.id}` : `/sale-orders/${item.id}`;
                            return (
                              <Link key={item.id} href={href} onClick={(e) => e.stopPropagation()}
                                className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/60 hover:border-foreground/20 transition-colors gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-semibold">{docNo}</div>
                                  <div className="text-[10px] text-muted-foreground truncate">{item.customerCompany}</div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-xs font-bold">{formatMoney(item.grandTotal)}</div>
                                  {ageHrs !== null && ageHrs > 0 && (
                                    <div className={`text-[10px] ${ageHrs >= s.critH && s.critH > 0 ? 'text-red-500' : ageHrs >= s.warnH && s.warnH > 0 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                                      {fmtAge(ageHrs)}
                                    </div>
                                  )}
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </button>
          </div>
        );
      })}

      <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
        <span>QT → SO Conversion Rate</span>
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
// TREND OVERVIEW CARD — tabbed count + revenue in one card
// ════════════════════════════════════════════════════════════════════════════
function TrendOverviewCard({
  trendData,
  revenueTrendData,
}: {
  trendData: Array<{ month: string; approved: number; rejected: number }>;
  revenueTrendData: Array<{ month: string; value: number }>;
}) {
  const [tab, setTab] = useState<'count' | 'value'>('count');
  const totalApproved = trendData.reduce((s, d) => s + d.approved, 0);
  const totalRejected = trendData.reduce((s, d) => s + d.rejected, 0);
  const totalRevenue = revenueTrendData.reduce((s, d) => s + d.value, 0);
  const winRate = totalApproved + totalRejected > 0
    ? Math.round((totalApproved / (totalApproved + totalRejected)) * 100) : 0;

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-emerald-500" />
        <span className="text-sm font-semibold text-foreground">Trend — 6 เดือนล่าสุด</span>
        <div className="ml-auto flex bg-muted rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setTab('count')}
            className={`px-3 py-1 text-xs rounded-md transition-all ${tab === 'count' ? 'bg-background shadow text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
          >
            จำนวน QT
          </button>
          <button
            onClick={() => setTab('value')}
            className={`px-3 py-1 text-xs rounded-md transition-all ${tab === 'value' ? 'bg-background shadow text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
          >
            มูลค่า
          </button>
        </div>
      </div>

      {tab === 'count' ? (
        <div className="flex gap-4 mb-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-0.5 bg-emerald-500 rounded" />Approved
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-dashed border-red-500" />Rejected
          </span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mb-3">มูลค่าที่อนุมัติแล้วรายเดือน</p>
      )}

      {tab === 'count'
        ? (trendData.length > 0
            ? <TrendChart data={trendData} />
            : <div className="flex items-center justify-center h-44 text-muted-foreground text-xs">ยังไม่มีข้อมูล</div>)
        : (revenueTrendData.length > 0
            ? <RevenueAreaChart data={revenueTrendData} />
            : <div className="flex items-center justify-center h-40 text-muted-foreground text-xs">ยังไม่มีข้อมูล</div>)
      }

      <div className="mt-3 pt-3 border-t border-border/50">
        {tab === 'count' ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-base font-bold text-emerald-500 tabular-nums">{totalApproved}</div>
              <div className="text-[10px] text-muted-foreground">อนุมัติแล้ว</div>
            </div>
            <div>
              <div className="text-base font-bold text-red-500 tabular-nums">{totalRejected}</div>
              <div className="text-[10px] text-muted-foreground">ปฏิเสธ</div>
            </div>
            <div>
              <div className="text-base font-bold tabular-nums">{winRate}%</div>
              <div className="text-[10px] text-muted-foreground">Win Rate</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-base font-bold text-emerald-500 tabular-nums">{formatMoney(totalRevenue)}</div>
              <div className="text-[10px] text-muted-foreground">รายได้รวม 6 เดือน</div>
            </div>
            <div className="text-right">
              <div className="text-base font-bold tabular-nums">{formatMoney(revenueTrendData.length > 0 ? Math.round(totalRevenue / revenueTrendData.length) : 0)}</div>
              <div className="text-[10px] text-muted-foreground">เฉลี่ย/เดือน</div>
            </div>
          </div>
        )}
      </div>
    </>
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

// ════════════════════════════════════════════════════════════════════════════
// REJECTION DONUT CHART CARD
// ════════════════════════════════════════════════════════════════════════════
const DONUT_COLORS = ['#ef4444', '#f97316', '#a855f7', '#3b82f6', '#10b981', '#eab308', '#ec4899'];

function polarXY(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutArc(cx: number, cy: number, outerR: number, innerR: number, start: number, end: number) {
  const o1 = polarXY(cx, cy, outerR, start);
  const o2 = polarXY(cx, cy, outerR, end);
  const i1 = polarXY(cx, cy, innerR, start);
  const i2 = polarXY(cx, cy, innerR, end);
  const lg = end - start > 180 ? 1 : 0;
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${outerR} ${outerR} 0 ${lg} 1 ${o2.x} ${o2.y}`,
    `L ${i2.x} ${i2.y}`,
    `A ${innerR} ${innerR} 0 ${lg} 0 ${i1.x} ${i1.y}`,
    'Z',
  ].join(' ');
}

function RejectionDonutCard({ reasons }: { reasons: Array<{ reason: string; count: number }> }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (reasons.length === 0) {
    return (
      <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
        <div className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
          <XCircle className="h-4 w-4 text-red-500" />
          Top Rejection Reasons
        </div>
        <div className="text-center py-10 text-muted-foreground">
          <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-muted/40 flex items-center justify-center">
            <XCircle className="h-8 w-8 opacity-20" />
          </div>
          <p className="text-sm">ยังไม่มีข้อมูล rejection</p>
        </div>
      </div>
    );
  }

  const total = reasons.reduce((s, r) => s + r.count, 0);
  const CX = 80; const CY = 80; const OR = 70; const IR = 44;
  const GAP = 1.5;

  let angle = 0;
  const slices = reasons.map((r, i) => {
    const sweep = (r.count / total) * 360;
    const start = angle + GAP / 2;
    const end = angle + sweep - GAP / 2;
    angle += sweep;
    return { ...r, start, end, pct: Math.round((r.count / total) * 100), color: DONUT_COLORS[i % DONUT_COLORS.length] };
  });

  const active = hovered !== null ? slices[hovered] : null;

  return (
    <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <XCircle className="h-4 w-4 text-red-500" />
          Top Rejection Reasons
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {total} ครั้งทั้งหมด
        </span>
      </div>

      <div className="flex items-center gap-5">
        {/* Donut SVG */}
        <div className="relative shrink-0" style={{ width: 160, height: 160 }}>
          <svg viewBox="0 0 160 160" width={160} height={160}>
            {slices.map((s, i) => {
              const isHov = hovered === i;
              const scale = isHov ? 1.04 : 1;
              return (
                <path
                  key={s.reason}
                  d={donutArc(CX, CY, OR * scale, IR * (1 / scale), s.start, s.end)}
                  fill={s.color}
                  opacity={hovered !== null && !isHov ? 0.35 : 1}
                  style={{ cursor: 'pointer', transition: 'opacity 0.2s, transform 0.15s' }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })}
          </svg>
          {/* Centre label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            {active ? (
              <>
                <div className="text-xl font-bold leading-none tabular-nums" style={{ color: active.color }}>
                  {active.pct}%
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{active.count} ครั้ง</div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold leading-none tabular-nums">{total}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">ครั้ง</div>
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {slices.map((s, i) => (
            <div
              key={s.reason}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-default transition-colors"
              style={{ background: hovered === i ? `${s.color}18` : undefined }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="flex-1 min-w-0 text-[11px] leading-tight text-foreground truncate">
                {s.reason}
              </span>
              <div className="shrink-0 text-right">
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: s.color }}>
                  {s.pct}%
                </span>
                <span className="text-[10px] text-muted-foreground ml-1.5 tabular-nums">
                  {s.count} ครั้ง
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
