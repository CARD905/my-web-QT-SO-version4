'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, FileText, CheckCircle2, XCircle, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatDate, formatMoney, getStatusClass } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import type { ApiResponse, Quotation } from '@/types/api';

export default function QuotationsPage() {
  const t = useT();
  const { can, role } = usePermissions();
  const [list, setList] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [actioningId, setActioningId] = useState<string | null>(null);

  const canCreate = can('quotation', 'create', 'OWN');
  const canApprove = can('quotation', 'approve', 'TEAM') || can('quotation', 'approve', 'ALL');
  const canApproveAll = can('quotation', 'approve', 'ALL');

  const fetchList = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      params.set('limit', '50');
      const res = await api.get<ApiResponse<Quotation[]>>(`/quotations?${params}`);
      setList(res.data.data ?? []);
    } catch (err) {
      console.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const handler = setTimeout(async () => {
      if (cancelled) return;
      await fetchList();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  const handleApprove = async (e: React.MouseEvent, q: Quotation) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`อนุมัติใบเสนอราคา ${q.quotationNo} ใช่หรือไม่?`)) return;
    setActioningId(q.id);
    try {
      await api.post(`/quotations/${q.id}/approve`, { comment: '' });
      toast.success(`Approved ${q.quotationNo}`);
      fetchList();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (e: React.MouseEvent, q: Quotation) => {
    e.preventDefault();
    e.stopPropagation();
    const reason = prompt(`ปฏิเสธ ${q.quotationNo} — กรุณาระบุเหตุผล:`);
    if (!reason || reason.trim().length < 2) return;
    setActioningId(q.id);
    try {
      await api.post(`/quotations/${q.id}/reject`, { reason });
      toast.success(`Rejected ${q.quotationNo}`);
      fetchList();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setActioningId(null);
    }
  };

  const statuses = [
    '',
    'DRAFT',
    'PENDING',
    'PENDING_ESCALATED',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
    'EXPIRED',
  ];

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
        {canCreate && (
          <Button asChild>
            <Link href="/quotations/new">
              <Plus className="h-4 w-4" />
              {t('quotation.newQuotation')}
            </Link>
          </Button>
        )}
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
            {canCreate && (
              <Button asChild variant="outline">
                <Link href="/quotations/new">
                  <Plus className="h-4 w-4" />
                  {t('quotation.newQuotation')}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.map((q) => {
            const isPending = q.status === 'PENDING';
            const isEscalated = q.status === 'PENDING_ESCALATED';
            const isManagerOnly = role?.code === 'MANAGER';

            // Manager can approve PENDING (≤limit) but not PENDING_ESCALATED
            const showApproveButtons =
              canApprove &&
              ((isPending && (canApproveAll || role?.code === 'MANAGER')) ||
                (isEscalated && canApproveAll));

            return (
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
                          {isEscalated && isManagerOnly && (
                            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 border-amber-300">
                              <Lock className="h-2.5 w-2.5 mr-1" />
                              รอ CEO อนุมัติ
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground truncate mt-0.5">
                          {q.customerCompany}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-lg font-bold">
                          {formatMoney(q.grandTotal, q.currency)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t('quotation.expiryDate')}: {formatDate(q.expiryDate)}
                        </div>
                      </div>

                      {/* Approve/Reject buttons */}
                      {showApproveButtons && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={(e) => handleApprove(e, q)}
                            disabled={actioningId === q.id}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            {actioningId === q.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(e) => handleReject(e, q)}
                            disabled={actioningId === q.id}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </div>
                      )}
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