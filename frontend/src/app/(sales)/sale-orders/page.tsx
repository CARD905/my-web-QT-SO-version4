'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatDate, formatMoney, getStatusClass } from '@/lib/utils';
import type { ApiResponse, SaleOrder } from '@/types/api';

export default function SaleOrdersPage() {
  const t = useT();
  const [list, setList] = useState<SaleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    const handler = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        params.set('limit', '50');
        const res = await api.get<ApiResponse<SaleOrder[]>>(`/sale-orders?${params}`);
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
  }, [search]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">{t('nav.saleOrders')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {loading ? t('common.loading') : `${list.length} items`}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`${t('common.search')}... (SO no, customer)`}
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
            <ClipboardList className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t('common.noData')}</p>
            <p className="text-xs text-muted-foreground">
              Sale Orders are created automatically when a Quotation is approved
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.map((so) => (
            <Link key={so.id} href={`/sale-orders/${so.id}`}>
              <Card className="cursor-pointer hover:border-primary/50 transition-colors">
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-success/10 text-success flex items-center justify-center shrink-0">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{so.saleOrderNo}</span>
                        <Badge className={getStatusClass(so.status)} variant="outline">
                          {so.status}
                        </Badge>
                        {so.quotation && (
                          <span className="text-xs text-muted-foreground">
                            from {so.quotation.quotationNo}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground truncate mt-0.5">
                        {so.customerCompany}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold">{formatMoney(so.grandTotal, so.currency)}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(so.issueDate)}</div>
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
