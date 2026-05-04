'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
  Users as UsersIcon,
  ArrowRight,
  Inbox,
  Crown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatMoney, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import type { ApiResponse } from '@/types/api';
import { usePermissions } from '@/hooks/use-permissions';

interface DashboardData {
  totals: {
    quotations: number;
    pending: number;
    escalated: number;
    approved: number;
    rejected: number;
    totalValue: number;
    pendingValue: number;
  };
  todayActivity: { approved: number; rejected: number };
  topOfficers: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    count: number;
    value: number;
  }>;
  topApprovers: Array<{ userId: string; userName: string; count: number }>;
  recentEscalated: Array<{
    id: string;
    quotationNo: string;
    grandTotal: number;
    customerCompany: string;
    createdByName: string;
    submittedAt: string;
  }>;
  statusBreakdown: Array<{ status: string; count: number }>;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500',
  PENDING: 'bg-amber-500',
  PENDING_BACKUP: 'bg-amber-600',
  PENDING_ESCALATED: 'bg-rose-500',
  APPROVED: 'bg-emerald-500',
  REJECTED: 'bg-red-500',
  CANCELLED: 'bg-gray-400',
  EXPIRED: 'bg-gray-600',
  SENT: 'bg-blue-500',
  SIGNED: 'bg-blue-600',
};

export default function ManagerDashboardPage() {
  const t = useT();
  const { role, loading: permLoading } = usePermissions();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (permLoading) return;
    (async () => {
      try {
        const res = await api.get<ApiResponse<DashboardData>>('/manager-dashboard/overview');
        setData(res.data.data ?? null);
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [permLoading]);

  if (permLoading || loading) {
    return (
      <div className="space-y-4 max-w-7xl">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          ไม่สามารถโหลดข้อมูล Dashboard ได้
        </CardContent>
      </Card>
    );
  }

  const totalActive = data.totals.pending + data.totals.escalated;
  const approvalRate =
    data.totals.approved + data.totals.rejected > 0
      ? Math.round(
          (data.totals.approved / (data.totals.approved + data.totals.rejected)) * 100,
        )
      : 0;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" />
            Manager Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ภาพรวมและสถิติของทีมคุณ {role?.nameTh && `· ${role.nameTh}`}
          </p>
        </div>
        <Link
          href="/manager/users"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          <UsersIcon className="h-4 w-4" />
          ดูสมาชิกในทีม
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Inbox className="h-5 w-5" />}
          label="Pending"
          value={totalActive.toString()}
          accent="from-amber-500 to-orange-500"
          subtitle={`${formatMoney(data.totals.pendingValue)} value`}
        />
        <KpiCard
          icon={<AlertCircle className="h-5 w-5" />}
          label="Escalated"
          value={data.totals.escalated.toString()}
          accent="from-rose-500 to-pink-500"
          subtitle="ต้องอนุมัติด่วน"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Approved"
          value={data.totals.approved.toString()}
          accent="from-emerald-500 to-teal-500"
          subtitle={`${approvalRate}% approval rate`}
        />
        <KpiCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Total Value"
          value={formatMoney(data.totals.totalValue)}
          accent="from-blue-500 to-cyan-500"
          subtitle={`${data.totals.quotations} quotations`}
        />
      </div>

      {/* Today's Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            Today's Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold">{data.todayActivity.approved}</div>
              <div className="text-xs text-muted-foreground">Approved วันนี้</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center">
              <XCircle className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold">{data.todayActivity.rejected}</div>
              <div className="text-xs text-muted-foreground">Rejected วันนี้</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Escalated */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              Pending Escalated
              <Badge variant="destructive" className="ml-auto">
                {data.recentEscalated.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentEscalated.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                ไม่มีรายการที่รออนุมัติ
              </p>
            ) : (
              <div className="space-y-2">
                {data.recentEscalated.map((q) => (
                  <Link
                    key={q.id}
                    href={`/manager/quotations/${q.id}`}
                    className="block p-3 rounded-md border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate">{q.quotationNo}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {q.customerCompany} · by {q.createdByName}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-rose-600">
                          {formatMoney(q.grandTotal)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(q.submittedAt)}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Officers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Top Officers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topOfficers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                ยังไม่มีข้อมูล
              </p>
            ) : (
              <div className="space-y-2">
                {data.topOfficers.map((o, idx) => (
                  <Link
                    key={o.userId}
                    href={`/manager/users/${o.userId}`}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors"
                  >
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0
                          ? 'bg-amber-500/20 text-amber-600'
                          : idx === 1
                            ? 'bg-gray-300/30 text-gray-600'
                            : idx === 2
                              ? 'bg-orange-300/30 text-orange-600'
                              : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{o.userName}</div>
                      <div className="text-xs text-muted-foreground truncate">{o.userEmail}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-sm">{o.count} QT</div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatMoney(o.value)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {data.statusBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">ไม่มีข้อมูล</p>
          ) : (
            <div className="space-y-2">
              {data.statusBreakdown.map((s) => {
                const pct =
                  data.totals.quotations > 0
                    ? Math.round((s.count / data.totals.quotations) * 100)
                    : 0;
                return (
                  <div key={s.status}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{s.status}</span>
                      <span className="text-muted-foreground">
                        {s.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${STATUS_COLORS[s.status] || 'bg-gray-500'} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===========================
// KPI Card sub-component
// ===========================
function KpiCard({
  icon,
  label,
  value,
  accent,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  subtitle?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div
          className={`h-10 w-10 rounded-lg bg-gradient-to-br ${accent} text-white flex items-center justify-center mb-3 shadow-md`}
        >
          {icon}
        </div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        {subtitle && (
          <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>
        )}
      </CardContent>
    </Card>
  );
}