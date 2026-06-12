'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft, Upload, FileText, Image as ImageIcon,
  Send, CheckCircle2, Loader2, AlertTriangle,
  Download, Clock, History, ChevronDown, ChevronUp, Hash,
  ZoomIn, ZoomOut, RotateCcw, RotateCw, ExternalLink, Maximize2, Minimize2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  poNumber?: string | null;
}

const STATUS_BANNERS: Record<string, { bg: string; icon: React.ElementType; title: string; textColor: string }> = {
  APPROVED:    { bg: 'border-blue-300 bg-blue-50 dark:bg-blue-900/20',    icon: Upload,        title: 'รออัปโหลดใบ PO และกรอกหมายเลขใบสั่งซื้อ', textColor: 'text-blue-800 dark:text-blue-200' },
  PO_PENDING:  { bg: 'border-amber-300 bg-amber-50 dark:bg-amber-900/20', icon: Clock,         title: 'รอ Manager ตรวจสอบ Sale Order',            textColor: 'text-amber-800 dark:text-amber-200' },
  PO_APPROVED: { bg: 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20', icon: CheckCircle2, title: 'ดำเนินการเรียบร้อย — ดู Sale Order ได้เลย', textColor: 'text-emerald-800 dark:text-emerald-200' },
  PO_REJECTED: { bg: 'border-red-300 bg-red-50 dark:bg-red-900/20',      icon: AlertTriangle, title: 'PO ถูกปฏิเสธ — กรุณาอัปโหลดใหม่',          textColor: 'text-red-800 dark:text-red-200' },
};

export default function ChecklistDetailPage() {
  const t = useT();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: session } = useSession();

  const [q, setQ] = useState<ChecklistQuotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [poNumber, setPoNumber] = useState('');
  const [poZoom, setPoZoom] = useState(1);
  const [poRotation, setPoRotation] = useState(0);
  const [poFullscreen, setPoFullscreen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const userId = session?.user?.id;
  const isOwner = !!(userId && q?.createdById === userId);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<ChecklistQuotation>>(`/quotations/${id}`);
      const data = res.data.data ?? null;
      setQ(data);
      if (data?.poNumber) setPoNumber(data.poNumber);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Close fullscreen on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setPoFullscreen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) { toast.error('รองรับเฉพาะ PDF, PNG, JPG, WebP'); e.target.value = ''; return; }
    if (file.size > MAX_SIZE) { toast.error('ไฟล์ใหญ่เกิน 10 MB'); e.target.value = ''; return; }

    setUploading(true); setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/quotations/${id}/po-upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => setUploadProgress(Math.round((e.loaded * 100) / (e.total ?? 1))),
      });
      toast.success('อัปโหลด PO สำเร็จ');
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setUploading(false); setUploadProgress(0); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleSubmitPo = async () => {
    if (!poNumber.trim()) { toast.error('กรุณากรอกหมายเลขใบสั่งซื้อ (PO Number)'); return; }
    if (!q?.poFileUrl) { toast.error('กรุณาอัปโหลดไฟล์ PO ก่อน'); return; }
    if (!confirm('ยืนยันส่ง PO?\n\nระบบจะสร้าง Sale Order และส่งให้ Manager ตรวจสอบ')) return;

    setActing('submit');
    try {
      const res = await api.post<ApiResponse<{ quotation: ChecklistQuotation; saleOrder: { id: string; saleOrderNo: string } }>>(
        `/quotations/${id}/po-submit`,
        { poNumber: poNumber.trim() },
      );
      const soId = res.data.data?.saleOrder?.id;
      const soNo = res.data.data?.saleOrder?.saleOrderNo;
      toast.success(`สร้าง Sale Order ${soNo} เรียบร้อย`);
      if (soId) router.push(`/sale-orders/${soId}`);
      else await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setActing(null);
    }
  };

  const resetViewer = () => { setPoZoom(1); setPoRotation(0); };

  if (loading) {
    return (
      <div className="space-y-4 max-w-7xl">
        <Skeleton className="h-10 w-72" /><Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" /><Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-[520px] w-full" />
        </div>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="text-center py-20">
        <p>ไม่พบข้อมูล</p>
        <Button asChild variant="ghost" className="mt-4"><Link href="/quotations/checklist">ย้อนกลับ</Link></Button>
      </div>
    );
  }

  const status = q.status as string;
  const banner = STATUS_BANNERS[status];
  const BannerIcon = banner?.icon;
  const canUpload   = isOwner && ['APPROVED', 'PO_REJECTED'].includes(status);
  const isImage = q.poFileMimeType?.startsWith('image/');
  const isPdf   = q.poFileMimeType === 'application/pdf';
  const hasPreview = !!(q.poFileUrl && (isImage || isPdf));
  const history = (q.poUploadHistory ?? []) as PoUploadHistoryEntry[];

  return (
    <>
      {/* ── Fullscreen overlay ── */}
      {poFullscreen && q.poFileUrl && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          {/* Fullscreen toolbar */}
          <div className="flex items-center justify-between gap-3 px-4 py-2 bg-black/60 border-b border-white/10">
            <span className="text-sm text-white/70 font-mono truncate">{q.poFileName}</span>
            <div className="flex items-center gap-1">
              <ViewerToolbar
                zoom={poZoom} setZoom={setPoZoom}
                rotation={poRotation} setRotation={setPoRotation}
                fileUrl={q.poFileUrl} fileName={q.poFileName}
                onReset={resetViewer}
                dark
              />
              <div className="w-px h-5 bg-white/20 mx-1" />
              <button onClick={() => setPoFullscreen(false)}
                className="h-7 w-7 flex items-center justify-center rounded text-white/80 hover:bg-white/10 transition-colors">
                <Minimize2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* Content */}
          <div className="flex-1 overflow-auto flex items-start justify-center p-4"
            onDoubleClick={resetViewer}>
            {isImage && (
              <img src={q.poFileUrl} alt="PO"
                style={{ width: `${poZoom * 100}%`, transform: `rotate(${poRotation}deg)`, transformOrigin: 'center top', maxWidth: 'none', transition: 'transform 0.2s' }} />
            )}
            {isPdf && (
              <iframe src={q.poFileUrl} title="PO PDF" className="w-full rounded" style={{ height: 'calc(100vh - 60px)', minHeight: 600 }} />
            )}
          </div>
        </div>
      )}

      <div className="space-y-5 max-w-7xl">
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
                <FileText className="h-4 w-4" />{q.saleOrder.saleOrderNo}
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
                  <p className={cn('text-sm mt-1 font-medium', banner.textColor)}>เหตุผล: {q.poRejectionReason}</p>
                )}
                {status === 'PO_APPROVED' && q.poApprovedAt && (
                  <p className="text-xs text-muted-foreground mt-1">อนุมัติเมื่อ {formatDate(q.poApprovedAt)}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ══ Main two-column split ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ── LEFT: Quotation info ── */}
          <div className="space-y-5 min-w-0">
            {/* Customer info */}
            <Card>
              <CardContent className="pt-5 pb-5">
                <h2 className="font-semibold mb-4 text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />ข้อมูลลูกค้า
                </h2>
                <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                  <InfoRow label={t('customer.company')} value={q.customerCompany} bold />
                  <InfoRow label={t('customer.contactName')} value={q.customerContactName} />
                  {q.customerTaxId && <InfoRow label={t('customer.taxId')} value={q.customerTaxId} />}
                  {q.customerPhone && <InfoRow label={t('customer.phone')} value={q.customerPhone} />}
                  {q.customerEmail && <InfoRow label={t('customer.email')} value={q.customerEmail} span2 />}
                  {q.customerBillingAddress && <InfoRow label={t('customer.billingAddress')} value={q.customerBillingAddress} span2 />}
                  <div className="col-span-2 pt-2 border-t grid grid-cols-2 gap-4">
                    <InfoRow label="วันที่ออก" value={formatDate(q.issueDate)} />
                    <InfoRow label="เงื่อนไขชำระเงิน" value={q.paymentTerms ?? '-'} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line items */}
            <Card>
              <CardContent className="pt-5 pb-5">
                <h2 className="font-semibold mb-4 text-base">รายการสินค้า ({q.items?.length ?? 0} รายการ)</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase text-muted-foreground">
                        <th className="text-left py-2 font-medium pr-3">SKU</th>
                        <th className="text-left py-2 font-medium">ชื่อสินค้า</th>
                        <th className="text-right py-2 font-medium w-16">จำนวน</th>
                        <th className="text-center py-2 font-medium w-14">หน่วย</th>
                        <th className="text-right py-2 font-medium w-24">ราคา/หน่วย</th>
                        <th className="text-right py-2 font-medium w-24">รวม</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {q.items?.map((it, idx) => (
                        <tr key={it.id || idx} className="hover:bg-muted/30">
                          <td className="py-2.5 text-xs text-muted-foreground pr-3 font-mono">{it.productSku || '-'}</td>
                          <td className="py-2.5">
                            <div className="font-medium">{it.productName}</div>
                            {it.productDescription && (
                              <div className="text-xs text-muted-foreground mt-0.5">{it.productDescription}</div>
                            )}
                          </td>
                          <td className="py-2.5 text-right">{formatNumber(it.quantity)}</td>
                          <td className="py-2.5 text-center text-muted-foreground">{it.unit}</td>
                          <td className="py-2.5 text-right">{formatNumber(it.unitPrice)}</td>
                          <td className="py-2.5 text-right font-semibold text-primary">{formatNumber(it.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Totals row */}
                <div className="mt-4 pt-3 border-t flex justify-end">
                  <div className="w-56 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('quotation.subtotal')}</span>
                      <span>{formatNumber(q.subtotal)}</span>
                    </div>
                    {Number(q.discountTotal) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('quotation.discount')}</span>
                        <span className="text-destructive">-{formatNumber(q.discountTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">VAT {formatNumber(q.vatRate)}%</span>
                      <span>{q.vatEnabled ? formatNumber(q.vatAmount) : '—'}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base border-t pt-2">
                      <span>{t('quotation.grandTotal')}</span>
                      <span className="text-primary">{formatMoney(q.grandTotal, q.currency)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT: PO Panel ── */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <Card className="overflow-hidden">
              <CardContent className="pt-5 pb-5">

                {/* Panel header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-base flex items-center gap-2">
                      <Upload className="h-4 w-4 text-primary" />ข้อมูล PO
                    </h2>
                    {q.poNumber && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        หมายเลขใบสั่งซื้อ:{' '}
                        <span className="font-semibold text-foreground">{q.poNumber}</span>
                      </p>
                    )}
                  </div>
                  {q.poFileName && (
                    <Badge variant="outline" className="text-xs font-mono shrink-0">{q.poFileName}</Badge>
                  )}
                </div>

                {/* ── PO Number input (when can upload) ── */}
                {canUpload && (
                  <div className="mb-4">
                    <Label htmlFor="poNumber" className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
                      <Hash className="h-3.5 w-3.5" />
                      หมายเลขใบสั่งซื้อ (PO Number) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="poNumber"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      placeholder="เช่น PO-2026-0001"
                      className="text-sm"
                    />
                  </div>
                )}

                {/* ── File viewer ── */}
                {hasPreview ? (
                  <div className="space-y-2">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-muted/40 rounded-lg border border-border/50">
                      {/* Left: zoom controls */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPoZoom(z => Math.max(0.25, parseFloat((z - 0.25).toFixed(2))))}
                          disabled={poZoom <= 0.25}
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-background disabled:opacity-30 transition-colors"
                          title="ซูมออก"
                        >
                          <ZoomOut className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="range"
                          min={25} max={400} step={25}
                          value={Math.round(poZoom * 100)}
                          onChange={(e) => setPoZoom(Number(e.target.value) / 100)}
                          className="w-24 h-1 accent-primary cursor-pointer"
                          title="ซูม"
                        />
                        <button
                          onClick={() => setPoZoom(z => Math.min(4, parseFloat((z + 0.25).toFixed(2))))}
                          disabled={poZoom >= 4}
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-background disabled:opacity-30 transition-colors"
                          title="ซูมเข้า"
                        >
                          <ZoomIn className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-[11px] tabular-nums text-muted-foreground w-10 text-center font-mono">
                          {Math.round(poZoom * 100)}%
                        </span>
                        <div className="w-px h-4 bg-border mx-0.5" />
                        <button
                          onClick={() => setPoRotation(r => (r - 90 + 360) % 360)}
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-background transition-colors"
                          title="หมุนทวนเข็ม"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setPoRotation(r => (r + 90) % 360)}
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-background transition-colors"
                          title="หมุนตามเข็ม"
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {/* Right: actions */}
                      <div className="flex items-center gap-0.5">
                        <a href={q.poFileUrl!} target="_blank" rel="noopener noreferrer"
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-background transition-colors"
                          title="เปิดในแท็บใหม่">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <a href={q.poFileUrl!} download={q.poFileName}
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-background transition-colors"
                          title="ดาวน์โหลด">
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        <button
                          onClick={() => setPoFullscreen(true)}
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-background transition-colors"
                          title="เต็มจอ"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Preview area */}
                    <div
                      className="rounded-lg border bg-neutral-100 dark:bg-neutral-900 overflow-auto cursor-grab active:cursor-grabbing"
                      style={{ height: 460 }}
                      onDoubleClick={resetViewer}
                      title="ดับเบิลคลิกเพื่อรีเซ็ตการซูม"
                    >
                      {isImage && (
                        <div className="flex justify-center items-start min-h-full p-2">
                          <img
                            src={q.poFileUrl!}
                            alt="PO"
                            style={{
                              width: `${poZoom * 100}%`,
                              transform: `rotate(${poRotation}deg)`,
                              transformOrigin: 'center top',
                              flexShrink: 0,
                              display: 'block',
                              transition: 'transform 0.15s ease',
                            }}
                            draggable={false}
                          />
                        </div>
                      )}
                      {isPdf && (
                        <iframe
                          src={q.poFileUrl!}
                          title="PO PDF"
                          className="w-full h-full"
                          style={{ minHeight: 460 }}
                        />
                      )}
                    </div>

                    {/* Hint */}
                    <p className="text-[10px] text-center text-muted-foreground">
                      ลากเพื่อเลื่อน · เลื่อนเมาส์/พินช์เพื่อซูม · ดับเบิลคลิกเพื่อรีเซ็ต
                    </p>
                  </div>
                ) : q.poFileUrl ? (
                  /* Has file but not previewable (fallback) */
                  <div className="border rounded-lg p-3 flex items-center gap-3 bg-muted/20 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-red-500" />
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
                ) : canUpload ? (
                  /* Upload zone */
                  <div
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={cn(
                      'border-2 border-dashed rounded-xl p-10 text-center transition-all mb-3',
                      uploading
                        ? 'border-primary/50 cursor-default'
                        : 'border-border hover:border-primary hover:bg-accent/20 cursor-pointer',
                    )}
                  >
                    {uploading ? (
                      <div className="space-y-3">
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
                        <p className="text-xs text-muted-foreground mt-1.5">PDF, PNG, JPG, WebP · สูงสุด 10 MB</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                    <ImageIcon className="h-10 w-10 opacity-30" />
                    <p className="text-sm">ยังไม่มีไฟล์ PO</p>
                  </div>
                )}

                {/* Action buttons (when canUpload + has file) */}
                {canUpload && q.poFileUrl && (
                  <div className="mt-3 space-y-2">
                    <Button variant="outline" size="sm" className="w-full"
                      onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      เปลี่ยนไฟล์ PO
                    </Button>
                    <Button className="w-full shine" onClick={handleSubmitPo}
                      disabled={acting !== null || !poNumber.trim()}>
                      {acting === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      ส่ง PO และสร้าง Sale Order
                    </Button>
                    {!poNumber.trim() && (
                      <p className="text-xs text-center text-destructive">กรุณากรอก PO Number ก่อน</p>
                    )}
                  </div>
                )}

                {status === 'PO_PENDING' && isOwner && (
                  <p className="mt-3 text-xs text-center text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2">
                    รอ Manager ตรวจสอบ Sale Order — ไม่สามารถแก้ไขได้
                  </p>
                )}
              </CardContent>
            </Card>

            {/* PO Upload history */}
            {history.length > 0 && (
              <Card className="mt-4">
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
                            {h.url && (
                              <a href={h.url} target="_blank" rel="noopener noreferrer"
                                className="text-primary hover:underline shrink-0">ดู</a>
                            )}
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
              <div className="mt-4">
                <CommentThread quotationId={id} />
              </div>
            )}
          </div>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp"
        onChange={handleFileChange} className="hidden" />
    </>
  );
}

// ── Reusable toolbar (used inside fullscreen overlay) ──────────────────────
function ViewerToolbar({
  zoom, setZoom, rotation, setRotation, fileUrl, fileName, onReset, dark,
}: {
  zoom: number; setZoom: (z: number) => void;
  rotation: number; setRotation: (r: number) => void;
  fileUrl: string; fileName?: string | null;
  onReset: () => void;
  dark?: boolean;
}) {
  const btn = cn(
    'h-7 w-7 flex items-center justify-center rounded transition-colors',
    dark ? 'text-white/80 hover:bg-white/10' : 'hover:bg-background',
  );
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => setZoom(Math.max(0.25, parseFloat((zoom - 0.25).toFixed(2))))}
        disabled={zoom <= 0.25} className={cn(btn, 'disabled:opacity-30')} title="ซูมออก">
        <ZoomOut className="h-3.5 w-3.5" />
      </button>
      <input type="range" min={25} max={400} step={25} value={Math.round(zoom * 100)}
        onChange={(e) => setZoom(Number(e.target.value) / 100)}
        className="w-20 h-1 accent-primary cursor-pointer" />
      <button onClick={() => setZoom(Math.min(4, parseFloat((zoom + 0.25).toFixed(2))))}
        disabled={zoom >= 4} className={cn(btn, 'disabled:opacity-30')} title="ซูมเข้า">
        <ZoomIn className="h-3.5 w-3.5" />
      </button>
      <span className={cn('text-[11px] tabular-nums font-mono w-10 text-center', dark ? 'text-white/60' : 'text-muted-foreground')}>
        {Math.round(zoom * 100)}%
      </span>
      <div className={cn('w-px h-4 mx-0.5', dark ? 'bg-white/20' : 'bg-border')} />
      <button onClick={() => setRotation((rotation - 90 + 360) % 360)} className={btn} title="หมุนทวนเข็ม">
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => setRotation((rotation + 90) % 360)} className={btn} title="หมุนตามเข็ม">
        <RotateCw className="h-3.5 w-3.5" />
      </button>
      <div className={cn('w-px h-4 mx-0.5', dark ? 'bg-white/20' : 'bg-border')} />
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={btn} title="เปิดในแท็บใหม่">
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
      <a href={fileUrl} download={fileName} className={btn} title="ดาวน์โหลด">
        <Download className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

function InfoRow({ label, value, bold, span2 }: { label: string; value: string; bold?: boolean; span2?: boolean }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className={cn('mt-0.5', bold ? 'font-bold text-base' : 'font-medium')}>{value}</div>
    </div>
  );
}
