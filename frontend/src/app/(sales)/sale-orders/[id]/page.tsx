'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, FileText, Loader2, Calendar, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatDate, formatMoney, formatNumber, getStatusClass } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import type { ApiResponse, CompanySettings, SaleOrder } from '@/types/api';

export default function SaleOrderDetailPage() {
  const t = useT();
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();

  const [so, setSo] = useState<SaleOrder | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [soRes, cRes] = await Promise.all([
          api.get<ApiResponse<SaleOrder>>(`/sale-orders/${id}`),
          api.get<ApiResponse<CompanySettings>>('/company'),
        ]);
        setSo(soRes.data.data ?? null);
        setCompany(cRes.data.data ?? null);
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
      <div className="space-y-4 max-w-5xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!so) {
    return <div className="text-center py-20">Not found</div>;
  }

  const afterDiscount = Number(so.subtotal) - Number(so.discountTotal);

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Top toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/sale-orders">
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Link>
        </Button>
        <div className="flex gap-2">
          {so.quotation && (
            <Button asChild variant="outline" size="sm">
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

      {/* Document — formal layout */}
      <Card className="overflow-hidden border-2">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center shrink-0">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <div className="text-lg font-bold">
                  {company?.companyNameTh || company?.companyName || 'Your Company'}
                </div>
                {company?.companyNameTh && company?.companyName && (
                  <div className="text-xs text-white/70">{company.companyName}</div>
                )}
                <div className="text-xs text-white/60 mt-1">
                  {[company?.addressTh || company?.address, company?.phone, company?.taxId && `Tax ID: ${company.taxId}`]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tracking-wider">SALE ORDER</div>
              <div className="text-xs text-white/70">ใบสั่งขาย</div>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Document meta + Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-4 border-b">
            <Meta label="เลขที่ / No." value={so.saleOrderNo} highlight />
            <Meta label="วันที่ / Date" value={formatDate(so.issueDate)} />
            <Meta
              label="อ้างอิง QT"
              value={so.quotation?.quotationNo || '-'}
            />
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                สถานะ
              </div>
              <Badge className={getStatusClass(so.status)} variant="outline">
                ● {so.status}
              </Badge>
            </div>
          </div>

          {/* Customer block — split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 border-b">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">
                ลูกค้า / Bill To
              </div>
              <div className="space-y-1 text-sm">
                <div className="font-bold text-base">{so.customerCompany}</div>
                <div className="text-muted-foreground">Attn: {so.customerContactName}</div>
                {so.customerTaxId && <div className="text-xs">Tax ID: {so.customerTaxId}</div>}
                {so.customerPhone && <div className="text-xs">โทร. {so.customerPhone}</div>}
                {so.customerEmail && <div className="text-xs">{so.customerEmail}</div>}
                {so.customerBillingAddress && (
                  <div className="text-xs text-muted-foreground pt-1">
                    {so.customerBillingAddress}
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">
                ที่อยู่จัดส่ง / Ship To
              </div>
              <div className="space-y-1 text-sm">
                <div className="text-muted-foreground">
                  {so.customerShippingAddress || so.customerBillingAddress || '-'}
                </div>
                <div className="pt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">เงื่อนไข:</span>{' '}
                    <span className="font-medium">{so.paymentTerms || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">สกุลเงิน:</span>{' '}
                    <span className="font-medium">{so.currency}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Items table */}
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">
              รายการสินค้า / Items
            </div>
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wide">
                      รหัส / SKU
                    </th>
                    <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wide">
                      รายการ
                    </th>
                    <th className="text-right px-3 py-2.5 font-semibold text-xs uppercase tracking-wide">
                      จำนวน
                    </th>
                    <th className="text-center px-3 py-2.5 font-semibold text-xs uppercase tracking-wide">
                      หน่วย
                    </th>
                    <th className="text-right px-3 py-2.5 font-semibold text-xs uppercase tracking-wide">
                      ราคา/หน่วย
                    </th>
                    <th className="text-right px-3 py-2.5 font-semibold text-xs uppercase tracking-wide">
                      ส่วนลด
                    </th>
                    <th className="text-right px-3 py-2.5 font-semibold text-xs uppercase tracking-wide">
                      จำนวนเงิน
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {so.items?.map((it, idx) => (
                    <tr
                      key={it.id || idx}
                      className={idx % 2 === 0 ? '' : 'bg-muted/20'}
                    >
                      <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">
                        {it.productSku || '-'}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{it.productName}</div>
                        {it.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {it.description}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">{formatNumber(it.quantity)}</td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground">{it.unit}</td>
                      <td className="px-3 py-2.5 text-right">{formatNumber(it.unitPrice)}</td>
                      <td className="px-3 py-2.5 text-right">
                        {Number(it.discount) > 0
                          ? it.discountType === 'PERCENTAGE'
                            ? `${formatNumber(it.discount)}%`
                            : formatNumber(it.discount)
                          : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold">
                        {formatNumber(it.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              {company?.bankName && (
                <div className="rounded border-2 border-dashed p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">
                    ชำระเงินผ่านบัญชี
                  </div>
                  <div className="text-sm font-semibold">{company.bankName}</div>
                  {company.bankAccount && (
                    <div className="text-sm font-mono">{company.bankAccount}</div>
                  )}
                  {company.bankBranch && (
                    <div className="text-xs text-muted-foreground">สาขา {company.bankBranch}</div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5 text-sm">
              <SummaryRow label="รวมเงิน / Subtotal" value={formatNumber(so.subtotal)} />
              {Number(so.discountTotal) > 0 && (
                <SummaryRow
                  label="ส่วนลด / Discount"
                  value={`-${formatNumber(so.discountTotal)}`}
                  className="text-destructive"
                />
              )}
              <SummaryRow
                label="หลังหักส่วนลด / After Discount"
                value={formatNumber(afterDiscount)}
              />
              <SummaryRow
                label={`ภาษีมูลค่าเพิ่ม ${formatNumber(so.vatRate)}% / VAT`}
                value={so.vatEnabled ? formatNumber(so.vatAmount) : 'ไม่มี'}
              />
              <div className="border-t-2 border-slate-900 pt-2 mt-2 bg-slate-900 text-white px-4 py-3 rounded -mx-2">
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-sm">จำนวนเงินทั้งสิ้น</span>
                  <span className="text-2xl font-bold">
                    {formatMoney(so.grandTotal, so.currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Conditions */}
          {so.conditions && (
            <div className="border-t pt-4">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">
                เงื่อนไข / Conditions
              </div>
              <div className="text-sm whitespace-pre-wrap">{so.conditions}</div>
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-6 pt-8 mt-4">
            {[
              { th: 'ผู้อนุมัติสั่งซื้อ', en: 'Authorized Buyer' },
              { th: 'พนักงานขาย', en: 'Sales Representative' },
              { th: 'ผู้มีอำนาจลงนาม', en: 'Authorized Signatory' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="border-t border-slate-700 mt-12 mx-3 pt-2">
                  <div className="text-sm font-medium">{s.th}</div>
                  <div className="text-xs text-muted-foreground">{s.en}</div>
                  <div className="text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Date: ___________
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Meta({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className={`font-semibold ${highlight ? 'text-primary' : ''}`}>{value}</div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex justify-between ${className}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}