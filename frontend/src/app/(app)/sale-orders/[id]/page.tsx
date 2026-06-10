'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft, Printer, FileText, Send, CheckCircle2,
  XCircle, Loader2, Clock, AlertTriangle, Download, Calendar,
  ZoomIn, ZoomOut, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { usePermissions } from '@/hooks/use-permissions';
import { formatDate, formatMoney, formatNumber, getStatusClass, cn } from '@/lib/utils';
import type { ApiResponse, CompanySettings, SaleOrder } from '@/types/api';

const MANAGER_ROLES = ['MANAGER', 'CEO', 'ADMIN', 'APPROVER'];

// ════════════════════════════════════════════════════════════════════════════
// Action Confirm Dialog — ใช้กับทุก action (submit / approve / reject)
// ════════════════════════════════════════════════════════════════════════════
function ActionConfirmDialog({ title, description, confirmLabel, confirmVariant = 'default',
  confirmIcon, requireComment, commentLabel, commentPlaceholder, onClose, onConfirm, loading,
}: {
  title: string; description: string;
  confirmLabel: string; confirmVariant?: 'default' | 'destructive' | 'emerald';
  confirmIcon?: React.ReactNode; requireComment?: boolean;
  commentLabel?: string; commentPlaceholder?: string;
  onClose: () => void; onConfirm: (comment?: string) => void; loading: boolean;
}) {
  const [comment, setComment] = useState('');
  const canConfirm = !requireComment || comment.trim().length >= 2;
  const btnClass = confirmVariant === 'emerald'
    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
    : '';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background rounded-2xl border shadow-2xl w-full max-w-md p-6">
        <h3 className="font-bold text-lg mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        {requireComment && (
          <div className="mb-4">
            <Label className="text-xs font-semibold mb-1.5 block">
              {commentLabel ?? 'คอมเมนต์'} <span className="text-destructive">*</span>
            </Label>
            <textarea
              value={comment} onChange={(e) => setComment(e.target.value)}
              rows={3} autoFocus placeholder={commentPlaceholder ?? 'ระบุรายละเอียด...'}
              className="w-full border border-input rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {!canConfirm && comment.length > 0 && (
              <p className="text-[11px] text-destructive mt-1">กรุณาระบุอย่างน้อย 2 ตัวอักษร</p>
            )}
          </div>
        )}
        <div className="flex gap-2 justify-end mt-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>ยกเลิก</Button>
          <Button
            variant={confirmVariant === 'emerald' ? 'default' : confirmVariant}
            className={btnClass}
            disabled={loading || !canConfirm}
            onClick={() => onConfirm(comment.trim() || undefined)}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmIcon}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PO File Preview with zoom
