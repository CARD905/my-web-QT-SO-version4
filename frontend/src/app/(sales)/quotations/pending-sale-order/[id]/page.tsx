'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft, FileText, Image as ImageIcon, CheckCircle2,
  XCircle, Loader2, AlertTriangle, Download, Clock, Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatDate, formatMoney, formatNumber, getStatusClass, cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { CommentThread } from '@/components/comments/comment-thread';
import type { ApiResponse, Quotation } from '@/types/api';

const ELEVATED_ROLES = ['MANAGER', 'CEO', 'ADMIN', 'APPROVER'];

interface PendingSOQuotation extends Quotation {
  poFileUrl?: string | null;
  poFileName?: string | null;
  poFileSize?: number | null;
  poFileMimeType?: string | null;
  poUploadedAt?: string | null;
  poSubmittedAt?: string | null;
}

function ConfirmDialog({ title, description, confirmLabel, confirmVariant = 'default',
  requireReason = false, onClose, onConfirm, loading }: {
  title: string; description: string; confirmLabel: string;
  confirmVariant?: 'default' | 'destructive';
  requireReason?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-2xl border shadow-2xl w-full max-w-md p-6">
        <h3 className="font-bold text-lg mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        {requireReason && (
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoFocus
            placeholder="ระบุเหตุผล..."
            className="w-full border border-input rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring mb-4"
          />
        )}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={loading}>ยกเลิก</Button>
          <Button variant={confirmVariant}
            disabled={loading || (requireReason && reason.trim().length < 3)}
            onClick={() => onConfirm(reason.trim())}
            className={confirmVariant === 'default' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PendingSaleOrderDetailPage() {
  const t = useT();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: session } = useSession();
  const { role } = usePermissions();

  const [q, setQ] = useState<PendingSOQuotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'approve' | 'reject' | 'cancel' | null>(null);

  const isElevated = !!(role?.code && ELEVATED_ROLES.includes(role.code));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<PendingSOQuotation>>(`/quotations/${id}`);
      setQ(res.data.data ?? null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ─── Approve PO → สร้าง Sale Order ──────────────────────────────────────
  const handleApprove = async (_reason: string) => {
    setActing('approve');
    try {
      const res = await api.post<ApiResponse<{ saleOrder: { id: string; saleOrderNo: string } }>>(
        `/quotations/${id}/po-approve`
      );
      const soNo = res.data.data?.saleOrder?.saleOrderNo;
      toast.success(`อนุมัติ PO แล้ว — สร้าง Sale Order ${soNo}`);
      setDialog(null);
      router.push('/quotations/pending-sale-order');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setActing(null);
    }
  };

  // ─── Reject PO → กลับไป Checklist ───────────────────────────────────────
  const handleReject = async (reason: string) => {
    setActing('reject');
    try {
      await api.post(`/quotations/${id}/po-reject`, { reason });
      toast.success('ปฏิเสธ PO — Officer จะได้รับแจ้งให้อัปโหลดใหม่');
      setDialog(null);
      router.push('/quotations/pending-sale-order');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setActing(null);
    }
  };

  // ─── Cancel (ลูกค้ายกเลิก) ───────────────────────────────────────────────
  const handleCancel = async (reason: string) => {
    setActing('cancel');
    try {
      await api.post(`/quotations/${id}/po-cancel`, { reason });
      toast.success('ยกเลิกใบเสนอราคาเรียบร้อย');
      setDialog(null);
      router.push('/quotations/pending-sale-order');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!q) {
    return (
      <div className="text-center py-20">
        <p>ไม่พบข้อมูล</p>
        <Button asChild variant="ghost" className="mt-4">
          <Link href="/quotations/pending-sale-order">ย้อนกลับ</Link>
        </Button>
      </div>
    );
  }

  const status = q.status as string;
  const isImage = q.poFileMimeType?.startsWith('image/');
  const isPdf   = q.poFileMimeType === 'application/pdf';

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-1">
            <Link href="/quotations/pending-sale-order"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{q.quotationNo}</h1>
              <Badge className={getStatusClass(status)} variant="outline">● {status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {q.customerCompany} · โดย {(q as any).createdBy?.name}
            </p>
          </div>
        </div>
      </div>

      {/* Status banner */}
      <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20">
        <CardContent className="pt-4 pb-4 flex gap-3 items-start">
          <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-800 dark:text-amber-200">PO รอการตรวจสอบ</div>
            <p className="text-xs text-muted-foreground mt-1">
              ตรวจสอบใบ PO ด้านล่างว่าตรงกับ QT หรือไม่ แล้วกดอนุมัติหรือปฏิเสธ
              {q.poSubmittedAt && ` · ส่งเมื่อ ${formatDate(q.poSubmittedAt)}`}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
        {/* LEFT: QT Detail */}
        <div className="space-y-5 min-w-0">
          {/* Customer info */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />ข้อมูลลูกค้า
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <InfoRow label={t('customer.company')} value={q.customerCompany} bold />
                <InfoRow label={t('customer.contactName')} value={q.customerContactName} />
                {q.customerTaxId && <InfoRow label={t('customer.taxId')} value={q.customerTaxId} />}
                {q.customerPhone && <InfoRow label={t('customer.phone')} value={q.customerPhone} />}
                {q.customerEmail && <InfoRow label={t('customer.email')} value={q.customerEmail} span2 />}
                {q.customerBillingAddress && <InfoRow label={t('customer.billingAddress')} value={q.customerBillingAddress} span2 />}
                <div className="md:col-span-2 pt-2 border-t grid grid-cols-2 gap-4">
                  <InfoRow label="วันที่ออก" value={formatDate(q.issueDate)} />
                  <InfoRow label="วันหมดอายุ" value={formatDate(q.expiryDate)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold mb-4">รายการสินค้า ({q.items?.length ?? 0} รายการ)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-muted-foreground">
                      <th className="text-left py-2 pr-3">SKU</th>
                      <th className="text-left py-2">ชื่อสินค้า</th>
                      <th className="text-right py-2 w-20">จำนวน</th>
                      <th className="text-center py-2 w-16">หน่วย</th>
                      <th className="text-right py-2 w-28">ราคา/หน่วย</th>
                      <th className="text-right py-2 w-28">รวม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {q.items?.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td className="py-3 text-xs text-muted-foreground pr-3 font-mono">{it.productSku || '-'}</td>
                        <td className="py-3">
                          <div className="font-medium">{it.productName}</div>
                          {it.productDescription && <div className="text-xs text-muted-foreground">{it.productDescription}</div>}
                        </td>
                        <td className="py-3 text-right">{formatNumber(it.quantity)}</td>
                        <td className="py-3 text-center text-muted-foreground">{it.unit}</td>
                        <td className="py-3 text-right">{formatNumber(it.unitPrice)}</td>
                        <td className="py-3 text-right font-semibold">{formatNumber(it.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Summary */}
              <div className="flex justify-end mt-4 pt-4 border-t">
                <div className="w-72 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">รวม</span><span>{formatNumber(q.subtotal)}</span></div>
                  {Number(q.discountTotal) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">ส่วนลด</span><span className="text-destructive">-{formatNumber(q.discountTotal)}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">VAT {formatNumber(q.vatRate)}%</span><span>{q.vatEnabled ? formatNumber(q.vatAmount) : 'ไม่มี'}</span></div>
                  <div className="flex justify-between items-baseline pt-2 border-t">
                    <span className="font-bold">ยอดรวมทั้งสิ้น</span>
                    <span className="text-2xl font-bold text-primary">{formatMoney(q.grandTotal, q.currency)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: PO File + Manager Actions */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {/* PO File */}
          <Card>
            <CardContent className="pt-5">
              <h2 className="font-semibold mb-4 text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />ใบ Purchase Order (PO)
              </h2>

              {q.poFileUrl ? (
                <div className="space-y-3">
                  <div className="border rounded-lg p-3 flex items-center gap-3 bg-muted/20">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {isImage ? <ImageIcon className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5 text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{q.poFileName}</div>
                      <div className="text-xs text-muted-foreground">
                        {q.poFileSize && `${(q.poFileSize / 1024).toFixed(0)} KB · `}
                        อัปโหลด {formatDate(q.poUploadedAt)}
                      </div>
                    </div>
                    <Button asChild variant="outline" size="icon" className="h-8 w-8 shrink-0">
                      <a href={q.poFileUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                  {isImage && (
                    <div className="rounded-lg overflow-hidden border">
                      <img src={q.poFileUrl} alt="PO" className="w-full max-h-72 object-contain bg-muted/20" />
                    </div>
                  )}
                  {isPdf && <iframe src={q.poFileUrl} className="w-full h-64 rounded-lg border" title="PO PDF" />}
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-muted-foreground">ยังไม่มีไฟล์ PO</div>
              )}
            </CardContent>
          </Card>

          {/* Manager Actions */}
          {isElevated && status === 'PO_PENDING' && (
            <Card className="border-2 border-amber-300">
              <CardContent className="pt-5 space-y-3">
                <p className="text-xs text-muted-foreground text-center">
                  ตรวจสอบ QT และ PO ว่าตรงกันแล้วดำเนินการ
                </p>

                {/* Approve → Sale Order */}
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={acting !== null}
                  onClick={() => setDialog('approve')}>
                  <CheckCircle2 className="h-4 w-4" />
                  อนุมัติ PO — สร้าง Sale Order
                </Button>

                {/* Reject → Officer อัปโหลดใหม่ */}
                <Button className="w-full" variant="destructive" disabled={acting !== null}
                  onClick={() => setDialog('reject')}>
                  <XCircle className="h-4 w-4" />
                  ปฏิเสธ PO — ให้ Officer อัปโหลดใหม่
                </Button>

                <div className="border-t pt-3">
                  <Button className="w-full" variant="outline" disabled={acting !== null}
                    onClick={() => setDialog('cancel')}
                    title="ลูกค้าต้องการยกเลิก">
                    <Ban className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">ยกเลิก (ลูกค้าขอยกเลิก)</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comment Thread */}
          <CommentThread quotationId={id} />
        </div>
      </div>

      {/* Dialogs */}
      {dialog === 'approve' && (
        <ConfirmDialog
          title={`อนุมัติ PO ของ ${q.quotationNo}?`}
          description="ระบบจะสร้าง Sale Order อัตโนมัติ และ Officer จะได้รับแจ้ง"
          confirmLabel="✓ อนุมัติ PO"
          onClose={() => setDialog(null)}
          onConfirm={handleApprove}
          loading={acting === 'approve'}
        />
      )}
      {dialog === 'reject' && (
        <ConfirmDialog
          title={`ปฏิเสธ PO ของ ${q.quotationNo}?`}
          description="Officer จะต้องอัปโหลด PO ใหม่และส่งมาให้ตรวจสอบอีกครั้ง"
          confirmLabel="✗ ปฏิเสธ PO"
          confirmVariant="destructive"
          requireReason
          onClose={() => setDialog(null)}
          onConfirm={handleReject}
          loading={acting === 'reject'}
        />
      )}
      {dialog === 'cancel' && (
        <ConfirmDialog
          title={`ยกเลิกใบเสนอราคา ${q.quotationNo}?`}
          description="ใช้เมื่อลูกค้าต้องการยกเลิก ไม่สามารถย้อนกลับได้"
          confirmLabel="ยืนยันยกเลิก"
          confirmVariant="destructive"
          requireReason
          onClose={() => setDialog(null)}
          onConfirm={handleCancel}
          loading={acting === 'cancel'}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value, bold, span2 }: { label: string; value: string; bold?: boolean; span2?: boolean }) {
  return (
    <div className={span2 ? 'md:col-span-2' : ''}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className={cn('mt-0.5', bold ? 'font-bold text-base' : 'font-medium')}>{value}</div>
    </div>
  );
}