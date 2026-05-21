'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, TrendingUp, CheckCircle2, XCircle, DollarSign,
  FileText, ShoppingCart, Users, Calendar, BarChart2, Award,
  ChevronRight, Activity,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/utils';
import type { ApiResponse } from '@/types/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserDetailData {
  user: {
    id: string; name: string; email: string; phone?: string | null;
    isActive: boolean; isTeamLead: boolean; lastLoginAt?: string | null;
    createdAt: string; approvalLimit?: string | null;
    role: { id: string; code: string; nameTh: string };
    team?: { id: string; name: string; size: number } | null;
    reportsTo?: { id: string; name: string } | null;
    position?: string;
  } | null;
  totals: {
    quotations: number; approvedValue: number; thisMonth: number;
    approvedCount: number; rejectedCount: number; soCount: number; soValue: number;
  };
  byStatus: Array<{ status: string; count: number }>;
  recent: Array<{ id: string; quotationNo: string; status: string; grandTotal: number; createdAt: string; customerCompany: string }>;
  recentSos: Array<{ id: string; saleOrderNo: string; status: string; grandTotal: number; createdAt: string; customerCompany: string }>;
  monthlyTrend: Array<{ month: string; count: number; value: number }>;
}

const STATUS_CFG: Record<string, { hex: string; label: string }> = {
  DRAFT:             { hex: '#94a3b8', label: 'Draft' },
  PENDING:           { hex: '#fbbf24', label: 'Pending' },
  PENDING_BACKUP:    { hex: '#f59e0b', label: 'Pending Backup' },
  PENDING_ESCALATED: { hex: '#f43f5e', label: 'Escalated' },
  APPROVED:          { hex: '#10b981', label: 'Approved' },
  REJECTED:          { hex: '#ef4444', label: 'Rejected' },
  CANCELLED:         { hex: '#9ca3af', label: 'Cancelled' },
  EXPIRED:           { hex: '#6b7280', label: 'Expired' },
  PO_PENDING:        { hex: '#fcd34d', label: 'PO Pending' },
  PO_APPROVED:       { hex: '#14b8a6', label: 'PO Approved' },
  PO_REJECTED:       { hex: '#f87171', label: 'PO Rejected' },
};

const SO_STATUS_CFG: Record<string, { hex: string; label: string }> = {
  DRAFT:     { hex: '#94a3b8', label: 'Draft' },
  CONFIRMED: { hex: '#10b981', label: 'Confirmed' },
  COMPLETED: { hex: '#3b82f6', label: 'Completed' },
  CANCELLED: { hex: '#9ca3af', label: 'Cancelled' },
};

