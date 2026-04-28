'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Send,
  X,
  Loader2,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatDate, formatMoney, formatNumber, getStatusClass } from '@/lib/utils';
import type { ApiResponse, Quotation } from '@/types/api';

export default function QuotationDetailPage() {
  const t = useT();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [q, setQ] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<Quotation>>(`/quotations/${id}`);
      setQ(res.data.data ?? null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submit = async () => {
    setActing('submit');
    try {
      await api.post(`/quotations/${id}/submit`, {});
      toast.success('Submitted for approval');
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setActing(null);
    }
  };

  const cancel = async () => {
    const reason = prompt('Cancellation reason:');
    if (!reason) return;
    setActing('cancel');
    try {
      await api.post(`/quotations/${id}/cancel`, { reason });
      toast.success('Quotation cancelled');
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-6xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!q) {
    return (
      <div className="text-center py-20">
        <p>Not found</p>
        <Button asChild variant="ghost" className="mt-4">
          <Link href="/quotations">{t('common.back')}</Link>
        </Button>
      </div>
    );
  }

  const canSubmit = q.status === 'DRAFT' || q.status === 'REJECTED';
  const canEdit = q.status === 'DRAFT' || q.status === 'REJECTED';
  const canCancel = q.status === 'DRAFT' || q.status === 'PENDING';

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-1">
            <Link href="/quotations">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{q.quotationNo}</h1>
              <Badge className={getStatusClass(q.status)} variant="outline">
                ● {q.status}
              </Badge>
              {q.version > 1 && (
                <span className="text-xs text-muted-foreground">v{q.version}</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {q.customerCompany} · {formatDate(q.issueDate)} → {formatDate(q.expiryDate)}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {canEdit && (
            <Button asChild variant="outline">
              <Link href={`/quotations/${id}/edit`}>
                <FileText className="h-4 w-4" />
                {t('common.edit')}
              </Link>
            </Button>
          )}
          {canCancel && (
            <Button variant="outline" onClick={cancel} disabled={acting !== null}>
              {acting === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              {t('common.cancel')}
            </Button>
          )}
          {canSubmit && (
            <Button onClick={submit} disabled={acting !== null}>
              {acting === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t('quotation.submitForApproval')}
            </Button>
          )}
          {q.saleOrder && (
            <Button asChild variant="success">
              <Link href={`/sale-orders/${q.saleOrder.id}`}>
                <FileText className="h-4 w-4" />
                {q.saleOrder.saleOrderNo}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Status alerts */}
      {q.status === 'REJECTED' && q.rejectionReason && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-destructive">Rejected</div>
              <p className="text-sm mt-1">{q.rejectionReason}</p>
              <p className="text-xs text-muted-foreground mt-2">
                You can edit and resubmit this quotation.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {q.status === 'APPROVED' && (
        <Card className="border-success/50 bg-success/5">
          <CardContent className="pt-4 flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-success">Approved</div>
              <p className="text-sm mt-1">
                Approved on {formatDate(q.approvedAt)} by {q.approvedBy?.name || '-'}
                {q.saleOrder && ` · Sale Order ${q.saleOrder.saleOrderNo} created`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {q.status === 'PENDING' && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="pt-4 flex gap-3">
            <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-700 dark:text-amber-400">Pending Approval</div>
              <p className="text-sm mt-1">
                Submitted on {formatDate(q.submittedAt)} · Waiting for approver review
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer info */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-3">{t('quotation.customerInfo')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-sm">
            <div>
              <span className="text-muted-foreground">{t('customer.company')}:</span>{' '}
              <span className="font-medium">{q.customerCompany}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('customer.contactName')}:</span>{' '}
              <span className="font-medium">{q.customerContactName}</span>
            </div>
            {q.customerTaxId && (
              <div>
                <span className="text-muted-foreground">{t('customer.taxId')}:</span>{' '}
                <span className="font-medium">{q.customerTaxId}</span>
              </div>
            )}
            {q.customerPhone && (
              <div>
                <span className="text-muted-foreground">{t('customer.phone')}:</span>{' '}
                <span className="font-medium">{q.customerPhone}</span>
              </div>
            )}
            {q.customerEmail && (
              <div className="md:col-span-2">
                <span className="text-muted-foreground">{t('customer.email')}:</span>{' '}
                <span className="font-medium">{q.customerEmail}</span>
              </div>
            )}
            {q.customerBillingAddress && (
              <div className="md:col-span-2">
                <span className="text-muted-foreground">{t('customer.billingAddress')}:</span>{' '}
                <span className="font-medium">{q.customerBillingAddress}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-3">{t('quotation.lineItems')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="text-left py-2 font-medium">SKU</th>
                  <th className="text-left py-2 font-medium">Product</th>
                  <th className="text-right py-2 font-medium">Qty</th>
                  <th className="text-right py-2 font-medium">Unit Price</th>
                  <th className="text-right py-2 font-medium">Discount</th>
                  <th className="text-right py-2 font-medium">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {q.items?.map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td className="py-3 text-xs text-muted-foreground">{it.productSku || '-'}</td>
                    <td className="py-3">
                      <div className="font-medium">{it.productName}</div>
                      {it.description && (
                        <div className="text-xs text-muted-foreground mt-0.5">{it.description}</div>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {formatNumber(it.quantity)} {it.unit}
                    </td>
                    <td className="py-3 text-right">{formatNumber(it.unitPrice)}</td>
                    <td className="py-3 text-right">
                      {Number(it.discount) > 0
                        ? it.discountType === 'PERCENTAGE'
                          ? `${formatNumber(it.discount)}%`
                          : formatNumber(it.discount)
                        : '-'}
                    </td>
                    <td className="py-3 text-right font-semibold">{formatNumber(it.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6 flex justify-end">
          <div className="w-full md:w-80 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('quotation.subtotal')}</span>
              <span>{formatNumber(q.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('quotation.discount')}</span>
              <span className="text-destructive">-{formatNumber(q.discountTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('quotation.vat')} ({formatNumber(q.vatRate)}%)
              </span>
              <span>{q.vatEnabled ? formatNumber(q.vatAmount) : 'No VAT'}</span>
            </div>
            <div className="border-t pt-2 flex justify-between items-baseline">
              <span className="font-semibold">{t('quotation.grandTotal')}</span>
              <span className="text-2xl font-bold text-primary">
                {formatMoney(q.grandTotal, q.currency)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment / Conditions */}
      {(q.paymentTerms || q.conditions) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {q.paymentTerms && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-xs uppercase text-muted-foreground font-semibold">
                  {t('quotation.paymentTerms')}
                </div>
                <div className="mt-1 font-medium">{q.paymentTerms}</div>
              </CardContent>
            </Card>
          )}
          {q.conditions && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-xs uppercase text-muted-foreground font-semibold">
                  {t('quotation.conditions')}
                </div>
                <div className="mt-1 text-sm whitespace-pre-wrap">{q.conditions}</div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
