'use client';
/* ═══════════════════════════════════════════════════════════════════════════
   CEO EXECUTIVE COMMAND CENTER — Enterprise Decision Platform
   Role: CEO · Scope: Company-wide · Focus: Strategic + Approval Actions
═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Crown, TrendingUp, TrendingDown, Clock, CheckCircle2, DollarSign,
  Users as UsersIcon, AlertTriangle, Flame, RefreshCw, Activity,
  Target, Zap, Percent, Timer, Bell, ChevronRight, Minus,
  Building2, BarChart3, Eye, Shield,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/utils';
import { toast } from 'sonner';
import type { ApiResponse } from '@/types/api';

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
    specialDiscountCount: number; approvedCount: number;
    totalApprovedSubtotal: number;
  };
  soExecution?: { overdueCount: number; totalSos: number; completedCount: number; completedValue: number };
  pipelineDetail?: {
    approvedOnlyValue: number; poPendingValue: number; soConfirmedValue: number;
    stage1AvgHours: number | null; stage2AvgHours: number | null; stage3AvgHours: number | null;
    stage1Top: Array<{ id: string; quotationNo: string; grandTotal: number; submittedAt: string | null; customerCompany: string }>;
    stage2Top: any[]; stage3Top: any[]; stage4Top: any[];
  };
  rejectionReasons?: Array<{ reason: string; count: number }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function waitLabel(submittedAt: string): string {
  const hours = (Date.now() - new Date(submittedAt).getTime()) / 3_600_000;
  if (hours < 1) return '< 1 ชม.';
  if (hours < 24) return `${Math.round(hours)} ชม.`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  return `${days}ว ${rem}ชม.`;
}

// ─── Mini Sparkline (SVG) ─────────────────────────────────────────────────────
function Sparkline({ values, color = '#10b981' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const W = 52; const H = 22;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * W},${H - 2 - ((v - min) / range) * (H - 4)}`)
    .join(' ');
  return (
    <svg width={W} height={H} className="shrink-0 opacity-80">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Revenue Area SVG Chart ───────────────────────────────────────────────────
function RevenueAreaSVG({ data }: { data: Array<{ month: string; value: number }> }) {
  const W = 500; const H = 150; const PL = 52; const PR = 12; const PT = 8; const PB = 26;
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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 150 }}>
      <defs>
        <linearGradient id="ceoRevGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
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
              {val >= 1_000_000 ? `${(val / 1_000_000).toFixed(1)}M` : val >= 1_000 ? `${(val / 1_000).toFixed(0)}K` : `${val.toFixed(0)}`}
            </text>
          </g>
        );
      })}
      <path d={areaD} fill="url(#ceoRevGrad)" />
      <path d={pathD} fill="none" stroke="#10b981" strokeWidth={2.2} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#10b981" stroke="white" strokeWidth={1.2}>
          <title>{data[i].month}: {formatMoney(data[i].value)}</title>
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

// ─── KPI Command Card ─────────────────────────────────────────────────────────
function ExecKpiCard({
  icon, label, value, sublabel, trend, trendUp, sparkValues, sparkColor,
  alertLevel, href,
}: {
  icon: React.ReactNode; label: string; value: string | number;
  sublabel?: string; trend?: string; trendUp?: boolean | null;
  sparkValues?: number[]; sparkColor?: string;
  alertLevel?: 'critical' | 'warning' | null;
  href?: string;
}) {
  const ringCls =
    alertLevel === 'critical' ? 'ring-2 ring-red-500/40 shadow-lg shadow-red-500/10'
    : alertLevel === 'warning' ? 'ring-2 ring-amber-400/40 shadow-lg shadow-amber-400/10'
    : '';

  const inner = (
    <div className={`relative bg-card border border-border/50 rounded-2xl p-4 transition-all duration-200 hover:shadow-md hover:border-border ${ringCls} overflow-hidden ${href ? 'cursor-pointer' : ''}`}>
      {/* Subtle glow for alert */}
      {alertLevel && (
        <div className={`absolute inset-0 rounded-2xl pointer-events-none ${alertLevel === 'critical' ? 'bg-red-500/3' : 'bg-amber-400/3'}`} />
      )}
      <div className="relative">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="p-2 rounded-xl bg-muted/70">{icon}</div>
          {alertLevel && (
            <span className={`h-2 w-2 rounded-full mt-1 animate-pulse shrink-0 ${alertLevel === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`} />
          )}
        </div>
        <div className="flex items-end justify-between gap-1">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-muted-foreground mb-0.5 truncate font-medium uppercase tracking-wide">{label}</div>
            <div className={`text-2xl font-bold leading-none ${alertLevel === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
              {value}
            </div>
            {sublabel && (
              <div className={`text-[11px] mt-1 truncate ${alertLevel === 'critical' ? 'text-red-500/70' : 'text-muted-foreground'}`}>
                {sublabel}
              </div>
            )}
            {trend && (
              <div className={`flex items-center gap-1 mt-1.5 text-[11px] font-medium ${
                trendUp === true ? 'text-emerald-600 dark:text-emerald-400'
                : trendUp === false ? 'text-red-500 dark:text-red-400'
                : 'text-muted-foreground'
              }`}>
                {trendUp === true ? <TrendingUp className="h-3 w-3" />
                  : trendUp === false ? <TrendingDown className="h-3 w-3" />
                  : <Minus className="h-3 w-3" />}
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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — Data Fetching Wrapper
// ═══════════════════════════════════════════════════════════════════════════════
export default function CeoExecutiveDashboard() {
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

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = async () => {
    setSpinning(true);
    await fetchData();
    setTimeout(() => setSpinning(false), 700);
  };

  if (loading && !data) {
    return (
      <div className="space-y-5 max-w-7xl">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-48 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2"><Skeleton className="h-52 rounded-2xl" /></div>
          <Skeleton className="h-52 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-56 rounded-2xl" /><Skeleton className="h-56 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 rounded-2xl bg-card border border-border text-muted-foreground text-sm">
        ไม่สามารถโหลดข้อมูลได้ — กรุณาลองใหม่
      </div>
    );
  }

  return (
    <CeoDashboardContent
      data={data}
      lastUpdate={lastUpdate}
      onRefresh={handleRefresh}
      spinning={spinning}
    />
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
  // ── Derived metrics ──────────────────────────────────────────────────────────
  const conversionRate = data.totals.conversionRate ??
    (data.totals.quotations > 0 ? Math.round((data.totals.approved / data.totals.quotations) * 100) : 0);

  const revTrend = data.revenueTrend ?? [];
  const sparkVals = revTrend.map((m) => m.value);
  const prevRev = sparkVals[sparkVals.length - 2] ?? 0;
  const currRev = sparkVals[sparkVals.length - 1] ?? 0;
  const revGrowth = prevRev > 0 ? Math.round(((currRev - prevRev) / prevRev) * 100) : null;

  const overdueQt = data.agingBuckets?.gt7d.count ?? 0;
  const overdueSo = data.soExecution?.overdueCount ?? 0;
  const expiringCount = data.expiringQuotations?.length ?? 0;
  const poWaiting = data.totals.poVerificationPending ?? 0;
  const avgDiscount = data.marginAnalysis?.avgDiscountRate ?? 0;

  // ── Risk classification ───────────────────────────────────────────────────────
  const criticalRisks: string[] = [
    ...(data.totals.escalated > 0 ? [`${data.totals.escalated} ใบเสนอราคา Escalated รอ CEO อนุมัติ`] : []),
    ...(overdueQt > 0 ? [`${overdueQt} QT ค้างนานเกิน 7 วัน ไม่มีการตอบสนอง`] : []),
    ...(overdueSo > 0 ? [`${overdueSo} Sale Order เกินกำหนดส่งมอบ`] : []),
  ];
  const warningRisks: string[] = [
    ...(expiringCount > 0 ? [`${expiringCount} QT ใกล้หมดอายุภายใน 7 วัน`] : []),
    ...(poWaiting > 0 ? [`${poWaiting} PO รอการตรวจสอบและยืนยัน`] : []),
    ...(avgDiscount > 20 ? [`ส่วนลดเฉลี่ยสูงผิดปกติ ${avgDiscount.toFixed(1)}%`] : []),
  ];
  const attentionRisks: string[] = [
    ...(data.totals.pending > 10 ? [`${data.totals.pending} QT รออนุมัติในระบบ (volume สูง)`] : []),
    ...((data.marginAnalysis?.specialDiscountCount ?? 0) > 0
      ? [`${data.marginAnalysis!.specialDiscountCount} Special Discount Requests`] : []),
    ...(conversionRate < 40 && data.totals.quotations > 5
      ? [`Conversion Rate อยู่ที่ ${conversionRate}% (เป้าหมาย ≥ 50%)`] : []),
  ];
  const hasRisks = criticalRisks.length + warningRisks.length + attentionRisks.length > 0;

  // ── Executive summary insights ────────────────────────────────────────────────
  const insights: { icon: React.ReactNode; text: string; accent: string }[] = [];
  if (revGrowth !== null) {
    insights.push({
      icon: revGrowth >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> : <TrendingDown className="h-3.5 w-3.5 text-red-400" />,
      text: `รายได้${revGrowth >= 0 ? 'เพิ่มขึ้น' : 'ลดลง'} ${Math.abs(revGrowth)}% เทียบเดือนก่อนหน้า`,
      accent: revGrowth >= 0 ? 'text-emerald-300' : 'text-red-300',
    });
  }
  if (data.totals.escalated > 0) {
    insights.push({
      icon: <Flame className="h-3.5 w-3.5 text-red-400" />,
      text: `${data.totals.escalated} ใบเสนอราคารอการอนุมัติจาก CEO โดยเฉพาะ`,
      accent: 'text-red-300',
    });
  }
  if (criticalRisks.length + warningRisks.length > 0) {
    insights.push({
      icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
      text: `พบความเสี่ยง ${criticalRisks.length} วิกฤต · ${warningRisks.length} เตือน · ${attentionRisks.length} ต้องติดตาม`,
      accent: 'text-amber-300',
    });
  }
  if (data.forecast?.nextMonthForecast) {
    const vs = data.forecast.avgMonthlyRevenue > 0
      ? Math.round((data.forecast.nextMonthForecast / data.forecast.avgMonthlyRevenue - 1) * 100) : 0;
    insights.push({
      icon: <Target className="h-3.5 w-3.5 text-violet-400" />,
      text: `Forecast เดือนหน้า ${formatMoney(data.forecast.nextMonthForecast)} (${vs >= 0 ? '+' : ''}${vs}% vs ค่าเฉลี่ย)`,
      accent: 'text-violet-300',
    });
  }
  insights.push({
    icon: <Activity className="h-3.5 w-3.5 text-blue-400" />,
    text: `Conversion Rate รวม ${conversionRate}% · QT ทั้งหมด ${data.totals.quotations} ใบ`,
    accent: 'text-blue-300',
  });

  return (
    <div className="space-y-5 max-w-7xl pb-10">

      {/* ══ COMMAND HEADER ══ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 shadow-xl px-6 py-5">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/8 via-transparent to-purple-500/8 pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-amber-400/6 pointer-events-none" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="p-2 rounded-xl bg-amber-400/15 border border-amber-400/20">
                <Crown className="h-5 w-5 text-amber-400" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">CEO Command Center</h1>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-amber-400/15 border border-amber-400/25 rounded-full text-amber-300">
                EXECUTIVE
              </span>
            </div>
            <p className="text-sm text-slate-400">
              ภาพรวมบริษัท · อัปเดตเวลา{' '}
              <span className="text-slate-300 font-medium">
                {lastUpdate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-5 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-400">QT <span className="font-bold text-white">{data.totals.quotations}</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-slate-400">รออนุมัติ <span className="font-bold text-white">{data.totals.pending}</span></span>
              </div>
              {data.totals.escalated > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-slate-400">Escalated <span className="font-bold text-red-400">{data.totals.escalated}</span></span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                <span className="text-slate-400">Conv <span className="font-bold text-white">{conversionRate}%</span></span>
              </div>
            </div>
            <button
              onClick={onRefresh}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-white/15 bg-white/8 text-white hover:bg-white/15 transition-colors"
              title="Refresh data"
            >
              <RefreshCw className={`h-4 w-4 ${spinning ? 'animate-spin' : ''}`} />
            </button>
            <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-xs h-9">
              <Link href="/approval-queue">
                <Shield className="h-3.5 w-3.5 mr-1" />
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

      {/* ══ KPI COMMAND CENTER — 6 cards ══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <ExecKpiCard
          icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
          label="Total Revenue"
          value={formatMoney(data.totals.totalValue)}
          sublabel={`${data.totals.approved} ใบอนุมัติแล้ว`}
          trend={revGrowth !== null ? `${revGrowth >= 0 ? '+' : ''}${revGrowth}% MoM` : undefined}
          trendUp={revGrowth !== null ? revGrowth >= 0 : null}
          sparkValues={sparkVals.length > 1 ? sparkVals : undefined}
          sparkColor="#10b981"
        />
        <ExecKpiCard
          icon={<Flame className="h-4 w-4 text-red-600" />}
          label="CEO Actions"
          value={data.totals.escalated}
          sublabel={data.totals.escalated > 0 ? 'Escalated รอ CEO' : 'ไม่มีรายการด่วน'}
          alertLevel={data.totals.escalated > 0 ? 'critical' : null}
          href="/approval-queue"
        />
        <ExecKpiCard
          icon={<Activity className="h-4 w-4 text-blue-600" />}
          label="Conversion Rate"
          value={`${conversionRate}%`}
          sublabel="QT → SO Confirmed"
          trend={conversionRate >= 50 ? 'On target' : conversionRate >= 30 ? 'Below target' : 'Needs attention'}
          trendUp={conversionRate >= 50 ? true : conversionRate >= 30 ? null : false}
        />
        <ExecKpiCard
          icon={<TrendingUp className="h-4 w-4 text-violet-600" />}
          label="Forecast"
          value={formatMoney(data.forecast?.nextMonthForecast ?? 0)}
          sublabel="เดือนหน้า (ประมาณการ)"
          trend={data.forecast?.avgMonthlyRevenue
            ? `Avg ${formatMoney(data.forecast.avgMonthlyRevenue)}/mo`
            : undefined}
          trendUp={null}
        />
        <ExecKpiCard
          icon={<Clock className="h-4 w-4 text-amber-600" />}
          label="Pending Approval"
          value={data.totals.pending}
          sublabel={overdueQt > 0 ? `⚠ ${overdueQt} เกิน 7 วัน` : 'ในระบบ'}
          alertLevel={overdueQt > 0 ? 'warning' : null}
        />
        <ExecKpiCard
          icon={<Zap className="h-4 w-4 text-cyan-600" />}
          label="Pipeline Value"
          value={formatMoney(data.totals.pendingValue)}
          sublabel="มูลค่า Pending QT"
          trend={data.forecast?.pipelineCoverage
            ? `Coverage ${formatMoney(data.forecast.pipelineCoverage)}`
            : undefined}
          trendUp={null}
        />
      </div>

      {/* ══ EXECUTIVE ACTION CENTER ══ */}
      {data.recentEscalated.length > 0 && (
        <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-gradient-to-br from-red-50/70 to-rose-50/30 dark:from-red-950/25 dark:to-rose-950/15 overflow-hidden shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-red-200/50 dark:border-red-900/30">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-red-500/12 border border-red-400/20">
                <Bell className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <div className="font-bold text-red-700 dark:text-red-300 text-sm">Executive Action Required</div>
                <div className="text-xs text-red-600/60 dark:text-red-400/60">ใบเสนอราคา Escalated รอการอนุมัติจาก CEO</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">
                {data.recentEscalated.length}
              </span>
              <Button asChild size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30">
                <Link href="/approval-queue">ดูทั้งหมด <ChevronRight className="h-3 w-3 ml-0.5" /></Link>
              </Button>
            </div>
          </div>
          {/* Items */}
          <div className="divide-y divide-red-100/60 dark:divide-red-900/20">
            {data.recentEscalated.map((q) => {
              const waitHours = (Date.now() - new Date(q.submittedAt).getTime()) / 3_600_000;
              const isUrgent = waitHours > 48;
              return (
                <div key={q.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-red-50/40 dark:hover:bg-red-950/10 transition-colors">
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${isUrgent ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{q.quotationNo}</span>
                      <Badge variant="outline" className="text-[10px] bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                        ESCALATED
                      </Badge>
                      {isUrgent && (
                        <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-300">
                          OVERDUE
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5 truncate">
                      {q.customerCompany}
                      <span className="mx-1.5 opacity-30">·</span>
                      สร้างโดย <span className="text-foreground/80">{q.createdByName}</span>
                      <span className="mx-1.5 opacity-30">·</span>
                      <span className="text-[11px] opacity-60">{formatDate(q.submittedAt)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 min-w-[90px]">
                    <div className="font-bold text-red-700 dark:text-red-400 text-sm">{formatMoney(q.grandTotal)}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end mt-0.5">
                      <Timer className="h-3 w-3" />
                      {waitLabel(q.submittedAt)}
                    </div>
                  </div>
                  <Button asChild size="sm" className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white shrink-0">
                    <Link href={`/quotations/${q.id}`}>
                      Review <ChevronRight className="h-3 w-3 ml-0.5" />
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty action state when no escalated */}
      {data.recentEscalated.length === 0 && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">No Executive Actions Required</div>
            <div className="text-xs text-emerald-600/70 dark:text-emerald-400/70">ไม่มีใบเสนอราคา Escalated รอการอนุมัติขณะนี้</div>
          </div>
        </div>
      )}

      {/* ══ RISK INTELLIGENCE — 3 columns ══ */}
      {hasRisks && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Critical */}
          <RiskPanel
            level="critical"
            icon={<AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />}
            label="Critical"
            dot="bg-red-500"
            border={criticalRisks.length > 0 ? 'border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/15' : 'border-border bg-card'}
            iconBg="bg-red-500/10"
            textColor="text-red-700 dark:text-red-300"
            itemColor="text-red-700 dark:text-red-400"
            items={criticalRisks}
          />
          {/* Warning */}
          <RiskPanel
            level="warning"
            icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
            label="Warning"
            dot="bg-amber-400"
            border={warningRisks.length > 0 ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/15' : 'border-border bg-card'}
            iconBg="bg-amber-500/10"
            textColor="text-amber-700 dark:text-amber-300"
            itemColor="text-amber-700 dark:text-amber-400"
            items={warningRisks}
          />
          {/* Attention */}
          <RiskPanel
            level="attention"
            icon={<Eye className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />}
            label="Attention"
            dot="bg-yellow-400"
            border={attentionRisks.length > 0 ? 'border-yellow-200 bg-yellow-50/60 dark:border-yellow-900/40 dark:bg-yellow-950/15' : 'border-border bg-card'}
            iconBg="bg-yellow-500/10"
            textColor="text-yellow-700 dark:text-yellow-300"
            itemColor="text-yellow-700 dark:text-yellow-400"
            items={attentionRisks}
          />
        </div>
      )}

      {/* ══ REVENUE ANALYTICS + FORECAST ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Trend Chart */}
        <div className="lg:col-span-2 bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Revenue Trend
            </div>
            <div className="text-xs text-muted-foreground">6 เดือนที่ผ่านมา</div>
          </div>
          <p className="text-xs text-muted-foreground mb-4">มูลค่า Approved Quotations รายเดือน</p>
          {revTrend.length > 0 ? (
            <RevenueAreaSVG data={revTrend} />
          ) : (
            <div className="flex flex-col items-center justify-center h-36 text-muted-foreground text-xs gap-2">
              <BarChart3 className="h-8 w-8 opacity-20" />
              ยังไม่มีข้อมูล Revenue — จะแสดงเมื่อมีการอนุมัติใบเสนอราคา
            </div>
          )}
        </div>

        {/* Forecast Panel */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <div className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-violet-500" />
            Revenue Forecast
          </div>
          {!data.forecast ? (
            <div className="text-center py-8 text-muted-foreground text-xs">ยังไม่มีข้อมูล</div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl p-4 bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-200/40 dark:border-violet-800/30">
                <div className="text-xs text-muted-foreground mb-0.5">Forecast เดือนหน้า</div>
                <div className="text-2xl font-bold text-violet-700 dark:text-violet-300">
                  {formatMoney(data.forecast.nextMonthForecast)}
                </div>
                <div className="text-[11px] text-violet-600/60 dark:text-violet-400/60 mt-0.5">ประมาณการ +5% จากค่าเฉลี่ย</div>
              </div>
              <div className="rounded-xl p-3 bg-muted/40 flex justify-between items-center">
                <div>
                  <div className="text-xs text-muted-foreground">Avg / เดือน</div>
                  <div className="text-base font-bold mt-0.5">{formatMoney(data.forecast.avgMonthlyRevenue)}</div>
                </div>
                <BarChart3 className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <div className="rounded-xl p-3 bg-muted/40 flex justify-between items-center">
                <div>
                  <div className="text-xs text-muted-foreground">Pipeline Coverage</div>
                  <div className="text-base font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">
                    {formatMoney(data.forecast.pipelineCoverage)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Pending × Conv Rate</div>
                </div>
                <Zap className="h-5 w-5 text-cyan-500/40" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ PIPELINE + ORG PERFORMANCE ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Sales Pipeline */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <div className="text-sm font-semibold flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            Sales Pipeline
            <span className="ml-auto text-xs font-normal text-muted-foreground">{data.totals.quotations} QT baseline</span>
          </div>
          {(() => {
            const pd = data.pipelineDetail;
            const total = Math.max(data.totals.quotations, 1);
            const pending = (data.totals.pending ?? 0) + (data.totals.escalated ?? 0);
            const stages = [
              {
                label: 'Pending Approval', count: pending,
                value: data.totals.pendingValue, color: '#f59e0b',
                pct: Math.round((pending / total) * 100),
                avgH: pd?.stage1AvgHours, warnH: 48, critH: 168,
              },
              {
                label: 'Approved → Waiting PO', count: data.totals.approved,
                value: pd?.approvedOnlyValue ?? 0, color: '#06b6d4',
                pct: Math.round((data.totals.approved / total) * 100),
                avgH: pd?.stage2AvgHours, warnH: 72, critH: 168,
              },
              {
                label: 'PO Received', count: poWaiting,
                value: pd?.poPendingValue ?? 0, color: '#14b8a6',
                pct: Math.round((poWaiting / total) * 100),
                avgH: pd?.stage3AvgHours, warnH: 48, critH: 120,
              },
              {
                label: 'SO Confirmed', count: data.totals.soConfirmed ?? 0,
                value: pd?.soConfirmedValue ?? 0, color: '#10b981',
                pct: Math.round(((data.totals.soConfirmed ?? 0) / total) * 100),
                avgH: null, warnH: 0, critH: 0,
              },
            ];
            return (
              <div className="space-y-3">
                {stages.map((s, i) => {
                  const ageHrs = s.avgH ?? 0;
                  const isCrit = s.critH > 0 && ageHrs >= s.critH;
                  const isWarn = !isCrit && s.warnH > 0 && ageHrs >= s.warnH;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-1.5 h-9 rounded-full shrink-0" style={{ background: s.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-medium truncate">{s.label}</span>
                            {(isCrit || isWarn) && (
                              <span className={`h-1.5 w-1.5 rounded-full animate-pulse shrink-0 ${isCrit ? 'bg-red-500' : 'bg-amber-400'}`} />
                            )}
                          </div>
                          <span className="text-muted-foreground ml-2 shrink-0 tabular-nums">{s.count} QT</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.max(s.pct, s.count > 0 ? 5 : 0)}%`, background: s.color }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0 w-24">
                        <div className="text-xs font-bold tabular-nums" style={{ color: s.color }}>{s.pct}%</div>
                        <div className="text-[10px] text-muted-foreground tabular-nums">{formatMoney(s.value)}</div>
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2.5 border-t flex justify-between text-xs text-muted-foreground">
                  <span>Conversion Rate (QT → SO)</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{conversionRate}%</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Org Performance */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <div className="text-sm font-semibold flex items-center gap-2 mb-4">
            <UsersIcon className="h-4 w-4 text-violet-500" />
            Organization Performance
            <Badge variant="outline" className="ml-auto text-[10px]">Top {Math.min(data.topOfficers.length, 5)}</Badge>
          </div>
          {data.topOfficers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UsersIcon className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">ยังไม่มีข้อมูลทีมขาย</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="grid grid-cols-[18px_1fr_40px_80px] text-[10px] text-muted-foreground uppercase px-2 pb-2 border-b gap-2">
                <span>#</span><span>พนักงาน</span><span className="text-right">Win%</span><span className="text-right">Value</span>
              </div>
              {data.topOfficers.slice(0, 5).map((o, idx) => {
                const maxV = Math.max(...data.topOfficers.slice(0, 5).map((x) => x.value), 1);
                const barPct = Math.round((o.value / maxV) * 100);
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                return (
                  <div key={o.userId} className="p-2 rounded-xl hover:bg-accent transition-colors">
                    <div className="grid grid-cols-[18px_1fr_40px_80px] items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-bold text-center text-muted-foreground">{medal ?? (idx + 1)}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{o.userName}</div>
                        <div className="text-[10px] text-muted-foreground">{o.count} QT</div>
                      </div>
                      <div className="text-xs text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {o.winRate ?? 0}%
                      </div>
                      <div className="text-sm font-bold text-right tabular-nums">{formatMoney(o.value)}</div>
                    </div>
                    <div className="ml-6 h-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-violet-500 to-purple-400"
                        style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══ CUSTOMER INTELLIGENCE + EXECUTIVE SUMMARY ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top Customers */}
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <div className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Building2 className="h-4 w-4 text-indigo-500" />
            Customer Intelligence
            <Badge variant="outline" className="ml-auto text-[10px]">Top {Math.min(data.customerInsights?.length ?? 0, 5)}</Badge>
          </div>
          {!data.customerInsights || data.customerInsights.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">ยังไม่มีข้อมูลลูกค้า</p>
            </div>
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
                      </div>
                      <span className="text-muted-foreground ml-3 shrink-0 tabular-nums">
                        {c.qtCount} QT · {formatMoney(c.totalValue)}
                      </span>
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

        {/* Executive Summary */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 border border-slate-700/40 rounded-2xl shadow-sm p-5">
          <div className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-amber-400/5 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-1.5 rounded-lg bg-amber-400/15 border border-amber-400/20">
                <Crown className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Executive Summary</div>
                <div className="text-[10px] text-slate-500">Derived from live data</div>
              </div>
              <div className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400">
                <Activity className="h-3 w-3" />Live
              </div>
            </div>
            {insights.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">ยังไม่มีข้อมูลเพียงพอ</div>
            ) : (
              <ul className="space-y-3">
                {insights.map((ins, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <div className="mt-0.5 shrink-0">{ins.icon}</div>
                    <span className={`text-sm leading-relaxed ${ins.accent}`}>{ins.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ══ MARGIN & DISCOUNT INTELLIGENCE ══ */}
      {data.marginAnalysis && (
        <div className="bg-card border border-border/60 rounded-2xl shadow-sm p-5">
          <div className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Percent className="h-4 w-4 text-amber-500" />
            Margin &amp; Discount Intelligence
            {data.marginAnalysis.avgDiscountRate > 20 && (
              <Badge variant="outline" className="ml-2 text-[10px] bg-amber-50 text-amber-700 border-amber-300">High Discount Alert</Badge>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: 'Avg Discount Rate',
                value: `${data.marginAnalysis.avgDiscountRate.toFixed(1)}%`,
                color: data.marginAnalysis.avgDiscountRate > 20 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400',
                bg: data.marginAnalysis.avgDiscountRate > 20 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20',
                ring: data.marginAnalysis.avgDiscountRate > 20,
              },
              {
                label: 'Total Discount Given',
                value: formatMoney(data.marginAnalysis.totalDiscountGiven),
                color: 'text-rose-600 dark:text-rose-400',
                bg: 'bg-rose-50 dark:bg-rose-900/20',
                ring: false,
              },
              {
                label: 'Special Discount Req.',
                value: data.marginAnalysis.specialDiscountCount,
                color: 'text-violet-600 dark:text-violet-400',
                bg: 'bg-violet-50 dark:bg-violet-900/20',
                ring: false,
              },
              {
                label: 'QT Approved Total',
                value: data.marginAnalysis.approvedCount,
                color: 'text-emerald-600 dark:text-emerald-400',
                bg: 'bg-emerald-50 dark:bg-emerald-900/20',
                ring: false,
              },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl p-3.5 ${item.bg} ${item.ring ? 'ring-1 ring-red-400/30' : ''}`}>
                <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>
          {data.marginAnalysis.totalApprovedSubtotal > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>Net Revenue vs Discount Given</span>
                <span className={`font-semibold ${data.marginAnalysis.avgDiscountRate > 20 ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {data.marginAnalysis.avgDiscountRate.toFixed(1)}% discount rate
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700 rounded-l-full"
                  style={{ width: `${Math.max(100 - data.marginAnalysis.avgDiscountRate, 0)}%` }} />
                <div className="h-full bg-gradient-to-r from-rose-400 to-red-500 transition-all duration-700 rounded-r-full"
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
  );
}

// ─── Risk Panel Component ─────────────────────────────────────────────────────
function RiskPanel({
  icon, label, dot, border, iconBg, textColor, itemColor, items,
}: {
  level: string; icon: React.ReactNode; label: string; dot: string;
  border: string; iconBg: string; textColor: string; itemColor: string;
  items: string[];
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
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          ไม่มีรายการในระดับนี้
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((r, i) => (
            <li key={i} className={`flex items-start gap-1.5 text-xs ${itemColor}`}>
              <span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${dot} shrink-0`} />
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
