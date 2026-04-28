'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatDate, formatMoney, getStatusClass } from '@/lib/utils';
import type { ApiResponse, Quotation } from '@/types/api';

export default function ApprovalHistoryPage() {
  const t = useT();
  const [list, setList] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'APPROVED' | 'REJECTED'>('all');

  useEffect(() => {
    let cancelled = false;
    const handler = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (statusFilter !== 'all') params.set('status', statusFilter);
        params.set('limit', '100');
        params.set('sortBy', 'updatedAt');
        params.set('sortOrder', 'desc');
        const res = await api.get<ApiResponse<Quotation[]>>(`/quotations?${params}`);
        if (!cancelled) {
          let data = res.data.data ?? [];
          if (statusFilter === 'all') {
            data = data.filter((q) => ['APPROVED', 'REJECTED'].includes(q.status));
          }
          setList(data);
        }
      } catch (err) {
        console.error(getApiErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handler);
    };
  }, [search, statusFilter]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">{t('nav.history')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Approved & rejected quotations · {list.length} items
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`${t('common.search')}...`}
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'APPROVED', 'REJECTED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                {s === 'all' ? t('common.all') : s}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <History className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t('common.noData')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.map((q) => (
            <Link key={q.id} href={`/approver/quotations/${q.id}`}>
              <Card className="cursor-pointer hover:border-primary/50 transition-colors">
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{q.quotationNo}</span>
                        <Badge className={getStatusClass(q.status)} variant="outline">
                          {q.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground truncate mt-0.5">
                        {q.customerCompany} · by {q.createdBy?.name}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-base font-bold">{formatMoney(q.grandTotal, q.currency)}</div>
                    <div className="text-xs text-muted-foreground">
                      {q.status === 'APPROVED' && q.approvedAt && `Approved ${formatDate(q.approvedAt)}`}
                      {q.status === 'REJECTED' && q.rejectedAt && `Rejected ${formatDate(q.rejectedAt)}`}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
