'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  FileText,
  ClipboardList,
  TrendingUp,
  Clock,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatDate, formatMoney, getStatusClass } from '@/lib/utils';
import type { ApiResponse, SalesDashboard } from '@/types/api';

export default function SalesDashboardPage() {
  const t = useT();
  const { data: session } = useSession();
  const [stats, setStats] = useState<SalesDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<ApiResponse<SalesDashboard>>('/dashboard/sales');
        if (!cancelled && res.data.data) setStats(res.data.data);
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
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t('dashboard.Dashboard Quotations')}, {session?.user?.name?.split(' ')[0] || ''} 
        </h1>
        <p className="text-muted-foreground mt-1">{t('dashboard.title')}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('dashboard.totalQuotations')}
          value={stats?.totals.quotations}
          icon={FileText}
          loading={loading}
          tone="primary"
        />
        <StatCard
          title={t('dashboard.saleOrders')}
          value={stats?.totals.saleOrders}
          icon={ClipboardList}
          loading={loading}
          tone="success"
        />
        <StatCard
          title={t('dashboard.approvedValue')}
          value={stats ? formatMoney(stats.totals.approvedValue) : undefined}
          icon={TrendingUp}
          loading={loading}
          tone="primary"
        />
        <StatCard
          title={t('dashboard.pendingApproval')}
          value={stats?.byStatus.pending}
          icon={Clock}
          loading={loading}
          tone="warning"
        />
      </div>

      {/* Status breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('dashboard.byStatus')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatusPill label={t('common.draft')} value={stats?.byStatus.draft ?? 0} className="status-draft" />
              <StatusPill label={t('common.pending')} value={stats?.byStatus.pending ?? 0} className="status-pending" />
              <StatusPill label={t('common.approved')} value={stats?.byStatus.approved ?? 0} className="status-approved" />
              <StatusPill label={t('common.rejected')} value={stats?.byStatus.rejected ?? 0} className="status-rejected" />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expiring soon */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-warning" />
                {t('dashboard.expiringSoon')}
              </CardTitle>
              <CardDescription>Within 7 days</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : stats?.expiringSoon.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t('dashboard.noPending')}</p>
            ) : (
              <ul className="divide-y">
                {stats?.expiringSoon.map((q) => (
                  <li key={q.id}>
                    <Link
                      href={`/quotations/${q.id}`}
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

        {/* Recent */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">{t('dashboard.recent')}</CardTitle>
              <CardDescription>Latest quotations</CardDescription>
            </div>
            <Link
              href="/quotations"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              {t('dashboard.viewAll')} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : stats?.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t('common.noData')}</p>
            ) : (
              <ul className="divide-y">
                {stats?.recent.slice(0, 5).map((q) => (
                  <li key={q.id}>
                    <Link
                      href={`/quotations/${q.id}`}
                      className="flex items-center justify-between gap-4 py-3 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{q.quotationNo}</span>
                          <Badge className={getStatusClass(q.status)} variant="outline">
                            {q.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {q.customerCompany}
                        </div>
                      </div>
                      <div className="text-sm font-semibold shrink-0">
                        {formatMoney(q.grandTotal)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
  tone = 'primary',
}: {
  title: string;
  value?: number | string;
  icon: typeof FileText;
  loading: boolean;
  tone?: 'primary' | 'success' | 'warning';
}) {
  const toneClass = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-green-500/10 text-green-600 dark:text-green-400',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  }[tone];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-20 mt-2" />
            ) : (
              <p className="text-2xl font-bold mt-1">{value ?? '-'}</p>
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

function StatusPill({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`px-3 py-2 rounded-lg flex items-center justify-between ${className}`}>
      <span className="text-xs font-medium">{label}</span>
      <span className="text-lg font-bold">{value}</span>
    </div>
  );
}
