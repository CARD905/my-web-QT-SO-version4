'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Inbox, Search, AlertCircle, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatDate, formatMoney } from '@/lib/utils';
import type { ApiResponse, Quotation } from '@/types/api';

const HIGH_VALUE = 100000;

export default function ApprovalQueuePage() {
  const t = useT();
  const [list, setList] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'high' | 'expiring'>('all');

  useEffect(() => {
    let cancelled = false;
    const handler = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('status', 'PENDING');
        params.set('limit', '100');
        if (search) params.set('search', search);
        if (filter === 'high') params.set('highValue', 'true');
        if (filter === 'expiring') params.set('expiringSoon', 'true');
        const res = await api.get<ApiResponse<Quotation[]>>(`/quotations?${params}`);
        if (!cancelled) setList(res.data.data ?? []);
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
  }, [search, filter]);

  const isExpiringSoon = (expiry: string) => {
    const days = (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 7 && days >= 0;
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">{t('nav.approvalQueue')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {loading ? t('common.loading') : `${list.length} pending`}
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
            {(['all', 'high', 'expiring'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                {f === 'all' ? t('common.all') : f === 'high' ? '🔴 High Value' : '⏳ Expiring'}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <Inbox className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t('dashboard.noPending')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.map((q) => {
            const high = Number(q.grandTotal) >= HIGH_VALUE;
            const expiring = isExpiringSoon(q.expiryDate);
            return (
              <Link key={q.id} href={`/approver/quotations/${q.id}`}>
                <Card
                  className={`cursor-pointer hover:border-primary/50 transition-colors ${
                    high ? 'border-l-4 border-l-destructive' : ''
                  }`}
                >
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Inbox className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{q.quotationNo}</span>
                          {high && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              High Value
                            </Badge>
                          )}
                          {expiring && (
                            <Badge variant="outline" className="text-xs status-expired">
                              <Clock className="h-3 w-3 mr-1" />
                              Expiring
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground truncate mt-0.5">
                          {q.customerCompany} · by {q.createdBy?.name || '-'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-lg font-bold ${high ? 'text-destructive' : ''}`}>
                        {formatMoney(q.grandTotal, q.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Expires {formatDate(q.expiryDate)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