// ════════════════════════════════════════════════════════════════════════════
function POFilePreview({ url, mimeType, fileName }: { url: string; mimeType?: string | null; fileName?: string | null }) {
  const [zoom, setZoom] = useState(1);
  const isImage = mimeType?.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';

  if (!isImage && !isPdf) {
    return (
      <Button asChild variant="outline" size="sm" className="w-full">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Download className="h-3.5 w-3.5" />ดู/ดาวน์โหลด PO
        </a>
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      {/* Zoom controls */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground tabular-nums">{Math.round(zoom * 100)}%</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setZoom(z => Math.max(0.25, parseFloat((z - 0.25).toFixed(2))))}
            disabled={zoom <= 0.25}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
          <button
            onClick={() => setZoom(z => Math.min(4, parseFloat((z + 0.25).toFixed(2))))}
            disabled={zoom >= 4}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div
        className="rounded-lg border bg-muted/20 overflow-auto"
        style={{ height: 220 }}
      >
        {isImage && (
          <div className="flex justify-center items-start min-h-full">
            <img
              src={url}
              alt={fileName ?? 'PO'}
              style={{ width: `${zoom * 100}%`, flexShrink: 0, display: 'block' }}
            />
          </div>
        )}
        {isPdf && (
          <div style={{ width: `${zoom * 100}%`, height: '100%', minWidth: '100%', minHeight: 220 }}>
            <iframe src={url} title="PO PDF" className="w-full h-full" style={{ minHeight: 220 }} />
          </div>
        )}
      </div>

      {/* Download button */}
      <Button asChild variant="outline" size="sm" className="w-full">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Download className="h-3.5 w-3.5" />ดาวน์โหลด PO
        </a>
      </Button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Thai baht text
// ════════════════════════════════════════════════════════════════════════════
function toThaiBahtText(num: number): string {
  const txtNum = ['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
  const txtDigit = ['','สิบ','ร้อย','พัน','หมื่น','แสน','ล้าน'];
  function readNum(s: string): string {
    let r = ''; const l = s.length;
    for (let i = 0; i < l; i++) {
      const d = parseInt(s[i], 10); if (d === 0) continue;
      const p = l - i - 1;
      if (p === 0 && d === 1 && l > 1) r += 'เอ็ด';
      else if (p === 1 && d === 2) r += 'ยี่สิบ';
      else if (p === 1 && d === 1) r += 'สิบ';
      else r += txtNum[d] + txtDigit[p];
    }
    return r;
  }
  const fixed = Math.round(num * 100) / 100;
  const [bahtStr, satStr = '0'] = fixed.toFixed(2).split('.');
  let bahtText = parseInt(bahtStr) === 0 ? 'ศูนย์บาท' : '';
  if (parseInt(bahtStr) > 0) {
    let s = bahtStr;
    while (s.length > 6) { bahtText += readNum(s.slice(0, s.length - 6)) + 'ล้าน'; s = s.slice(s.length - 6); }
    bahtText += readNum(s) + 'บาท';
  }
  bahtText += parseInt(satStr) === 0 ? 'ถ้วน' : readNum(satStr.padEnd(2,'0').slice(0,2)) + 'สตางค์';
  return bahtText;
}

// ════════════════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════════════════
export default function SaleOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();
  const { role } = usePermissions();

  const [so, setSo] = useState<SaleOrder | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [dialogAction, setDialogAction] = useState<'submit' | 'resubmit' | 'approve' | 'reject' | null>(null);

  const userId = session?.user?.id;
  const isManager = !!(role?.code && MANAGER_ROLES.includes(role.code));

  const load = useCallback(async () => {
    try {
      const [soRes, cRes] = await Promise.all([
        api.get<ApiResponse<SaleOrder>>(`/sale-orders/${id}`),
        api.get<ApiResponse<CompanySettings>>('/company'),
      ]);
      const data = soRes.data.data ?? null;
      setSo(data);
      setCompany(cRes.data.data ?? null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleConfirmAction = async (comment?: string) => {
    if (!dialogAction) return;
    setActing(dialogAction);
    try {
      if (dialogAction === 'submit' || dialogAction === 'resubmit') {
        await api.post(`/sale-orders/${id}/submit`, comment ? { comment } : {});
        toast.success('ส่งให้ Manager อนุมัติเรียบร้อย');
      } else if (dialogAction === 'approve') {
        await api.post(`/sale-orders/${id}/approve`, { comment });
        toast.success('อนุมัติ Sale Order เรียบร้อย');
      } else if (dialogAction === 'reject') {
        await api.post(`/sale-orders/${id}/reject`, { reason: comment });
        toast.success('ปฏิเสธ Sale Order — Officer สามารถแก้ไขและส่งใหม่ได้');
      }
      setDialogAction(null);
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setActing(null); }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <Skeleton className="h-10 w-72" /><Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!so) return <div className="text-center py-20">ไม่พบข้อมูล</div>;

  const status = so.status as string;
  const isOwner = so.quotation?.createdById === userId;
  const isDraft = status === 'DRAFT';
  const isPending = status === 'PENDING_REVIEW';
  const isRejected = status === 'REJECTED';
  const isConfirmed = status === 'CONFIRMED';

  // CONFIRMED → เอกสารจริง
  if (isConfirmed) {
    return <ConfirmedDocument so={so} company={company} />;
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-1">
            <Link href="/sale-orders"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{so.saleOrderNo}</h1>
              <Badge className={getStatusClass(status)} variant="outline">● {status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {so.customerCompany}
              {so.quotation && ` · จาก ${so.quotation.quotationNo}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isDraft && isOwner && (
            <Button onClick={() => setDialogAction('submit')} disabled={acting !== null}>
              {acting === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              ส่งให้ Manager อนุมัติ
            </Button>
          )}
          {isRejected && isOwner && (
            <Button onClick={() => setDialogAction('resubmit')} disabled={acting !== null}>
              {acting === 'resubmit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              ส่งให้ Manager ใหม่
            </Button>
          )}
          {isPending && isManager && (
            <>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setDialogAction('approve')} disabled={acting !== null}>
                {acting === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                อนุมัติ
              </Button>
              <Button variant="destructive" onClick={() => setDialogAction('reject')} disabled={acting !== null}>
                <XCircle className="h-4 w-4" />ปฏิเสธ
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status Banners */}
      {isPending && (
        <Card className="border-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="pt-4 pb-4 flex gap-3 items-center">
            <Clock className="h-5 w-5 text-amber-700 dark:text-amber-400 shrink-0" />
            <div>
              <div className="font-semibold text-amber-800 dark:text-amber-200">รอ Manager อนุมัติ</div>
              {isOwner && <p className="text-xs text-muted-foreground mt-0.5">Sale Order อยู่ระหว่างการตรวจสอบ</p>}
              {isManager && <p className="text-xs text-muted-foreground mt-0.5">กรุณาตรวจสอบรายละเอียดแล้วกด อนุมัติ หรือ ปฏิเสธ</p>}
            </div>
          </CardContent>
        </Card>
      )}
      {isRejected && (
        <Card className="border-2 border-red-300 bg-red-50 dark:bg-red-900/20">
          <CardContent className="pt-4 pb-4 flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-red-800 dark:text-red-200">Sale Order ถูกปฏิเสธ</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                แก้ไขวันกำหนดส่งด้านขวา แล้วกด "ส่งให้ Manager ใหม่" ได้เลย
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* LEFT */}
        <div className="space-y-5 min-w-0">
          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold mb-4 text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />ข้อมูลลูกค้า
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <InfoRow label="บริษัท" value={so.customerCompany} bold />
                <InfoRow label="ผู้ติดต่อ" value={so.customerContactName} />
                {so.customerTaxId && <InfoRow label="เลขผู้เสียภาษี" value={so.customerTaxId} />}
                {so.customerPhone && <InfoRow label="โทรศัพท์" value={so.customerPhone} />}
                {so.customerEmail && <InfoRow label="Email" value={so.customerEmail} span2 />}
                {so.customerBillingAddress && <InfoRow label="ที่อยู่" value={so.customerBillingAddress} span2 />}
                <div className="md:col-span-2 pt-2 border-t grid grid-cols-2 gap-4">
                  <InfoRow label="วันที่ออก" value={formatDate(so.issueDate)} />
                  {so.paymentTerms && <InfoRow label="เงื่อนไขชำระเงิน" value={so.paymentTerms} />}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold mb-4 text-base">รายการสินค้า ({so.items?.length ?? 0} รายการ)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-muted-foreground">
                      <th className="text-left py-2 font-medium pr-3">SKU</th>
                      <th className="text-left py-2 font-medium">ชื่อสินค้า</th>
                      <th className="text-right py-2 font-medium w-20">จำนวน</th>
                      <th className="text-center py-2 font-medium w-16">หน่วย</th>
                      <th className="text-right py-2 font-medium w-28">ราคา/หน่วย</th>
                      <th className="text-right py-2 font-medium w-28">รวม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {so.items?.map((it, idx) => (
                      <tr key={it.id || idx} className="hover:bg-muted/30">
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
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold mb-4 text-base">สรุปยอด</h2>
              <div className="flex justify-end">
                <div className="w-full md:w-80 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ราคารวม</span>
                    <span className="font-medium">{formatNumber(so.subtotal)}</span>
                  </div>
                  {Number(so.discountTotal) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">ส่วนลด</span>
                      <span className="text-destructive font-medium">-{formatNumber(so.discountTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">VAT ({formatNumber(so.vatRate)}%)</span>
                    <span className="font-medium">{so.vatEnabled ? formatNumber(so.vatAmount) : 'ไม่มี VAT'}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between items-baseline">
                    <span className="font-bold text-base">ยอดรวมทั้งสิ้น</span>
                    <span className="text-2xl font-bold text-primary">{formatMoney(so.grandTotal, so.currency)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="pt-5">
              <h2 className="font-semibold mb-4 text-sm">ข้อมูล PO</h2>
              <div className="space-y-3">
                {so.poNumber && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">หมายเลขใบสั่งซื้อ (PO Number)</div>
                    <div className="font-semibold text-base">{so.poNumber}</div>
                  </div>
                )}
                {so.quotation?.poFileUrl && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">ไฟล์ PO</div>
                    <POFilePreview
                      url={so.quotation.poFileUrl as string}
                      mimeType={so.quotation.poFileMimeType}
                      fileName={so.quotation.poFileName}
                    />
                  </div>
                )}
                {so.quotation && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">ใบเสนอราคา</div>
                    <Button asChild variant="ghost" size="sm" className="w-full justify-start">
                      <Link href={`/quotations/${so.quotation.id}`}>
                        <FileText className="h-3.5 w-3.5" />{so.quotation.quotationNo}
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Deadline Card */}
          <Card>
            <CardContent className="pt-5">
              <h2 className="font-semibold mb-3 text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />วันจัดส่ง
              </h2>
              {so.deadlineDate
                ? <div className="font-semibold">{formatDate(so.deadlineDate)}</div>
                : <div className="text-sm text-muted-foreground">ไม่ได้ระบุวันจัดส่ง</div>
              }
            </CardContent>
          </Card>

          {isPending && isOwner && (
            <p className="text-xs text-center text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2">
              รอ Manager อนุมัติ — แก้ไขไม่ได้ในขณะนี้
            </p>
          )}
        </div>
      </div>

      {dialogAction === 'submit' && (
        <ActionConfirmDialog
          title="ส่ง Sale Order ให้ Manager อนุมัติ"
          description="Sale Order จะเปลี่ยนเป็นสถานะ รอตรวจสอบ และส่งให้ Manager ทราบ"
          confirmLabel="ยืนยันส่ง" confirmVariant="default" confirmIcon={<Send className="h-4 w-4" />}
          requireComment={false}
          onClose={() => setDialogAction(null)} onConfirm={handleConfirmAction} loading={acting === 'submit'}
        />
      )}
      {dialogAction === 'resubmit' && (
        <ActionConfirmDialog
          title="ส่งให้ Manager อนุมัติอีกครั้ง"
          description="Sale Order ที่ถูกปฏิเสธจะถูกส่งกลับให้ Manager ตรวจสอบใหม่"
          confirmLabel="ยืนยันส่งใหม่" confirmVariant="default" confirmIcon={<Send className="h-4 w-4" />}
          requireComment commentLabel="คอมเมนต์ / ชี้แจงการแก้ไข" commentPlaceholder="อธิบายสิ่งที่แก้ไขหรือเหตุผลที่ส่งใหม่..."
          onClose={() => setDialogAction(null)} onConfirm={handleConfirmAction} loading={acting === 'resubmit'}
        />
      )}
      {dialogAction === 'approve' && (
        <ActionConfirmDialog
          title="อนุมัติ Sale Order"
          description="Sale Order จะเปลี่ยนเป็นสถานะ CONFIRMED และ Officer จะได้รับการแจ้งเตือน"
          confirmLabel="ยืนยันอนุมัติ" confirmVariant="emerald" confirmIcon={<CheckCircle2 className="h-4 w-4" />}
          requireComment commentLabel="คอมเมนต์การอนุมัติ" commentPlaceholder="เช่น ตรวจสอบรายละเอียดแล้ว ถูกต้องทุกประการ..."
          onClose={() => setDialogAction(null)} onConfirm={handleConfirmAction} loading={acting === 'approve'}
        />
      )}
      {dialogAction === 'reject' && (
        <ActionConfirmDialog
          title="ปฏิเสธ Sale Order"
          description="Sale Order จะกลับไปที่ Officer เพื่อแก้ไขและส่งใหม่"
          confirmLabel="ยืนยันปฏิเสธ" confirmVariant="destructive" confirmIcon={<XCircle className="h-4 w-4" />}
          requireComment commentLabel="เหตุผลที่ปฏิเสธ" commentPlaceholder="ระบุเหตุผล เช่น ราคาไม่ถูกต้อง, ขาดเอกสาร..."
          onClose={() => setDialogAction(null)} onConfirm={handleConfirmAction} loading={acting === 'reject'}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CONFIRMED Document
// ════════════════════════════════════════════════════════════════════════════
function ConfirmedDocument({ so, company }: { so: SaleOrder; company: CompanySettings | null }) {
  const grandTotalNum = Number(so.grandTotal);
  const afterDiscount = Number(so.subtotal) - Number(so.discountTotal);
  const bahtText = so.currency === 'THB' ? toThaiBahtText(grandTotalNum) : '';
  const minRows = 8;
  const padCount = Math.max(0, minRows - (so.items?.length ?? 0));
  const NAVY = '#1a3557';
  const NAVY_LIGHT = '#e8eef5';

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #so-printable, #so-printable * { visibility: visible !important; }
          #so-printable { position: fixed; inset: 0; padding: 0; margin: 0; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 10mm; }
        }
        #so-printable { font-family: 'Sarabun', 'TH Sarabun New', sans-serif; }
        .so-tr-alt:nth-child(even) { background-color: #f8fafc; }
      `}</style>

      <div className="max-w-4xl mx-auto">
        {/* ── Screen toolbar ── */}
        <div className="no-print flex flex-wrap gap-3 items-center justify-between mb-5 p-3 rounded-xl border bg-card shadow-sm">
          <Button asChild variant="ghost" size="sm">
            <Link href="/sale-orders"><ArrowLeft className="h-4 w-4" />กลับรายการ</Link>
          </Button>
          <div className="flex gap-2 items-center flex-wrap">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 gap-1.5">
              <CheckCircle2 className="h-3 w-3" />CONFIRMED
            </Badge>
            {so.quotation && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/quotations/${so.quotation.id}`}>
                  <FileText className="h-3.5 w-3.5" />{so.quotation.quotationNo}
                </Link>
              </Button>
            )}
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" />พิมพ์ / Save PDF
            </Button>
          </div>
        </div>

        {/* ── Printable Document ── */}
        <div id="so-printable" className="bg-white text-black" style={{ fontFamily: 'Sarabun, sans-serif', border: `1.5px solid ${NAVY}` }}>

          {/* Accent bar */}
          <div style={{ height: 6, background: NAVY }} />

          {/* ── Header: Company + Title ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', borderBottom: `1.5px solid ${NAVY}` }}>
            {/* Company info */}
            <div style={{ padding: '14px 16px', borderRight: `1.5px solid ${NAVY}`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {company?.logoUrl ? (
                <img src={company.logoUrl} alt="logo" style={{ width: 64, height: 64, objectFit: 'contain', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 52, height: 52, background: NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 22, flexShrink: 0, borderRadius: 4 }}>
                  {(company?.companyNameTh || company?.companyName || 'C').slice(0, 1)}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: NAVY }}>{company?.companyNameTh || company?.companyName || 'บริษัท'}</div>
                {company?.companyNameTh && company?.companyName && (
                  <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{company.companyName}</div>
                )}
                <div style={{ fontSize: 11, color: '#444', marginTop: 5, lineHeight: 1.7 }}>
                  {(company?.addressTh || company?.address) && <div>{company?.addressTh || company?.address}</div>}
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {company?.phone && <span>โทร. {company.phone}</span>}
                    {company?.fax && <span>แฟกซ์ {company.fax}</span>}
                  </div>
                  {company?.email && <div>Email: {company.email}</div>}
                  {company?.taxId && <div style={{ marginTop: 3 }}>เลขผู้เสียภาษี: <strong>{company.taxId}</strong></div>}
                </div>
              </div>
            </div>

            {/* Document title + meta */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: NAVY, color: '#fff', textAlign: 'center', padding: '10px 8px', borderBottom: `1.5px solid ${NAVY}` }}>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 3 }}>SALE ORDER</div>
                <div style={{ fontSize: 11, opacity: 0.85, marginTop: 1 }}>ใบสั่งขาย / ใบยืนยันการสั่งซื้อ</div>
              </div>
              <table style={{ width: '100%', fontSize: 11, flex: 1 }}>
                <tbody>
                  {[
                    { label: 'เลขที่', value: so.saleOrderNo, bold: true },
                    { label: 'วันที่ออก', value: formatDate(so.issueDate) },
                    { label: 'เลข PO', value: so.poNumber || '—' },
                    ...(so.deadlineDate ? [{ label: 'กำหนดส่ง', value: formatDate(so.deadlineDate) }] : []),
                    { label: 'อ้างอิง QT', value: so.quotation?.quotationNo || '—' },
                  ].map((row, i, arr) => (
                    <tr key={i} style={{ borderBottom: i < arr.length - 1 ? `1px solid #d0dae8` : undefined }}>
                      <td style={{ padding: '5px 10px', color: '#555', width: '45%', background: NAVY_LIGHT, borderRight: `1px solid #d0dae8` }}>{row.label}</td>
                      <td style={{ padding: '5px 10px', fontWeight: row.bold ? 700 : 600, textAlign: 'right', color: row.bold ? NAVY : '#111' }}>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Customer + Terms ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1.5px solid ${NAVY}` }}>
            <div style={{ padding: '10px 16px', borderRight: `1px solid #c8d8e8` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>ข้อมูลลูกค้า · Bill To</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#111', marginBottom: 3 }}>{so.customerCompany}</div>
              <div style={{ fontSize: 11, color: '#444', lineHeight: 1.75 }}>
                {so.customerContactName && <div>ผู้ติดต่อ: {so.customerContactName}</div>}
                {so.customerTaxId && <div>เลขผู้เสียภาษี: {so.customerTaxId}</div>}
                {so.customerPhone && <div>โทร. {so.customerPhone}</div>}
                {so.customerEmail && <div>{so.customerEmail}</div>}
                {so.customerBillingAddress && <div style={{ marginTop: 4, color: '#555' }}>{so.customerBillingAddress}</div>}
              </div>
            </div>
            <div style={{ padding: '10px 16px', background: '#fafcff' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>เงื่อนไข · Terms</div>
              <div style={{ fontSize: 11, color: '#444', lineHeight: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#666' }}>สกุลเงิน</span>
                  <span style={{ fontWeight: 600 }}>{so.currency}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#666' }}>เงื่อนไขชำระเงิน</span>
                  <span style={{ fontWeight: 600 }}>{so.paymentTerms || '—'}</span>
                </div>
                {so.deadlineDate && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>กำหนดส่งสินค้า</span>
                    <span style={{ fontWeight: 600 }}>{formatDate(so.deadlineDate)}</span>
                  </div>
                )}
                {so.customerShippingAddress && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ color: '#666', fontSize: 10 }}>ที่อยู่จัดส่ง (Ship To)</div>
                    <div style={{ fontWeight: 600 }}>{so.customerShippingAddress}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Items Table ── */}
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', borderBottom: `1.5px solid ${NAVY}` }}>
            <thead>
              <tr style={{ background: NAVY, color: '#fff' }}>
                <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)', width: 72 }}>SKU</th>
                <th style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)' }}>รายการสินค้า / Description</th>
                <th style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)', width: 56 }}>จำนวน</th>
                <th style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)', width: 44 }}>หน่วย</th>
                <th style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)', width: 90 }}>ราคา/หน่วย</th>
                <th style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)', width: 60 }}>ส่วนลด</th>
                <th style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600, width: 96 }}>จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody>
              {so.items?.map((it, idx) => (
                <tr key={it.id || idx} className="so-tr-alt" style={{ borderBottom: '1px solid #dde7f0' }}>
                  <td style={{ padding: '7px 8px', fontFamily: 'monospace', fontSize: 10, color: '#666', borderRight: '1px solid #dde7f0' }}>{it.productSku || '—'}</td>
                  <td style={{ padding: '7px 8px', borderRight: '1px solid #dde7f0' }}>
                    <div style={{ fontWeight: 600 }}>{it.productName}</div>
                    {it.productDescription && <div style={{ fontSize: 10, color: '#777', marginTop: 1 }}>{it.productDescription}</div>}
                  </td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', borderRight: '1px solid #dde7f0' }}>{formatNumber(it.quantity)}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center', color: '#555', borderRight: '1px solid #dde7f0' }}>{it.unit}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', borderRight: '1px solid #dde7f0' }}>{formatNumber(it.unitPrice)}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', color: '#e53e3e', borderRight: '1px solid #dde7f0' }}>
                    {Number(it.discount) > 0 ? (it.discountType === 'PERCENTAGE' ? `${formatNumber(it.discount)}%` : formatNumber(it.discount)) : '—'}
                  </td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700 }}>{formatNumber(it.lineTotal)}</td>
                </tr>
              ))}
              {Array.from({ length: padCount }).map((_, i) => (
                <tr key={`pad-${i}`} className="so-tr-alt" style={{ borderBottom: '1px solid #dde7f0' }}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} style={{ padding: '7px 8px', borderRight: j < 6 ? '1px solid #dde7f0' : undefined }}>&nbsp;</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Footer: Baht text + Summary ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px' }}>
            {/* Left: Baht text + Bank */}
            <div style={{ padding: '12px 16px', borderRight: `1.5px solid ${NAVY}`, borderBottom: `1.5px solid ${NAVY}` }}>
              {bahtText && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: '#666', marginBottom: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>จำนวนเงินตัวอักษร</div>
                  <div style={{ fontSize: 12, fontStyle: 'italic', fontWeight: 600, color: '#222', padding: '5px 10px', background: NAVY_LIGHT, borderLeft: `3px solid ${NAVY}`, borderRadius: 2 }}>
                    ( {bahtText} )
                  </div>
                </div>
              )}
              {company?.bankName && (
                <div style={{ marginTop: bahtText ? 10 : 0 }}>
                  <div style={{ fontSize: 10, color: '#666', marginBottom: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>โอนเงินเข้าบัญชี</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: NAVY }}>
                    {company.bankName}{company.bankAccount && ` — ${company.bankAccount}`}
                  </div>
                  {company.bankBranch && <div style={{ fontSize: 11, color: '#555' }}>สาขา {company.bankBranch}</div>}
                </div>
              )}
            </div>

            {/* Right: Summary rows */}
            <div style={{ fontSize: 11 }}>
              {[
                { label: 'รวมเงิน (ก่อน VAT)', value: formatNumber(so.subtotal) },
                ...(Number(so.discountTotal) > 0 ? [{ label: 'ส่วนลดรวม', value: `− ${formatNumber(so.discountTotal)}`, red: true }] : []),
                ...(Number(so.discountTotal) > 0 ? [{ label: 'หลังหักส่วนลด', value: formatNumber(afterDiscount) }] : []),
                so.vatEnabled
                  ? { label: `ภาษีมูลค่าเพิ่ม (VAT ${formatNumber(so.vatRate)}%)`, value: formatNumber(so.vatAmount) }
                  : { label: 'ภาษีมูลค่าเพิ่ม', value: 'ไม่มี VAT', muted: true },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid #dde7f0', color: (row as { red?: boolean }).red ? '#e53e3e' : (row as { muted?: boolean }).muted ? '#999' : '#333' }}>
                  <span style={{ color: '#555' }}>{row.label}</span>
                  <span style={{ fontWeight: 600, minWidth: 90, textAlign: 'right' }}>{row.value}</span>
                </div>
              ))}
              <div style={{ background: NAVY, color: '#fff', padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: `1.5px solid ${NAVY}` }}>
                <span style={{ fontWeight: 700, fontSize: 12 }}>จำนวนเงินทั้งสิ้น</span>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{formatNumber(so.grandTotal)} {so.currency}</span>
              </div>
            </div>
          </div>

          {/* ── Conditions ── */}
          {so.conditions && (
            <div style={{ padding: '8px 16px', borderBottom: `1px solid #c8d8e8`, background: '#fafcff' }}>
              <div style={{ fontSize: 10, color: '#666', marginBottom: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>เงื่อนไขและหมายเหตุ</div>
              <div style={{ fontSize: 11, whiteSpace: 'pre-wrap', color: '#333', lineHeight: 1.6 }}>{so.conditions}</div>
            </div>
          )}

          {/* ── Signature Section ── */}
          <div style={{ padding: '6px 24px 16px', borderTop: `1px solid #c8d8e8` }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 8 }}>
              {[
                { th: 'ผู้อนุมัติสั่งซื้อ', en: 'Authorized Buyer' },
                { th: 'พนักงานขาย', en: 'Sales Representative' },
                { th: 'ผู้มีอำนาจลงนาม', en: 'Authorized Signatory' },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ height: 48 }} />
                  <div style={{ borderTop: `1.5px solid ${NAVY}`, marginTop: 4, paddingTop: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#222' }}>{s.th}</div>
                    <div style={{ fontSize: 10, color: '#777', marginTop: 1 }}>{s.en}</div>
                    <div style={{ fontSize: 10, color: '#999', marginTop: 8 }}>วันที่ ________________</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom accent bar */}
          <div style={{ height: 4, background: NAVY }} />
        </div>
      </div>
    </>
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
