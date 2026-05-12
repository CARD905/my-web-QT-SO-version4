'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft, Upload, FileText, Image as ImageIcon,
  Send, CheckCircle2, Loader2, AlertTriangle,
  Download, Clock, History, ChevronDown, ChevronUp,
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

const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024;

interface PoUploadHistoryEntry {
  url: string | null;
  fileName: string | null;
  uploadedAt: string;
  rejectedAt?: string;
  rejectedByName?: string;
  reason?: string;
}

interface ChecklistQuotation extends Quotation {
  poFileUrl?: string | null;
  poFileName?: string | null;
  poFileSize?: number | null;
  poFileMimeType?: string | null;
  poUploadedAt?: string | null;
  poSubmittedAt?: string | null;
  poApprovedAt?: string | null;
  poRejectedAt?: string | null;
  poRejectionReason?: string | null;
  poUploadHistory?: PoUploadHistoryEntry[] | null;
}

const STATUS_BANNERS: Record<string, { bg: string; icon: React.ElementType; title: string; textColor: string }> = {
  APPROVED:    { bg: 'border-blue-300 bg-blue-50 dark:bg-blue-900/20',    icon: Upload,        title: 'รออัปโหลดใบ PO',           textColor: 'text-blue-800 dark:text-blue-200' },
  PO_PENDING:  { bg: 'border-amber-300 bg-amber-50 dark:bg-amber-900/20', icon: Clock,         title: 'PO รอการตรวจสอบจาก Manager', textColor: 'text-amber-800 dark:text-amber-200' },
  PO_APPROVED: { bg: 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20', icon: CheckCircle2, title: 'PO อนุมัติแล้ว — สร้าง Sale Order เรียบร้อย', textColor: 'text-emerald-800 dark:text-emerald-200' },
  PO_REJECTED: { bg: 'border-red-300 bg-red-50 dark:bg-red-900/20',      icon: AlertTriangle, title: 'PO ถูกปฏิเสธ — กรุณาอัปโหลดใบ PO ใหม่',     textColor: 'text-red-800 dark:text-red-200' },
};

export default function ChecklistDetailPage() {
  const t = useT();
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();
  const { role } = usePermissions();

  const [q, setQ] = useState<ChecklistQuotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const userId = session?.user?.id;
  const isOwner = !!(userId && q?.createdById === userId);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<ChecklistQuotation>>(`/quotations/${id}`);
      setQ(res.data.data ?? null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('รองรับเฉพาะ PDF, PNG, JPG, WebP');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error('ไฟล์ใหญ่เกิน 10 MB');
      e.target.value = '';
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/quotations/${id}/po-upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          const pct = Math.round((e.loaded * 100) / (e.total ?? 1));
          setUploadProgress(pct);
        },
      });
      toast.success('อัปโหลด PO สำเร็จ');
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmitPo = async () => {
  if (!confirm('ส่ง PO ให้ Manager ตรวจสอบ?\n\nหลังส่งแล้ว จะแก้ไขหรือเปลี่ยนไฟล์ไม่ได้จนกว่าจะถูก reject')) return;
  setActing('submit');
  try {
    await api.post(`/quotations/${id}/po-submit`);
    toast.success('ส่ง PO ให้ Manager ตรวจสอบเรียบร้อย');
    setTimeout(() => window.location.reload(), 1000);
  } catch (err) {
    toast.error(getApiErrorMessage(err));
    setActing(null);
  }
};

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!q) {
    return (
      <div className="text-center py-20">
        <p>ไม่พบข้อมูล</p>
        <Button asChild variant="ghost" className="mt-4">
          <Link href="/quotations/checklist">ย้อนกลับ</Link>
        </Button>
      </div>
    );
  }

  const status = q.status as string;
  const banner = STATUS_BANNERS[status];
  const BannerIcon = banner?.icon;

  // ✅ Officer อัปโหลดได้เฉพาะ APPROVED + PO_REJECTED
  const canUpload   = isOwner && ['APPROVED', 'PO_REJECTED'].includes(status);
  const canSubmitPo = isOwner && ['APPROVED', 'PO_REJECTED'].includes(status) && !!q.poFileUrl;

  const isImage = q.poFileMimeType?.startsWith('image/');
  const isPdf   = q.poFileMimeType === 'application/pdf';
  const history = (q.poUploadHistory ?? []) as PoUploadHistoryEntry[];

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-1">
            <Link href="/quotations/checklist"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{q.quotationNo}</h1>
              <Badge className={getStatusClass(status)} variant="outline">● {status}</Badge>
              {q.version > 1 && <span className="text-xs text-muted-foreground">v{q.version}</span>}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {q.customerCompany} · อนุมัติเมื่อ {formatDate(q.approvedAt)}
            </p>
          </div>
        </div>
        {q.saleOrder && (
          <Button asChild>
            <Link href={`/sale-orders/${q.saleOrder.id}`}>
              <FileText className="h-4 w-4" />
              {q.saleOrder.saleOrderNo}
            </Link>
          </Button>
        )}
      </div>

      {/* Status Banner */}
      {banner && (
        <Card className={cn('border-2', banner.bg)}>
          <CardContent className="pt-4 pb-4 flex gap-3 items-start">
            <BannerIcon className={cn('h-5 w-5 shrink-0 mt-0.5', banner.textColor)} />
            <div className="flex-1">
              <div className={cn('font-semibold', banner.textColor)}>{banner.title}</div>
              {status === 'PO_PENDING' && q.poSubmittedAt && (
                <p className="text-xs text-muted-foreground mt-1">ส่งเมื่อ {formatDate(q.poSubmittedAt)}</p>
              )}
              {status === 'PO_REJECTED' && q.poRejectionReason && (
                <p className={cn('text-sm mt-1 font-medium', banner.textColor)}>
                  เหตุผล: {q.poRejectionReason}
                </p>
              )}
              {status === 'PO_APPROVED' && q.poApprovedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  อนุมัติเมื่อ {formatDate(q.poApprovedAt)}
                </p>
              )}
              {/* ✅ แจ้ง Officer ว่ารายการนี้อยู่ที่ Pending Sale Order แล้ว */}
              {status === 'PO_PENDING' && (
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Manager กำลังตรวจสอบอยู่ที่หน้า Pending Sale Order
                  </p>
                  <Link
                    href={`/quotations/pending-sale-order/${q.id}`}
                    className="text-xs text-primary underline hover:no-underline"
                  >
                    ดูหน้า Pending SO →
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
        {/* LEFT: Quotation Detail */}
        <div className="space-y-5 min-w-0">
          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold mb-4 text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />ข้อมูลลูกค้า
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <InfoRow label={t('customer.company')} value={q.customerCompany} bold />
                <InfoRow label={t('customer.contactName')} value={q.customerContactName} />
                {q.customerTaxId && <InfoRow label={t('customer.taxId')} value={q.customerTaxId} />}
                {q.customerPhone && <InfoRow label={t('customer.phone')} value={q.customerPhone} />}
                {q.customerEmail && <InfoRow label={t('customer.email')} value={q.customerEmail} span2 />}
                {q.customerBillingAddress && <InfoRow label={t('customer.billingAddress')} value={q.customerBillingAddress} span2 />}
                {q.customerShippingAddress && <InfoRow label="ที่อยู่จัดส่ง" value={q.customerShippingAddress} span2 />}
                <div className="md:col-span-2 pt-2 border-t grid grid-cols-2 gap-4">
                  <InfoRow label="วันที่ออก" value={formatDate(q.issueDate)} />
                  <InfoRow label="วันหมดอายุ" value={formatDate(q.expiryDate)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold mb-4 text-base">รายการสินค้า ({q.items?.length ?? 0} รายการ)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-muted-foreground">
                      <th className="text-left py-2 font-medium pr-3">SKU</th>
                      <th className="text-left py-2 font-medium">ชื่อสินค้า</th>
                      <th className="text-right py-2 font-medium w-20">จำนวน</th>
                      <th className="text-center py-2 font-medium w-16">หน่วย</th>
                      <th className="text-right py-2 font-medium w-28">ราคา/หน่วย</th>
                      <th className="text-right py-2 font-medium w-24">ส่วนลด</th>
                      <th className="text-right py-2 font-medium w-28">รวม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {q.items?.map((it, idx) => (
                      <tr key={it.id || idx} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 text-xs text-muted-foreground pr-3 font-mono">{it.productSku || '-'}</td>
                        <td className="py-3">
                          <div className="font-medium">{it.productName}</div>
                          {it.productDescription && <div className="text-xs text-muted-foreground mt-0.5">{it.productDescription}</div>}
                        </td>
                        <td className="py-3 text-right">{formatNumber(it.quantity)}</td>
                        <td className="py-3 text-center text-muted-foreground">{it.unit}</td>
                        <td className="py-3 text-right">{formatNumber(it.unitPrice)}</td>
                        <td className="py-3 text-right text-muted-foreground">
                          {Number(it.discount) > 0
                            ? it.discountType === 'PERCENTAGE' ? `${formatNumber(it.discount)}%` : formatNumber(it.discount)
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

          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold mb-4 text-base">สรุปยอด</h2>
              <div className="flex justify-end">
                <div className="w-full md:w-80 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('quotation.subtotal')}</span>
                    <span className="font-medium">{formatNumber(q.subtotal)}</span>
                  </div>
                  {Number(q.discountTotal) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('quotation.discount')}</span>
                      <span className="text-destructive font-medium">-{formatNumber(q.discountTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('quotation.vat')} ({formatNumber(q.vatRate)}%)</span>
                    <span className="font-medium">{q.vatEnabled ? formatNumber(q.vatAmount) : 'ไม่มี VAT'}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between items-baseline">
                    <span className="font-bold text-base">{t('quotation.grandTotal')}</span>
                    <span className="text-2xl font-bold text-primary">{formatMoney(q.grandTotal, q.currency)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {(q.paymentTerms || q.conditions) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {q.paymentTerms && (
                <Card><CardContent className="pt-5">
                  <div className="text-xs uppercase text-muted-foreground font-semibold mb-2">{t('quotation.paymentTerms')}</div>
                  <div className="text-sm font-medium">{q.paymentTerms}</div>
                </CardContent></Card>
              )}
              {q.conditions && (
                <Card><CardContent className="pt-5">
                  <div className="text-xs uppercase text-muted-foreground font-semibold mb-2">{t('quotation.conditions')}</div>
                  <div className="text-sm whitespace-pre-wrap">{q.conditions}</div>
                </CardContent></Card>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: PO Upload (Officer only) */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="pt-5">
              <h2 className="font-semibold mb-4 text-sm flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />ใบ Purchase Order (PO)
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
                    <Button asChild variant="outline" size="icon" className="shrink-0 h-8 w-8">
                      <a href={q.poFileUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>

                  {isImage && (
                    <div className="rounded-lg overflow-hidden border">
                      <img src={q.poFileUrl} alt="PO" className="w-full max-h-64 object-contain bg-muted/20" />
                    </div>
                  )}
                  {isPdf && <iframe src={q.poFileUrl} className="w-full h-56 rounded-lg border" title="PO PDF" />}

                  {/* ✅ Officer: upload + submit — เฉพาะ APPROVED + PO_REJECTED */}
                  {canUpload && (
                    <div className="space-y-2 pt-1">
                      <Button variant="outline" size="sm" className="w-full"
                        onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        เปลี่ยนไฟล์ PO
                      </Button>
                      {canSubmitPo && (
                        <Button className="w-full shine" onClick={handleSubmitPo} disabled={acting !== null}>
                          {acting === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          ส่งให้ Manager ตรวจสอบ
                        </Button>
                      )}
                    </div>
                  )}

                  {/* ✅ ข้อความเมื่อรออยู่ (Officer) — ไม่มีปุ่ม Manager แล้ว */}
                  {status === 'PO_PENDING' && isOwner && (
                    <p className="text-xs text-center text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2">
                      รอ Manager ตรวจสอบ — แก้ไขไม่ได้จนกว่าจะถูก reject
                    </p>
                  )}
                </div>
              ) : (
                canUpload ? (
                  <div
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={cn(
                      'border-2 border-dashed rounded-xl p-8 text-center transition-all',
                      uploading ? 'border-primary/50 cursor-default' : 'border-border hover:border-primary hover:bg-accent/20 cursor-pointer'
                    )}
                  >
                    {uploading ? (
                      <div className="space-y-2">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        <p className="text-sm font-medium">กำลังอัปโหลด... {uploadProgress}%</p>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                        <p className="font-medium text-sm">คลิกเพื่อเลือกไฟล์ PO</p>
                        <p className="text-xs text-muted-foreground mt-1.5">รองรับ PDF, PNG, JPG, WebP · ขนาดสูงสุด 10 MB</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-sm text-muted-foreground">ยังไม่มีไฟล์ PO</div>
                )
              )}

              <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileChange} className="hidden" />
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardContent className="pt-5">
                <button onClick={() => setShowHistory(!showHistory)}
                  className="w-full flex items-center justify-between text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    ประวัติการอัปโหลด ({history.length})
                  </span>
                  {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showHistory && (
                  <div className="mt-3 space-y-2">
                    {history.map((h, i) => (
                      <div key={i} className="text-xs border rounded-lg p-3 bg-muted/20">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{h.fileName || 'ไฟล์'}</span>
                          {h.url && <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline shrink-0">ดู</a>}
                        </div>
                        {h.rejectedAt && <div className="mt-1 text-red-600 dark:text-red-400">ถูกปฏิเสธ: {h.reason}</div>}
                        <div className="text-muted-foreground mt-0.5">{formatDate(h.uploadedAt)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {status === 'PO_PENDING' && (
            <CommentThread quotationId={id} />
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, bold, span2 }: {
  label: string; value: string; bold?: boolean; span2?: boolean;
}) {
  return (
    <div className={span2 ? 'md:col-span-2' : ''}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className={cn('mt-0.5', bold ? 'font-bold text-base' : 'font-medium')}>{value}</div>
    </div>
  );
}