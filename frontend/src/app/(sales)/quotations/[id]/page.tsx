'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft, Send, X, Check, Loader2, FileText,
  CheckCircle2, Clock, AlertTriangle, Upload, ExternalLink, Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatDate, formatMoney, formatNumber, getStatusClass } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { CommentThread } from '@/components/comments/comment-thread';
import type { ApiResponse, CompanySettings, Quotation } from '@/types/api';

const ELEVATED_ROLES = ['MANAGER', 'CEO', 'ADMIN'];
const COMMENT_ALLOWED_STATUSES = ['PENDING', 'PENDING_ESCALATED', 'PENDING_BACKUP', 'PO_PENDING'];
const PDF_ALLOWED_STATUSES = ['APPROVED', 'PO_PENDING', 'PO_APPROVED', 'PO_REJECTED', 'SENT', 'SIGNED'];

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

function ConfirmPopover({
  title, description, confirmLabel, confirmVariant = 'default',
  requireComment = false, onClose, onConfirm, loading,
}: {
  title: string; description: string; confirmLabel: string;
  confirmVariant?: 'default' | 'destructive'; requireComment?: boolean;
  onClose: () => void; onConfirm: (comment: string) => void; loading: boolean;
}) {
  const [comment, setComment] = useState('');
  return (
    <div className="fixed inset-0 z-40" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute bottom-6 right-6 z-50 w-80 rounded-xl border bg-background shadow-2xl">
        <div className="p-4 space-y-3">
          <div>
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <div>
            <Label className="text-xs">
              {requireComment ? 'เหตุผล' : 'Comment (optional)'}
              {requireComment && <span className="text-destructive ml-1">*</span>}
            </Label>
            <textarea
              value={comment} onChange={(e) => setComment(e.target.value)}
              rows={2} autoFocus
              placeholder={requireComment ? 'ระบุเหตุผลที่ปฏิเสธ...' : 'เพิ่มหมายเหตุ...'}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={onClose} disabled={loading}>ยกเลิก</Button>
            <Button size="sm" variant={confirmVariant} onClick={() => onConfirm(comment)}
              disabled={loading || (requireComment && !comment.trim())}
              className={confirmVariant === 'default' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuotationDocument({ q, company }: { q: Quotation; company: CompanySettings | null }) {
  const grandTotalNum = Number(q.grandTotal);
  const afterDiscount = Number(q.subtotal) - Number(q.discountTotal);
  const bahtText = q.currency === 'THB' ? toThaiBahtText(grandTotalNum) : '';
  const padCount = Math.max(0, 8 - (q.items?.length ?? 0));

  return (
    <div id="qt-printable" className="bg-white text-black" style={{ fontFamily: 'Sarabun, sans-serif' }}>
      <div className="border-2 border-black">
        <div className="grid grid-cols-[1fr_280px]">
          <div className="px-4 py-3 border-r-2 border-black">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 border-2 border-black flex items-center justify-center font-bold text-lg shrink-0">
                {(company?.companyNameTh || company?.companyName || 'C').slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-base">{company?.companyNameTh || company?.companyName}</div>
                {company?.companyNameTh && company?.companyName && <div className="text-xs text-gray-700">{company.companyName}</div>}
                <div className="text-[11px] text-gray-800 mt-1">
                  {company?.addressTh || company?.address}
                  {company?.phone && <div>โทร. {company.phone}{company?.fax && `  แฟกซ์ ${company.fax}`}</div>}
                  {company?.email && <div>อีเมล {company.email}</div>}
                  {company?.taxId && <div>เลขประจำตัวผู้เสียภาษี: {company.taxId}</div>}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="text-center py-2 border-b-2 border-black">
              <div className="text-xl font-bold tracking-widest">QUOTATION</div>
              <div className="text-xs text-gray-700">ใบเสนอราคา</div>
            </div>
            <table className="w-full text-[11px]">
              <tbody>
                <tr className="border-b border-black"><td className="px-2 py-1 border-r border-black w-[42%] text-gray-700">เลขที่ / No.</td><td className="px-2 py-1 font-semibold text-right">{q.quotationNo}</td></tr>
                <tr className="border-b border-black"><td className="px-2 py-1 border-r border-black text-gray-700">วันที่ / Date</td><td className="px-2 py-1 font-semibold text-right">{formatDate(q.issueDate)}</td></tr>
                <tr className="border-b border-black"><td className="px-2 py-1 border-r border-black text-gray-700">หมดอายุ / Expiry</td><td className="px-2 py-1 font-semibold text-right">{formatDate(q.expiryDate)}</td></tr>
                <tr><td className="px-2 py-1 border-r border-black text-gray-700">สกุลเงิน</td><td className="px-2 py-1 font-semibold text-right">{q.currency}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="border-2 border-t-0 border-black grid grid-cols-2">
        <div className="px-4 py-2 border-r-2 border-black">
          <div className="text-[10px] text-gray-500 uppercase font-semibold mb-1">เสนอราคาให้แก่ / To</div>
          <DocRow label="บริษัท" value={q.customerCompany} bold />
          <DocRow label="ผู้ติดต่อ" value={q.customerContactName} />
          {q.customerTaxId && <DocRow label="เลขผู้เสียภาษี" value={q.customerTaxId} />}
          {q.customerPhone && <DocRow label="โทรศัพท์" value={q.customerPhone} />}
          {q.customerEmail && <DocRow label="Email" value={q.customerEmail} />}
          {q.customerBillingAddress && <DocRow label="ที่อยู่" value={q.customerBillingAddress} />}
        </div>
        <div className="px-4 py-2">
          <div className="text-[10px] text-gray-500 uppercase font-semibold mb-1">รายละเอียด</div>
          {q.paymentTerms && <DocRow label="เงื่อนไขชำระเงิน" value={q.paymentTerms} />}
          {q.conditions && <DocRow label="เงื่อนไข" value={q.conditions} />}
          {q.customerShippingAddress && <DocRow label="ที่อยู่จัดส่ง" value={q.customerShippingAddress} />}
        </div>
      </div>
      <table className="w-full border-2 border-t-0 border-black border-collapse text-[11px]">
        <thead>
          <tr className="bg-black text-white">
            <th className="border-r border-gray-700 px-2 py-2 text-left w-[70px]">รหัส / SKU</th>
            <th className="border-r border-gray-700 px-2 py-2 text-left">รายการ / Description</th>
            <th className="border-r border-gray-700 px-2 py-2 text-right w-[55px]">จำนวน</th>
            <th className="border-r border-gray-700 px-2 py-2 text-center w-[45px]">หน่วย</th>
            <th className="border-r border-gray-700 px-2 py-2 text-right w-[80px]">ราคา/หน่วย</th>
            <th className="border-r border-gray-700 px-2 py-2 text-right w-[55px]">ส่วนลด</th>
            <th className="px-2 py-2 text-right w-[85px]">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {q.items?.map((it, idx) => (
            <tr key={it.id || idx} className="border-b border-gray-300">
              <td className="border-r border-gray-300 px-2 py-2 align-top font-mono text-[10px]">{it.productSku || '-'}</td>
              <td className="border-r border-gray-300 px-2 py-2 align-top"><div className="font-semibold">{it.productName}</div>{it.productDescription && <div className="text-[10px] text-gray-700 mt-0.5">{it.productDescription}</div>}</td>
              <td className="border-r border-gray-300 px-2 py-2 align-top text-right">{formatNumber(it.quantity)}</td>
              <td className="border-r border-gray-300 px-2 py-2 align-top text-center">{it.unit}</td>
              <td className="border-r border-gray-300 px-2 py-2 align-top text-right">{formatNumber(it.unitPrice)}</td>
              <td className="border-r border-gray-300 px-2 py-2 align-top text-right">{Number(it.discount) > 0 ? (it.discountType === 'PERCENTAGE' ? `${formatNumber(it.discount)}%` : formatNumber(it.discount)) : '-'}</td>
              <td className="px-2 py-2 align-top text-right font-semibold">{formatNumber(it.lineTotal)}</td>
            </tr>
          ))}
          {Array.from({ length: padCount }).map((_, i) => (
            <tr key={`pad-${i}`} className="border-b border-gray-300">
              {Array.from({ length: 7 }).map((__, j) => <td key={j} className={`px-2 py-2 ${j < 6 ? 'border-r border-gray-300' : ''}`}>&nbsp;</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-2 border-t-0 border-black grid grid-cols-[1fr_300px]">
        <div className="px-4 py-3 border-r-2 border-black flex flex-col justify-between">
          {bahtText && <div><div className="text-[10px] text-gray-700 mb-1">จำนวนเงินตัวอักษร</div><div className="text-[12px] italic font-semibold">( {bahtText} )</div></div>}
          {company?.bankName && <div className="mt-3 pt-3 border-t border-gray-300"><div className="text-[10px] text-gray-700 mb-1">โอนเงินเข้าบัญชี</div><div className="text-[11px] font-semibold">{company.bankName}{company.bankAccount && `   ${company.bankAccount}`}{company.bankBranch && ` (${company.bankBranch})`}</div></div>}
        </div>
        <div className="text-[11px]">
          <SummaryRow label="รวมเงิน (Subtotal)" value={formatNumber(q.subtotal)} />
          {Number(q.discountTotal) > 0 && <SummaryRow label="ส่วนลด (Discount)" value={`-${formatNumber(q.discountTotal)}`} />}
          <SummaryRow label="หลังหักส่วนลด" value={formatNumber(afterDiscount)} />
          {q.vatEnabled ? <SummaryRow label={`ภาษีมูลค่าเพิ่ม ${formatNumber(q.vatRate)}%`} value={formatNumber(q.vatAmount)} /> : <SummaryRow label="ภาษีมูลค่าเพิ่ม" value="ไม่มี VAT" />}
          <div className="bg-black text-white px-3 py-2 flex justify-between items-baseline"><span className="font-bold">จำนวนเงินทั้งสิ้น</span><span className="font-bold text-base">{formatNumber(q.grandTotal)} {q.currency}</span></div>
        </div>
      </div>
      <div className="border-2 border-t-0 border-black">
        <div className="grid grid-cols-3 gap-6 py-10 px-6">
          {[{ th: 'ผู้เสนอราคา', en: 'Sales Representative' }, { th: 'ผู้ตรวจสอบ', en: 'Reviewed By' }, { th: 'ผู้มีอำนาจอนุมัติ', en: 'Authorized Signatory' }].map((s, i) => (
            <div key={i} className="text-center"><div className="border-t border-black mt-10 mx-4 pt-1.5"><div className="text-[11px] font-medium">{s.th}</div><div className="text-[10px] text-gray-700">{s.en}</div><div className="text-[10px] text-gray-700 mt-2">วันที่ / Date: ____________</div></div></div>
          ))}
        </div>
        <div className="px-4 pb-3 text-[9px] text-gray-500 text-center border-t border-gray-200">เอกสารนี้ออกโดยระบบอัตโนมัติ · ใบเสนอราคามีอายุถึง {formatDate(q.expiryDate)}</div>
      </div>
    </div>
  );
}

export default function QuotationDetailPage() {
  const t = useT();
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();
  const { role, can } = usePermissions();

  const [q, setQ] = useState<Quotation | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [showApprovePopover, setShowApprovePopover] = useState(false);
  const [showRejectPopover, setShowRejectPopover] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [qRes, cRes] = await Promise.all([
        api.get<ApiResponse<Quotation>>(`/quotations/${id}`),
        api.get<ApiResponse<CompanySettings>>('/company'),
      ]);
      setQ(qRes.data.data ?? null);
      setCompany(cRes.data.data ?? null);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  const submit = async () => {
    setActing('submit');
    try { await api.post(`/quotations/${id}/submit`, {}); toast.success('ส่งขออนุมัติเรียบร้อย'); await load(); }
    catch (err) { toast.error(getApiErrorMessage(err)); } finally { setActing(null); }
  };

  const cancel = async () => {
    if (!confirm('ยืนยันการยกเลิกใบเสนอราคา DRAFT นี้?')) return;
    setActing('cancel');
    try { await api.post(`/quotations/${id}/cancel`, { reason: 'Cancelled by ' + (role?.code || 'user') }); toast.success('ยกเลิกเรียบร้อย'); await load(); }
    catch (err) { toast.error(getApiErrorMessage(err)); } finally { setActing(null); }
  };

  const handleApprove = async (comment: string) => {
    setActing('approve');
    try { await api.post(`/quotations/${id}/approve`, { comment }); toast.success('อนุมัติแล้ว'); setShowApprovePopover(false); await load(); }
    catch (err) { toast.error(getApiErrorMessage(err)); } finally { setActing(null); }
  };

  const handleReject = async (reason: string) => {
    setActing('reject');
    try { await api.post(`/quotations/${id}/reject`, { reason }); toast.success('ปฏิเสธเรียบร้อย'); setShowRejectPopover(false); await load(); }
    catch (err) { toast.error(getApiErrorMessage(err)); } finally { setActing(null); }
  };

  if (loading) return (
    <div className="space-y-4 max-w-6xl">
      <Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /><Skeleton className="h-96 w-full" />
    </div>
  );

  if (!q) return (
    <div className="text-center py-20">
      <p>Not found</p>
      <Button asChild variant="ghost" className="mt-4"><Link href="/quotations">{t('common.back')}</Link></Button>
    </div>
  );

  const userId = session?.user?.id;
  const isOwner = !!(userId && q.createdById === userId);
  const isElevated = !!(role?.code && ELEVATED_ROLES.includes(role.code));
  const canEdit   = (q.status === 'DRAFT' || q.status === 'REJECTED') && isOwner;
  const canSubmit = (q.status === 'DRAFT' || q.status === 'REJECTED') && isOwner;
  const canCancel = q.status === 'DRAFT' && (isOwner || isElevated);
  const canPdf    = PDF_ALLOWED_STATUSES.includes(q.status as string);
  const canApproveThis = (() => {
    if (!isElevated) return false;
    if (q.status === 'PENDING') return can('quotation', 'approve', 'TEAM') || can('quotation', 'approve', 'ALL');
    if (q.status === 'PENDING_ESCALATED') return can('quotation', 'approve', 'ALL');
    return false;
  })();
  const showCommentThread = COMMENT_ALLOWED_STATUSES.includes(q.status as string);

  if (showPrintView) {
    return (
      <>
        <style>{`@media print { body * { visibility: hidden !important; } #qt-printable, #qt-printable * { visibility: visible !important; } #qt-printable { position: fixed; inset: 0; padding: 0; margin: 0; } .no-print { display: none !important; } @page { size: A4; margin: 10mm; } }`}</style>
        <div className="max-w-4xl mx-auto">
          <div className="no-print flex items-center justify-between mb-4 gap-3 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => setShowPrintView(false)}><ArrowLeft className="h-4 w-4" />กลับ</Button>
            <div className="flex gap-2 items-center">
              <Badge className={getStatusClass(q.status)} variant="outline">● {q.status}</Badge>
              <Button onClick={() => window.print()}><Printer className="h-4 w-4" />พิมพ์ / Save PDF</Button>
            </div>
          </div>
          <div className="shadow-lg rounded overflow-hidden"><QuotationDocument q={q} company={company} /></div>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-1">
            <Link href="/quotations"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{q.quotationNo}</h1>
              <Badge className={getStatusClass(q.status)} variant="outline">● {q.status}</Badge>
              {q.version > 1 && <span className="text-xs text-muted-foreground">v{q.version}</span>}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{q.customerCompany} · {formatDate(q.issueDate)} → {formatDate(q.expiryDate)}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canEdit && <Button asChild variant="outline"><Link href={`/quotations/${id}/edit`}><FileText className="h-4 w-4" />{t('common.edit')}</Link></Button>}
          {canCancel && <Button variant="outline" onClick={cancel} disabled={acting !== null}>{acting === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}{t('common.cancel')}</Button>}
          {canSubmit && <Button onClick={submit} disabled={acting !== null}>{acting === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{t('quotation.submitForApproval')}</Button>}
          {canPdf && <Button variant="outline" onClick={() => setShowPrintView(true)}><Printer className="h-4 w-4" />Save PDF</Button>}
          {q.saleOrder && <Button asChild variant="success"><Link href={`/sale-orders/${q.saleOrder.id}`}><FileText className="h-4 w-4" />{q.saleOrder.saleOrderNo}</Link></Button>}
        </div>
      </div>

      {/* Status Banners */}
      {q.status === 'REJECTED' && q.rejectionReason && (
        <Card className="border-destructive/50 bg-destructive/5"><CardContent className="pt-4 flex gap-3"><AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" /><div><div className="font-semibold text-destructive">ถูกปฏิเสธ</div><p className="text-sm mt-1">{q.rejectionReason}</p><p className="text-xs text-muted-foreground mt-2">แก้ไขแล้วส่งใหม่ได้เลย</p></div></CardContent></Card>
      )}
      {q.status === 'PENDING' && (
        <Card className="border-amber-500/50 bg-amber-500/5"><CardContent className="pt-4 flex gap-3"><Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" /><div><div className="font-semibold text-amber-700 dark:text-amber-400">รออนุมัติ</div><p className="text-sm mt-1">ส่งเมื่อ {formatDate(q.submittedAt)} · รอ Manager ตรวจสอบ</p>{!isElevated && <p className="text-xs text-muted-foreground mt-2">⚠ ไม่สามารถยกเลิกได้หลังส่งแล้ว — ติดต่อ Manager หากต้องการยกเลิก</p>}</div></CardContent></Card>
      )}
      {q.status === 'APPROVED' && (
        <Card className="border-blue-500/50 bg-blue-500/5"><CardContent className="pt-4 flex gap-3 items-start"><Upload className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" /><div className="flex-1"><div className="font-semibold text-blue-900 dark:text-blue-200">อนุมัติแล้ว — กรุณาแนบใบ PO</div><p className="text-sm mt-1">อนุมัติเมื่อ {formatDate(q.approvedAt)} โดย {q.approvedBy?.name || '-'}</p><p className="text-xs text-muted-foreground mt-1">💡 กด "Save PDF" ส่งให้ลูกค้า แล้วนำใบ PO อัปโหลดที่ Checklist</p></div><Button asChild size="sm" className="shrink-0 mt-1"><Link href={`/quotations/checklist/${id}`}><ExternalLink className="h-3.5 w-3.5" />ไปหน้า Checklist</Link></Button></CardContent></Card>
      )}
      {q.status === 'PO_PENDING' && (
        <Card className="border-amber-500/50 bg-amber-500/5"><CardContent className="pt-4 flex gap-3 items-start"><Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" /><div className="flex-1"><div className="font-semibold text-amber-700 dark:text-amber-400">PO รอการตรวจสอบ</div><p className="text-xs text-muted-foreground mt-1">Manager กำลังตรวจสอบใบ PO</p></div><Button asChild size="sm" variant="outline" className="shrink-0 mt-1"><Link href={`/quotations/checklist/${id}`}><ExternalLink className="h-3.5 w-3.5" />ดูหน้า Checklist</Link></Button></CardContent></Card>
      )}
      {q.status === 'PO_APPROVED' && (
        <Card className="border-emerald-500/50 bg-emerald-500/5"><CardContent className="pt-4 flex gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" /><div><div className="font-semibold text-emerald-700 dark:text-emerald-300">PO อนุมัติแล้ว — เสร็จสิ้น</div><p className="text-sm mt-1">Sale Order {q.saleOrder?.saleOrderNo} ถูกสร้างแล้ว</p></div></CardContent></Card>
      )}
      {(q.status as string) === 'PO_REJECTED' && (
        <Card className="border-red-500/50 bg-red-500/5"><CardContent className="pt-4 flex gap-3 items-start"><AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" /><div className="flex-1"><div className="font-semibold text-red-700 dark:text-red-300">PO ถูกปฏิเสธ</div><p className="text-xs text-muted-foreground mt-1">กรุณาอัปโหลดใบ PO ใหม่</p></div><Button asChild size="sm" variant="outline" className="shrink-0 mt-1"><Link href={`/quotations/checklist/${id}`}><Upload className="h-3.5 w-3.5" />อัปโหลด PO ใหม่</Link></Button></CardContent></Card>
      )}

      {/* ✅ Content — ไม่ใช้ grid แล้ว ปุ่มแชทจะ float เอง */}
      <div className="space-y-5 min-w-0">
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold mb-3">{t('quotation.customerInfo')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-sm">
              <div><span className="text-muted-foreground">{t('customer.company')}:</span>{' '}<span className="font-medium">{q.customerCompany}</span></div>
              <div><span className="text-muted-foreground">{t('customer.contactName')}:</span>{' '}<span className="font-medium">{q.customerContactName}</span></div>
              {q.customerTaxId && <div><span className="text-muted-foreground">{t('customer.taxId')}:</span>{' '}<span className="font-medium">{q.customerTaxId}</span></div>}
              {q.customerPhone && <div><span className="text-muted-foreground">{t('customer.phone')}:</span>{' '}<span className="font-medium">{q.customerPhone}</span></div>}
              {q.customerEmail && <div className="md:col-span-2"><span className="text-muted-foreground">{t('customer.email')}:</span>{' '}<span className="font-medium">{q.customerEmail}</span></div>}
              {q.customerBillingAddress && <div className="md:col-span-2"><span className="text-muted-foreground">{t('customer.billingAddress')}:</span>{' '}<span className="font-medium">{q.customerBillingAddress}</span></div>}
            </div>
          </CardContent>
        </Card>

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
                      <td className="py-3"><div className="font-medium">{it.productName}</div>{it.productDescription && <div className="text-[10px] text-gray-700 mt-0.5">{it.productDescription}</div>}</td>
                      <td className="py-3 text-right">{formatNumber(it.quantity)} {it.unit}</td>
                      <td className="py-3 text-right">{formatNumber(it.unitPrice)}</td>
                      <td className="py-3 text-right">{Number(it.discount) > 0 ? (it.discountType === 'PERCENTAGE' ? `${formatNumber(it.discount)}%` : formatNumber(it.discount)) : '-'}</td>
                      <td className="py-3 text-right font-semibold">{formatNumber(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex justify-end">
            <div className="w-full md:w-80 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('quotation.subtotal')}</span><span>{formatNumber(q.subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('quotation.discount')}</span><span className="text-destructive">-{formatNumber(q.discountTotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('quotation.vat')} ({formatNumber(q.vatRate)}%)</span><span>{q.vatEnabled ? formatNumber(q.vatAmount) : 'No VAT'}</span></div>
              <div className="border-t pt-2 flex justify-between items-baseline">
                <span className="font-semibold">{t('quotation.grandTotal')}</span>
                <span className="text-2xl font-bold text-primary">{formatMoney(q.grandTotal, q.currency)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {(q.paymentTerms || q.conditions) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {q.paymentTerms && <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground font-semibold">{t('quotation.paymentTerms')}</div><div className="mt-1 font-medium">{q.paymentTerms}</div></CardContent></Card>}
            {q.conditions && <Card><CardContent className="pt-6"><div className="text-xs uppercase text-muted-foreground font-semibold">{t('quotation.conditions')}</div><div className="mt-1 text-sm whitespace-pre-wrap">{q.conditions}</div></CardContent></Card>}
          </div>
        )}

        {canApproveThis && (
          <div className="flex justify-end gap-3 pb-2">
            <Button variant="destructive" onClick={() => { setShowApprovePopover(false); setShowRejectPopover(true); }} disabled={acting !== null}><X className="h-4 w-4" />Reject</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setShowRejectPopover(false); setShowApprovePopover(true); }} disabled={acting !== null}><Check className="h-4 w-4" />Approve</Button>
          </div>
        )}
      </div>

      {/* ✅ Floating chat — อยู่นอก layout ลอยได้อิสระ */}
      {showCommentThread && <CommentThread quotationId={id} />}

      {showApprovePopover && <ConfirmPopover title={`อนุมัติ ${q.quotationNo}?`} description="Officer จะได้รับแจ้งให้อัปโหลด PO ที่หน้า Checklist" confirmLabel="✓ Approve" onClose={() => setShowApprovePopover(false)} onConfirm={handleApprove} loading={acting === 'approve'} />}
      {showRejectPopover && <ConfirmPopover title={`ปฏิเสธ ${q.quotationNo}?`} description="Officer จะได้รับแจ้งและสามารถแก้ไขแล้วส่งใหม่ได้" confirmLabel="✕ Reject" confirmVariant="destructive" requireComment onClose={() => setShowRejectPopover(false)} onConfirm={handleReject} loading={acting === 'reject'} />}
    </div>
  );
}

function DocRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className="flex gap-2 text-[11px] py-0.5"><span className="text-gray-700 w-[110px] shrink-0">{label}</span><span className={`flex-1 ${bold ? 'font-bold text-[12px]' : 'font-semibold'}`}>{value}</span></div>;
}
function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[1fr_auto] px-3 py-1.5 border-b border-gray-300"><span className="text-gray-700">{label}</span><span className="font-semibold min-w-[90px] text-right">{value}</span></div>;
}