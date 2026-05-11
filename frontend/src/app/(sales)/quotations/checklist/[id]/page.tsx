'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  Upload,
  FileText,
  Image as ImageIcon,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Download,
  Trash2,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatDate, formatMoney, formatNumber, cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { CommentThread } from '@/components/comments/comment-thread';
import type { ApiResponse, Quotation } from '@/types/api';

const ELEVATED_ROLES = ['MANAGER', 'CEO', 'ADMIN', 'APPROVER'];
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

interface ChecklistDetail extends Quotation {
  poFileUrl?: string | null;
  poFileName?: string | null;
  poFileSize?: number | null;
  poFileMimeType?: string | null;
  poUploadedAt?: string | null;
  poSubmittedAt?: string | null;
  poApprovedAt?: string | null;
  poRejectedAt?: string | null;
  poRejectionReason?: string | null;
}

export default function ChecklistDetailPage() {
  const t = useT();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: session } = useSession();
  const { role } = usePermissions();

  const [q, setQ] = useState<ChecklistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userId = session?.user?.id;
  const isOwner = userId && q?.createdById === userId;
  const isElevated = role?.code && ELEVATED_ROLES.includes(role.code);

  // ─── Load quotation ──────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<ChecklistDetail>>(`/quotations/${id}`);
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

  // ─── File upload ────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate client-side
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('รองรับเฉพาะไฟล์ PDF, PNG, JPG, WebP');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error('ไฟล์ใหญ่เกิน 10 MB');
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      await api.post(`/quotations/${id}/po-upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('อัปโหลด PO สำเร็จ');
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ─── Officer: submit PO ──────────────────────────────────────────────────
  const handleSubmitPo = async () => {
    if (!confirm('ส่ง PO ให้ Manager ตรวจสอบใช่หรือไม่? หลังส่งจะแก้ไขไม่ได้จนกว่าจะถูก reject')) return;
    setActing('submit');
    try {
      await api.post(`/quotations/${id}/po-submit`);
      toast.success('ส่ง PO ให้ Manager ตรวจสอบเรียบร้อย');
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setActing(null);
    }
  };

  // ─── Manager: approve PO ─────────────────────────────────────────────────
  const handleApprovePo = async () => {
    if (!confirm('อนุมัติ PO นี้? ระบบจะสร้าง Sale Order อัตโนมัติ')) return;
    setActing('approve');
    try {
      const res = await api.post<ApiResponse<{ saleOrder: { id: string; saleOrderNo: string } }>>(
        `/quotations/${id}/po-approve`,
      );
      const soNo = res.data.data?.saleOrder?.saleOrderNo;
      toast.success(`PO อนุมัติแล้ว — สร้าง Sale Order ${soNo}`);
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setActing(null);
    }
  };

  // ─── Manager: reject PO ──────────────────────────────────────────────────
  const handleRejectPo = async () => {
    const reason = prompt('เหตุผลที่ปฏิเสธ PO:');
    if (!reason || reason.trim().length < 2) return;
    setActing('reject');
    try {
      await api.post(`/quotations/${id}/po-reject`, { reason });
      toast.success('ปฏิเสธ PO เรียบร้อย');
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
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!q) {
    return (
      <div className="text-center py-20">
        <p>Not found</p>
        <Button asChild variant="ghost" className="mt-4">
          <Link href="/quotations/checklist">ย้อนกลับ</Link>
        </Button>
      </div>
    );
  }

  // ─── Permission logic ────────────────────────────────────────────────────
  const canUpload = isOwner && ['APPROVED', 'PO_REJECTED'].includes(q.status);
  const canSubmitPo = isOwner && ['APPROVED', 'PO_REJECTED'].includes(q.status) && q.poFileUrl;
  const canApproveReject = isElevated && q.status === 'PO_PENDING';

  // ─── Status colors ───────────────────────────────────────────────────────
  const statusBg: Record<string, string> = {
    APPROVED: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20',
    PO_PENDING: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20',
    PO_APPROVED: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20',
    PO_REJECTED: 'bg-red-50 border-red-200 dark:bg-red-900/20',
  };

  const isImage = q.poFileMimeType?.startsWith('image/');
  const isPdf = q.poFileMimeType === 'application/pdf';

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-1">
            <Link href="/quotations/checklist">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{q.quotationNo}</h1>
              <Badge variant="outline" className="text-xs">
                {q.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {q.customerCompany} · อนุมัติแล้วเมื่อ {formatDate(q.approvedAt)}
            </p>
          </div>
        </div>

        {q.saleOrder && (
          <Button asChild variant="success">
            <Link href={`/sale-orders/${q.saleOrder.id}`}>
              <FileText className="h-4 w-4" />
              {q.saleOrder.saleOrderNo}
            </Link>
          </Button>
        )}
      </div>

      {/* Status banner */}
      <Card className={cn('border-2', statusBg[q.status])}>
        <CardContent className="pt-4 flex gap-3 items-start">
          {q.status === 'APPROVED' && (
            <>
              <Upload className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-blue-900 dark:text-blue-200">รออัปโหลด PO</div>
                <p className="text-sm mt-1">กรุณาแนบใบ PO ที่ลูกค้าออกให้ (PDF, รูป) แล้วกดส่งให้ Manager ตรวจสอบ</p>
              </div>
            </>
          )}
          {q.status === 'PO_PENDING' && (
            <>
              <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-amber-900 dark:text-amber-200">PO รอการตรวจสอบ</div>
                <p className="text-sm mt-1">
                  ส่งให้ Manager ตรวจสอบเมื่อ {formatDate(q.poSubmittedAt)} — Officer แก้ไขไม่ได้จนกว่าจะถูก reject
                </p>
              </div>
            </>
          )}
          {q.status === 'PO_APPROVED' && (
            <>
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-emerald-900 dark:text-emerald-200">PO อนุมัติแล้ว</div>
                <p className="text-sm mt-1">
                  Manager อนุมัติเมื่อ {formatDate(q.poApprovedAt)} — สร้าง Sale Order {q.saleOrder?.saleOrderNo} แล้ว
                </p>
              </div>
            </>
          )}
          {q.status === 'PO_REJECTED' && (
            <>
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-red-900 dark:text-red-200">PO ถูกปฏิเสธ</div>
                <p className="text-sm mt-1">
                  เหตุผล: <strong>{q.poRejectionReason}</strong>
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  กรุณาอัปโหลด PO ใหม่ที่ถูกต้อง แล้วส่งให้ Manager ตรวจสอบอีกครั้ง
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Two-column: Detail + Comment */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5">
        <div className="space-y-5 min-w-0">
          {/* PO Upload section */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                ใบ Purchase Order (PO)
              </h2>

              {q.poFileUrl ? (
                <div className="space-y-3">
                  {/* File preview */}
                  <div className="border rounded-lg p-4 flex items-center gap-3 bg-muted/30">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {isImage ? (
                        <ImageIcon className="h-6 w-6 text-primary" />
                      ) : isPdf ? (
                        <FileText className="h-6 w-6 text-red-600" />
                      ) : (
                        <FileText className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{q.poFileName}</div>
                      <div className="text-xs text-muted-foreground">
                        อัปโหลดเมื่อ {formatDate(q.poUploadedAt)}
                        {q.poFileSize && ` · ${(q.poFileSize / 1024).toFixed(0)} KB`}
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <a href={q.poFileUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="h-3.5 w-3.5" />
                        ดู
                      </a>
                    </Button>
                  </div>

                  {/* Image preview */}
                  {isImage && (
                    <div className="rounded-lg overflow-hidden border bg-muted/30">
                      <img
                        src={q.poFileUrl}
                        alt={q.poFileName ?? 'PO'}
                        className="max-w-full max-h-96 mx-auto object-contain"
                      />
                    </div>
                  )}

                  {/* PDF preview (iframe) */}
                  {isPdf && (
                    <div className="rounded-lg overflow-hidden border bg-muted/30">
                      <iframe
                        src={q.poFileUrl}
                        className="w-full h-96"
                        title="PO PDF Preview"
                      />
                    </div>
                  )}

                  {/* Actions for Officer */}
                  {canUpload && (
                    <div className="flex gap-2 flex-wrap pt-2">
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        เปลี่ยนไฟล์
                      </Button>
                      {canSubmitPo && (
                        <Button onClick={handleSubmitPo} disabled={acting !== null}>
                          {acting === 'submit' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          ส่งให้ Manager ตรวจสอบ
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Actions for Manager */}
                  {canApproveReject && (
                    <div className="flex gap-2 flex-wrap pt-3 border-t mt-3">
                      <Button
                        onClick={handleApprovePo}
                        disabled={acting !== null}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        {acting === 'approve' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        อนุมัติ PO + สร้าง Sale Order
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleRejectPo}
                        disabled={acting !== null}
                      >
                        {acting === 'reject' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        ปฏิเสธ PO
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {canUpload ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-accent/30 transition-all"
                    >
                      {uploading ? (
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      ) : (
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      )}
                      <p className="mt-2 font-medium">คลิกเพื่อเลือกไฟล์ PO</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        รองรับ PDF, PNG, JPG, WebP — ขนาดไม่เกิน 10 MB
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      ยังไม่มีไฟล์ PO
                    </p>
                  )}
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </CardContent>
          </Card>

          {/* Quotation summary (read-only) */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold mb-3">รายละเอียดใบเสนอราคา</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-sm">
                <div>
                  <span className="text-muted-foreground">บริษัท:</span>{' '}
                  <span className="font-medium">{q.customerCompany}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">ผู้ติดต่อ:</span>{' '}
                  <span className="font-medium">{q.customerContactName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">วันที่ออก:</span>{' '}
                  <span className="font-medium">{formatDate(q.issueDate)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">หมดอายุ:</span>{' '}
                  <span className="font-medium">{formatDate(q.expiryDate)}</span>
                </div>
                <div className="md:col-span-2 pt-2 border-t flex justify-between items-baseline">
                  <span className="font-semibold">มูลค่ารวม</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatMoney(q.grandTotal, q.currency)}
                  </span>
                </div>
              </div>

              {/* Items */}
              {q.items && q.items.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h3 className="text-xs uppercase text-muted-foreground font-semibold mb-2">
                    รายการ ({q.items.length})
                  </h3>
                  <div className="space-y-1.5">
                    {q.items.map((it, idx) => (
                      <div key={it.id || idx} className="text-sm flex justify-between gap-3">
                        <span className="truncate">{it.productName}</span>
                        <span className="text-muted-foreground shrink-0">
                          {formatNumber(it.quantity)} {it.unit} ×{' '}
                          {formatNumber(it.unitPrice)} ={' '}
                          <span className="font-semibold text-foreground">
                            {formatNumber(it.lineTotal)}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Comment thread (PO_PENDING only) */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          {q.status === 'PO_PENDING' ? (
            <CommentThread quotationId={id} />
          ) : (
            <Card className="bg-muted/30">
              <CardContent className="pt-6 text-center text-sm text-muted-foreground">
                <p>การสนทนาเปิดใช้งานเฉพาะตอน</p>
                <p className="font-medium text-foreground mt-1">PO รอการตรวจสอบ</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}