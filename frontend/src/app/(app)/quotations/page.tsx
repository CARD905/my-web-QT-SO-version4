'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Search, FileText, CheckCircle2, Loader2,
  Lock, CheckSquare, Square, ListChecks,
} from 'lucide-react';
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
import { useConfirm } from '@/components/ui/confirm-dialog'; // ✅ import hook
import type { ApiResponse, Quotation } from '@/types/api';

export default function QuotationsPage() {
  const t       = useT();
  const confirm = useConfirm(); // ✅ ใช้แทน window.confirm
  const { can, role } = usePermissions();

  const [list,    setList]    = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const [bulkMode,   setBulkMode]   = useState(false);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [bulkActing, setBulkActing] = useState(false);

  const canCreate    = can('quotation', 'create', 'OWN');
  const canApprove   = can('quotation', 'approve', 'TEAM') || can('quotation', 'approve', 'ALL');
  const canApproveAll = can('quotation', 'approve', 'ALL');

  const fetchList = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)       params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      params.set('limit', '50');
      const res = await api.get<ApiResponse<Quotation[]>>(`/quotations?${params}`);
      const PO_STATUSES = ['PO_PENDING', 'PO_APPROVED', 'PO_REJECTED'];
      const data = res.data.data ?? [];
      setList(statusFilter ? data : data.filter((q) => !PO_STATUSES.includes(q.status)));
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
    return () => { cancelled = true; clearTimeout(handler); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  useEffect(() => {
    if (!bulkMode) setSelected(new Set());
  }, [bulkMode]);

  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const approvableList = list.filter((q) => {
    const isPending    = q.status === 'PENDING';
    const isEscalated  = q.status === 'PENDING_ESCALATED';
    return (
      canApprove &&
      ((isPending && (canApproveAll || role?.code === 'MANAGER')) ||
        (isEscalated && canApproveAll))
    );
  });

  const allSelected =
    approvableList.length > 0 && approvableList.every((q) => selected.has(q.id));

  const toggleSelectAll = () => {
    allSelected
      ? setSelected(new Set())
      : setSelected(new Set(approvableList.map((q) => q.id)));
  };

  // ✅ แทนที่ window.confirm ด้วย custom dialog สวยๆ
  const handleBulkApprove = async () => {
    if (selected.size === 0) return;

    const ok = await confirm({
      title:       `อนุมัติ ${selected.size} รายการ`,
      description: 'ใบเสนอราคาที่เลือกทั้งหมดจะถูกอนุมัติพร้อมกัน ยืนยันหรือไม่?',
      confirmText: `อนุมัติ ${selected.size} รายการ`,
      cancelText:  'ยกเลิก',
      variant:     'default',
    });
    if (!ok) return;

    setBulkActing(true);
    try {
      const res = await api.post<
        ApiResponse<{ approved: number; failed: { id: string; error: string }[] }>
      >('/quotations/bulk-approve', { ids: Array.from(selected) });
      const { approved, failed } = res.data.data ?? { approved: 0, failed: [] };
      if (approved > 0) toast.success(`อนุมัติสำเร็จ ${approved} รายการ`);
      if (failed.length > 0)
        toast.error(`ล้มเหลว ${failed.length} รายการ — ${failed[0]?.error ?? ''}`);
      setBulkMode(false);
      await fetchList();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBulkActing(false);
    }
  };

  const statuses = [
    '', 'DRAFT', 'PENDING', 'PENDING_ESCALATED',
    'APPROVED', 'REJECTED', 'CANCELLED',
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
        <div className="flex gap-2">
          {canApprove && approvableList.length > 0 && (
            <Button
              variant={bulkMode ? 'secondary' : 'outline'}
              onClick={() => setBulkMode((v) => !v)}
            >
              <ListChecks className="h-4 w-4" />
              {bulkMode ? 'ยกเลิก Bulk' : 'Bulk Approve'}
            </Button>
          )}
          {canCreate && (
            <Button asChild>
              <Link href="/quotations/new">
                <Plus className="h-4 w-4" />
                {t('quotation.newQuotation')}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {bulkMode && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="py-3 px-4 flex flex-wrap items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
            >
              {allSelected
                ? <CheckSquare className="h-4 w-4 text-primary" />
                : <Square className="h-4 w-4 text-muted-foreground" />}
              เลือกทั้งหมด ({approvableList.length})
            </button>
            <div className="flex-1" />
            {selected.size > 0 && (
              <span className="text-sm text-muted-foreground">
                เลือกแล้ว{' '}
                <span className="font-semibold text-foreground">{selected.size}</span> รายการ
              </span>
            )}
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={selected.size === 0 || bulkActing}
              onClick={handleBulkApprove}
            >
              {bulkActing
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <CheckCircle2 className="h-3.5 w-3.5" />}
              Approve {selected.size > 0 ? `(${selected.size})` : ''}
            </Button>
          </CardContent>
        </Card>
      )}

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
            const isEscalated  = q.status === 'PENDING_ESCALATED';
            const isManagerOnly = role?.code === 'MANAGER';
            const isApprovable =
              canApprove &&
              ((q.status === 'PENDING' && (canApproveAll || role?.code === 'MANAGER')) ||
                (isEscalated && canApproveAll));
            const isChecked = selected.has(q.id);

            return (
              <Link
                key={q.id}
                href={bulkMode ? '#' : `/quotations/${q.id}`}
                onClick={
                  bulkMode && isApprovable
                    ? (e) => toggleSelect(e, q.id)
                    : bulkMode
                    ? (e) => e.preventDefault()
                    : undefined
                }
              >
                <Card
                  className={`cursor-pointer transition-colors ${
                    bulkMode && isApprovable
                      ? isChecked
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/40'
                      : 'hover:border-primary/50'
                  } ${bulkMode && !isApprovable ? 'opacity-50 cursor-default' : ''}`}
                >
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      {bulkMode && (
                        <div className="shrink-0">
                          {isApprovable ? (
                            isChecked
                              ? <CheckSquare className="h-5 w-5 text-primary" />
                              : <Square className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <Square className="h-5 w-5 text-muted-foreground/30" />
                          )}
                        </div>
                      )}
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
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold">
                        {formatMoney(q.grandTotal, q.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t('quotation.expiryDate')}: {formatDate(q.expiryDate)}
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