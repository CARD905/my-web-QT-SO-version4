'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, FileText, TrendingUp, Calendar, CheckCircle2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/effects/glass-card';
import { AnimatedCounter } from '@/components/effects/animated-counter';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, formatMoney, formatRelativeTime, getStatusClass } from '@/lib/utils';
import { toast } from 'sonner';
import type { ApiResponse, UserDetailResponse } from '@/types/api';

const ROLE_GRADIENT: Record<string, string> = {
  SALES: 'from-blue-500 to-cyan-500',
  APPROVER: 'from-purple-500 to-fuchsia-500',
  MANAGER: 'from-amber-500 to-orange-500',
  ADMIN: 'from-rose-500 to-red-500',
};

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.userId as string;

  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<ApiResponse<UserDetailResponse>>(
          `/manager-dashboard/users/${userId}`,
        );
        setData(res.data.data ?? null);
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-4 max-w-6xl">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) return <div>Not found</div>;

  const { user, totals, byStatus, recent } = data;
  const gradient = ROLE_GRADIENT[user.role] || 'from-slate-500 to-slate-600';

  return (
    <div className="space-y-6 max-w-6xl">
      <Button asChild variant="ghost" size="sm">
        <Link href="/manager/users">
          <ArrowLeft className="h-4 w-4" />
          กลับ
        </Link>
      </Button>

      {/* Hero */}
      <GlassCard className="p-6 overflow-hidden">
        <div className="flex items-start gap-5 flex-wrap">
          <div
            className={`h-20 w-20 rounded-2xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center font-bold text-2xl shrink-0 shadow-2xl`}
          >
            {user.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">{user.name}</h1>
            <Badge variant="outline" className="mt-1">
              {user.role}
            </Badge>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {user.email}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Member since {formatDate(user.createdAt)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {user.lastLoginAt
                ? `เข้าระบบล่าสุด ${formatRelativeTime(user.lastLoginAt)}`
                : 'ยังไม่เคยเข้าระบบ'}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Quotations ทั้งหมด</div>
              <div className="text-3xl font-bold mt-1 tabular-nums">
                <AnimatedCounter value={totals.quotations} />
              </div>
            </div>
            <FileText className="h-8 w-8 text-primary opacity-30" />
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">มูลค่าที่อนุมัติ</div>
              <div className="text-3xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                <AnimatedCounter
                  value={totals.approvedValue}
                  format={(n) => formatMoney(n)}
                />
              </div>
            </div>
            <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-30" />
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">เดือนนี้</div>
              <div className="text-3xl font-bold mt-1 tabular-nums">
                <AnimatedCounter value={totals.thisMonth} />
              </div>
            </div>
            <TrendingUp className="h-8 w-8 text-amber-500 opacity-30" />
          </div>
        </GlassCard>
      </div>

      {/* Status breakdown */}
      <GlassCard className="p-5">
        <h2 className="font-bold mb-4">แยกตามสถานะ</h2>
        {byStatus.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">ไม่มีข้อมูล</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {byStatus.map((s) => (
              <div
                key={s.status}
                className={`px-3 py-3 rounded-lg border ${getStatusClass(s.status)}`}
              >
                <div className="text-[10px] uppercase tracking-wider opacity-80">{s.status}</div>
                <div className="text-2xl font-bold mt-1">
                  <AnimatedCounter value={s.count} />
                </div>
                <div className="text-xs opacity-70 mt-0.5 truncate">
                  {formatMoney(s.totalValue)}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Recent quotations */}
      <GlassCard className="p-5">
        <h2 className="font-bold mb-4">Quotations ล่าสุด</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">ยังไม่มีรายการ</p>
        ) : (
          <ul className="divide-y divide-border/50">
            {recent.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/manager/quotations/${q.id}`}
                  className="flex items-center justify-between gap-3 py-3 px-2 -mx-2 rounded-lg hover:bg-accent/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{q.quotationNo}</span>
                      <Badge className={getStatusClass(q.status)} variant="outline">
                        {q.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {q.customerCompany}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatMoney(q.grandTotal, q.currency)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatRelativeTime(q.updatedAt)}
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