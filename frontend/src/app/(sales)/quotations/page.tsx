'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatDate, formatMoney, getStatusClass } from '@/lib/utils';
import type { ApiResponse, Quotation } from '@/types/api';

export default function QuotationsPage() {
  const t = useT();
  const [list, setList] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const handler = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (statusFilter) params.set('status', statusFilter);
        params.set('limit', '50');
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
  }, [search, statusFilter]);

  const statuses = ['', 'DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('quotation.list')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? t('common.loading') : `${list.length} items`}
          </p>
        </div>
        <Button asChild>
          <Link href="/quotations/new">
            <Plus className="h-4 w-4" />
            {t('quotation.newQuotation')}
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`${t('common.search')}... (QT no, customer)`}
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {statuses.map((s) => (
              <button
                key={s || 'all'}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                {s || t('common.all')}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t('common.noData')}</p>
            <Button asChild variant="outline">
              <Link href="/quotations/new">
                <Plus className="h-4 w-4" />
                {t('quotation.newQuotation')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.map((q) => (
            <Link key={q.id} href={`/quotations/${q.id}`}>
              <Card className="cursor-pointer hover:border-primary/50 transition-colors">
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{q.quotationNo}</span>
                        <Badge className={getStatusClass(q.status)} variant="outline">
                          {q.status}
                        </Badge>
                        {q.version > 1 && (
                          <span className="text-xs text-muted-foreground">v{q.version}</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground truncate mt-0.5">
                        {q.customerCompany}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold">{formatMoney(q.grandTotal, q.currency)}</div>
                    <div className="text-xs text-muted-foreground">
                      {t('quotation.expiryDate')}: {formatDate(q.expiryDate)}
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
