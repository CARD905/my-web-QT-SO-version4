'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Construction, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import type { ApiResponse } from '@/types/api';

interface UserDetailStub {
  user: {
    id: string;
    name: string;
    email: string;
    role: string | { code: string; nameTh?: string };
  } | null;
  totals?: {
    quotations: number;
    approvedValue: number;
    thisMonth: number;
  };
  byStatus?: Array<{ status: string; count: number }>;
  recent?: Array<{
    id: string;
    quotationNo: string;
    status: string;
    grandTotal: number;
    createdAt: string;
  }>;
}

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.userId as string;
  const [data, setData] = useState<UserDetailStub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<ApiResponse<UserDetailStub>>(`/manager-dashboard/users/${userId}`);
        if (!cancelled) setData(res.data.data ?? null);
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        href="/manager/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-bold">User Details</h1>
        <p className="text-sm text-muted-foreground mt-1">
          User ID: <span className="font-mono">{userId}</span>
        </p>
      </div>

      {/* Phase 6 Coming Soon Banner */}
      <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="py-4 flex items-center gap-3">
          <Construction className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="text-sm">
            <span className="font-medium text-amber-900 dark:text-amber-100">
              Phase 6: Manager Dashboard Rebuild
            </span>
            <span className="text-amber-700 dark:text-amber-300 ml-2">
              — Detailed user analytics with team-scoped queries coming soon.
            </span>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {data && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <div className="font-semibold">{data.user?.name || '-'}</div>
                <div className="text-sm text-muted-foreground">{data.user?.email || '-'}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Role:{' '}
                  {typeof data.user?.role === 'string'
                    ? data.user.role
                    : data.user?.role?.nameTh || data.user?.role?.code || '-'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}