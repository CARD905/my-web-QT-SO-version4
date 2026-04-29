'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Inbox, AlertTriangle } from 'lucide-react';
import { GlassCard } from '@/components/effects/glass-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, formatMoney, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import type { ApiResponse, Quotation } from '@/types/api';

export default function ManagerApprovalQueuePage() {
  const [list, setList] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams();
        params.set('status', 'PENDING_MANAGER');
        params.set('limit', '100');
        const res = await api.get<ApiResponse<Quotation[]>>(`/quotations?${params}`);
        setList(res.data.data ?? []);
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          Manager Approval Queue
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          ใบเสนอราคาที่มูลค่าเกินวงเงิน Approver — รอ Manager อนุมัติ
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <GlassCard className="py-16 flex flex-col items-center text-center gap-3">
          <Inbox className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">ไม่มีรายการรออนุมัติ</p>
          <p className="text-xs text-muted-foreground">เมื่อมีใบเสนอราคาเกินวงเงินจะปรากฏที่นี่</p>
        </GlassCard>
      ) : (
        <div className="grid gap-3">
          {list.map((q) => (
            <Link key={q.id} href={`/manager/quotations/${q.id}`}>
              <GlassCard className="p-4 hover:scale-[1.01] transition-transform border-l-4 border-l-amber-500">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-lg">{q.quotationNo}</span>
                        <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40">
                          🔥 HIGH VALUE
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground truncate mt-0.5">
                        {q.customerCompany} · by {q.createdBy?.name || '-'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                      {formatMoney(q.grandTotal, q.currency)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {q.submittedAt ? formatRelativeTime(q.submittedAt) : '-'} · Expires{' '}
                      {formatDate(q.expiryDate)}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}