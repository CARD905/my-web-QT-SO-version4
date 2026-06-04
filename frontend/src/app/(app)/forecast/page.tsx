'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, Target, BarChart3, Users, Loader2,
  Pencil, Check, X, ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatMoney, cn } from '@/lib/utils';
import type { ApiResponse } from '@/types/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MonthlyData {
  label: string; year: number; month: number;
  actual: number; target: number | null; winRate: number | null;
  approved: number; rejected: number;
}
interface ForecastMonth {
  label: string; year: number; month: number;
  forecast: number; target: number | null;
}
interface PipelineStage { count: number; value: number; }
interface SummaryData {
  monthlyData: MonthlyData[];
  forecastMonths: ForecastMonth[];
  pipeline: { total: number; weighted: number; byStage: Record<string, PipelineStage>; count: number };
  winRate6m: number | null;
  movingAvg: number;
  currentMonth: MonthlyData;
  topCustomers: Array<{ company: string; total: number }>;
}

// ─── Formatters ───────────────────────────────────────────────────────────────
function shortMoney(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
}

// ════════════════════════════════════════════════════════════════════════════
// BAR CHART — actual vs target (last 12 months)
// ════════════════════════════════════════════════════════════════════════════
function RevenueBarChart({ data }: { data: MonthlyData[] }) {
  const W = 640; const H = 180; const PL = 52; const PR = 12; const PT = 12; const PB = 30;
  const cW = W - PL - PR; const cH = H - PT - PB;
  const maxVal = Math.max(...data.flatMap((d) => [d.actual, d.target ?? 0]), 1);
  const barW = cW / data.length;
  const gap = barW * 0.15;
  const actualW = barW * 0.42;
  const targetW = barW * 0.28;

  const yv = (v: number) => PT + cH - (v / maxVal) * cH;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 180 }}>
      <defs>
        <linearGradient id="fActualGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="fTargetGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {gridLines.map((t) => {
        const gy = PT + cH * (1 - t);
        return (
          <g key={t}>
            <line x1={PL} y1={gy} x2={W - PR} y2={gy} stroke="currentColor" strokeOpacity={0.07} strokeWidth={1} />
            <text x={PL - 6} y={gy + 4} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.45}>
              {shortMoney(maxVal * t)}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const x = PL + i * barW + gap;
        const ah = Math.max(2, (d.actual / maxVal) * cH);
        const th = d.target ? Math.max(2, (d.target / maxVal) * cH) : 0;
        const isCurrentMonth = i === data.length - 1;
        return (
          <g key={i}>
            {/* Actual bar */}
            <rect x={x} y={yv(d.actual)} width={actualW} height={ah}
              fill={isCurrentMonth ? '#6366f1' : 'url(#fActualGrad)'} rx={2}>
              <title>{d.label}: {formatMoney(d.actual)}</title>
            </rect>
            {/* Target bar */}
            {d.target != null && (
              <rect x={x + actualW + 2} y={yv(d.target)} width={targetW} height={th}
                fill="url(#fTargetGrad)" rx={2} opacity={0.85}>
                <title>เป้า {d.label}: {formatMoney(d.target)}</title>
              </rect>
            )}
            <text x={x + actualW / 2} y={H - 8} textAnchor="middle" fontSize={9}
              fill="currentColor" fillOpacity={isCurrentMonth ? 0.9 : 0.45} fontWeight={isCurrentMonth ? '600' : '400'}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// WIN RATE SPARK LINE
// ════════════════════════════════════════════════════════════════════════════
function WinRateLine({ data }: { data: MonthlyData[] }) {
  const pts = data.filter((d) => d.winRate !== null);
  if (pts.length < 2) return <div className="text-xs text-muted-foreground">ข้อมูลไม่เพียงพอ</div>;

  const W = 300; const H = 70; const PL = 28; const PR = 8; const PT = 6; const PB = 18;
  const cW = W - PL - PR; const cH = H - PT - PB;
  const xi = (i: number) => PL + (i / (pts.length - 1)) * cW;
  const yv = (v: number) => PT + cH - (v / 100) * cH;

  let pathD = `M ${xi(0)} ${yv(pts[0].winRate!)}`;
  for (let i = 1; i < pts.length; i++) {
    const cpx = (xi(i - 1) + xi(i)) / 2;
    pathD += ` C ${cpx} ${yv(pts[i - 1].winRate!)} ${cpx} ${yv(pts[i].winRate!)} ${xi(i)} ${yv(pts[i].winRate!)}`;
  }
  const areaD = `${pathD} L ${xi(pts.length - 1)} ${PT + cH} L ${xi(0)} ${PT + cH} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 70 }}>
      <defs>
        <linearGradient id="wrGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={PL} y1={yv(v)} x2={W - PR} y2={yv(v)} stroke="currentColor" strokeOpacity={0.06} strokeWidth={1} />
          <text x={PL - 4} y={yv(v) + 3} textAnchor="end" fontSize={8} fill="currentColor" fillOpacity={0.4}>{v}%</text>
        </g>
      ))}
      <path d={areaD} fill="url(#wrGrad)" />
      <path d={pathD} fill="none" stroke="#10b981" strokeWidth={2} strokeLinejoin="round" />
      {pts.map((d, i) => (
        <circle key={i} cx={xi(i)} cy={yv(d.winRate!)} r={3} fill="#10b981" stroke="white" strokeWidth={1.5}>
          <title>{d.label}: {d.winRate}%</title>
        </circle>
      ))}
      {pts.map((d, i) => (
        <text key={i} x={xi(i)} y={H - 4} textAnchor="middle" fontSize={8} fill="currentColor" fillOpacity={0.4}>
          {d.label}
        </text>
      ))}
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PIPELINE STAGE BADGE
// ════════════════════════════════════════════════════════════════════════════
const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  PENDING:           { label: 'รออนุมัติ',    color: '#f59e0b' },
  PENDING_ESCALATED: { label: 'Escalated',    color: '#f97316' },
  PENDING_BACKUP:    { label: 'Backup',       color: '#f97316' },
  APPROVED:          { label: 'อนุมัติแล้ว',  color: '#10b981' },
  PO_PENDING:        { label: 'รอ PO',        color: '#8b5cf6' },
  PO_APPROVED:       { label: 'PO อนุมัติ',   color: '#06b6d4' },
};
const STAGE_WEIGHTS: Record<string, number> = {
  PENDING: 25, PENDING_ESCALATED: 25, PENDING_BACKUP: 25,
  APPROVED: 70, PO_PENDING: 90, PO_APPROVED: 95,
};

// ════════════════════════════════════════════════════════════════════════════
// TARGET EDIT ROW
// ════════════════════════════════════════════════════════════════════════════
function TargetRow({ row, onSave }: {
  row: { label: string; year: number; month: number; forecast: number; target: number | null };
  onSave: (year: number, month: number, target: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(row.target?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const n = parseFloat(val);
    if (isNaN(n) || n < 0) { toast.error('กรอกตัวเลขที่ถูกต้อง'); return; }
    setSaving(true);
    try { await onSave(row.year, row.month, n); setEditing(false); }
    finally { setSaving(false); }
  };

  const diff = row.target != null ? row.forecast - row.target : null;
  const diffPct = row.target && row.target > 0 ? ((row.forecast - row.target) / row.target) * 100 : null;

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-colors">
      <div className="w-20 text-sm font-semibold">{row.label}</div>
      <div className="flex-1 text-sm text-muted-foreground">
        คาดการณ์ <span className="font-semibold text-foreground">{formatMoney(row.forecast)}</span>
      </div>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            type="number" min="0" step="1000"
            value={val} onChange={(e) => setVal(e.target.value)}
            autoFocus
            className="w-32 h-7 rounded border border-input bg-background px-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button onClick={handleSave} disabled={saving}
            className="h-7 w-7 flex items-center justify-center rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => setEditing(false)} className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="text-right min-w-[110px]">
            {row.target != null ? (
              <>
                <div className="text-sm font-semibold">{formatMoney(row.target)}</div>
                {diffPct !== null && (
                  <div className={cn('text-[11px]', diff! >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {diff! >= 0 ? '+' : ''}{diffPct.toFixed(1)}% vs เป้า
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-muted-foreground">ยังไม่ได้ตั้งเป้า</div>
            )}
          </div>
          <button onClick={() => { setVal(row.target?.toString() ?? ''); setEditing(true); }}
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function ForecastPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPipelineDetail, setShowPipelineDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<SummaryData>>('/forecast/summary');
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

  if (loading) {
    return (
      <div className="space-y-5 max-w-6xl">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64" /><Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-center py-20 text-muted-foreground">ไม่สามารถโหลดข้อมูลได้</div>;

  const { monthlyData, forecastMonths, pipeline, winRate6m, movingAvg, currentMonth, topCustomers } = data;

  // acheivement rate this month
  const achieveRate = currentMonth.target && currentMonth.target > 0
    ? Math.round((currentMonth.actual / currentMonth.target) * 100)
    : null;

  // pipeline coverage vs forecast
  const coverage = movingAvg > 0
    ? Math.round((pipeline.weighted / movingAvg) * 100)
    : null;

  const MONTH_TH = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  return (
    <div className="space-y-5 max-w-6xl">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Sales Forecast
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            คาดการณ์ยอดขายจากข้อมูล 12 เดือนย้อนหลัง · Pipeline สถานะปัจจุบัน
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <TrendingUp className="h-4 w-4" />รีเฟรช
        </Button>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* This month actual */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-muted-foreground mb-1">ยอดขายเดือนนี้</div>
            <div className="text-xl font-bold text-primary">{shortMoney(currentMonth.actual)}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {currentMonth.label}
              {achieveRate !== null && (
                <span className={cn('ml-1.5 font-semibold', achieveRate >= 100 ? 'text-emerald-600' : 'text-amber-600')}>
                  {achieveRate}% ของเป้า
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Next month forecast */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-muted-foreground mb-1">คาดการณ์เดือนถัดไป</div>
            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{shortMoney(movingAvg)}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Moving Avg (6m)</div>
          </CardContent>
        </Card>

        {/* Pipeline weighted */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-muted-foreground mb-1">Pipeline (Weighted)</div>
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{shortMoney(pipeline.weighted)}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {pipeline.count} รายการ
              {coverage !== null && <span className="ml-1.5">· Coverage {coverage}%</span>}
            </div>
          </CardContent>
        </Card>

        {/* Win rate */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-muted-foreground mb-1">Win Rate (6 เดือน)</div>
            <div className={cn('text-xl font-bold',
              winRate6m == null ? 'text-muted-foreground' :
              winRate6m >= 60 ? 'text-emerald-600' :
              winRate6m >= 40 ? 'text-amber-600' : 'text-red-600')}>
              {winRate6m != null ? `${winRate6m}%` : 'N/A'}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">อนุมัติ / (อนุมัติ + ปฏิเสธ)</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Revenue Bar Chart ────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">ยอดขาย 12 เดือนย้อนหลัง</h2>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-500 opacity-80" />ยอดจริง
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400 opacity-80" />เป้าหมาย
              </span>
            </div>
          </div>
          <RevenueBarChart data={monthlyData} />
        </CardContent>
      </Card>

      {/* ── Middle Row: Pipeline + Win Rate ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Pipeline breakdown */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-purple-500" />Pipeline ปัจจุบัน
              </h2>
              <button onClick={() => setShowPipelineDetail((v) => !v)}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors">
                {showPipelineDetail ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showPipelineDetail ? 'ย่อ' : 'ดูรายละเอียด'}
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground pb-1 border-b">
                <span>สถานะ</span>
                <span className="flex gap-6"><span>จำนวน</span><span>มูลค่า</span></span>
              </div>
              {Object.entries(pipeline.byStage).map(([status, val]) => {
                const meta = STAGE_LABELS[status];
                const weight = STAGE_WEIGHTS[status] ?? 0;
                if (!meta) return null;
                return (
                  <div key={status} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                    <span className="text-xs flex-1">{meta.label}</span>
                    {showPipelineDetail && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1">{weight}%</Badge>
                    )}
                    <span className="text-xs text-muted-foreground w-8 text-right">{val.count}</span>
                    <span className="text-xs font-semibold w-24 text-right">{shortMoney(val.value)}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-t space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">มูลค่ารวม Pipeline</span>
                <span className="font-semibold">{formatMoney(pipeline.total)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1" title="มูลค่า × โอกาสปิดตามสถานะ">
                  Weighted Forecast
                  <Info className="h-3 w-3" />
                </span>
                <span className="font-bold text-purple-600 dark:text-purple-400">{formatMoney(pipeline.weighted)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Win Rate trend */}
        <Card>
          <CardContent className="pt-5">
            <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
              <TrendingUp className="h-4 w-4 text-emerald-500" />Win Rate รายเดือน
            </h2>
            <WinRateLine data={monthlyData} />
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t">
              {monthlyData.slice(-3).map((m) => (
                <div key={m.label} className="text-center">
                  <div className="text-[11px] text-muted-foreground">{m.label}</div>
                  <div className={cn('text-sm font-bold',
                    m.winRate == null ? 'text-muted-foreground' :
                    m.winRate >= 60 ? 'text-emerald-600' :
                    m.winRate >= 40 ? 'text-amber-600' : 'text-red-600')}>
                    {m.winRate != null ? `${m.winRate}%` : '-'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {m.approved}✓ {m.rejected}✗
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom Row: Forecast Next 3 Months + Top Customers ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Forecast + target setting */}
        <Card>
          <CardContent className="pt-5">
            <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
              <Target className="h-4 w-4 text-amber-500" />คาดการณ์ 3 เดือนข้างหน้า
            </h2>
            <p className="text-[11px] text-muted-foreground mb-3">คลิก ✎ เพื่อตั้งเป้าหมายแต่ละเดือน</p>
            <div className="divide-y divide-border/50">
              {forecastMonths.map((m) => (
                <TargetRow
                  key={`${m.year}-${m.month}`}
                  row={{ ...m, label: `${MONTH_TH[m.month]} ${m.year}` }}
                  onSave={handleSaveTarget}
                />
              ))}
            </div>
            <div className="mt-3 pt-3 border-t text-[11px] text-muted-foreground flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
              คาดการณ์คำนวณจาก Moving Average ของยอดจริง 6 เดือนล่าสุด
            </div>
          </CardContent>
        </Card>

        {/* Top customers */}
        <Card>
          <CardContent className="pt-5">
            <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
              <Users className="h-4 w-4 text-blue-500" />Top ลูกค้า (12 เดือน)
            </h2>
            {topCustomers.length === 0 ? (
              <div className="text-sm text-center text-muted-foreground py-6">ยังไม่มีข้อมูล</div>
            ) : (
              <div className="space-y-2.5">
                {topCustomers.map((c, i) => {
                  const max = topCustomers[0]?.total ?? 1;
                  const pct = (c.total / max) * 100;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium truncate flex-1 pr-2">{c.company}</span>
                        <span className="font-bold shrink-0">{shortMoney(c.total)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background: i === 0 ? '#6366f1' : i === 1 ? '#8b5cf6' : i === 2 ? '#06b6d4' : '#94a3b8',
                          }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