// ─── Mini SVG Bar Trend Chart ─────────────────────────────────────────────────
function TrendBars({ data }: { data: Array<{ month: string; count: number; value: number }> }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const W = 420; const H = 100; const PB = 22; const PT = 8; const GAP = 6;
  const barW = (W - GAP * (data.length + 1)) / data.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>
      {data.map((d, i) => {
        const x = GAP + i * (barW + GAP);
        const barH = Math.max(((d.value / maxVal) * (H - PB - PT)), d.count > 0 ? 4 : 0);
        const y = H - PB - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={3}
              fill={i === data.length - 1 ? '#10b981' : '#3b82f6'} fillOpacity={i === data.length - 1 ? 0.9 : 0.5} />
            {d.count > 0 && (
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={9} fill="currentColor" fillOpacity={0.7}>
                {d.count}
              </text>
            )}
            <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={9} fill="currentColor" fillOpacity={0.5}>
              {d.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Status breakdown horizontal bar ─────────────────────────────────────────
function StatusBar({ byStatus }: { byStatus: Array<{ status: string; count: number }> }) {
  const total = byStatus.reduce((s, x) => s + x.count, 0) || 1;
  const sorted = [...byStatus].sort((a, b) => b.count - a.count);
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {sorted.map((s) => {
          const cfg = STATUS_CFG[s.status] ?? { hex: '#94a3b8', label: s.status };
          const pct = (s.count / total) * 100;
          if (pct < 1) return null;
          return (
            <div key={s.status} style={{ width: `${pct}%`, background: cfg.hex }}
              title={`${cfg.label}: ${s.count}`} />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {sorted.filter((s) => s.count > 0).map((s) => {
          const cfg = STATUS_CFG[s.status] ?? { hex: '#94a3b8', label: s.status };
          return (
            <div key={s.status} className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.hex }} />
              {cfg.label} <span className="font-semibold text-foreground">{s.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── KPI tile ─────────────────────────────────────────────────────────────────
function KpiTile({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className={`rounded-xl border border-border/60 p-3.5 flex items-center gap-3`}>
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
        <div className="text-lg font-bold leading-tight tabular-nums">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ManagerTeamMemberPage() {
  const params = useParams();
  const userId = params.userId as string;
  const [data, setData] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<ApiResponse<UserDetailData>>(`/manager-dashboard/users/${userId}`);
        setData(res.data.data ?? null);
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) return (
    <div className="max-w-5xl mx-auto space-y-4 p-4">
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0,1,2,3,4,5].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );

  if (!data?.user) return (
    <div className="max-w-md mx-auto mt-16 text-center">
      <XCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm text-muted-foreground mb-3">ไม่พบข้อมูลผู้ใช้ หรือคุณไม่มีสิทธิ์ดูข้อมูลนี้</p>
      <Link href="/dashboard" className="text-sm text-primary hover:underline">← กลับ Dashboard</Link>
    </div>
  );

  const { user, totals, byStatus, recent, recentSos, monthlyTrend } = data;
  const initials = user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  const winRate = totals.approvedCount + totals.rejectedCount > 0
    ? Math.round((totals.approvedCount / (totals.approvedCount + totals.rejectedCount)) * 100)
    : 0;
  const avgDeal = totals.approvedCount > 0
    ? formatMoney(totals.approvedValue / totals.approvedCount)
    : '—';

  return (
    <div className="max-w-5xl mx-auto space-y-4">

      {/* ── Header bar ── */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 rounded-2xl px-5 py-4 shadow-xl">
        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/dashboard"
            className="shrink-0 inline-flex items-center gap-1.5 text-[12px] text-blue-300 hover:text-white transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-white/30 hidden sm:block" />

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-full bg-blue-500/30 border-2 border-blue-400/40 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-semibold text-[15px]">{user.name}</span>
                <Badge variant="secondary" className="text-[11px] bg-white/10 text-white/80 border-white/20">
                  {user.role.nameTh}
                </Badge>
                {user.isTeamLead && (
                  <Badge variant="secondary" className="text-[11px] bg-amber-500/20 text-amber-300 border-amber-400/30">
                    Team Lead
                  </Badge>
                )}
                <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  user.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="text-[12px] text-blue-200/70 mt-0.5 flex gap-3 flex-wrap">
                <span>{user.email}</span>
                {user.team && <span>· {user.team.name}</span>}
                {user.reportsTo && <span>· รายงานต่อ {user.reportsTo.name}</span>}
              </div>
            </div>
          </div>

          <div className="text-right shrink-0 hidden sm:block">
            <div className="text-[11px] text-blue-200/60">เข้าระบบล่าสุด</div>
            <div className="text-[12px] text-white/80">{user.lastLoginAt ? formatDate(user.lastLoginAt) : '—'}</div>
          </div>
        </div>
      </div>

      {/* ── KPI tiles ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiTile
          icon={<FileText className="h-4 w-4 text-blue-600" />}
          label="QT ทั้งหมด"
          value={String(totals.quotations)}
          sub={`เดือนนี้ ${totals.thisMonth}`}
          color="bg-blue-50 dark:bg-blue-900/20"
        />
        <KpiTile
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          label="Win Rate"
          value={`${winRate}%`}
          sub={`${totals.approvedCount} approved`}
          color="bg-emerald-50 dark:bg-emerald-900/20"
        />
        <KpiTile
          icon={<DollarSign className="h-4 w-4 text-violet-600" />}
          label="Approved Value"
          value={formatMoney(totals.approvedValue)}
          sub={`avg ${avgDeal}`}
          color="bg-violet-50 dark:bg-violet-900/20"
        />
        <KpiTile
          icon={<ShoppingCart className="h-4 w-4 text-teal-600" />}
          label="SO Confirmed"
          value={String(totals.soCount)}
          sub={formatMoney(totals.soValue)}
          color="bg-teal-50 dark:bg-teal-900/20"
        />
        <KpiTile
          icon={<XCircle className="h-4 w-4 text-red-500" />}
          label="Rejected"
          value={String(totals.rejectedCount)}
          color="bg-red-50 dark:bg-red-900/20"
        />
        <KpiTile
          icon={<Calendar className="h-4 w-4 text-amber-600" />}
          label="เดือนนี้"
          value={String(totals.thisMonth)}
          sub="ใบเสนอราคา"
          color="bg-amber-50 dark:bg-amber-900/20"
        />
      </div>

      {/* ── Status + Monthly trend row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Status breakdown */}
        <Card className="border border-border/60 shadow-none rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-[13px] font-semibold">สถานะใบเสนอราคา</span>
            </div>
            {byStatus.length === 0
              ? <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มีข้อมูล</p>
              : <StatusBar byStatus={byStatus} />
            }
          </CardContent>
        </Card>

        {/* Monthly trend */}
        <Card className="border border-border/60 shadow-none rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-[13px] font-semibold">QT รายเดือน (6 เดือน)</span>
            </div>
            {monthlyTrend.every((m) => m.count === 0)
              ? <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มีข้อมูล</p>
              : <TrendBars data={monthlyTrend} />
            }
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Quotations ── */}
      <Card className="border border-border/60 shadow-none rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-[13px] font-semibold">ใบเสนอราคาล่าสุด</span>
            </div>
            <Link href={`/quotations?createdBy=${userId}`}
              className="text-[12px] text-primary hover:underline flex items-center gap-1">
              ดูทั้งหมด <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {recent.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มีใบเสนอราคา</p>
          ) : (
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-2 pb-1 border-b border-border/50">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">เลขที่ / ลูกค้า</span>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase text-right w-16">สถานะ</span>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase text-right w-24">มูลค่า</span>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase text-right w-20">วันที่</span>
              </div>
              {recent.map((q) => {
                const cfg = STATUS_CFG[q.status] ?? { hex: '#94a3b8', label: q.status };
                return (
                  <Link key={q.id} href={`/quotations/${q.id}`}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-2 py-1.5 rounded-lg hover:bg-accent/60 transition-colors">
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold truncate">{q.quotationNo}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{q.customerCompany}</div>
                    </div>
                    <div className="w-16 text-right">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: cfg.hex + '22', color: cfg.hex }}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="w-24 text-right text-[12px] font-semibold tabular-nums">{formatMoney(q.grandTotal)}</div>
                    <div className="w-20 text-right text-[10px] text-muted-foreground">{formatDate(q.createdAt)}</div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Recent Sale Orders ── */}
      <Card className="border border-border/60 shadow-none rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span className="text-[13px] font-semibold">Sale Orders ล่าสุด</span>
              <Badge variant="secondary" className="text-[11px]">{totals.soCount} SO confirmed</Badge>
            </div>
          </div>

          {recentSos.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มี Sale Orders</p>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-2 pb-1 border-b border-border/50">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">เลขที่ SO / ลูกค้า</span>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase text-right w-20">สถานะ</span>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase text-right w-24">มูลค่า</span>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase text-right w-20">วันที่</span>
              </div>
              {recentSos.map((so) => {
                const cfg = SO_STATUS_CFG[so.status] ?? { hex: '#94a3b8', label: so.status };
                return (
                  <Link key={so.id} href={`/sale-orders/${so.id}`}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-2 py-1.5 rounded-lg hover:bg-accent/60 transition-colors">
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold truncate">{so.saleOrderNo}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{so.customerCompany}</div>
                    </div>
                    <div className="w-20 text-right">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: cfg.hex + '22', color: cfg.hex }}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="w-24 text-right text-[12px] font-semibold tabular-nums">{formatMoney(so.grandTotal)}</div>
                    <div className="w-20 text-right text-[10px] text-muted-foreground">{formatDate(so.createdAt)}</div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
