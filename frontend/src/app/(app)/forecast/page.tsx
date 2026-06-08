'use client';

import { useEffect, useState, useCallback, type ElementType } from 'react';
import Link from 'next/link';
import {
  TrendingUp, TrendingDown, Target, BarChart3, Users, Loader2,
  Pencil, Check, X, Info, AlertTriangle, ShieldAlert, Clock,
  ChevronRight, ArrowUpRight, ArrowDownRight, Minus, Activity,
  Calendar, Zap, Award,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatMoney, cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { AnimatedCounter } from '@/components/effects/animated-counter';
import type { ApiResponse } from '@/types/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FvtMonth { label: string; year: number; month: number; actual: number; target: number | null; forecast: number; achievePct: number | null; gap: number | null; isFuture?: boolean; }
interface FvtQuarter { label: string; year: number; quarter: number; actual: number; target: number | null; forecast: number; achievePct: number | null; gap: number | null; }
interface FvtYearly { year: number; actual: number; target: number | null; forecast: number; achievePct: number | null; gap: number | null; }
interface FunnelStep { label: string; step: number; count: number; value: number; conversionFromFirst: number; conversionFromPrev: number; }
interface DealRisk { id: string; quotationNo: string; customerCompany: string; grandTotal: number; status: string; expiryDate: string | null; updatedAt: string; createdAt: string; salesName: string; riskType: string; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; riskScore: number; daysUntilExpiry: number | null; daysSinceUpdate: number; daysOpen: number; }
interface AccuracyMonth { label: string; month: number; year: number; actual: number; target: number | null; forecast: number; accuracy: number | null; targetAchievement: number | null; }
interface SalesPerf { userId: string; name: string; actualRevenue: number; quotationCount: number; pipelineCount: number; lostCount: number; pendingCount: number; saleOrderCount: number; closedDeals: number; winRate: number | null; lowSample: boolean; avgDealSize: number; }
interface TrendMonth { label: string; month: number; year: number; actual: number; prevYearActual: number | null; momGrowth: number | null; yoyGrowth: number | null; momIsExtreme: boolean; trend: 'UP' | 'DOWN' | 'FLAT'; }
interface PipelineStatus { status: string; count: number; value: number; probability: number; weightedValue: number; }
interface PipelineSales { userId: string; name: string; count: number; value: number; weightedValue: number; }
interface PipelineCustomer { company: string; count: number; value: number; }
interface PipelineHealth { total: number; weighted: number; coverageRatio: number | null; coverageBase: 'target' | 'avg_monthly'; byStatus: PipelineStatus[]; bySales: PipelineSales[]; byCustomer: PipelineCustomer[]; }
interface Opportunity { id: string; quotationNo: string; customerCompany: string; grandTotal: number; status: string; probability: number; forecastValue: number; expiryDate: string | null; createdAt: string; salesName: string; daysOpen: number; riskScore: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; }
interface AgingBucket { label: string; minDays: number; maxDays: number | null; count: number; value: number; pct: number; }
interface AgingItem { id: string; quotationNo: string; customerCompany: string; grandTotal: number; status: string; ageDays: number; salesName: string; }
interface WinRateTrendItem { label: string; month: number; year: number; won: number; lost: number; winRate: number | null; }
interface KpiSummary {
  forecastGap: number | null; forecastGapPct: number | null;
  expectedClosingThisMonth: number; expectedClosingCount: number;
  avgDealSizeSO: number; avgDealSizePipeline: number;
  avgSalesCycle: number | null; winRate6m: number | null;
  top5CustomerPct: number | null; totalRevenue12m: number;
}
interface CustomerConcentration { company: string; total: number; pct: number; }
interface AdvancedData {
  forecastVsTarget: { monthly: FvtMonth[]; quarterly: FvtQuarter[]; yearly: FvtYearly; forecastMonths: FvtMonth[] };
  conversionFunnel: FunnelStep[];
  dealsAtRisk: DealRisk[];
  forecastAccuracy: AccuracyMonth[];
  topSalesPerformance: SalesPerf[];
  revenueTrend: TrendMonth[];
  pipelineHealth: PipelineHealth;
  topOpportunities: Opportunity[];
  agingPipeline: { buckets: AgingBucket[]; items: AgingItem[] };
  winRateTrend: WinRateTrendItem[];
  kpiSummary: KpiSummary;
  customerConcentration: CustomerConcentration[];
  roleCode: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
type Period = 'monthly' | 'quarterly' | 'yearly';
type PipelineTab = 'status' | 'sales' | 'customer';

function short(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'รออนุมัติ', PENDING_ESCALATED: 'Escalated', PENDING_BACKUP: 'Backup',
  APPROVED: 'อนุมัติแล้ว', PO_PENDING: 'รอ PO', PO_APPROVED: 'PO อนุมัติ',
  DRAFT: 'Draft', REJECTED: 'ถูกปฏิเสธ',
};
const STATUS_COLOR: Record<string, string> = {
  PENDING: '#f59e0b', PENDING_ESCALATED: '#f97316', PENDING_BACKUP: '#f97316',
  APPROVED: '#10b981', PO_PENDING: '#8b5cf6', PO_APPROVED: '#06b6d4',
  DRAFT: '#94a3b8', REJECTED: '#ef4444',
};
const RISK_COLOR: Record<string, string> = {
  HIGH: 'text-red-600 bg-red-50 dark:bg-red-900/20',
  MEDIUM: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
  LOW: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
};
const RISK_LABEL_TH: Record<string, string> = {
  EXPIRING: 'ใกล้หมดอายุ', LONG_PENDING: 'รออนุมัตินาน',
  HIGH_VALUE_STALE: 'มูลค่าสูง ไม่มีการอัปเดต', LOW_ACTIVITY: 'กิจกรรมน้อย',
};

// ════════════════════════════════════════════════════════════════════════════
// CHARTS
// ════════════════════════════════════════════════════════════════════════════

function BarComboChart({ data, labelKey, actualKey, targetKey, forecastKey, futureSplit }: {
  data: Array<Record<string, number | string | null>>;
  labelKey: string; actualKey: string; targetKey: string; forecastKey: string;
  futureSplit?: number;
}) {
  const W = 640; const H = 180; const PL = 52; const PR = 12; const PT = 10; const PB = 30;
  const cW = W - PL - PR; const cH = H - PT - PB;
  const vals = data.flatMap((d) => [Number(d[actualKey] ?? 0), Number(d[targetKey] ?? 0), Number(d[forecastKey] ?? 0)]);
  const maxVal = Math.max(...vals, 1);
  const bW = cW / data.length;
  const gap = bW * 0.12; const aW = bW * 0.36; const fW = bW * 0.22; const tW = bW * 0.16;
  const yv = (v: number) => PT + cH - (v / maxVal) * cH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 180 }}>
      <defs>
        <linearGradient id="fcActual" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const gy = PT + cH * (1 - t);
        return <g key={t}>
          <line x1={PL} y1={gy} x2={W - PR} y2={gy} stroke="currentColor" strokeOpacity={0.06} strokeWidth={1} />
          <text x={PL - 4} y={gy + 3} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.4}>{short(maxVal * t)}</text>
        </g>;
      })}
      {data.map((d, i) => {
        const x = PL + i * bW + gap;
        const actual = Number(d[actualKey] ?? 0);
        const target = Number(d[targetKey] ?? 0);
        const forecast = Number(d[forecastKey] ?? 0);
        const isFutureBar = futureSplit != null && i >= futureSplit;
        const isCurrent = !isFutureBar && i === (futureSplit != null ? futureSplit - 1 : data.length - 1);
        return <g key={i}>
          {isFutureBar && <rect x={x - gap / 2} y={PT} width={bW} height={cH} fill="currentColor" fillOpacity={0.025} />}
          {!isFutureBar && actual > 0 && <rect x={x} y={yv(actual)} width={aW} height={Math.max(2, (actual / maxVal) * cH)} fill="url(#fcActual)" rx={2}><title>จริง: {formatMoney(actual)}</title></rect>}
          {forecast > 0 && <rect x={x + aW + 1} y={yv(forecast)} width={fW} height={Math.max(2, (forecast / maxVal) * cH)} fill="#a5b4fc" rx={2} opacity={isFutureBar ? 0.95 : 0.8}><title>Forecast: {formatMoney(forecast)}</title></rect>}
          {target > 0 && <rect x={x + aW + fW + 2} y={yv(target)} width={tW} height={Math.max(2, (target / maxVal) * cH)} fill="#f59e0b" rx={2} opacity={0.75}><title>เป้า: {formatMoney(target)}</title></rect>}
          <text x={x + aW / 2} y={H - 8} textAnchor="middle" fontSize={9} fill="currentColor" fillOpacity={isCurrent ? 0.9 : isFutureBar ? 0.6 : 0.4} fontWeight={isCurrent || isFutureBar ? '600' : '400'}>
            {String(d[labelKey])}
          </text>
        </g>;
      })}
      {futureSplit != null && futureSplit > 0 && futureSplit < data.length && (
        <line x1={PL + futureSplit * bW} y1={PT} x2={PL + futureSplit * bW} y2={PT + cH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} strokeDasharray="3 3" />
      )}
    </svg>
  );
}

