'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, User as UserIcon, Calendar, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, formatMoney, getStatusClass } from '@/lib/utils';
import { toast } from 'sonner';
import type { ApiResponse } from '@/types/api';

interface UserDetailData {
  user: {
    id: string;
    name: string;
    email: string;
    role: { code: string; nameTh: string };
    team: { id: string; name: string } | null;
    isActive: boolean;
  } | null;
  totals: {
    quotations: number;
    approvedValue: number;
    thisMonth: number;
  };
  byStatus: Array<{ status: string; count: number }>;
  recent: Array<{
    id: string;
    quotationNo: string;
    status: string;
    grandTotal: number;
    createdAt: string;
  }>;
}

export default function ManagerUserDetailPage() {
  const params = useParams();
  const userId = params.userId as string;
  const [data, setData] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<ApiResponse<UserDetailData>>(
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
      <div className="space-y-4 max-w-5xl">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!data?.user) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground">ไม่พบข้อมูลผู้ใช้</p>
          <Link
            href="/manager/dashboard"
            className="text-sm text-primary hover:underline mt-2 inline-block"
          >
            ← กลับสู่ Dashboard
          </Link>
        </CardContent>
      </Card>
    );
  }

  const { user, totals, byStatus, recent } = data;

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        href="/manager/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* User Hero Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-blue-500 to-purple-500 text-white p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center font-bold text-2xl shrink-0">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{user.name}</h1>
                {!user.isActive && <Badge variant="destructive">Inactive</Badge>}
              </div>
              <div className="text-sm text-white/90 mt-1">{user.email}</div>
              <div className="text-xs text-white/70 mt-1 flex flex-wrap gap-3">
                <span>📋 {user.role.nameTh}</span>
                {user.team && <span>👥 {user.team.name}</span>}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totals.quotations}</div>
              <div className="text-xs text-muted-foreground">Total Quotations</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-bold">{formatMoney(totals.approvedValue)}</div>
              <div className="text-xs text-muted-foreground">Approved Value</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totals.thisMonth}</div>
              <div className="text-xs text-muted-foreground">This Month</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">By Status</CardTitle>
        </CardHeader>
        <CardContent>
          {byStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">ไม่มีข้อมูล</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {byStatus.map((s) => (
                <Badge
                  key={s.status}
                  className={getStatusClass(s.status)}
                  variant="outline"
                >
                  {s.status}: {s.count}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Quotations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Recent Quotations</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              ยังไม่มีใบเสนอราคา
            </p>
          ) : (
            <div className="space-y-2">
              {recent.map((q) => (
                <Link
                  key={q.id}
                  href={`/manager/quotations/${q.id}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-md border hover:border-primary/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm">{q.quotationNo}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(q.createdAt)}
                    </div>
                  </div>
                  <Badge className={getStatusClass(q.status)} variant="outline">
                    {q.status}
                  </Badge>
                  <div className="font-bold text-sm shrink-0">
                    {formatMoney(q.grandTotal)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}