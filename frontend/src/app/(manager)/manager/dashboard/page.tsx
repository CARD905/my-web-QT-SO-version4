'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Crown,
  TrendingUp,
  AlertTriangle,
  Users,
  CheckCircle2,
  XCircle,
  Inbox,
  Trophy,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/effects/glass-card';
import { AnimatedCounter } from '@/components/effects/animated-counter';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatMoney, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import type { ApiResponse, ManagerOverview } from '@/types/api';

export default function ManagerDashboardPage() {
  const t = useT();
  const { data: session } = useSession();
  const [data, setData] = useState<ManagerOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<ApiResponse<ManagerOverview>>('/manager-dashboard/overview');
        if (res.data.data) setData(res.data.data);
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 max-w-7xl">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Hero */}
      <GlassCard className="p-8 overflow-hidden">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-2xl shadow-amber-500/30 shrink-0">
            <Crown className="h-8 w-8" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
              Welcome back, Manager
            </div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              {session?.user?.name?.split(' ')[0] || 'Manager'} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t('manager.overview')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
            <span className="text-sm text-muted-foreground">Live</span>
          </div>
        </div>
      </GlassCard>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Inbox}
          label={t('manager.pendingApprover')}
          value={data.totals.pendingApprover}
          subValue={formatMoney(data.totals.pendingApproverValue)}
          gradient="from-purple-500 to-pink-500"
        />
        <StatCard
          icon={AlertTriangle}
          label={t('manager.pendingManager')}
          value={data.totals.pendingManager}
          subValue={formatMoney(data.totals.pendingManagerValue)}
          gradient="from-amber-500 to-red-500"
          urgent
        />
        <StatCard
          icon={CheckCircle2}
          label="✓ Approved Today"
          value={data.todayActivity.approved}
          gradient="from-emerald-500 to-teal-500"
        />
        <StatCard
          icon={XCircle}
          label="✕ Rejected Today"
          value={data.todayActivity.rejected}
          gradient="from-rose-500 to-red-500"
        />
      </div>

      {/* Lower grid: Top Sales / Top Approvers / Escalated */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Sales */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <h2 className="font-bold">{t('manager.topSales')}</h2>
            </div>
            <Link
              href="/manager/users"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              ดูทั้งหมด <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.topSales.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">ไม่มีข้อมูล</p>
          ) : (
            <ul className="space-y-2">
              {data.topSales.map((s, i) => (
                <li key={s.userId}>
                  <Link
                    href={`/manager/users/${s.userId}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors group"
                  >
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md ${
                        i === 0
                          ? 'bg-gradient-to-br from-amber-400 to-amber-600'
                          : i === 1
                            ? 'bg-gradient-to-br from-slate-400 to-slate-600'
                            : i === 2
                              ? 'bg-gradient-to-br from-amber-700 to-amber-800'
                              : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                      }`}
                    >
                      {i < 3 ? ['🥇', '🥈', '🥉'][i] : s.user?.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {s.user?.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.quotationCount} ใบเสนอราคาที่อนุมัติ
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(s.approvedValue)}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        {/* Top Approvers */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              <h2 className="font-bold">{t('manager.topApprovers')}</h2>
            </div>
            <Link
              href="/manager/users"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              ดูทั้งหมด <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.topApprovers.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">ไม่มีข้อมูลเดือนนี้</p>
          ) : (
            <ul className="space-y-2">
              {data.topApprovers.map((a) => (
                <li key={a.userId}>
                  <Link
                    href={`/manager/users/${a.userId}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors group"
                  >
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white flex items-center justify-center font-bold text-sm shadow-md">
                      {a.user?.name.slice(0, 2).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {a.user?.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-muted-foreground">เดือนนี้</div>
                    </div>
                    <Badge variant="outline" className="font-bold">
                      {a.approvedCount} approved
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      {/* Escalated */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="font-bold">{t('manager.recentEscalated')}</h2>
            <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40">
              {data.recentEscalated.length}
            </Badge>
          </div>
          <Link
            href="/manager/approval-queue"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            ดูทั้งหมด <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {data.recentEscalated.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500" />
            ไม่มีรายการที่ต้อง Manager อนุมัติ
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {data.recentEscalated.slice(0, 5).map((q) => (
              <li key={q.id}>
                <Link
                  href={`/manager/quotations/${q.id}`}
                  className="flex items-center justify-between gap-3 py-3 px-2 -mx-2 rounded-lg hover:bg-accent/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                        🔥 HIGH
                      </span>
                      {q.quotationNo}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {q.customerCompany} · by {q.createdBy.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-amber-700 dark:text-amber-400">
                      {formatMoney(q.grandTotal, q.currency)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {q.submittedAt ? formatRelativeTime(q.submittedAt) : '-'}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  gradient,
  urgent,
}: {
  icon: typeof Inbox;
  label: string;
  value: number;
  subValue?: string;
  gradient: string;
  urgent?: boolean;
}) {
  return (
    <GlassCard
      className={`p-5 overflow-hidden ${
        urgent && value > 0 ? 'ring-2 ring-amber-500/40 animate-pulse-slow' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground font-medium">{label}</div>
          <div className="text-3xl font-bold mt-2 tabular-nums">
            <AnimatedCounter value={value} />
          </div>
          {subValue && (
            <div className="text-xs text-muted-foreground mt-0.5 truncate">{subValue}</div>
          )}
        </div>
        <div
          className={`h-10 w-10 rounded-xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center shadow-lg shrink-0`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </GlassCard>
  );
}