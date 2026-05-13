'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft, Printer, FileText, Send, CheckCircle2,
  XCircle, Loader2, Clock, AlertTriangle, Download, Calendar, Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { usePermissions } from '@/hooks/use-permissions';
import { formatDate, formatMoney, formatNumber, getStatusClass, cn } from '@/lib/utils';
import type { ApiResponse, CompanySettings, SaleOrder } from '@/types/api';

const MANAGER_ROLES = ['MANAGER', 'CEO', 'ADMIN', 'APPROVER'];

// ════════════════════════════════════════════════════════════════════════════
// Reject Dialog
// ════════════════════════════════════════════════════════════════════════════
function RejectDialog({ onClose, onConfirm, loading }: {
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-2xl border shadow-2xl w-full max-w-md p-6">
        <h3 className="font-bold text-lg mb-1">ปฏิเสธ Sale Order</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Sale Order จะกลับไปอยู่ในรายการรอดำเนินการ Officer สามารถแก้ไขและส่งใหม่ได้
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3} autoFocus
          placeholder="ระบุเหตุผล..."
          className="w-full border border-input rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>ยกเลิก</Button>
          <Button variant="destructive" disabled={loading || reason.trim().length < 2}
            onClick={() => onConfirm(reason.trim())}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <XCircle className="h-4 w-4" />ยืนยันปฏิเสธ
          </Button>
        </div>
      </div>
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

// helper: แปลง deadlineDate (string | Date | null | undefined) → "YYYY-MM-DD"
function toDateInput(val: string | Date | null | undefined): string {
  if (!val) return '';
  const s = typeof val === 'string' ? val : val.toISOString();
  return s.slice(0, 10);
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
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [deadlineEdit, setDeadlineEdit] = useState('');
  const [savingDeadline, setSavingDeadline] = useState(false);

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
      if (data?.deadlineDate) {
        setDeadlineEdit(toDateInput(data.deadlineDate));
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!confirm('ส่ง Sale Order ให้ Manager อนุมัติ?')) return;
    setActing('submit');
    try {
      await api.post(`/sale-orders/${id}/submit`);
      toast.success('ส่งให้ Manager อนุมัติเรียบร้อย');
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setActing(null); }
  };

  const handleApprove = async () => {
    if (!confirm('อนุมัติ Sale Order นี้?')) return;
    setActing('approve');
    try {
      await api.post(`/sale-orders/${id}/approve`);
      toast.success('อนุมัติ Sale Order เรียบร้อย');
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setActing(null); }
  };

  const handleReject = async (reason: string) => {
    setActing('reject');
    try {
      await api.post(`/sale-orders/${id}/reject`, { reason });
      toast.success('ปฏิเสธ Sale Order — เก็บไว้ในรายการรอดำเนินการ');
      setShowRejectDialog(false);
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setActing(null); }
  };

  const handleSaveDeadline = async () => {
    if (!deadlineEdit) { toast.error('กรุณาเลือกวันที่'); return; }
    setSavingDeadline(true);
    try {
      await api.patch(`/sale-orders/${id}/deadline`, { deadlineDate: deadlineEdit });
      toast.success('บันทึกวันกำหนดส่งเรียบร้อย');
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setSavingDeadline(false); }
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
            <Button onClick={handleSubmit} disabled={acting !== null}>
              {acting === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              ส่งให้ Manager อนุมัติ
            </Button>
          )}
          {isRejected && isOwner && (
            <Button onClick={handleSubmit} disabled={acting !== null}>
              {acting === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              ส่งให้ Manager ใหม่
            </Button>
          )}
          {isPending && isManager && (
            <>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleApprove} disabled={acting !== null}>
                {acting === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                อนุมัติ
              </Button>
              <Button variant="destructive" onClick={() => setShowRejectDialog(true)} disabled={acting !== null}>
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
                    <div className="text-xs text-muted-foreground mb-1">ไฟล์ PO</div>
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <a href={so.quotation.poFileUrl as string} target="_blank" rel="noopener noreferrer">
                        <Download className="h-3.5 w-3.5" />ดู/ดาวน์โหลด PO
                      </a>
                    </Button>
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
          <Card className={isRejected && isOwner ? 'border-amber-300' : ''}>
            <CardContent className="pt-5">
              <h2 className="font-semibold mb-3 text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />วันกำหนดส่ง (Deadline)
              </h2>
              {isRejected && isOwner ? (
                <div className="space-y-2">
                  <Label htmlFor="deadlineDate" className="text-xs text-muted-foreground">
                    วันสุดท้ายในการดำเนินการ
                  </Label>
                  <Input
                    id="deadlineDate"
                    type="date"
                    value={deadlineEdit}
                    onChange={(e) => setDeadlineEdit(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="text-sm"
                  />
                  <Button className="w-full" size="sm" onClick={handleSaveDeadline}
                    disabled={savingDeadline || !deadlineEdit}>
                    {savingDeadline ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    บันทึกวันกำหนดส่ง
                  </Button>
                 
                </div>
              ) : (
                <div>
                  {so.deadlineDate
                    ? <div className="font-semibold">{formatDate(so.deadlineDate)}</div>
                    : <div className="text-sm text-muted-foreground">ยังไม่ได้กำหนด</div>
                  }
                </div>
              )}
            </CardContent>
          </Card>

          {isPending && isOwner && (
            <p className="text-xs text-center text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2">
              รอ Manager อนุมัติ — แก้ไขไม่ได้ในขณะนี้
            </p>
          )}
        </div>
      </div>

      {showRejectDialog && (
        <RejectDialog
          onClose={() => setShowRejectDialog(false)}
          onConfirm={handleReject}
          loading={acting === 'reject'}
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

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #so-printable, #so-printable * { visibility: visible !important; }
          #so-printable { position: fixed; inset: 0; padding: 0; margin: 0; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>
      <div className="max-w-5xl mx-auto">
        <div className="no-print flex flex-wrap gap-3 items-center justify-between mb-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/sale-orders"><ArrowLeft className="h-4 w-4" />กลับ</Link>
          </Button>
          <div className="flex gap-2 items-center">
            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-300">🔒 CONFIRMED</Badge>
            {so.quotation && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/quotations/${so.quotation.id}`}>
                  <FileText className="h-4 w-4" />{so.quotation.quotationNo}
                </Link>
              </Button>
            )}
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" />พิมพ์ / Save PDF
            </Button>
          </div>
        </div>

        <div id="so-printable" className="bg-white text-black shadow-sm" style={{ fontFamily: 'Sarabun, sans-serif' }}>
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
                      {company?.taxId && <div>เลขประจำตัวผู้เสียภาษี: {company.taxId}</div>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col">
                <div className="text-center py-2 border-b-2 border-black">
                  <div className="text-xl font-bold tracking-widest">SALE ORDER</div>
                  <div className="text-xs text-gray-700">ใบสั่งขาย</div>
                </div>
                <table className="w-full text-[11px]">
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="px-2 py-1 border-r border-black w-[42%] text-gray-700">เลขที่</td>
                      <td className="px-2 py-1 font-semibold text-right">{so.saleOrderNo}</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="px-2 py-1 border-r border-black text-gray-700">วันที่</td>
                      <td className="px-2 py-1 font-semibold text-right">{formatDate(so.issueDate)}</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="px-2 py-1 border-r border-black text-gray-700">เลข PO</td>
                      <td className="px-2 py-1 font-semibold text-right">{so.poNumber || '-'}</td>
                    </tr>
                    {so.deadlineDate && (
                      <tr className="border-b border-black">
                        <td className="px-2 py-1 border-r border-black text-gray-700">กำหนดส่ง</td>
                        <td className="px-2 py-1 font-semibold text-right">{formatDate(so.deadlineDate)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="px-2 py-1 border-r border-black text-gray-700">อ้างอิง QT</td>
                      <td className="px-2 py-1 font-semibold text-right">{so.quotation?.quotationNo || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="border-2 border-t-0 border-black grid grid-cols-2">
            <div className="px-4 py-2 border-r-2 border-black">
              <DocRow label="ลูกค้า" value={so.customerCompany} bold />
              <DocRow label="ผู้ติดต่อ" value={so.customerContactName} />
              {so.customerTaxId && <DocRow label="เลขผู้เสียภาษี" value={so.customerTaxId} />}
              {so.customerPhone && <DocRow label="โทรศัพท์" value={so.customerPhone} />}
              {so.customerBillingAddress && <DocRow label="ที่อยู่" value={so.customerBillingAddress} />}
            </div>
            <div className="px-4 py-2">
              <DocRow label="วันที่ออกใบ" value={formatDate(so.issueDate)} />
              <DocRow label="เงื่อนไขชำระเงิน" value={so.paymentTerms || '-'} />
              <DocRow label="สกุลเงิน" value={so.currency} />
              {so.customerShippingAddress && <DocRow label="ที่อยู่จัดส่ง" value={so.customerShippingAddress} />}
            </div>
          </div>

          <table className="w-full border-2 border-t-0 border-black text-[11px]">
            <thead>
              <tr className="bg-black text-white">
                <th className="border-r border-gray-700 px-2 py-2 text-left w-[80px]">SKU</th>
                <th className="border-r border-gray-700 px-2 py-2 text-left">รายการ</th>
                <th className="border-r border-gray-700 px-2 py-2 text-right w-[60px]">จำนวน</th>
                <th className="border-r border-gray-700 px-2 py-2 text-center w-[50px]">หน่วย</th>
                <th className="border-r border-gray-700 px-2 py-2 text-right w-[80px]">ราคา/หน่วย</th>
                <th className="border-r border-gray-700 px-2 py-2 text-right w-[60px]">ส่วนลด</th>
                <th className="px-2 py-2 text-right w-[90px]">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody>
              {so.items?.map((it, idx) => (
                <tr key={it.id || idx} className="border-b border-gray-300">
                  <td className="border-r border-gray-300 px-2 py-2 font-mono text-[10px]">{it.productSku || '-'}</td>
                  <td className="border-r border-gray-300 px-2 py-2">
                    <div className="font-semibold">{it.productName}</div>
                    {it.productDescription && <div className="text-[10px] text-gray-700">{it.productDescription}</div>}
                  </td>
                  <td className="border-r border-gray-300 px-2 py-2 text-right">{formatNumber(it.quantity)}</td>
                  <td className="border-r border-gray-300 px-2 py-2 text-center">{it.unit}</td>
                  <td className="border-r border-gray-300 px-2 py-2 text-right">{formatNumber(it.unitPrice)}</td>
                  <td className="border-r border-gray-300 px-2 py-2 text-right">
                    {Number(it.discount) > 0 ? (it.discountType === 'PERCENTAGE' ? `${formatNumber(it.discount)}%` : formatNumber(it.discount)) : '-'}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold">{formatNumber(it.lineTotal)}</td>
                </tr>
              ))}
              {Array.from({ length: padCount }).map((_, i) => (
                <tr key={`pad-${i}`} className="border-b border-gray-300">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className={`px-2 py-2 ${j < 6 ? 'border-r border-gray-300' : ''}`}>&nbsp;</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-2 border-t-0 border-black grid grid-cols-[1fr_300px]">
            <div className="px-4 py-3 border-r-2 border-black">
              {bahtText && (
                <div>
                  <div className="text-[10px] text-gray-700 mb-1">จำนวนเงินตัวอักษร</div>
                  <div className="text-[12px] italic font-semibold">( {bahtText} )</div>
                </div>
              )}
              {company?.bankName && (
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <div className="text-[10px] text-gray-700 mb-1">โอนเงินเข้าบัญชี</div>
                  <div className="text-[11px] font-semibold">
                    {company.bankName}{company.bankAccount && `   ${company.bankAccount}`}
                    {company.bankBranch && ` (${company.bankBranch})`}
                  </div>
                </div>
              )}
            </div>
            <div className="text-[11px]">
              <SummaryRow label="รวมเงิน" value={formatNumber(so.subtotal)} />
              {Number(so.discountTotal) > 0 && <SummaryRow label="ส่วนลด" value={`-${formatNumber(so.discountTotal)}`} />}
              <SummaryRow label="หลังหักส่วนลด" value={formatNumber(afterDiscount)} />
              {so.vatEnabled
                ? <SummaryRow label={`VAT ${formatNumber(so.vatRate)}%`} value={formatNumber(so.vatAmount)} />
                : <SummaryRow label="ภาษีมูลค่าเพิ่ม" value="ไม่มี VAT" />}
              <div className="bg-black text-white px-3 py-2 flex justify-between items-baseline">
                <span className="font-bold">จำนวนเงินทั้งสิ้น</span>
                <span className="font-bold text-base">{formatNumber(so.grandTotal)} {so.currency}</span>
              </div>
            </div>
          </div>

          {so.conditions && (
            <div className="border-2 border-t-0 border-black px-4 py-2">
              <div className="text-[10px] text-gray-700 mb-1">เงื่อนไข</div>
              <div className="text-[11px] whitespace-pre-wrap">{so.conditions}</div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-6 mt-12 pb-4 px-4">
            {[
              { th: 'ผู้อนุมัติสั่งซื้อ', en: 'Authorized Buyer' },
              { th: 'พนักงานขาย', en: 'Sales Representative' },
              { th: 'ผู้มีอำนาจลงนาม', en: 'Authorized Signatory' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="border-t border-black mt-12 mx-3 pt-1.5">
                  <div className="text-[11px] font-medium">{s.th}</div>
                  <div className="text-[10px] text-gray-700">{s.en}</div>
                  <div className="text-[10px] text-gray-700 mt-3">วันที่: ____________</div>
                </div>
              </div>
            ))}
          </div>
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
function DocRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex gap-2 text-[11px] py-0.5">
      <span className="text-gray-700 w-[110px] shrink-0">{label}</span>
      <span className={`flex-1 ${bold ? 'font-bold text-[12px]' : 'font-semibold'}`}>{value}</span>
    </div>
  );
}
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] px-3 py-1.5 border-b border-gray-300">
      <span className="text-gray-700">{label}</span>
      <span className="font-semibold min-w-[90px] text-right">{value}</span>
    </div>
  );
}