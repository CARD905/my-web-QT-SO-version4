'use client';
/* ═══════════════════════════════════════════════════════════════════════════
   CEO EXECUTIVE COMMAND CENTER — Enterprise Decision Platform v3
   All 8 spec sections · Profitability · Sales Performance · Risk · Pipeline
═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Crown, TrendingUp, TrendingDown, Clock, CheckCircle2, DollarSign,
  Users as UsersIcon, AlertTriangle, Flame, RefreshCw, Activity,
  Target, Zap, Percent, Timer, Bell, ChevronRight, Minus,
  Building2, BarChart3, Eye, Shield, XCircle, Check, X,
  Loader2, FileText, ShoppingCart, ArrowUpRight,
  Award, Briefcase, BookOpen,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import type { ApiResponse } from '@/types/api';
import ManagerDashboardPage from './manager';
import { CurrencyProvider, useCx } from '@/lib/currency-context';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CeoDashboardData {
  filter: string;
  totals: {
    quotations: number; pending: number; escalated: number;
    approved: number; rejected: number; totalValue: number;
    pendingValue: number; poVerificationPending?: number; soConfirmed?: number;
    conversionRate?: number;
  };
  todayActivity: { approved: number; rejected: number };
  monthActivity?: { approved: number; rejected: number };
  topOfficers: Array<{
    userId: string; userName: string; userEmail: string;
    count: number; value: number; winRate?: number; avgDealSize?: number;
  }>;
  recentEscalated: Array<{
    id: string; quotationNo: string; grandTotal: number;
    customerCompany: string; createdByName: string; submittedAt: string;
  }>;
  revenueTrend?: Array<{ month: string; value: number }>;
  trendData?: Array<{ month: string; approved: number; rejected: number }>;
  expiringQuotations?: Array<{
    id: string; quotationNo: string; customerCompany: string;
    grandTotal: number; expiryDate: string;
  }>;
  customerInsights?: Array<{
    customerId: string; customerCompany: string; qtCount: number; totalValue: number;
  }>;
  agingBuckets?: {
    lt1d: { count: number; value: number };
    d1to3: { count: number; value: number };
    d3to7: { count: number; value: number };
    gt7d: { count: number; value: number };
  };
  forecast?: {
    nextMonthForecast: number; pipelineCoverage: number; avgMonthlyRevenue: number;
  };
  marginAnalysis?: {
    totalDiscountGiven: number; avgDiscountRate: number;
    approvedCount: number;
    totalApprovedSubtotal: number;
  };
  avgApprovalHours?: number | null;
  soExecution?: {
    statusBreakdown?: Array<{ status: string; count: number; value: number }>;
    overdueCount: number; totalSos: number;
    completedCount: number; completedValue: number;
  };
  pipelineDetail?: {
    approvedOnlyValue: number; poPendingValue: number; soConfirmedValue: number;
    stage1AvgHours: number | null; stage2AvgHours: number | null; stage3AvgHours: number | null;
    stage1Top: unknown[]; stage2Top: unknown[]; stage3Top: unknown[]; stage4Top: unknown[];
  };
  rejectionReasons?: Array<{ reason: string; count: number }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function waitHours(submittedAt: string): number {
  return (Date.now() - new Date(submittedAt).getTime()) / 3_600_000;
}
function waitLabel(submittedAt: string): string {
  const h = waitHours(submittedAt);
  if (h < 1) return '< 1h';
  if (h < 24) return `${Math.round(h)}h`;
  const d = Math.floor(h / 24); const r = Math.round(h % 24);
  return `${d}d ${r}h`;
}
function pct(n: number, digits = 1): string { return `${n.toFixed(digits)}%`; }

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({
  icon, title, subtitle, badge, action,
}: {
  icon: React.ReactNode; title: string; subtitle?: string;
  badge?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1.5 rounded-lg bg-muted/60 shrink-0">{icon}</div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-foreground">{title}</div>
          {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
        {badge}
      </div>
      {action}
    </div>
  );
}

// ─── Mini Sparkline ───────────────────────────────────────────────────────────
function Sparkline({ values, color = '#10b981' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values); const min = Math.min(...values); const range = max - min || 1;
  const W = 52; const H = 22;
  const pts = values.map((v, i) =>
    `${(i / (values.length - 1)) * W},${H - 2 - ((v - min) / range) * (H - 4)}`
  ).join(' ');
  return (
    <svg width={W} height={H} className="shrink-0 opacity-75">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Win Rate Bar Chart ───────────────────────────────────────────────────────
function WinRateBarSVG({ data }: { data: Array<{ month: string; approved: number; rejected: number }> }) {
  const W = 320; const H = 72;
  const n = Math.max(data.length, 1);
  const barW = Math.max(8, (W - 4 * (n - 1)) / n);
  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" style={{ height: H + 20 }}>
      {/* baseline */}
      <line x1={0} y1={H} x2={W} y2={H} stroke="currentColor" strokeOpacity={0.07} strokeWidth={1} />
      {data.map((d, i) => {
        const total = d.approved + d.rejected;
        const rate = total > 0 ? d.approved / total : 0;
        const barH = Math.max(rate * H, total > 0 ? 3 : 0);
        const x = i * (barW + 4);
        const color = rate >= 0.6 ? '#10b981' : rate >= 0.4 ? '#f59e0b' : '#ef4444';
        const winPct = Math.round(rate * 100);
        return (
          <g key={i}>
            <rect x={x} y={H - barH} width={barW} height={barH} fill={color} opacity={0.82} rx={2}>
              <title>{d.month}: {winPct}% win ({d.approved}/{total})</title>
            </rect>
            {barH > 16 && (
              <text x={x + barW / 2} y={H - barH + 11} textAnchor="middle" fontSize={9} fill="white" fontWeight="600">
                {winPct}
              </text>
            )}
            <text x={x + barW / 2} y={H + 13} textAnchor="middle" fontSize={8.5} fill="currentColor" fillOpacity={0.45}>
              {d.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Revenue Area SVG ─────────────────────────────────────────────────────────
function RevenueAreaSVG({ data }: { data: Array<{ month: string; value: number }> }) {
  const currency = useCx();
  const W = 500; const H = 160; const PL = 54; const PR = 12; const PT = 8; const PB = 28;
  const cW = W - PL - PR; const cH = H - PT - PB;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const xi = (i: number) => PL + (i / Math.max(data.length - 1, 1)) * cW;
  const yv = (v: number) => PT + cH - (v / maxVal) * cH;
  const pts = data.map((d, i) => ({ x: xi(i), y: yv(d.value) }));

  let pathD = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i - 1].x + pts[i].x) / 2;
    pathD += ` C ${cx} ${pts[i - 1].y} ${cx} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
  }
  const areaD = `${pathD} L ${pts[pts.length - 1].x} ${PT + cH} L ${pts[0].x} ${PT + cH} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      <defs>
        <linearGradient id="ceoAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((t) => {
        const gy = PT + cH * (1 - t);
        const val = maxVal * t;
        return (
          <g key={t}>
            <line x1={PL} y1={gy} x2={W - PR} y2={gy} stroke="currentColor" strokeOpacity={0.06} strokeWidth={1} />
            <text x={PL - 5} y={gy + 3.5} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.4}>
              {val >= 1_000_000 ? `${(val / 1_000_000).toFixed(1)}M` : val >= 1_000 ? `${(val / 1_000).toFixed(0)}K` : `${Math.round(val)}`}
            </text>
          </g>
        );
      })}
      <path d={areaD} fill="url(#ceoAreaGrad)" />
      <path d={pathD} fill="none" stroke="#10b981" strokeWidth={2.2} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#10b981" stroke="white" strokeWidth={1.2}>
          <title>{data[i].month}: {currency.fmt(data[i].value)}</title>
        </circle>
      ))}
      {data.map((d, i) => (
        <text key={i} x={xi(i)} y={H - 5} textAnchor="middle" fontSize={9.5} fill="currentColor" fillOpacity={0.45}>
          {d.month}
        </text>
      ))}
    </svg>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function ExecKpiCard({
  icon, label, value, sublabel, trend, trendUp, sparkValues, sparkColor,
  alertLevel, href,
}: {
  icon: React.ReactNode; label: string; value: string | number;
  sublabel?: string; trend?: string; trendUp?: boolean | null;
  sparkValues?: number[]; sparkColor?: string;
  alertLevel?: 'critical' | 'warning' | null; href?: string;
}) {
  const ringCls =
    alertLevel === 'critical' ? 'ring-2 ring-red-500/40 shadow-red-500/10'
    : alertLevel === 'warning' ? 'ring-2 ring-amber-400/40 shadow-amber-400/10'
    : '';
  const inner = (
    <div className={`relative bg-card border border-border/50 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 hover-lift ${ringCls} ${href ? 'cursor-pointer hover:border-primary/30' : ''} overflow-hidden`}>
      {alertLevel && <div className={`absolute inset-0 pointer-events-none ${alertLevel === 'critical' ? 'bg-red-500/[0.03]' : 'bg-amber-400/[0.03]'}`} />}
      <div className="relative">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="p-2 rounded-xl bg-muted/70">{icon}</div>
          {alertLevel && <span className={`h-2 w-2 rounded-full mt-1 animate-pulse shrink-0 ${alertLevel === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`} />}
        </div>
        <div className="flex items-end justify-between gap-1">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-muted-foreground mb-0.5 font-medium uppercase tracking-[0.08em] truncate">{label}</div>
            <div className={`text-2xl font-bold leading-none ${alertLevel === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>{value}</div>
            {sublabel && <div className={`text-[11px] mt-1 truncate ${alertLevel === 'critical' ? 'text-red-500/70' : 'text-muted-foreground'}`}>{sublabel}</div>}
            {trend && (
              <div className={`flex items-center gap-1 mt-1.5 text-[11px] font-medium ${trendUp === true ? 'text-emerald-600 dark:text-emerald-400' : trendUp === false ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'}`}>
                {trendUp === true ? <TrendingUp className="h-3 w-3" /> : trendUp === false ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {trend}
              </div>
            )}
          </div>
          {sparkValues && <Sparkline values={sparkValues} color={sparkColor ?? '#10b981'} />}
        </div>
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ─── Risk Panel ───────────────────────────────────────────────────────────────
function RiskPanel({ icon, label, dot, border, iconBg, textColor, itemColor, items }: {
  icon: React.ReactNode; label: string; dot: string; border: string;
  iconBg: string; textColor: string; itemColor: string; items: string[];
}) {
  return (
    <div className={`rounded-2xl border p-4 ${border}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg ${iconBg}`}>{icon}</div>
        <div>
          <div className={`text-xs font-bold uppercase tracking-wide ${textColor}`}>{label}</div>
          <div className="text-[10px] text-muted-foreground">{items.length} รายการ</div>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />ไม่มีรายการในระดับนี้
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((r, i) => (
            <li key={i} className={`flex items-start gap-1.5 text-xs ${itemColor}`}>
              <span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${dot} shrink-0`} />{r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — Data Fetching Wrapper + View Switcher
// ═══════════════════════════════════════════════════════════════════════════════
export default function CeoExecutiveDashboard() {
  const cx = useCx();
  const [viewMode, setViewMode] = useState<'executive' | 'team'>('executive');
  const [data, setData] = useState<CeoDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<CeoDashboardData>>('/manager-dashboard/overview?filter=all');
      setData(res.data.data ?? null);
      setLastUpdate(new Date());
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'executive') fetchData();
  }, [viewMode, fetchData]);

  const handleRefresh = async () => {
    setSpinning(true);
    await fetchData();
    setTimeout(() => setSpinning(false), 700);
  };

  const viewSwitcher = (
    <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl w-fit mb-5 shadow-lg border border-white/10">
      <button
        onClick={() => setViewMode('executive')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          viewMode === 'executive'
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Crown className="h-3.5 w-3.5" />
        Executive Dashboard
      </button>
      <button
        onClick={() => setViewMode('team')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          viewMode === 'team'
            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-sm'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <UsersIcon className="h-3.5 w-3.5" />
        ทีม / Sales Dashboard
      </button>
    </div>
  );

  if (viewMode === 'team') {
    return (
      <CurrencyProvider>
        <div>
          {viewSwitcher}
          <ManagerDashboardPage initialFilter="all" />
        </div>
      </CurrencyProvider>
    );
  }

  if (loading && !data) {
    return (
      <CurrencyProvider>
        <div className="space-y-5 max-w-7xl">
          {viewSwitcher}
          <Skeleton className="h-[88px] rounded-2xl" />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-[120px] rounded-2xl" />)}
          </div>
          <Skeleton className="h-[240px] rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-[140px] rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[200px] rounded-2xl" />)}
          </div>
        </div>
      </CurrencyProvider>
    );
  }

  if (!data) {
    return (
      <CurrencyProvider>
        <div className="space-y-5 max-w-7xl">
          {viewSwitcher}
          <div className="flex items-center justify-center h-64 rounded-2xl bg-card border border-border text-muted-foreground text-sm">
            ไม่สามารถโหลดข้อมูลได้ — กรุณาลองใหม่
          </div>
        </div>
      </CurrencyProvider>
    );
  }

  return (
    <CurrencyProvider>
      <div className="space-y-5 max-w-7xl">
        {viewSwitcher}
        <CeoDashboardContent data={data} lastUpdate={lastUpdate} onRefresh={handleRefresh} spinning={spinning} />
      </div>
    </CurrencyProvider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD CONTENT
// ═══════════════════════════════════════════════════════════════════════════════
function CeoDashboardContent({
  data, lastUpdate, onRefresh, spinning,
}: {
  data: CeoDashboardData; lastUpdate: Date; onRefresh: () => void; spinning: boolean;
}) {
  const cx = useCx();
  // ── Approve / Reject state ───────────────────────────────────────────────────
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const handleApprove = async (id: string) => {
    if (confirmId !== id) { setConfirmId(id); setRejectId(null); return; }
    setActionLoading(true);
    try {
      await api.post(`/quotations/${id}/approve`, { comment: '' });
      toast.success('อนุมัติใบเสนอราคาเรียบร้อยแล้ว');
      setConfirmId(null);
      onRefresh();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setActionLoading(false); }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) { toast.error('กรุณาระบุเหตุผล'); return; }
    setActionLoading(true);
    try {
      await api.post(`/quotations/${id}/reject`, { reason: rejectReason });
      toast.success('ปฏิเสธใบเสนอราคาเรียบร้อยแล้ว');
      setRejectId(null); setRejectReason('');
      onRefresh();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setActionLoading(false); }
  };

  // ── Revenue derived metrics ──────────────────────────────────────────────────
  const revTrend = data.revenueTrend ?? [];
  const sparkVals = revTrend.map((m) => m.value);
  const thisMonthRevenue = revTrend.length > 0 ? revTrend[revTrend.length - 1].value : 0;
  const lastMonthRevenue = revTrend.length > 1 ? revTrend[revTrend.length - 2].value : 0;
  const monthGrowth = lastMonthRevenue > 0
    ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : null;
  const quarterRevenue = revTrend.slice(-3).reduce((s, m) => s + m.value, 0);
  const prevQuarterRevenue = revTrend.length >= 6
    ? revTrend.slice(-6, -3).reduce((s, m) => s + m.value, 0) : 0;
  const quarterGrowth = prevQuarterRevenue > 0
    ? Math.round(((quarterRevenue - prevQuarterRevenue) / prevQuarterRevenue) * 100) : null;
  const prevRev = sparkVals[sparkVals.length - 2] ?? 0;
  const currRev = sparkVals[sparkVals.length - 1] ?? 0;
  const revGrowth = prevRev > 0 ? Math.round(((currRev - prevRev) / prevRev) * 100) : null;

  // ── Win rate from trendData ──────────────────────────────────────────────────
  const trendMonths = data.trendData ?? [];
  const totalTrendApproved = trendMonths.reduce((s, m) => s + m.approved, 0) || data.totals.approved;
  const totalTrendRejected = trendMonths.reduce((s, m) => s + m.rejected, 0) || data.totals.rejected;
  const winRate = (totalTrendApproved + totalTrendRejected) > 0
    ? Math.round((totalTrendApproved / (totalTrendApproved + totalTrendRejected)) * 100) : 0;
  const thisMonthWin = trendMonths.length > 0 ? trendMonths[trendMonths.length - 1] : null;
  const lastMonthWin = trendMonths.length > 1 ? trendMonths[trendMonths.length - 2] : null;
  const thisWinRate = thisMonthWin && (thisMonthWin.approved + thisMonthWin.rejected) > 0
    ? Math.round((thisMonthWin.approved / (thisMonthWin.approved + thisMonthWin.rejected)) * 100) : null;
  const lastWinRate = lastMonthWin && (lastMonthWin.approved + lastMonthWin.rejected) > 0
    ? Math.round((lastMonthWin.approved / (lastMonthWin.approved + lastMonthWin.rejected)) * 100) : null;
  const winRateDelta = thisWinRate !== null && lastWinRate !== null ? thisWinRate - lastWinRate : null;

  // ── Conversion & general ─────────────────────────────────────────────────────
  const convRate = data.totals.conversionRate ??
    (data.totals.quotations > 0 ? Math.round((data.totals.approved / data.totals.quotations) * 100) : 0);
  const overdueQt = data.agingBuckets?.gt7d.count ?? 0;
  const avgDealSize = data.totals.approved > 0
    ? data.totals.totalValue / data.totals.approved : 0;

  // ── Profitability / Margin derived ───────────────────────────────────────────
  const netRevenue = data.marginAnalysis
    ? data.marginAnalysis.totalApprovedSubtotal - data.marginAnalysis.totalDiscountGiven
    : data.totals.totalValue;
  const priceRetentionRate = data.marginAnalysis
    ? Math.max(0, 100 - data.marginAnalysis.avgDiscountRate) : null;

  // ── Risk panels ──────────────────────────────────────────────────────────────
  const criticals = [
    ...(data.totals.escalated > 0 ? [`${data.totals.escalated} QT Escalated รอ CEO อนุมัติ`] : []),
    ...(overdueQt > 0 ? [`${overdueQt} QT ค้างรอนานเกิน 7 วัน`] : []),
    ...((data.soExecution?.overdueCount ?? 0) > 0 ? [`${data.soExecution!.overdueCount} SO เกินกำหนดส่งมอบ`] : []),
  ];
  const warnings = [
    ...((data.expiringQuotations?.length ?? 0) > 0 ? [`${data.expiringQuotations!.length} QT ใกล้หมดอายุใน 7 วัน`] : []),
    ...((data.totals.poVerificationPending ?? 0) > 0 ? [`${data.totals.poVerificationPending} PO รอตรวจสอบ`] : []),
    ...((data.marginAnalysis?.avgDiscountRate ?? 0) > 20 ? [`Avg Discount ${data.marginAnalysis!.avgDiscountRate.toFixed(1)}% — สูงเกินนโยบาย`] : []),
    ...(winRate < 40 && (totalTrendApproved + totalTrendRejected) > 5 ? [`Win Rate ${winRate}% ต่ำกว่าเป้า (50%)`] : []),
  ];
  const attentions = [
    ...(data.totals.pending > 10 ? [`${data.totals.pending} QT รออนุมัติสะสมในระบบ`] : []),
...(convRate < 40 && data.totals.quotations > 5 ? [`Conversion Rate ${convRate}% ต่ำกว่าเป้า (50%)`] : []),
    // Rejection patterns
    ...((data.rejectionReasons?.length ?? 0) > 0
      ? [`Rejection Pattern: "${data.rejectionReasons![0].reason}" (${data.rejectionReasons![0].count}×)`]
      : []),
  ];
  const hasRisks = criticals.length + warnings.length + attentions.length > 0;
  const highRiskCount = criticals.length + warnings.length;

  // ── Executive summary insights ────────────────────────────────────────────────
  const insights: { icon: React.ReactNode; text: string; cls: string }[] = [];
  if (revGrowth !== null) insights.push({
    icon: revGrowth >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> : <TrendingDown className="h-3.5 w-3.5 text-red-400" />,
    text: `รายได้${revGrowth >= 0 ? 'เพิ่มขึ้น' : 'ลดลง'} ${Math.abs(revGrowth)}% เทียบเดือนก่อน`,
    cls: revGrowth >= 0 ? 'text-emerald-300' : 'text-red-300',
  });
  if (data.totals.escalated > 0) insights.push({
    icon: <Flame className="h-3.5 w-3.5 text-red-400" />,
    text: `${data.totals.escalated} ใบเสนอราคารอการอนุมัติจาก CEO`,
    cls: 'text-red-300',
  });
  if (criticals.length + warnings.length > 0) insights.push({
    icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
    text: `พบความเสี่ยง ${criticals.length} วิกฤต · ${warnings.length} เตือน · ${attentions.length} ติดตาม`,
    cls: 'text-amber-300',
  });
  if (data.forecast?.nextMonthForecast) {
    const vs = data.forecast.avgMonthlyRevenue > 0
      ? Math.round((data.forecast.nextMonthForecast / data.forecast.avgMonthlyRevenue - 1) * 100) : 0;
    insights.push({
      icon: <Target className="h-3.5 w-3.5 text-violet-400" />,
      text: `Forecast เดือนหน้า ${cx.fmt(data.forecast.nextMonthForecast)} (${vs >= 0 ? '+' : ''}${vs}% vs avg)`,
      cls: 'text-violet-300',
    });
  }
  if (quarterRevenue > 0) insights.push({
    icon: <BarChart3 className="h-3.5 w-3.5 text-cyan-400" />,
    text: `Revenue ไตรมาสนี้ ${cx.fmt(quarterRevenue)}${quarterGrowth !== null ? ` (${quarterGrowth >= 0 ? '+' : ''}${quarterGrowth}% QoQ)` : ''}`,
    cls: 'text-cyan-300',
  });
  insights.push({
    icon: <Activity className="h-3.5 w-3.5 text-blue-400" />,
    text: `Win Rate ${winRate}% · Conversion ${convRate}% · QT ทั้งหมด ${data.totals.quotations} ใบ`,
    cls: 'text-blue-300',
  });

  // ── Activity feed ────────────────────────────────────────────────────────────
  const activities: Array<{ icon: React.ReactNode; text: string; time: string; color: string }> = [
    ...(data.todayActivity.approved > 0 ? [{
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
      text: `อนุมัติ ${data.todayActivity.approved} ใบเสนอราคาวันนี้`,
      time: 'วันนี้', color: 'text-emerald-600 dark:text-emerald-400',
    }] : []),
    ...(data.todayActivity.rejected > 0 ? [{
      icon: <XCircle className="h-3.5 w-3.5 text-red-500" />,
      text: `ปฏิเสธ ${data.todayActivity.rejected} ใบเสนอราคาวันนี้`,
      time: 'วันนี้', color: 'text-red-600 dark:text-red-400',
    }] : []),
    ...(data.totals.escalated > 0 ? [{
      icon: <Flame className="h-3.5 w-3.5 text-red-500" />,
      text: `${data.totals.escalated} ใบเสนอราคา Escalated รอ CEO`,
      time: 'ปัจจุบัน', color: 'text-red-600 dark:text-red-400',
    }] : []),
    ...((data.totals.poVerificationPending ?? 0) > 0 ? [{
      icon: <FileText className="h-3.5 w-3.5 text-cyan-500" />,
      text: `${data.totals.poVerificationPending} PO ถูกอัปโหลด รอตรวจสอบ`,
      time: 'ปัจจุบัน', color: 'text-cyan-600 dark:text-cyan-400',
    }] : []),
    ...((data.totals.soConfirmed ?? 0) > 0 ? [{
      icon: <ShoppingCart className="h-3.5 w-3.5 text-teal-500" />,
      text: `SO ยืนยันแล้ว ${data.totals.soConfirmed} รายการ`,
      time: 'รวม', color: 'text-teal-600 dark:text-teal-400',
    }] : []),
    ...((data.monthActivity?.approved ?? 0) > 0 ? [{
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
      text: `อนุมัติ ${data.monthActivity!.approved} ใบ เดือนนี้`,
      time: 'เดือนนี้', color: 'text-muted-foreground',
    }] : []),
  ];

  return (
    <div className="space-y-5 max-w-7xl pb-12">

      {/* ══ SECTION 1 · COMMAND HEADER ═════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 shadow-xl px-6 py-5">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/8 via-transparent to-purple-500/8 pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-amber-400/5 pointer-events-none" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="p-2 rounded-xl bg-amber-400/15 border border-amber-400/20">
                <Crown className="h-5 w-5 text-amber-400" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">CEO Command Center</h1>
              <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-amber-400/15 border border-amber-400/25 rounded-full text-amber-300">
                EXECUTIVE
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Company-wide · อัปเดต{' '}
              <span className="text-slate-200 font-medium">
                {lastUpdate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-5 text-[11px]">
              {[
                { dot: 'bg-emerald-400', label: 'QT', val: data.totals.quotations, cls: 'text-white' },
                { dot: 'bg-amber-400', label: 'รออนุมัติ', val: data.totals.pending, cls: 'text-white' },
                ...(data.totals.escalated > 0 ? [{ dot: 'bg-red-500', label: 'Escalated', val: data.totals.escalated, cls: 'text-red-400' }] : []),
                { dot: 'bg-blue-400', label: 'Win Rate', val: `${winRate}%`, cls: 'text-white' },
                { dot: 'bg-violet-400', label: 'Conv', val: `${convRate}%`, cls: 'text-white' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot} animate-pulse`} />
                  <span className="text-slate-400">{s.label} <span className={`font-bold ${s.cls}`}>{s.val}</span></span>
                </div>
              ))}
            </div>
            <button onClick={onRefresh} className="h-9 w-9 flex items-center justify-center rounded-lg border border-white/15 bg-white/8 text-white hover:bg-white/15 transition-colors" title="Refresh">
              <RefreshCw className={`h-4 w-4 ${spinning ? 'animate-spin' : ''}`} />
            </button>
            <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-xs h-9 shadow-lg shadow-amber-500/20">
              <Link href="/approval-queue">
                <Shield className="h-3.5 w-3.5 mr-1.5" />
                Approval Center
                {data.totals.escalated > 0 && (
                  <span className="ml-1.5 h-4 min-w-[16px] px-1 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center">
                    {data.totals.escalated}
                  </span>
                )}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ══ SECTION 2 · EXECUTIVE KPI SUMMARY — 8 cards ════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 animate-stagger-fast">
        {/* 1. Total Revenue */}
        <ExecKpiCard
          icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
          label="Total Revenue"
          value={cx.fmt(data.totals.totalValue)}
          sublabel={`${data.totals.approved} QT Approved`}
          trend={revGrowth !== null ? `${revGrowth >= 0 ? '+' : ''}${revGrowth}% MoM` : undefined}
          trendUp={revGrowth !== null ? revGrowth >= 0 : null}
          sparkValues={sparkVals.length > 1 ? sparkVals : undefined}
          sparkColor="#10b981"
        />
        {/* 2. Revenue This Month */}
        <ExecKpiCard
          icon={<BarChart3 className="h-4 w-4 text-teal-600" />}
          label="Revenue / Month"
          value={cx.fmt(thisMonthRevenue)}
          sublabel={revTrend.length > 0 ? revTrend[revTrend.length - 1].month : 'เดือนนี้'}
          trend={monthGrowth !== null ? `${monthGrowth >= 0 ? '+' : ''}${monthGrowth}% MoM` : undefined}
          trendUp={monthGrowth !== null ? monthGrowth >= 0 : null}
        />
        {/* 3. CEO Actions */}
        <ExecKpiCard
          icon={<Flame className="h-4 w-4 text-red-600" />}
          label="CEO Actions"
          value={data.totals.escalated}
          sublabel={data.totals.escalated > 0 ? 'Escalated รอ CEO' : 'ไม่มีรายการด่วน'}
          alertLevel={data.totals.escalated > 0 ? 'critical' : null}
          href="/approval-queue"
        />
        {/* 4. Win Rate */}
        <ExecKpiCard
          icon={<Award className="h-4 w-4 text-violet-600" />}
          label="Win Rate"
          value={`${winRate}%`}
          sublabel={`${totalTrendApproved} win / ${totalTrendRejected} lose`}
          trend={winRateDelta !== null ? `${winRateDelta >= 0 ? '+' : ''}${winRateDelta}% this month` : undefined}
          trendUp={winRateDelta !== null ? winRateDelta >= 0 : null}
        />
        {/* 5. Conversion Rate */}
        <ExecKpiCard
          icon={<Activity className="h-4 w-4 text-blue-600" />}
          label="Conversion Rate"
          value={`${convRate}%`}
          sublabel="QT → SO Confirmed"
          trend={convRate >= 50 ? 'On target' : 'Below target'}
          trendUp={convRate >= 50 ? true : convRate >= 30 ? null : false}
        />
        {/* 6. Price Retention / Avg Margin Proxy */}
        <ExecKpiCard
          icon={<Percent className="h-4 w-4 text-amber-600" />}
          label="Price Retention"
          value={priceRetentionRate !== null ? pct(priceRetentionRate) : 'N/A'}
          sublabel={data.marginAnalysis ? `Avg discount ${data.marginAnalysis.avgDiscountRate.toFixed(1)}%` : 'After discount'}
          alertLevel={(data.marginAnalysis?.avgDiscountRate ?? 0) > 20 ? 'warning' : null}
        />
        {/* 7. Forecast */}
        <ExecKpiCard
          icon={<Target className="h-4 w-4 text-violet-600" />}
          label="Forecast"
          value={cx.fmt(data.forecast?.nextMonthForecast ?? 0)}
          sublabel="เดือนหน้า"
          trend={data.forecast ? `Avg ${cx.fmt(data.forecast.avgMonthlyRevenue)}/mo` : undefined}
          trendUp={null}
        />
        {/* 8. High-Risk Deals */}
        <ExecKpiCard
          icon={<AlertTriangle className="h-4 w-4 text-rose-600" />}
          label="High-Risk Items"
          value={highRiskCount}
          sublabel={highRiskCount > 0 ? `${criticals.length} critical, ${warnings.length} warning` : 'ทุกอย่างปกติ'}
          alertLevel={criticals.length > 0 ? 'critical' : warnings.length > 0 ? 'warning' : null}
        />
      </div>

      {/* ══ MONTHLY PULSE ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Revenue this month */}
        <div className="rounded-2xl p-4 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-200/50 dark:border-emerald-800/30 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/15">
              <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Revenue เดือนนี้</span>
          </div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums leading-tight">
            {cx.fmt(thisMonthRevenue)}
          </div>
          {monthGrowth !== null ? (
            <div className={`mt-1.5 flex items-center gap-1 text-[11px] font-medium ${monthGrowth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {monthGrowth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {monthGrowth >= 0 ? '+' : ''}{monthGrowth}% vs เดือนก่อน
            </div>
          ) : (
            <div className="mt-1.5 text-[11px] text-muted-foreground">เดือนแรก</div>
          )}
        </div>

        {/* QTs approved this month */}
        <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-200/50 dark:border-blue-800/30 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-500/15">
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">อนุมัติเดือนนี้</span>
          </div>
          <div className="text-xl font-bold text-blue-700 dark:text-blue-300 tabular-nums leading-tight">
            {data.monthActivity?.approved ?? 0} QT
          </div>
          <div className="mt-1.5 text-[11px] text-muted-foreground">
            วันนี้: <span className="font-bold text-blue-600 dark:text-blue-400">{data.todayActivity.approved}</span>
            {' '}· ปฏิเสธ: <span className="font-bold text-red-500">{data.todayActivity.rejected}</span>
          </div>
        </div>

        {/* Rejection this month */}
        <div className="rounded-2xl p-4 bg-gradient-to-br from-rose-500/10 to-red-500/5 border border-rose-200/50 dark:border-rose-800/30 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-rose-500/15">
              <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            </div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">ปฏิเสธเดือนนี้</span>
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 tabular-nums leading-tight">
            {data.monthActivity?.rejected ?? 0} QT
          </div>
          {(() => {
            const m = data.monthActivity ?? { approved: 0, rejected: 0 };
            const total = m.approved + m.rejected;
            const rate = total > 0 ? Math.round((m.rejected / total) * 100) : 0;
            return (
              <div className={`mt-1.5 text-[11px] font-medium ${rate > 30 ? 'text-red-600' : rate > 15 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                Rejection Rate {rate}%
              </div>
            );
          })()}
        </div>

        {/* Approval speed */}
        <div className="rounded-2xl p-4 bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-200/50 dark:border-violet-800/30 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-violet-500/15">
              <Timer className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Approval Speed</span>
          </div>
          <div className="text-xl font-bold text-violet-700 dark:text-violet-300 tabular-nums leading-tight">
            {data.avgApprovalHours != null ? `${data.avgApprovalHours}h` : '—'}
          </div>
          <div className={`mt-1.5 text-[11px] font-medium ${
            data.avgApprovalHours == null ? 'text-muted-foreground'
            : data.avgApprovalHours < 24 ? 'text-emerald-600 dark:text-emerald-400'
            : data.avgApprovalHours < 48 ? 'text-amber-600 dark:text-amber-400'
            : 'text-red-500'
          }`}>
            {data.avgApprovalHours == null ? 'ยังไม่มีข้อมูล'
              : data.avgApprovalHours < 24 ? '✓ เร็ว (< 1 วัน)'
              : data.avgApprovalHours < 48 ? '~ ปานกลาง (1–2 วัน)'
              : '⚠ ช้า (> 2 วัน)'}
          </div>
        </div>
      </div>

      {/* ══ SECTION 5 · APPROVAL MONITORING ════════════════════════════════════ */}
      <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-gradient-to-br from-red-50/80 to-rose-50/30 dark:from-red-950/20 dark:to-rose-950/10 overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-red-200/50 dark:border-red-900/30">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-xl bg-red-500/12 border border-red-400/20">
              <Bell className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="font-bold text-sm text-red-700 dark:text-red-300">Executive Action Required</div>
              <div className="text-[11px] text-red-600/60 dark:text-red-400/60">Approval Monitoring — CEO ต้องอนุมัติหรือปฏิเสธใบเสนอราคาต่อไปนี้</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data.recentEscalated.length > 0 && (
              <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">
                {data.recentEscalated.length}
              </span>
            )}
            <Button asChild size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400">
              <Link href="/approval-queue">ดูทั้งหมด <ArrowUpRight className="h-3 w-3 ml-0.5" /></Link>
            </Button>
          </div>
        </div>

        {/* Escalated Items */}
        {data.recentEscalated.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-5">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">No Executive Actions Required</div>
              <div className="text-xs text-muted-foreground">ไม่มีใบเสนอราคา Escalated รอการอนุมัติขณะนี้</div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-red-100/60 dark:divide-red-900/20">
            {data.recentEscalated.map((q) => {
              const hrs = waitHours(q.submittedAt);
              const isUrgent = hrs > 48;
              const isConfirming = confirmId === q.id;
              const isRejecting = rejectId === q.id;

              return (
                <div key={q.id}>
                  <div className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${isConfirming ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : isRejecting ? 'bg-red-100/40 dark:bg-red-950/20' : 'hover:bg-red-50/30 dark:hover:bg-red-950/10'}`}>
                    <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${isUrgent ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{q.quotationNo}</span>
                        <Badge variant="outline" className="text-[10px] bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">ESCALATED</Badge>
                        {isUrgent && <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-300">OVERDUE</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5 truncate">
                        {q.customerCompany}
                        <span className="mx-1.5 opacity-30">·</span>
                        <span className="text-foreground/70">{q.createdByName}</span>
                        <span className="mx-1.5 opacity-30">·</span>
                        <span className="text-[11px] opacity-50">{formatDate(q.submittedAt)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                      <div className="font-bold text-red-700 dark:text-red-400 text-sm tabular-nums">{cx.fmt(q.grandTotal)}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end mt-0.5">
                        <Timer className="h-3 w-3" />{waitLabel(q.submittedAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link href={`/quotations/${q.id}`} className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/60 hover:border-border text-muted-foreground hover:text-foreground transition-colors" title="ดูรายละเอียด">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        onClick={() => {
                          if (isRejecting) { setRejectId(null); setRejectReason(''); }
                          else { setRejectId(q.id); setConfirmId(null); setRejectReason(''); }
                        }}
                        className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors ${isRejecting ? 'bg-red-600 text-white' : 'border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30'}`}
                        disabled={actionLoading}
                      >
                        <span className="flex items-center gap-1"><X className="h-3 w-3" />Reject</span>
                      </button>
                      <button
                        onClick={() => handleApprove(q.id)}
                        className={`h-8 px-3 rounded-lg text-xs font-bold transition-colors ${isConfirming ? 'bg-emerald-600 text-white ring-2 ring-emerald-400/50' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                        disabled={actionLoading}
                      >
                        {actionLoading && confirmId === q.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <span className="flex items-center gap-1"><Check className="h-3 w-3" />{isConfirming ? 'Confirm?' : 'Approve'}</span>
                        }
                      </button>
                      {isConfirming && (
                        <button onClick={() => setConfirmId(null)} className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {isRejecting && (
                    <div className="px-5 pb-4 bg-red-50/80 dark:bg-red-950/25 border-t border-red-100 dark:border-red-900/30">
                      <div className="pt-3 flex flex-col gap-2">
                        <div className="text-xs font-semibold text-red-700 dark:text-red-300">เหตุผลในการปฏิเสธ (จำเป็น)</div>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="ระบุเหตุผล เช่น ราคาสูงเกินไป, ส่วนลดเกินนโยบาย, ต้องแก้ไขเงื่อนไข..."
                          rows={2}
                          className="w-full rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-red-950/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/40 resize-none placeholder:text-muted-foreground/50"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleReject(q.id)}
                            disabled={actionLoading || !rejectReason.trim()}
                            className="h-8 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                          >
                            {actionLoading && rejectId === q.id
                              ? <><Loader2 className="h-3 w-3 animate-spin" />กำลังส่ง...</>
                              : <><XCircle className="h-3 w-3" />ยืนยันการปฏิเสธ</>}
                          </button>
                          <button
                            onClick={() => { setRejectId(null); setRejectReason(''); }}
                            className="h-8 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ EXPIRING QTs + AGING ═══════════════════════════════════════════════ */}
      {((data.expiringQuotations?.length ?? 0) > 0 || overdueQt > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data.expiringQuotations?.length ?? 0) > 0 && (
            <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
              <SectionHeader
                icon={<Timer className="h-4 w-4 text-rose-500" />}
                title="Expiring Soon (7 วัน)"
                badge={<Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-300">{data.expiringQuotations!.length}</Badge>}
              />
              <div className="space-y-2">
                {data.expiringQuotations!.map((q) => {
                  const days = Math.ceil((new Date(q.expiryDate).getTime() - Date.now()) / 86_400_000);
                  const cls = days < 1 ? 'text-red-600 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800'
                    : days <= 3 ? 'text-amber-700 border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800'
                    : 'text-yellow-700 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800';
                  return (
                    <Link key={q.id} href={`/quotations/${q.id}`}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-opacity hover:opacity-80 gap-3 ${cls}`}>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm">{q.quotationNo}</div>
                        <div className="text-xs opacity-70 truncate">{q.customerCompany}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold">{days < 1 ? 'วันนี้!' : `${days} วัน`}</div>
                        <div className="text-[10px] opacity-65">{cx.fmt(q.grandTotal)}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          {data.agingBuckets && (
            <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
              <SectionHeader
                icon={<Clock className="h-4 w-4 text-orange-500" />}
                title="Quotation Aging"
                subtitle="QT Pending ค้างนานเท่าไหร่"
                badge={overdueQt > 0 ? <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-300">{overdueQt} เกิน 7 วัน</Badge> : undefined}
              />
              {(() => {
                const total = data.agingBuckets!.lt1d.count + data.agingBuckets!.d1to3.count + data.agingBuckets!.d3to7.count + data.agingBuckets!.gt7d.count;
                if (total === 0) return (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />ไม่มี QT ค้างอยู่ในระบบ
                  </div>
                );
                const buckets = [
                  { label: '< 1 วัน', sub: 'Fresh', ...data.agingBuckets!.lt1d, color: '#10b981' },
                  { label: '1–3 วัน', sub: 'Normal', ...data.agingBuckets!.d1to3, color: '#f59e0b' },
                  { label: '3–7 วัน', sub: 'Attention', ...data.agingBuckets!.d3to7, color: '#f97316' },
                  { label: '> 7 วัน', sub: 'Critical', ...data.agingBuckets!.gt7d, color: '#ef4444' },
                ];
                const maxCount = Math.max(...buckets.map((b) => b.count), 1);
                return (
                  <div className="space-y-2.5">
                    {buckets.map((b) => (
                      <div key={b.label} className="flex items-center gap-3">
                        <div className="w-1.5 h-8 rounded-full shrink-0" style={{ background: b.color }} />
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium">{b.label} <span className="text-muted-foreground">— {b.sub}</span></span>
                            <span className="text-muted-foreground tabular-nums">{b.count} QT</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${Math.max(Math.round((b.count / maxCount) * 100), b.count > 0 ? 8 : 0)}%`, background: b.color }} />
                          </div>
                        </div>
                        <div className="text-sm font-bold shrink-0 w-6 text-right" style={{ color: b.color }}>{b.count}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ══ SECTION 3 · PROFITABILITY ANALYTICS ════════════════════════════════ */}
      {data.marginAnalysis && (
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <SectionHeader
            icon={<Percent className="h-4 w-4 text-amber-500" />}
            title="Profitability Analytics"
            subtitle="Margin · Discount Impact · Revenue Quality"
            badge={(data.marginAnalysis.avgDiscountRate > 20)
              ? <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">High Discount Alert</Badge>
              : undefined}
          />

          {/* Metric Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              {
                label: 'Net Revenue (After Discount)',
                value: cx.fmt(netRevenue),
                color: 'text-emerald-600 dark:text-emerald-400',
                bg: 'bg-emerald-50 dark:bg-emerald-900/20',
                sub: `จาก ${cx.fmt(data.marginAnalysis.totalApprovedSubtotal)} list price`,
              },
              {
                label: 'Total Discount Given',
                value: cx.fmt(data.marginAnalysis.totalDiscountGiven),
                color: 'text-rose-600 dark:text-rose-400',
                bg: 'bg-rose-50 dark:bg-rose-900/20',
                sub: `${data.marginAnalysis.approvedCount} QT Approved`,
              },
              {
                label: 'Avg Discount Rate',
                value: pct(data.marginAnalysis.avgDiscountRate),
                color: data.marginAnalysis.avgDiscountRate > 20 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400',
                bg: data.marginAnalysis.avgDiscountRate > 20 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20',
                sub: data.marginAnalysis.avgDiscountRate > 20 ? '⚠ เกินนโยบาย 20%' : 'อยู่ในนโยบาย',
              },
              {
                label: 'Price Retention Rate',
                value: pct(Math.max(0, 100 - data.marginAnalysis.avgDiscountRate)),
                color: 'text-violet-600 dark:text-violet-400',
                bg: 'bg-violet-50 dark:bg-violet-900/20',
                sub: 'Effective pricing rate',
              },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl p-3.5 ${item.bg}`}>
                <div className={`text-lg font-bold tabular-nums ${item.color}`}>{item.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{item.label}</div>
                <div className="text-[10px] opacity-60 mt-0.5">{item.sub}</div>
              </div>
            ))}
          </div>

          {/* Revenue vs Discount Impact Bar */}
          {data.marginAnalysis.totalApprovedSubtotal > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>Revenue Retained vs Discount Given</span>
                <span className={`font-semibold ${data.marginAnalysis.avgDiscountRate > 20 ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {pct(data.marginAnalysis.avgDiscountRate)} discount rate
                </span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-l-full transition-all duration-700 flex items-center justify-end pr-2"
                  style={{ width: `${Math.max(100 - data.marginAnalysis.avgDiscountRate, 0)}%` }}>
                  {(100 - data.marginAnalysis.avgDiscountRate) > 20 && (
                    <span className="text-[9px] text-white font-bold">{pct(100 - data.marginAnalysis.avgDiscountRate, 0)} retained</span>
                  )}
                </div>
                <div className="h-full bg-gradient-to-r from-rose-400 to-red-500 rounded-r-full transition-all duration-700"
                  style={{ width: `${Math.min(data.marginAnalysis.avgDiscountRate, 100)}%` }} />
              </div>
            </div>
          )}

          {/* Rejection Reasons */}
          <div className="rounded-xl p-3.5 bg-muted/30 border border-border/40 mt-2">
              <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5 text-red-500" />
                Rejection Patterns
              </div>
              {data.rejectionReasons && data.rejectionReasons.length > 0 ? (
                <div className="space-y-1.5">
                  {data.rejectionReasons.slice(0, 3).map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground truncate">{r.reason || 'ไม่ระบุเหตุผล'}</span>
                      <span className="text-xs font-bold text-rose-600 shrink-0">{r.count}×</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">ยังไม่มีข้อมูล Rejection Pattern</div>
              )}
            </div>
        </div>
      )}

      {/* ══ SECTION 4 · SALES PERFORMANCE ANALYTICS ════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Win Rate Analysis */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <SectionHeader
            icon={<Award className="h-4 w-4 text-violet-500" />}
            title="Win Rate Analysis"
            subtitle="Monthly win/loss breakdown"
            badge={<Badge variant="outline" className="text-[10px]">{winRate}% overall</Badge>}
          />
          {trendMonths.length > 0 ? (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl p-3 bg-emerald-50 dark:bg-emerald-900/20">
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{winRate}%</div>
                  <div className="text-[10px] text-muted-foreground">Overall Win Rate</div>
                </div>
                <div className="rounded-xl p-3 bg-muted/40">
                  <div className="text-lg font-bold tabular-nums">{totalTrendApproved}</div>
                  <div className="text-[10px] text-muted-foreground">Approved</div>
                </div>
                <div className="rounded-xl p-3 bg-red-50 dark:bg-red-900/20">
                  <div className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">{totalTrendRejected}</div>
                  <div className="text-[10px] text-muted-foreground">Rejected</div>
                </div>
              </div>
              <WinRateBarSVG data={trendMonths} />
              {winRateDelta !== null && (
                <div className={`mt-2 text-xs font-medium flex items-center gap-1 ${winRateDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                  {winRateDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  Win Rate เดือนนี้ {thisWinRate}% ({winRateDelta >= 0 ? '+' : ''}{winRateDelta}% vs เดือนก่อน)
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-36 text-muted-foreground text-xs gap-2">
              <BarChart3 className="h-8 w-8 opacity-20" />ยังไม่มีข้อมูล Win Rate Trend
            </div>
          )}
        </div>

        {/* Deal Performance */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <SectionHeader
            icon={<Briefcase className="h-4 w-4 text-blue-500" />}
            title="Deal Performance"
            subtitle="Top Officers · Deal Metrics"
            badge={<Badge variant="outline" className="text-[10px]">Top {Math.min(data.topOfficers.length, 5)}</Badge>}
          />

          {/* Deal metrics */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="rounded-xl p-3 bg-muted/40">
              <div className="text-sm font-bold tabular-nums">{cx.fmt(avgDealSize)}</div>
              <div className="text-[10px] text-muted-foreground">Avg Deal Size</div>
            </div>
            <div className="rounded-xl p-3 bg-muted/40">
              <div className="text-sm font-bold tabular-nums">{data.totals.quotations}</div>
              <div className="text-[10px] text-muted-foreground">Total Deals</div>
            </div>
          </div>

          {data.topOfficers.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground"><UsersIcon className="h-8 w-8 mx-auto mb-2 opacity-20" /><p className="text-sm">ยังไม่มีข้อมูล</p></div>
          ) : (
            <div className="space-y-0.5">
              <div className="grid grid-cols-[18px_1fr_36px_80px] text-[10px] text-muted-foreground uppercase px-2 pb-1.5 border-b gap-2">
                <span>#</span><span>Officer</span><span className="text-right">Win%</span><span className="text-right">Value</span>
              </div>
              {data.topOfficers.slice(0, 5).map((o, idx) => {
                const maxV = Math.max(...data.topOfficers.slice(0, 5).map((x) => x.value), 1);
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                const wr = o.winRate ?? 0;
                return (
                  <div key={o.userId} className="p-2 rounded-xl hover:bg-accent transition-colors">
                    <div className="grid grid-cols-[18px_1fr_36px_80px] items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-bold text-center text-muted-foreground">{medal ?? (idx + 1)}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{o.userName}</div>
                        <div className="text-[10px] text-muted-foreground">{o.count} QT</div>
                      </div>
                      <div className={`text-xs text-right font-semibold ${wr >= 60 ? 'text-emerald-600 dark:text-emerald-400' : wr >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{wr}%</div>
                      <div className="text-xs font-bold text-right tabular-nums">{cx.fmt(o.value)}</div>
                    </div>
                    <div className="ml-6 h-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-violet-500 to-purple-400"
                        style={{ width: `${Math.round((o.value / maxV) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══ SECTION 6 · RISK & COMPLIANCE MONITORING ═══════════════════════════ */}
      {hasRisks && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-bold text-foreground">Risk & Compliance Monitoring</span>
            <Badge variant="outline" className="text-[10px]">{highRiskCount} รายการสำคัญ</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <RiskPanel icon={<AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />} label="Critical"
              dot="bg-red-500" border={criticals.length > 0 ? 'border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/15' : 'border-border bg-card'}
              iconBg="bg-red-500/10" textColor="text-red-700 dark:text-red-300" itemColor="text-red-700 dark:text-red-400" items={criticals} />
            <RiskPanel icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />} label="Warning"
              dot="bg-amber-400" border={warnings.length > 0 ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/15' : 'border-border bg-card'}
              iconBg="bg-amber-500/10" textColor="text-amber-700 dark:text-amber-300" itemColor="text-amber-700 dark:text-amber-400" items={warnings} />
            <RiskPanel icon={<Eye className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />} label="Attention"
              dot="bg-yellow-400" border={attentions.length > 0 ? 'border-yellow-200 bg-yellow-50/60 dark:border-yellow-900/40 dark:bg-yellow-950/15' : 'border-border bg-card'}
              iconBg="bg-yellow-500/10" textColor="text-yellow-700 dark:text-yellow-300" itemColor="text-yellow-700 dark:text-yellow-400" items={attentions} />
          </div>
        </div>
      )}

      {/* ══ SECTION 2 · REVENUE ANALYTICS + FORECAST ═══════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <SectionHeader
            icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
            title="Revenue Analytics"
            subtitle="Approved Quotation value · 6 เดือน"
            action={
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {quarterRevenue > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-violet-400 shrink-0" />
                    Q: {cx.fmt(quarterRevenue)}
                    {quarterGrowth !== null && <span className={`ml-1 font-semibold ${quarterGrowth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>({quarterGrowth >= 0 ? '+' : ''}{quarterGrowth}%)</span>}
                  </span>
                )}
                <span>6M</span>
              </div>
            }
          />
          {revTrend.length > 0 ? <RevenueAreaSVG data={revTrend} /> : (
            <div className="flex flex-col items-center justify-center h-36 text-muted-foreground text-xs gap-2">
              <BarChart3 className="h-8 w-8 opacity-20" />ยังไม่มีข้อมูล Revenue
            </div>
          )}
        </div>

        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <SectionHeader
            icon={<Target className="h-4 w-4 text-violet-500" />}
            title="Forecast & Pipeline"
          />
          {!data.forecast ? (
            <div className="text-center py-8 text-muted-foreground text-xs">ยังไม่มีข้อมูล</div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl p-4 bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-200/40 dark:border-violet-800/30">
                <div className="text-xs text-muted-foreground mb-0.5">Forecast เดือนหน้า</div>
                <div className="text-2xl font-bold text-violet-700 dark:text-violet-300">{cx.fmt(data.forecast.nextMonthForecast)}</div>
                <div className="text-[11px] text-violet-600/60 mt-0.5">ประมาณการ +5% จากค่าเฉลี่ย</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl p-3 bg-muted/40">
                  <div className="text-[10px] text-muted-foreground">Avg / เดือน</div>
                  <div className="text-sm font-bold mt-0.5 tabular-nums">{cx.fmt(data.forecast.avgMonthlyRevenue)}</div>
                </div>
                <div className="rounded-xl p-3 bg-muted/40">
                  <div className="text-[10px] text-muted-foreground">Pipeline Coverage</div>
                  <div className="text-sm font-bold text-cyan-600 dark:text-cyan-400 mt-0.5 tabular-nums">{cx.fmt(data.forecast.pipelineCoverage)}</div>
                </div>
              </div>
              {quarterRevenue > 0 && (
                <div className="rounded-xl p-3 bg-gradient-to-r from-blue-500/10 to-cyan-500/5 border border-blue-200/40 dark:border-blue-800/30">
                  <div className="text-[10px] text-muted-foreground">Revenue ไตรมาสนี้</div>
                  <div className="text-sm font-bold text-blue-700 dark:text-blue-300 mt-0.5 tabular-nums">{cx.fmt(quarterRevenue)}</div>
                  {quarterGrowth !== null && (
                    <div className={`text-[10px] mt-0.5 ${quarterGrowth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {quarterGrowth >= 0 ? '+' : ''}{quarterGrowth}% vs ไตรมาสก่อน
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ SECTION 7 · PIPELINE + STRATEGIC CUSTOMERS ═════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sales Pipeline */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <SectionHeader
            icon={<BarChart3 className="h-4 w-4 text-blue-500" />}
            title="Sales Pipeline"
            action={<span className="text-xs text-muted-foreground">{data.totals.quotations} QT baseline</span>}
          />
          {(() => {
            const pd = data.pipelineDetail;
            const total = Math.max(data.totals.quotations, 1);
            const pending = (data.totals.pending ?? 0) + (data.totals.escalated ?? 0);
            const stages = [
              { label: 'Pending Approval', count: pending, value: data.totals.pendingValue, color: '#f59e0b', pct: Math.round((pending / total) * 100) },
              { label: 'Approved → Waiting PO', count: data.totals.approved, value: pd?.approvedOnlyValue ?? 0, color: '#06b6d4', pct: Math.round((data.totals.approved / total) * 100) },
              { label: 'PO Received', count: data.totals.poVerificationPending ?? 0, value: pd?.poPendingValue ?? 0, color: '#14b8a6', pct: Math.round(((data.totals.poVerificationPending ?? 0) / total) * 100) },
              { label: 'SO Confirmed', count: data.totals.soConfirmed ?? 0, value: pd?.soConfirmedValue ?? 0, color: '#10b981', pct: Math.round(((data.totals.soConfirmed ?? 0) / total) * 100) },
            ];
            return (
              <div className="space-y-3">
                {stages.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-1.5 h-9 rounded-full shrink-0" style={{ background: s.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium truncate">{s.label}</span>
                        <span className="text-muted-foreground ml-2 shrink-0 tabular-nums">{s.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.max(s.pct, s.count > 0 ? 5 : 0)}%`, background: s.color }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0 w-24">
                      <div className="text-xs font-bold tabular-nums" style={{ color: s.color }}>{s.pct}%</div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">{cx.fmt(s.value)}</div>
                    </div>
                  </div>
                ))}
                <div className="pt-2.5 border-t flex justify-between text-xs text-muted-foreground">
                  <span>Conversion Rate</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{convRate}%</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Strategic Customers */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <SectionHeader
            icon={<Building2 className="h-4 w-4 text-indigo-500" />}
            title="Strategic Customers"
            subtitle="Key accounts · Customer Intelligence"
            badge={<Badge variant="outline" className="text-[10px]">Top {Math.min(data.customerInsights?.length ?? 0, 5)}</Badge>}
          />
          {!data.customerInsights || data.customerInsights.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground"><Building2 className="h-8 w-8 mx-auto mb-2 opacity-20" /><p className="text-sm">ยังไม่มีข้อมูลลูกค้า</p></div>
          ) : (
            <div className="space-y-3">
              {(() => {
                const maxV = Math.max(...data.customerInsights!.map((c) => c.totalValue), 1);
                const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];
                return data.customerInsights!.slice(0, 5).map((c, i) => (
                  <div key={c.customerId}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} />
                        <span className="font-medium truncate">{c.customerCompany}</span>
                        {i === 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">KEY ACCOUNT</span>}
                      </div>
                      <span className="text-muted-foreground ml-3 shrink-0 tabular-nums">{c.qtCount} QT · {cx.fmt(c.totalValue)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.max(Math.round((c.totalValue / maxV) * 100), 5)}%`, background: colors[i % colors.length] }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      </div>

      {/* ══ SO EXECUTION DASHBOARD ═════════════════════════════════════════════ */}
      {data.soExecution && (
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <SectionHeader
            icon={<ShoppingCart className="h-4 w-4 text-teal-500" />}
            title="Sale Order Execution"
            subtitle="ติดตามสถานะ SO ทั้งองค์กร"
            badge={data.soExecution.overdueCount > 0
              ? <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-300 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">⚠ {data.soExecution.overdueCount} Overdue</Badge>
              : undefined}
            action={<span className="text-xs text-muted-foreground">{data.soExecution.totalSos} SO ทั้งหมด</span>}
          />

          {data.soExecution.totalSos === 0 ? (
            <div className="flex items-center gap-3 py-6 text-muted-foreground">
              <ShoppingCart className="h-8 w-8 opacity-20 mx-auto" />
              <p className="text-sm text-center w-full">ยังไม่มี Sale Order ในระบบ</p>
            </div>
          ) : (
            <>
              {/* Status Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {(() => {
                  const sbMap = Object.fromEntries(
                    (data.soExecution.statusBreakdown ?? []).map((s) => [s.status, s])
                  );
                  return [
                    { key: 'PENDING_REVIEW', label: 'รออนุมัติ',   colorVal: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/20',   border: 'border-amber-200 dark:border-amber-800/30',   textCls: 'text-amber-700 dark:text-amber-300' },
                    { key: 'CONFIRMED',      label: 'ยืนยันแล้ว',  colorVal: '#14b8a6', bg: 'bg-teal-50 dark:bg-teal-900/20',     border: 'border-teal-200 dark:border-teal-800/30',     textCls: 'text-teal-700 dark:text-teal-300' },
                    { key: 'COMPLETED',      label: 'ส่งมอบแล้ว',  colorVal: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800/30', textCls: 'text-emerald-700 dark:text-emerald-300' },
                    { key: 'REJECTED',       label: 'ถูกยกเลิก',   colorVal: '#ef4444', bg: 'bg-red-50 dark:bg-red-900/20',       border: 'border-red-200 dark:border-red-800/30',       textCls: 'text-red-700 dark:text-red-300' },
                  ].map(({ key, label, colorVal, bg, border, textCls }) => {
                    const s = sbMap[key];
                    const count = s?.count ?? 0;
                    const value = s?.value ?? 0;
                    return (
                      <div key={key} className={`rounded-xl p-3.5 ${bg} border ${border}`}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: colorVal }} />
                          <span className={`text-[11px] font-semibold ${textCls}`}>{label}</span>
                        </div>
                        <div className={`text-2xl font-bold tabular-nums ${textCls}`}>{count}</div>
                        {value > 0 && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{cx.fmt(value)}</div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Completion progress bar */}
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-foreground">SO Completion Rate</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {Math.round((data.soExecution.completedCount / Math.max(data.soExecution.totalSos, 1)) * 100)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700"
                    style={{ width: `${Math.max(Math.round((data.soExecution.completedCount / Math.max(data.soExecution.totalSos, 1)) * 100), data.soExecution.completedCount > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                  <span>ส่งมอบแล้ว: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{cx.fmt(data.soExecution.completedValue)}</span></span>
                  <span>{data.soExecution.completedCount} / {data.soExecution.totalSos} SO</span>
                </div>
              </div>

              {/* Overdue alert */}
              {data.soExecution.overdueCount > 0 && (
                <div className="mt-3 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  <span className="text-sm text-red-700 dark:text-red-400 font-medium flex-1">
                    {data.soExecution.overdueCount} SO เกินกำหนดส่งมอบ — ต้องติดตามด่วน
                  </span>
                  <Link href="/sale-orders" className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 flex items-center gap-1 shrink-0">
                    ดู SO <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══ EXECUTIVE SUMMARY ══════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 border border-slate-700/40 rounded-2xl shadow-sm p-5">
        <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-amber-400/5 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-1.5 rounded-lg bg-amber-400/15 border border-amber-400/20">
              <Crown className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Executive Summary</div>
              <div className="text-[10px] text-slate-500">Derived from live company data · {insights.length} insights</div>
            </div>
            <div className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400">
              <Activity className="h-3 w-3" />Live
            </div>
          </div>
          <ul className="space-y-3">
            {insights.map((ins, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0">{ins.icon}</div>
                <span className={`text-sm leading-relaxed ${ins.cls}`}>{ins.text}</span>
              </li>
            ))}
          </ul>
          {/* Quick Links */}
          <div className="mt-4 pt-4 border-t border-slate-700/40 flex flex-wrap gap-2">
            {[
              { href: '/approval-queue', label: 'Approval Center', icon: <Shield className="h-3 w-3" /> },
              { href: '/history', label: 'Audit Trail', icon: <BookOpen className="h-3 w-3" /> },
              { href: '/quotations', label: 'All Quotations', icon: <FileText className="h-3 w-3" /> },
            ].map((l) => (
              <Link key={l.href} href={l.href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/6 hover:bg-white/12 text-slate-300 hover:text-white text-xs transition-colors border border-white/8">
                {l.icon}{l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ══ LIVE ACTIVITY FEED ════════════════════════════════════════════════ */}
      {activities.length > 0 && (
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <SectionHeader
            icon={<Activity className="h-4 w-4 text-blue-500" />}
            title="Activity Feed"
            subtitle="สถานะล่าสุดของระบบ"
            action={
              <Link href="/history" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                ดูประวัติทั้งหมด <ArrowUpRight className="h-3 w-3" />
              </Link>
            }
          />
          <div className="space-y-0">
            {activities.map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
                <div className="p-1.5 rounded-lg bg-muted/50 shrink-0">{a.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${a.color}`}>{a.text}</div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">{a.time}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
