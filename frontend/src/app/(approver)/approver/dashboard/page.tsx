'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Inbox,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatDate, formatMoney } from '@/lib/utils';
import type { ApiResponse, ApproverDashboard } from '@/types/api';

export default function ApproverDashboardPage() {
  const t = useT();
  const { data: session } = useSession();
  const [stats, setStats] = useState<ApproverDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<ApiResponse<ApproverDashboard>>('/dashboard/approver');
        if (!cancelled) setStats(res.data.data ?? null);
      } catch (err) {
        console.error(getApiErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">
          {t('dashboard.welcome')}, {session?.user?.name?.split(' ')[0] || ''} 👔
        </h1>
        <p className="text-muted-foreground mt-1">Approver Dashboard</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="📥 Pending"
          value={stats?.pending.count}
          icon={Inbox}
          tone="warning"
          loading={loading}
        />
        <StatCard
          title="💰 Total Value"
          value={stats ? formatMoney(stats.pending.totalValue) : undefined}
          icon={TrendingUp}
          tone="primary"
          loading={loading}
        />
        <StatCard
          title="🔴 High Value"
          value={stats?.pending.highValueCount}
          icon={AlertCircle}
          tone="destructive"
          loading={loading}
          subtitle="≥ 100,000"
        />
        <StatCard
          title="⏳ Expiring Soon"
          value={stats?.pending.expiringSoonCount}
          icon={Clock}
          tone="warning"
          loading={loading}
          subtitle="Within 7 days"
        />
      </div>

      {/* Today */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-success/30 bg-success/5">
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">{t('dashboard.approvedToday')}</p>
              <p className="text-2xl font-bold">{loading ? '-' : stats?.todayActivity.approved ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">{t('dashboard.rejectedToday')}</p>
              <p className="text-2xl font-bold">{loading ? '-' : stats?.todayActivity.rejected ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* High Value */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              🔴 {t('dashboard.highValue')}
            </CardTitle>
            <CardDescription>≥ 100,000</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : stats?.highValuePending.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t('dashboard.noPending')}</p>
            ) : (
              <ul className="divide-y">
                {stats?.highValuePending.map((q) => (
                  <li key={q.id}>
                    <Link
                      href={`/approver/quotations/${q.id}`}
                      className="flex items-center justify-between gap-4 py-3 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{q.quotationNo}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {q.customerCompany} · by {q.createdBy.name}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-base font-bold text-destructive">
                          {formatMoney(q.grandTotal)}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Expiring Soon */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              ⏳ {t('dashboard.expiringSoon')}
            </CardTitle>
            <CardDescription>Within 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : stats?.expiringSoon.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t('dashboard.noPending')}</p>
            ) : (
              <ul className="divide-y">
                {stats?.expiringSoon.map((q) => (
                  <li key={q.id}>
                    <Link
                      href={`/approver/quotations/${q.id}`}
                      className="flex items-center justify-between gap-4 py-3 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{q.quotationNo}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {q.customerCompany}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold">{formatMoney(q.grandTotal)}</div>
                        <div className="text-xs text-warning">{formatDate(q.expiryDate)}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Requests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">📄 Recent Requests</CardTitle>
            <CardDescription>Latest pending approvals</CardDescription>
          </div>
          <Link
            href="/approver/approval-queue"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            {t('dashboard.viewAll')} <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : stats?.recentRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t('dashboard.noPending')}</p>
          ) : (
            <ul className="divide-y">
              {stats?.recentRequests.slice(0, 8).map((q) => (
                <li key={q.id}>
                  <Link
                    href={`/approver/quotations/${q.id}`}
                    className="flex items-center justify-between gap-4 py-3 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm">{q.quotationNo}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {q.customerCompany} · by {q.createdBy.name}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold">{formatMoney(q.grandTotal)}</div>
                      <div className="text-xs text-muted-foreground">
                        Expires {formatDate(q.expiryDate)}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  tone,
  loading,
  subtitle,
}: {
  title: string;
  value?: number | string;
  icon: typeof Inbox;
  tone: 'primary' | 'warning' | 'destructive';
  loading: boolean;
  subtitle?: string;
}) {
  const toneClass = {
    primary: 'bg-primary/10 text-primary',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    destructive: 'bg-red-500/10 text-red-600 dark:text-red-400',
  }[tone];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-20 mt-2" />
            ) : (
              <>
                <p className="text-2xl font-bold mt-1">{value ?? '-'}</p>
                {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
              </>
            )}
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${toneClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
