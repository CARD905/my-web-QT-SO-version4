'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatDate, formatMoney, formatNumber, getStatusClass } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import type { ApiResponse, SaleOrder } from '@/types/api';

export default function SaleOrderDetailPage() {
  const t = useT();
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();

  const [so, setSo] = useState<SaleOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<ApiResponse<SaleOrder>>(`/sale-orders/${id}`);
        setSo(res.data.data ?? null);
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const downloadPdf = async () => {
    if (!session?.accessToken) return;
    setDownloading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${apiUrl}/sale-orders/${id}/pdf/download`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${so?.saleOrderNo || 'sale-order'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to download PDF');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-6xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!so) {
    return (
      <div className="text-center py-20">
        <p>Not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-1">
            <Link href="/sale-orders">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{so.saleOrderNo}</h1>
              <Badge className={getStatusClass(so.status)} variant="outline">
                ● {so.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {so.customerCompany} · {formatDate(so.issueDate)}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {so.quotation && (
            <Button asChild variant="outline">
              <Link href={`/quotations/${so.quotation.id}`}>
                <FileText className="h-4 w-4" />
                {so.quotation.quotationNo}
              </Link>
            </Button>
          )}
          <Button onClick={downloadPdf} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Save PDF
          </Button>
        </div>
      </div>

      {/* Customer info */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-3">{t('quotation.customerInfo')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-sm">
            <div>
              <span className="text-muted-foreground">{t('customer.company')}:</span>{' '}
              <span className="font-medium">{so.customerCompany}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('customer.contactName')}:</span>{' '}
              <span className="font-medium">{so.customerContactName}</span>
            </div>
            {so.customerTaxId && (
              <div>
                <span className="text-muted-foreground">{t('customer.taxId')}:</span>{' '}
                <span className="font-medium">{so.customerTaxId}</span>
              </div>
            )}
            {so.customerPhone && (
              <div>
                <span className="text-muted-foreground">{t('customer.phone')}:</span>{' '}
                <span className="font-medium">{so.customerPhone}</span>
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
                  <th className="text-right py-2 font-medium">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {so.items?.map((it, idx) => (
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
              <span>{formatNumber(so.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('quotation.discount')}</span>
              <span className="text-destructive">-{formatNumber(so.discountTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('quotation.vat')} ({formatNumber(so.vatRate)}%)
              </span>
              <span>{so.vatEnabled ? formatNumber(so.vatAmount) : 'No VAT'}</span>
            </div>
            <div className="border-t pt-2 flex justify-between items-baseline">
              <span className="font-semibold">{t('quotation.grandTotal')}</span>
              <span className="text-2xl font-bold text-primary">
                {formatMoney(so.grandTotal, so.currency)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