function AreaLineChart({ data, color = '#10b981', yMax }: { data: Array<{ label: string; value: number; value2?: number | null }>; color?: string; yMax?: number }) {
  const W = 500; const H = 120; const PL = 44; const PR = 12; const PT = 8; const PB = 24;
  const cW = W - PL - PR; const cH = H - PT - PB;
  if (data.length < 2) return <div className="text-xs text-center text-muted-foreground py-4">ข้อมูลไม่เพียงพอ</div>;
  const maxVal = yMax ?? Math.max(...data.flatMap((d) => [d.value, d.value2 ?? 0]), 1);
  const xi = (i: number) => PL + (i / (data.length - 1)) * cW;
  const yv = (v: number) => PT + cH - Math.min(1, Math.max(0, v / maxVal)) * cH;
  const pts = data.map((d, i) => ({ x: xi(i), y: yv(d.value) }));
  let path = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i - 1].x + pts[i].x) / 2;
    path += ` C ${cpx} ${pts[i - 1].y} ${cpx} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
  }
  const area = `${path} L ${pts[pts.length - 1].x} ${PT + cH} L ${pts[0].x} ${PT + cH} Z`;
  const gradId = `ag-${color.replace('#', '')}`;
  const pts2 = data.some((d) => d.value2 != null) ? data.map((d, i) => d.value2 != null ? { x: xi(i), y: yv(d.value2) } : null) : [];
  let path2 = '';
  if (pts2.length > 0) {
    const first = pts2.find((p) => p != null);
    if (first) {
      path2 = `M ${first.x} ${first.y}`;
      for (let i = 1; i < pts2.length; i++) {
        const p = pts2[i]; const pp = pts2[i - 1];
        if (p && pp) { const cpx = (pp.x + p.x) / 2; path2 += ` C ${cpx} ${pp.y} ${cpx} ${p.y} ${p.x} ${p.y}`; }
      }
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((t) => {
        const gy = PT + cH * (1 - t);
        return <g key={t}>
          <line x1={PL} y1={gy} x2={W - PR} y2={gy} stroke="currentColor" strokeOpacity={0.06} strokeWidth={1} />
          <text x={PL - 4} y={gy + 3} textAnchor="end" fontSize={8} fill="currentColor" fillOpacity={0.35}>{short(maxVal * t)}</text>
        </g>;
      })}
      <path d={area} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {path2 && <path d={path2} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" strokeLinejoin="round" />}
      {data.map((d, i) => <g key={i}>
        <circle cx={xi(i)} cy={yv(d.value)} r={3} fill={color} stroke="white" strokeWidth={1.5}><title>{d.label}: {short(d.value)}</title></circle>
        <text x={xi(i)} y={H - 5} textAnchor="middle" fontSize={8} fill="currentColor" fillOpacity={0.4}>{d.label}</text>
      </g>)}
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// KPI QUICK STATS BAR
// ════════════════════════════════════════════════════════════════════════════

function QuickStatChip({ icon: Icon, label, value, sub, color }: { icon: ElementType; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-muted/50 border border-border/50 hover:bg-muted/70 hover:border-border hover-lift transition-colors min-w-0 group">
      <div className={cn('p-1.5 rounded-lg bg-background/80 shrink-0', color ? color.replace('text-', 'bg-').replace('-600', '-100').replace('-400', '-100') + ' dark:bg-opacity-20' : 'bg-muted')}>
        <Icon className={cn('h-3.5 w-3.5', color ?? 'text-muted-foreground')} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground leading-tight font-medium">{label}</div>
        <div className="text-xs font-bold leading-tight truncate">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground leading-tight">{sub}</div>}
      </div>
    </div>
  );
}

function KpiQuickStatsBar({ kpi, isCeo }: { kpi: KpiSummary; isCeo: boolean }) {
  type Chip = { icon: ElementType; label: string; value: string; sub?: string; color?: string };
  const chips = [
    kpi.expectedClosingThisMonth > 0 && {
      icon: Calendar, label: 'คาดปิดเดือนนี้', color: 'text-emerald-600',
      value: short(kpi.expectedClosingThisMonth),
      sub: `${kpi.expectedClosingCount} ดีล`,
    },
    kpi.avgDealSizeSO > 0 && {
      icon: Award, label: 'Avg Deal Size (SO)', color: 'text-indigo-600',
      value: short(kpi.avgDealSizeSO), sub: undefined,
    },
    kpi.avgSalesCycle !== null && {
      icon: Clock, label: 'Sales Cycle', color: 'text-blue-600',
      value: `${kpi.avgSalesCycle} วัน`, sub: 'QT → SO เฉลี่ย',
    },
    kpi.winRate6m !== null && {
      icon: Zap, label: 'Win Rate (6 เดือน)',
      color: kpi.winRate6m >= 60 ? 'text-emerald-600' : kpi.winRate6m >= 40 ? 'text-amber-600' : 'text-red-600',
      value: `${kpi.winRate6m}%`, sub: undefined,
    },
    isCeo && kpi.top5CustomerPct !== null && {
      icon: Users, label: 'Top 5 Customer', color: kpi.top5CustomerPct > 70 ? 'text-red-600' : 'text-muted-foreground',
      value: `${kpi.top5CustomerPct}%`, sub: 'ของยอดขายทั้งหมด',
    },
  ].filter(Boolean) as Chip[];

  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 animate-stagger-fast">
      {chips.map((c, i) => <QuickStatChip key={i} {...c} />)}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

function ForecastVsTargetCard({ data, period, onPeriodChange, onSaveTarget, canEditTarget }: {
  data: AdvancedData['forecastVsTarget'];
  period: Period;
  onPeriodChange: (p: Period) => void;
  onSaveTarget: (year: number, month: number, target: number) => Promise<void>;
  canEditTarget?: boolean;
}) {
  const rows = period === 'monthly' ? data.monthly : period === 'quarterly' ? data.quarterly : [data.yearly as FvtMonth];
  type ChartRow = { label: string; actual: number; target: number; forecast: number };
  const allMonthly = period === 'monthly' ? [...data.monthly, ...(data.forecastMonths ?? [])] : null;
  const flatRows = allMonthly ?? (period === 'quarterly' ? data.quarterly : [data.yearly as unknown as FvtMonth]);
  const chartData: ChartRow[] = flatRows.map((r) => ({ label: r.label ?? String(r.year ?? ''), actual: r.actual, target: r.target ?? 0, forecast: r.forecast }));
  const futureSplit = period === 'monthly' ? data.monthly.length : undefined;
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
  const [saving, setSaving] = useState(false);
  const handleSave = async (r: FvtMonth) => {
    const n = parseFloat(editVal);
    if (isNaN(n) || n < 0) { toast.error('กรอกตัวเลขที่ถูกต้อง'); return; }
    setSaving(true);
    try { await onSaveTarget(r.year, r.month, n); setEditIdx(null); }
    finally { setSaving(false); }
  };
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5"><Target className="h-4 w-4 text-indigo-500" />Forecast vs เป้าหมาย</h2>
          <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-0.5">
            {(['monthly', 'quarterly', 'yearly'] as Period[]).map((p) => (
              <button key={p} onClick={() => onPeriodChange(p)} className={cn('px-2.5 py-1 rounded-md text-xs font-medium transition-colors', period === p ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {p === 'monthly' ? 'รายเดือน' : p === 'quarterly' ? 'รายไตรมาส' : 'รายปี'}
              </button>
            ))}
          </div>
        </div>
        <BarComboChart data={chartData} labelKey="label" actualKey="actual" targetKey="target" forecastKey="forecast" futureSplit={futureSplit} />
        <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground justify-end">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-500 inline-block" />ยอดจริง</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-300 inline-block" />Forecast</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400 inline-block" />เป้าหมาย</span>
        </div>
        {period === 'monthly' && (
          <div className="mt-4 space-y-1 max-h-64 overflow-y-auto">
            {data.monthly.slice(-6).reverse().map((m, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/30">
                <span className="w-14 text-xs font-semibold shrink-0">{m.label}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-muted-foreground">จริง: <span className="font-semibold text-foreground">{short(m.actual)}</span></span>
                    {m.achievePct !== null && (
                      <span className={cn('font-semibold', m.achievePct >= 100 ? 'text-emerald-600' : m.achievePct >= 80 ? 'text-amber-600' : 'text-red-500')}>{m.achievePct}%</span>
                    )}
                  </div>
                  {m.target !== null && (
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all duration-700', m.achievePct && m.achievePct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500')} style={{ width: `${Math.min(100, m.achievePct ?? 0)}%` }} />
                    </div>
                  )}
                </div>
                {canEditTarget && editIdx === i ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <input type="number" min="0" value={editVal} onChange={(e) => setEditVal(e.target.value)} autoFocus className="w-24 h-6 rounded border border-input bg-background px-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring" />
                    <button onClick={() => handleSave(m)} disabled={saving} className="h-6 w-6 flex items-center justify-center rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </button>
                    <button onClick={() => setEditIdx(null)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"><X className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-muted-foreground">{m.target != null ? `เป้า ${short(m.target)}` : 'ไม่มีเป้า'}</span>
                    {canEditTarget && (
                      <button onClick={() => { setEditVal(m.target?.toString() ?? ''); setEditIdx(i); }} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground">
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {period !== 'monthly' && (
          <div className="mt-3 space-y-2">
            {rows.slice(0, 6).map((r, i) => {
              const row = r as FvtMonth;
              const pct = row.achievePct;
              return (
                <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-muted/30">
                  <span className="w-20 text-xs font-semibold shrink-0">{row.label ?? String(row.year)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span>จริง: <span className="font-semibold">{short(row.actual)}</span></span>
                      {row.target != null && <span className="text-muted-foreground">เป้า: {short(row.target)}</span>}
                    </div>
                    {row.target != null && (
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', pct && pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500')} style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
                      </div>
                    )}
                  </div>
                  {pct !== null && <span className={cn('text-xs font-bold w-10 text-right shrink-0', pct >= 100 ? 'text-emerald-600' : pct >= 80 ? 'text-amber-600' : 'text-red-500')}>{pct}%</span>}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Conversion Funnel — shows both Overall Conversion and Stage-to-Stage Conversion
function ConversionFunnelCard({ data }: { data: FunnelStep[] }) {
  const maxCount = data[0]?.count ?? 1;
  const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#06b6d4'];
  return (
    <Card>
      <CardContent className="pt-5">
        <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
          <TrendingUp className="h-4 w-4 text-purple-500" />Conversion Funnel (12 เดือน)
        </h2>
        <p className="text-[10px] text-muted-foreground mb-3">Overall = จากขั้นแรก · Stage = จากขั้นก่อนหน้า</p>
        <div className="space-y-4">
          {data.map((step, i) => (
            <div key={i}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i] }} />
                  <span className="font-semibold">{step.label}</span>
                  <span className="text-muted-foreground">{step.count} รายการ · {short(step.value)}</span>
                </div>
                {i > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Overall {step.conversionFromFirst}%</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold', step.conversionFromPrev >= 70 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : step.conversionFromPrev >= 40 ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400')}>
                      Stage {step.conversionFromPrev}%
                    </span>
                  </div>
                )}
              </div>
              <div className="h-7 bg-muted/40 rounded-lg overflow-hidden relative">
                <div className="h-full rounded-lg transition-all duration-700 flex items-center justify-end pr-2"
                  style={{ width: `${Math.max(4, (step.count / maxCount) * 100)}%`, backgroundColor: COLORS[i] + 'cc' }}>
                  <span className="text-[10px] text-white font-semibold">{step.conversionFromFirst}%</span>
                </div>
              </div>
              {i < data.length - 1 && (
                <div className="flex items-center gap-1 mt-1 pl-3">
                  <div className="w-px h-3 bg-border mx-1" />
                  <span className="text-[10px] text-muted-foreground">
                    {data[i].label} → {data[i + 1].label}: <span className="font-semibold">{data[i + 1].conversionFromPrev}%</span>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DealsAtRiskCard({ data }: { data: DealRisk[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? data : data.slice(0, 6);
  if (data.length === 0) return (
    <Card><CardContent className="pt-5">
      <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-3"><ShieldAlert className="h-4 w-4 text-red-500" />Deals At Risk</h2>
      <div className="text-center py-6 text-sm text-muted-foreground">ไม่มีดีลที่มีความเสี่ยงในขณะนี้ ✅</div>
    </CardContent></Card>
  );

  function RiskScoreBadge({ score }: { score: number }) {
    const color = score >= 70 ? 'bg-red-500' : score >= 45 ? 'bg-amber-500' : 'bg-blue-500';
    return (
      <div className="flex items-center gap-1 shrink-0">
        <div className="h-1.5 w-12 bg-muted rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full', color)} style={{ width: `${score}%` }} />
        </div>
        <span className={cn('text-[10px] font-bold w-6 text-right', score >= 70 ? 'text-red-600' : score >= 45 ? 'text-amber-600' : 'text-blue-600')}>{score}</span>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4 text-red-500" />Deals At Risk
            <Badge variant="destructive" className="text-[10px] h-4 px-1.5">{data.length}</Badge>
          </h2>
          <span className="text-[10px] text-muted-foreground">Risk Score 0–100</span>
        </div>
        <div className="space-y-1.5">
          {displayed.map((d) => (
            <Link key={d.id} href={`/quotations/${d.id}`}
              className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/50 hover:border-border hover:bg-muted/30 transition-all group">
              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 min-w-[42px] text-center', RISK_COLOR[d.riskLevel])}>{d.riskLevel}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{d.quotationNo}</span>
                  <span className="text-[10px] text-muted-foreground truncate">{d.customerCompany}</span>
                </div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                  <span>{RISK_LABEL_TH[d.riskType] ?? d.riskType}</span>
                  {d.daysUntilExpiry !== null && <span className="text-red-500">· หมดอายุใน {d.daysUntilExpiry} วัน</span>}
                  <span>· ไม่มีการอัปเดต {d.daysSinceUpdate} วัน</span>
                  <span className="text-muted-foreground/60">· เปิด {d.daysOpen} วัน</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="text-xs font-bold">{short(d.grandTotal)}</div>
                <RiskScoreBadge score={d.riskScore} />
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
            </Link>
          ))}
        </div>
        {data.length > 6 && (
          <button onClick={() => setShowAll((v) => !v)} className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground py-1.5 transition-colors">
            {showAll ? 'ย่อ' : `ดูทั้งหมด ${data.length} รายการ`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function ForecastAccuracyCard({ data }: { data: AccuracyMonth[] }) {
  const accuracyMonths = data.filter((m) => m.accuracy !== null);
  const avgAcc = accuracyMonths.length > 0
    ? Math.round(accuracyMonths.reduce((s, m) => s + (m.accuracy ?? 0), 0) / accuracyMonths.length)
    : null;
  const hasData = accuracyMonths.length > 0;
  const chartData = data.map((m) => ({ label: m.label, value: m.accuracy ?? 0, value2: null }));
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5"><Target className="h-4 w-4 text-emerald-500" />Forecast Accuracy</h2>
          {avgAcc !== null
            ? <span className={cn('text-sm font-bold', avgAcc >= 80 ? 'text-emerald-600' : avgAcc >= 60 ? 'text-amber-600' : 'text-red-600')}>avg {avgAcc}%</span>
            : <span className="text-sm font-bold text-muted-foreground">N/A</span>
          }
        </div>
        {!hasData ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            {data.length === 0 ? 'ตั้งเป้าหมายก่อนเพื่อดู Accuracy' : 'ข้อมูลยอดขายไม่เพียงพอในการคำนวณ'}
          </div>
        ) : (
          <>
            <AreaLineChart data={chartData} color="#10b981" yMax={100} />
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {accuracyMonths.slice(-4).reverse().map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-12 font-semibold shrink-0">{m.label}</span>
                  <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                    <div className={cn('h-full rounded-full', (m.accuracy ?? 0) >= 80 ? 'bg-emerald-500' : (m.accuracy ?? 0) >= 60 ? 'bg-amber-500' : 'bg-red-500')}
                      style={{ width: `${m.accuracy ?? 0}%` }} />
                  </div>
                  <span className={cn('w-10 text-right font-bold shrink-0', (m.accuracy ?? 0) >= 80 ? 'text-emerald-600' : (m.accuracy ?? 0) >= 60 ? 'text-amber-600' : 'text-red-600')}>
                    {m.accuracy != null ? `${m.accuracy}%` : 'N/A'}
                  </span>
                  {m.targetAchievement != null && <span className="text-[10px] text-muted-foreground shrink-0">({m.targetAchievement}%เป้า)</span>}
                </div>
              ))}
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground flex items-start gap-1">
              <Info className="h-3 w-3 shrink-0 mt-px" />
              Accuracy = 1 − |Forecast − Actual| / Actual · เทียบ Forecast กับยอดจริง
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const RANK_STYLE = ['bg-amber-400 text-white', 'bg-slate-400 text-white', 'bg-amber-700 text-white'];

function WinRatePill({ winRate, closedDeals, lowSample }: { winRate: number | null; closedDeals: number; lowSample: boolean }) {
  if (winRate === null || closedDeals === 0) return <span className="text-[10px] text-muted-foreground italic">ยังไม่มีผล</span>;
  const color = lowSample ? 'border-border text-muted-foreground'
    : winRate >= 70 ? 'border-emerald-400 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
    : winRate >= 50 ? 'border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
    : 'border-red-400 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
  return (
    <span className={cn('inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0', color)}>
      Win {winRate}%{lowSample && <span className="opacity-60 font-normal">({closedDeals})</span>}
    </span>
  );
}

function TopSalesCard({ data }: { data: SalesPerf[] }) {
  if (data.length === 0) return null;
  const maxRev = Math.max(...data.map((s) => s.actualRevenue), 1);
  return (
    <Card>
      <CardContent className="pt-5">
        <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-4">
          <Users className="h-4 w-4 text-blue-500" />Top Sales Performance
          <span className="text-[10px] font-normal text-muted-foreground">(12 เดือน)</span>
        </h2>
        <div className="flex items-center gap-3 pb-2 mb-1 border-b text-[10px] text-muted-foreground uppercase tracking-wider">
          <span className="w-5 shrink-0" />
          <span className="flex-1">ชื่อ</span>
          <span className="w-20 text-right shrink-0">ยอดขาย</span>
          <span className="w-16 text-right shrink-0">Avg Deal</span>
          <span className="w-24 text-right shrink-0">Win Rate</span>
        </div>
        <div className="divide-y divide-border/50">
          {data.map((s, i) => {
            const revPct = maxRev > 0 ? (s.actualRevenue / maxRev) * 100 : 0;
            return (
              <div key={s.userId} className="py-3 space-y-2">
                <div className="flex items-center gap-3">
                  <span className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0', RANK_STYLE[i] ?? 'bg-muted text-muted-foreground')}>{i + 1}</span>
                  <span className="flex-1 font-semibold text-sm truncate">{s.name}</span>
                  <span className="w-20 text-right font-bold text-sm shrink-0">
                    {s.actualRevenue > 0 ? formatMoney(s.actualRevenue) : <span className="text-muted-foreground font-normal text-xs">-</span>}
                  </span>
                  <span className="w-16 text-right text-xs text-muted-foreground shrink-0">
                    {s.avgDealSize > 0 ? short(s.avgDealSize) : '-'}
                  </span>
                  <span className="w-24 flex justify-end shrink-0">
                    <WinRatePill winRate={s.winRate} closedDeals={s.closedDeals} lowSample={s.lowSample} />
                  </span>
                </div>
                <div className="flex items-center gap-2 pl-9">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-700', i === 0 ? 'bg-indigo-500' : 'bg-indigo-400/70')} style={{ width: `${revPct}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-9 flex-wrap">
                  <StatChip label="QT ทั้งหมด" value={s.quotationCount} color="text-foreground" />
                  <span className="text-muted-foreground/40">·</span>
                  <StatChip label="ปิด SO" value={s.saleOrderCount} color={s.saleOrderCount > 0 ? 'text-emerald-600' : 'text-muted-foreground'} />
                  <StatChip label="ไม่ผ่าน" value={s.lostCount} color={s.lostCount > 0 ? 'text-red-500' : 'text-muted-foreground'} />
                  <span className="text-muted-foreground/40">·</span>
                  <StatChip label="Pipeline" value={s.pipelineCount} color="text-blue-600" />
                  <StatChip label="รอพิจารณา" value={s.pendingCount} color="text-amber-600" />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t text-[10px] text-muted-foreground flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
          Win Rate = SO ÷ (SO + ไม่ผ่าน) · Avg Deal = มูลค่าเฉลี่ยต่อ SO · ตัวเลขวงเล็บ = จำนวน Deal (น้อยกว่า 3 = ข้อมูลน้อย)
        </div>
      </CardContent>
    </Card>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="flex items-center gap-0.5 text-[11px]">
      <span className={cn('font-bold', color)}>{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function TrendCard({ revData, winData }: { revData: TrendMonth[]; winData: WinRateTrendItem[] }) {
  const latestMom = revData.filter((m) => m.momGrowth !== null).slice(-1)[0];
  const latestYoy = revData.filter((m) => m.yoyGrowth !== null).slice(-1)[0];
  const momExtreme = latestMom?.momIsExtreme;
  const revChartData = revData.map((m) => ({ label: m.label, value: m.actual, value2: m.prevYearActual }));
  const wrChartData = winData.map((m) => ({ label: m.label, value: m.winRate ?? 0 }));
  const withWrData = winData.filter((m) => m.winRate !== null);
  const avg = withWrData.length > 0 ? Math.round(withWrData.reduce((s, m) => s + (m.winRate ?? 0), 0) / withWrData.length) : null;
  const winMap = new Map(winData.map((m) => [m.label, m]));

  return (
    <Card>
      <CardContent className="pt-5">
        {/* Header — รวม title + stats ทั้ง 2 ชุดไว้แถวเดียว */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-blue-500" />Revenue &amp; Win Rate Trend
          </h2>
          <div className="flex items-center gap-3 text-xs flex-wrap">
            {latestMom?.momGrowth != null && (
              <span className={cn('flex items-center gap-0.5 font-semibold', latestMom.momGrowth >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {latestMom.momGrowth >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                MoM {momExtreme ? '↑↑ Very High' : `${latestMom.momGrowth >= 0 ? '+' : ''}${latestMom.momGrowth}%`}
                {momExtreme && <span className="text-[10px] text-muted-foreground ml-1" title="ยอดเดือนก่อนต่ำมาก ทำให้ % สูงผิดปกติ">(prev≈0)</span>}
              </span>
            )}
            {latestYoy?.yoyGrowth != null && (
              <span className={cn('flex items-center gap-0.5 font-semibold', latestYoy.yoyGrowth >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {latestYoy.yoyGrowth >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                YoY {latestYoy.yoyGrowth >= 0 ? '+' : ''}{latestYoy.yoyGrowth}%
              </span>
            )}
            {avg !== null && (
              <span className={cn('flex items-center gap-0.5 font-semibold', avg >= 60 ? 'text-emerald-600' : avg >= 40 ? 'text-amber-600' : 'text-red-600')}>
                <Activity className="h-3 w-3" />Win Rate avg {avg}%
              </span>
            )}
          </div>
        </div>

        {/* Revenue chart */}
        <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-indigo-500 inline-block" />Revenue
          <span className="flex items-center gap-1 ml-auto">
            <span className="h-2 w-4 rounded bg-indigo-400 inline-block" />ปีนี้
          </span>
          <span className="flex items-center gap-1">
            <span className="h-px w-4 border-t-2 border-dashed border-slate-400 inline-block" />ปีที่แล้ว
          </span>
        </div>
        <AreaLineChart data={revChartData} color="#6366f1" />

        {/* Win Rate chart */}
        <div className="text-[10px] text-muted-foreground mt-4 mb-1 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />Win Rate %
        </div>
        <AreaLineChart data={wrChartData} color="#10b981" yMax={100} />

        {/* Summary grid รวม — label เดือนแสดงครั้งเดียว พร้อม Revenue + Win Rate */}
        <div className="mt-3 pt-3 border-t grid grid-cols-4 gap-2">
          {revData.slice(-4).map((m) => {
            const wr = winMap.get(m.label);
            return (
              <div key={m.label} className="text-center space-y-0.5">
                <div className="text-[10px] text-muted-foreground">{m.label}</div>
                <div className="text-xs font-bold">{short(m.actual)}</div>
                <div className="flex items-center justify-center gap-0.5 text-[10px]">
                  {m.trend === 'UP' ? <ArrowUpRight className="h-3 w-3 text-emerald-500" /> : m.trend === 'DOWN' ? <ArrowDownRight className="h-3 w-3 text-red-500" /> : <Minus className="h-3 w-3 text-muted-foreground" />}
                  <span className={cn(m.trend === 'UP' ? 'text-emerald-600' : m.trend === 'DOWN' ? 'text-red-600' : 'text-muted-foreground')}>
                    {m.momIsExtreme ? '↑↑' : m.momGrowth != null ? `${m.momGrowth >= 0 ? '+' : ''}${m.momGrowth}%` : '-'}
                  </span>
                </div>
                <div className="border-t border-dashed border-muted pt-0.5">
                  <div className={cn('text-[10px] font-semibold', wr?.winRate == null ? 'text-muted-foreground' : wr.winRate >= 60 ? 'text-emerald-600' : wr.winRate >= 40 ? 'text-amber-600' : 'text-red-600')}>
                    {wr?.winRate != null ? `${wr.winRate}%` : '-'}
                  </div>
                  <div className="text-[9px] text-muted-foreground">{wr ? `${wr.won}W ${wr.lost}L` : ''}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2 text-[10px] text-muted-foreground flex items-start gap-1">
          <Info className="h-3 w-3 shrink-0 mt-px" />
          Win Rate = SO ÷ (SO + REJECTED/CANCELLED/EXPIRED) รายเดือน
        </div>
      </CardContent>
    </Card>
  );
}

function PipelineHealthCard({ data }: { data: PipelineHealth }) {
  const [tab, setTab] = useState<PipelineTab>('status');
  const coverageColor = data.coverageRatio == null ? '' : data.coverageRatio >= 3 ? 'text-emerald-600' : data.coverageRatio >= 1.5 ? 'text-amber-600' : 'text-red-600';
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-purple-500" />Pipeline Health</h2>
          <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-0.5">
            {(['status', 'sales', 'customer'] as PipelineTab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cn('px-2 py-0.5 rounded-md text-xs font-medium transition-colors', tab === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {t === 'status' ? 'สถานะ' : t === 'sales' ? 'Sales' : 'ลูกค้า'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="text-[10px] text-muted-foreground">Pipeline รวม</div>
            <div className="text-sm font-bold text-purple-600">{short(data.total)}</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="text-[10px] text-muted-foreground">Weighted Pipeline</div>
            <div className="text-sm font-bold text-indigo-600">{short(data.weighted)}</div>
            <div className="text-[10px] text-muted-foreground">Deal × Probability</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="text-[10px] text-muted-foreground">Coverage Ratio</div>
            <div className={cn('text-sm font-bold', coverageColor)}>{data.coverageRatio != null ? `${data.coverageRatio}×` : '-'}</div>
            <div className="text-[10px] text-muted-foreground">vs {data.coverageBase === 'target' ? 'เป้าเดือนนี้' : 'avg 6m'}</div>
          </div>
        </div>
        {tab === 'status' && (
          <div className="space-y-2">
            {data.byStatus.map((s) => (
              <div key={s.status} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLOR[s.status] ?? '#94a3b8' }} />
                <span className="text-xs flex-1">{STATUS_LABEL[s.status] ?? s.status}</span>
                <span className="text-[10px] text-muted-foreground w-8 text-right">{s.count}</span>
                <span className="text-[10px] text-muted-foreground w-8 text-right">{s.probability}%</span>
                <span className="text-xs font-semibold w-16 text-right">{short(s.value)}</span>
                <span className="text-[10px] text-muted-foreground w-14 text-right">→{short(s.weightedValue)}</span>
              </div>
            ))}
            <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1 pt-2 border-t">
              <Info className="h-3 w-3 shrink-0" /> Weighted = Value × Probability
            </div>
          </div>
        )}
        {tab === 'sales' && (
          <div className="space-y-2">
            {data.bySales.slice(0, 8).map((s) => {
              const pct = data.total > 0 ? (s.value / data.total) * 100 : 0;
              return (
                <div key={s.userId}>
                  <div className="flex items-center gap-2 text-xs mb-0.5">
                    <span className="flex-1 truncate font-medium">{s.name}</span>
                    <span className="text-muted-foreground shrink-0">{s.count} รายการ</span>
                    <span className="font-semibold shrink-0">{short(s.value)}</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {tab === 'customer' && (
          <div className="space-y-2">
            {data.byCustomer.map((c, i) => {
              const pct = data.total > 0 ? (c.value / data.total) * 100 : 0;
              return (
                <div key={i}>
                  <div className="flex items-center gap-2 text-xs mb-0.5">
                    <span className="flex-1 truncate font-medium">{c.company}</span>
                    <span className="font-semibold">{short(c.value)}</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TopOpportunitiesCard({ data }: { data: Opportunity[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? data : data.slice(0, 6);
  return (
    <Card>
      <CardContent className="pt-5">
        <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
          <AlertTriangle className="h-4 w-4 text-amber-500" />Top Opportunities
        </h2>
        <div className="space-y-1.5">
          {displayed.map((o, i) => (
            <Link key={o.id} href={`/quotations/${o.id}`}
              className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 hover:border-border hover:bg-muted/30 transition-all group">
              <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold">{o.quotationNo}</span>
                  <span className="text-[10px] text-muted-foreground truncate">{o.customerCompany}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLOR[o.status] }} />
                  <span className="text-[10px] text-muted-foreground">{STATUS_LABEL[o.status]}</span>
                  <span className="text-[10px] text-muted-foreground">· {o.salesName}</span>
                  <span className="text-[10px] text-muted-foreground">· {o.daysOpen}d</span>
                  {o.riskScore >= 50 && (
                    <span className={cn('text-[10px] font-bold', o.riskLevel === 'HIGH' ? 'text-red-500' : 'text-amber-500')}>
                      Risk {o.riskScore}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-bold">{short(o.grandTotal)}</div>
                <div className={cn('text-[10px] font-semibold', o.probability >= 70 ? 'text-emerald-600' : o.probability >= 40 ? 'text-amber-600' : 'text-red-600')}>
                  {o.probability}% · {short(o.forecastValue)}
                </div>
                {o.expiryDate && (
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(o.expiryDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                  </div>
                )}
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground shrink-0" />
            </Link>
          ))}
        </div>
        {data.length > 6 && (
          <button onClick={() => setShowAll((v) => !v)} className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground py-1.5 transition-colors">
            {showAll ? 'ย่อ' : `ดูทั้งหมด ${data.length} รายการ`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function AgingPipelineCard({ data }: { data: AdvancedData['agingPipeline'] }) {
  const [showItems, setShowItems] = useState(false);
  const totalVal = data.buckets.reduce((s, b) => s + b.value, 0);
  const BUCKET_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];
  const dangerItems = data.items.filter((i) => i.ageDays > 60);
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-orange-500" />Aging Pipeline
            {dangerItems.length > 0 && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">{dangerItems.length} ค้างนาน</Badge>}
          </h2>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {data.buckets.map((b, i) => (
            <div key={i} className="text-center p-2 rounded-lg bg-muted/30">
              <div className="text-[10px] text-muted-foreground leading-tight">{b.label}</div>
              <div className="text-sm font-bold" style={{ color: BUCKET_COLORS[i] }}>{b.count}</div>
              <div className="text-[10px] font-semibold" style={{ color: BUCKET_COLORS[i] }}>{b.pct}%</div>
              <div className="text-[10px] text-muted-foreground">{short(b.value)}</div>
            </div>
          ))}
        </div>
        {totalVal > 0 && (
          <div className="h-3 rounded-full overflow-hidden flex gap-0.5 mb-3">
            {data.buckets.map((b, i) => b.value > 0 && (
              <div key={i} className="h-full rounded-sm transition-all" style={{ width: `${(b.value / totalVal) * 100}%`, backgroundColor: BUCKET_COLORS[i] + 'cc' }}>
                <title>{b.label}: {short(b.value)} ({b.pct}%)</title>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => setShowItems((v) => !v)} className="w-full text-xs text-muted-foreground hover:text-foreground py-1 transition-colors">
          {showItems ? 'ซ่อนรายการ' : `ดูรายการ (${data.items.length})`}
        </button>
        {showItems && (
          <div className="mt-2 space-y-1 max-h-52 overflow-y-auto">
            {data.items.map((item) => (
              <Link key={item.id} href={`/quotations/${item.id}`}
                className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/30 transition-colors group">
                <span className={cn('text-[10px] font-bold w-12 shrink-0', item.ageDays > 90 ? 'text-red-600' : item.ageDays > 60 ? 'text-orange-600' : item.ageDays > 30 ? 'text-amber-600' : 'text-emerald-600')}>
                  {item.ageDays}d
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold">{item.quotationNo}</span>
                  <span className="text-[10px] text-muted-foreground ml-1.5 truncate">{item.customerCompany}</span>
                </div>
                <span className="text-xs font-semibold shrink-0">{short(item.grandTotal)}</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-foreground shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CustomerConcentrationCard({ data, totalRevenue }: { data: CustomerConcentration[]; totalRevenue: number }) {
  if (data.length === 0) return null;
  const top5Total = data.slice(0, 5).reduce((s, c) => s + c.pct, 0);
  const isHighRisk = top5Total > 70;
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Users className="h-4 w-4 text-violet-500" />Customer Concentration
          </h2>
          <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', isHighRisk ? 'bg-red-50 text-red-600 dark:bg-red-900/20' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20')}>
            Top 5 = {top5Total}% {isHighRisk ? '⚠ Risk' : '✓ OK'}
          </span>
        </div>
        <div className="space-y-2">
          {data.slice(0, 8).map((c, i) => (
            <div key={i}>
              <div className="flex items-center gap-2 text-xs mb-0.5">
                <span className="text-muted-foreground w-4 shrink-0">{i + 1}</span>
                <span className="flex-1 truncate font-medium">{c.company}</span>
                <span className="text-muted-foreground shrink-0">{short(c.total)}</span>
                <span className={cn('font-bold w-10 text-right shrink-0', i < 5 && top5Total > 70 ? 'text-red-600' : 'text-foreground')}>{c.pct}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', i < 3 ? 'bg-violet-500' : 'bg-violet-300')} style={{ width: `${c.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t text-[10px] text-muted-foreground flex items-start gap-1">
          <Info className="h-3 w-3 shrink-0 mt-px" />
          {isHighRisk ? 'ความเสี่ยงสูง: Top 5 ลูกค้าคิดเป็น >70% ของยอดขายทั้งหมด' : 'กระจายความเสี่ยงลูกค้าอยู่ในระดับที่ดี'}
        </div>
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function ForecastPage() {
  const { role } = usePermissions();
  const roleCode = role?.code ?? 'OFFICER';

  const [data, setData] = useState<AdvancedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('monthly');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<AdvancedData>>('/forecast/advanced');
      setData(res.data.data ?? null);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveTarget = async (year: number, month: number, target: number) => {
    await api.post('/forecast/targets', { year, month, target });
    toast.success('บันทึกเป้าหมายแล้ว');
    await load();
  };

  if (loading) return (
    <div className="space-y-5 max-w-6xl">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-12" />
      <Skeleton className="h-64" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
    </div>
  );

  if (!data) return <div className="text-center py-20 text-muted-foreground">ไม่สามารถโหลดข้อมูลได้</div>;

  const { forecastVsTarget, conversionFunnel, dealsAtRisk, forecastAccuracy, topSalesPerformance, revenueTrend, pipelineHealth, topOpportunities, agingPipeline, winRateTrend, kpiSummary, customerConcentration } = data;

  const currentM = forecastVsTarget.monthly[forecastVsTarget.monthly.length - 1];
  const latestTrend = revenueTrend[revenueTrend.length - 1];
  const accuracyMonths = forecastAccuracy.filter((m) => m.accuracy !== null);
  const avgAcc = accuracyMonths.length > 0
    ? Math.round(accuracyMonths.reduce((s, m) => s + (m.accuracy ?? 0), 0) / accuracyMonths.length)
    : null;

  const isOfficer = roleCode === 'OFFICER';
  const isManager = roleCode === 'MANAGER';
  const isCeo = roleCode === 'CEO' || roleCode === 'ADMIN';

  // ── KPI card definitions per role ────────────────────────────────────────
  const kpiCards = isCeo ? [
    {
      label: 'ยอดจริงเดือนนี้',
      value: <span className="text-xl font-bold text-primary">
        <AnimatedCounter value={currentM?.actual ?? 0} format={short} />
      </span>,
      sub: currentM?.achievePct != null ? <span className={cn('text-[11px]', currentM.achievePct >= 100 ? 'text-emerald-600' : 'text-amber-600')}>
        <AnimatedCounter value={currentM.achievePct} format={(n) => `${Math.round(n)}% ของเป้า`} />
      </span> : null,
    },
    {
      label: `Forecast Gap (${forecastVsTarget.forecastMonths[0]?.label ?? 'เดือนหน้า'})`,
      value: kpiSummary.forecastGap != null
        ? <span className={cn('text-xl font-bold', kpiSummary.forecastGap >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {kpiSummary.forecastGap >= 0 ? '+' : '-'}<AnimatedCounter value={Math.abs(kpiSummary.forecastGap)} format={short} />
          </span>
        : <span className="text-xl font-bold text-muted-foreground">N/A</span>,
      sub: kpiSummary.forecastGapPct != null
        ? <span className={cn('text-[11px]', kpiSummary.forecastGapPct >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {kpiSummary.forecastGapPct >= 0 ? '+' : ''}{kpiSummary.forecastGapPct}% vs เป้า
          </span>
        : null,
    },
    {
      label: 'Coverage Ratio',
      value: <span className={cn('text-xl font-bold', pipelineHealth.coverageRatio == null ? '' : pipelineHealth.coverageRatio >= 3 ? 'text-emerald-600' : pipelineHealth.coverageRatio >= 1.5 ? 'text-amber-600' : 'text-red-600')}>
        {pipelineHealth.coverageRatio != null
          ? <AnimatedCounter value={pipelineHealth.coverageRatio} decimals={1} format={(n) => `${n.toFixed(1)}×`} />
          : '-'}
      </span>,
      sub: <span className="text-[11px] text-muted-foreground">Weighted ÷ {pipelineHealth.coverageBase === 'target' ? 'เป้าเดือนนี้' : 'avg 6m'}</span>,
    },
    {
      label: 'Forecast Accuracy',
      value: avgAcc != null
        ? <span className={cn('text-xl font-bold', avgAcc >= 80 ? 'text-emerald-600' : avgAcc >= 60 ? 'text-amber-600' : 'text-red-600')}>
            <AnimatedCounter value={avgAcc} format={(n) => `${Math.round(n)}%`} />
          </span>
        : <span className="text-xl font-bold text-muted-foreground">N/A</span>,
      sub: <span className="text-[11px] text-muted-foreground">{avgAcc != null ? 'avg 12 เดือน' : 'ข้อมูลไม่เพียงพอ'}</span>,
    },
  ] : isManager ? [
    {
      label: 'ยอดจริงเดือนนี้',
      value: <span className="text-xl font-bold text-primary">
        <AnimatedCounter value={currentM?.actual ?? 0} format={short} />
      </span>,
      sub: currentM?.achievePct != null ? <span className={cn('text-[11px]', currentM.achievePct >= 100 ? 'text-emerald-600' : 'text-amber-600')}>
        <AnimatedCounter value={currentM.achievePct} format={(n) => `${Math.round(n)}% ของเป้า`} />
      </span> : null,
    },
    {
      label: 'Pipeline Weighted',
      value: <span className="text-xl font-bold text-purple-600">
        <AnimatedCounter value={pipelineHealth.weighted} format={short} />
      </span>,
      sub: pipelineHealth.coverageRatio != null ? <span className="text-[11px] text-muted-foreground">Coverage {pipelineHealth.coverageRatio}×</span> : null,
    },
    {
      label: 'Deals At Risk',
      value: <span className={cn('text-xl font-bold', dealsAtRisk.length > 0 ? 'text-red-600' : 'text-emerald-600')}>
        <AnimatedCounter value={dealsAtRisk.length} />
      </span>,
      sub: <span className="text-[11px] text-muted-foreground">{dealsAtRisk.filter((d) => d.riskLevel === 'HIGH').length} HIGH · {dealsAtRisk.filter((d) => d.riskLevel === 'MEDIUM').length} MEDIUM</span>,
    },
    {
      label: 'Win Rate (6m)',
      value: kpiSummary.winRate6m != null
        ? <span className={cn('text-xl font-bold', kpiSummary.winRate6m >= 60 ? 'text-emerald-600' : kpiSummary.winRate6m >= 40 ? 'text-amber-600' : 'text-red-600')}>
            <AnimatedCounter value={kpiSummary.winRate6m} format={(n) => `${Math.round(n)}%`} />
          </span>
        : <span className="text-xl font-bold text-muted-foreground">N/A</span>,
      sub: <span className="text-[11px] text-muted-foreground">SO ÷ (SO + Lost)</span>,
    },
  ] : [
    {
      label: 'ยอดจริงเดือนนี้',
      value: <span className="text-xl font-bold text-primary">
        <AnimatedCounter value={currentM?.actual ?? 0} format={short} />
      </span>,
      sub: currentM?.achievePct != null ? <span className={cn('text-[11px]', currentM.achievePct >= 100 ? 'text-emerald-600' : 'text-amber-600')}>
        <AnimatedCounter value={currentM.achievePct} format={(n) => `${Math.round(n)}% ของเป้า`} />
      </span> : null,
    },
    {
      label: 'Pipeline Weighted',
      value: <span className="text-xl font-bold text-purple-600">
        <AnimatedCounter value={pipelineHealth.weighted} format={short} />
      </span>,
      sub: null,
    },
    {
      label: 'Deals At Risk',
      value: <span className={cn('text-xl font-bold', dealsAtRisk.length > 0 ? 'text-red-600' : 'text-emerald-600')}>
        <AnimatedCounter value={dealsAtRisk.length} />
      </span>,
      sub: <span className="text-[11px] text-muted-foreground">{dealsAtRisk.filter((d) => d.riskLevel === 'HIGH').length} HIGH · {dealsAtRisk.filter((d) => d.riskLevel === 'MEDIUM').length} MEDIUM</span>,
    },
    {
      label: 'MoM Growth',
      value: <span className={cn('text-xl font-bold flex items-center gap-1', latestTrend?.trend === 'UP' ? 'text-emerald-600' : latestTrend?.trend === 'DOWN' ? 'text-red-600' : 'text-muted-foreground')}>
        {latestTrend?.trend === 'UP' ? <TrendingUp className="h-5 w-5" /> : latestTrend?.trend === 'DOWN' ? <TrendingDown className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
        {latestTrend?.momIsExtreme ? '↑↑ High' : latestTrend?.momGrowth != null ? `${latestTrend.momGrowth >= 0 ? '+' : ''}${latestTrend.momGrowth}%` : '-'}
      </span>,
      sub: <span className="text-[11px] text-muted-foreground">{latestTrend?.label ?? ''}</span>,
    },
  ];

  return (
    <div className="space-y-5 max-w-6xl">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary shrink-0" />
            <span className="page-heading">Sales Forecast</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {isOfficer ? 'ยอดขายและ pipeline ของคุณ' : isManager ? 'ภาพรวมทีม · Pipeline · Performance' : 'ภาพรวมบริษัท · Forecast · Accuracy'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <TrendingUp className="h-4 w-4" />รีเฟรช
        </Button>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-stagger">
        {kpiCards.map((kpi, i) => (
          <Card key={i} className="hover-glow stat-accent-card">
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-muted-foreground mb-1.5 font-medium">{kpi.label}</div>
              {kpi.value}
              {kpi.sub && <div className="mt-1">{kpi.sub}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Quick Stats Bar ──────────────────────────────────────────────── */}
      <KpiQuickStatsBar kpi={kpiSummary} isCeo={isCeo} />

      {/* ── Forecast vs Target ──────────────────────────────────────────── */}
      <ForecastVsTargetCard data={forecastVsTarget} period={period} onPeriodChange={setPeriod} onSaveTarget={handleSaveTarget} canEditTarget={!isOfficer} />

      {/* ── Funnel + Pipeline Health ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ConversionFunnelCard data={conversionFunnel} />
        <PipelineHealthCard data={pipelineHealth} />
      </div>

      {/* ── Deals At Risk + Top Opportunities ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DealsAtRiskCard data={dealsAtRisk} />
        <TopOpportunitiesCard data={topOpportunities} />
      </div>

      {/* ── Revenue + Win Rate Trend (Manager/CEO) ───────────────────────── */}
      {!isOfficer && <TrendCard revData={revenueTrend} winData={winRateTrend} />}

      {/* ── Forecast Accuracy + Aging ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(isManager || isCeo) && <ForecastAccuracyCard data={forecastAccuracy} />}
        <AgingPipelineCard data={agingPipeline} />
      </div>

      {/* ── Top Sales Performance (Manager/CEO) ─────────────────────────── */}
      {!isOfficer && topSalesPerformance.length > 0 && <TopSalesCard data={topSalesPerformance} />}

      {/* ── Customer Concentration (CEO only) ───────────────────────────── */}
      {isCeo && <CustomerConcentrationCard data={customerConcentration} totalRevenue={kpiSummary.totalRevenue12m} />}
    </div>
  );
}
