'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Star, CheckCircle2, XCircle, Loader2,
  AlertTriangle, FileText, User, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, formatMoney, formatNumber } from '@/lib/utils';
import type { ApiResponse, Quotation } from '@/types/api';

export default function SpecialDiscountApprovePage() {
  const params = useParams();
  const id = params.id as string;

  const [q, setQ] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [modifyPct, setModifyPct] = useState('');
  const [showModifyInput, setShowModifyInput] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<Quotation>>(`/quotations/${id}`);
      setQ(res.data.data ?? null);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async () => {
    if (!confirm('อนุมัติ Special Discount ตามที่ขอ?')) return;
    setActing('approve');
    try {
      await api.post(`/quotations/${id}/special-discount/approve`);
      toast.success('อนุมัติ Special Discount เรียบร้อย');
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setActing(null); }
  };

  const handleReject = async () => {
    if (!confirm(`ปฏิเสธ Special Discount?\n\nระบบจะปรับส่วนลดลงเหลือ 20% อัตโนมัติ`)) return;
    setActing('reject');
    try {
      await api.post(`/quotations/${id}/special-discount/reject`);
      toast.success('ปฏิเสธ Special Discount — ส่วนลดถูกปรับเหลือ 20%');
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setActing(null); }
  };

  const handleModify = async () => {
    const pct = parseFloat(modifyPct);
    if (isNaN(pct) || pct < 20 || pct > 50) { toast.error('กรุณาระบุ % ระหว่าง 20-50'); return; }
    if (!confirm(`อนุมัติ Special Discount ที่ ${pct}%?`)) return;
    setActing('modify');
    try {
      await api.post(`/quotations/${id}/special-discount/modify`, { finalPercent: pct });
      toast.success(`อนุมัติ Special Discount ${pct}% เรียบร้อย`);
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setActing(null); setShowModifyInput(false); }
  };

  if (loading) return (
    <div className="space-y-4 max-w-3xl">
      <Skeleton className="h-10 w-72" /><Skeleton className="h-64 w-full" /><Skeleton className="h-48 w-full" />
    </div>
  );

  if (!q) return <div className="text-center py-20">ไม่พบข้อมูล</div>;

  const sd = q as any;
  const isPending = sd.specialDiscountStatus === 'PENDING_CEO';

  const statusConfig: Record<string, { color: string; label: string; icon: React.ElementType }> = {
    PENDING_CEO: { color: 'border-amber-400 bg-amber-50 dark:bg-amber-900/20', label: 'รอ CEO อนุมัติ', icon: Star },
    APPROVED:    { color: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20', label: 'อนุมัติแล้ว', icon: CheckCircle2 },
    REJECTED:    { color: 'border-red-400 bg-red-50 dark:bg-red-900/20', label: 'ปฏิเสธ', icon: XCircle },
    MODIFIED:    { color: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20', label: `อนุมัติ ${sd.specialDiscountFinalPct}%`, icon: CheckCircle2 },
  };
  const sc = statusConfig[sd.specialDiscountStatus] ?? statusConfig['PENDING_CEO'];
  const StatusIcon = sc.icon;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="mt-1">
          <Link href="/manager/dashboard"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">คำขอ Special Discount</h1>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-400">
              <Star className="h-3 w-3 mr-1" />{sd.specialDiscountPercent}%
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{q.quotationNo} · {q.customerCompany}</p>
        </div>
      </div>

      {/* Status */}
      <Card className={`border-2 ${sc.color}`}>
        <CardContent className="pt-4 pb-4 flex items-center gap-3">
          <StatusIcon className="h-5 w-5 shrink-0" />
          <div>
            <div className="font-semibold">{sc.label}</div>
            {sd.specialDiscountStatus === 'REJECTED' && (
              <p className="text-xs text-muted-foreground mt-0.5">ส่วนลดถูกปรับลงเหลือ 20% อัตโนมัติแล้ว</p>
            )}
            {sd.specialDiscountStatus === 'MODIFIED' && (
              <p className="text-xs text-muted-foreground mt-0.5">CEO อนุมัติที่ {sd.specialDiscountFinalPct}% (ขอ {sd.specialDiscountPercent}%)</p>
            )}
            {sd.specialDiscountStatus === 'APPROVED' && (
              <p className="text-xs text-muted-foreground mt-0.5">Sales สามารถส่งขออนุมัติ Quotation ได้แล้ว</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Request Detail */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold">รายละเอียดคำขอ</h2>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">ใบเสนอราคา</div>
                <div className="font-medium">{q.quotationNo}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Sales</div>
                <div className="font-medium">{(q as any).createdBy?.name || '-'}</div>
              </div>
            </div>
          </div>

          {/* Discount comparison */}
          <div className="rounded-xl border p-4 bg-muted/30">
            <div className="text-xs text-muted-foreground uppercase font-semibold mb-3">ส่วนลดที่ขอ</div>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">ปกติสูงสุด</div>
                <div className="text-2xl font-bold text-muted-foreground">20%</div>
              </div>
              <div className="text-muted-foreground text-2xl">→</div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">ขอ Special</div>
                <div className="text-3xl font-bold text-amber-600">{sd.specialDiscountPercent}%</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">ผลต่าง</div>
                <div className="text-xl font-bold text-amber-500">+{Number(sd.specialDiscountPercent) - 20}%</div>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
            <MessageSquare className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">เหตุผลที่ขอ</div>
              <div className="text-sm text-amber-900 dark:text-amber-200">{sd.specialDiscountReason}</div>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="text-xs text-muted-foreground uppercase font-semibold mb-2">รายการสินค้า</div>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">สินค้า</th>
                    <th className="text-right px-3 py-2 font-medium">ส่วนลด</th>
                    <th className="text-right px-3 py-2 font-medium">รวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {q.items?.map((it, i) => (
                    <tr key={i} className={Number(it.discount) > 20 && it.discountType === 'PERCENTAGE' ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}>
                      <td className="px-3 py-2">{it.productName}</td>
                      <td className={`px-3 py-2 text-right font-medium ${Number(it.discount) > 20 && it.discountType === 'PERCENTAGE' ? 'text-amber-600' : ''}`}>
                        {Number(it.discount) > 0
                          ? `${formatNumber(it.discount)}${it.discountType === 'PERCENTAGE' ? '%' : ` ${q.currency}`}`
                          : '-'}
                        {Number(it.discount) > 20 && it.discountType === 'PERCENTAGE' && (
                          <Star className="inline h-3 w-3 ml-1 text-amber-500" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{formatNumber(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between items-baseline border-t pt-3">
            <span className="font-semibold">ยอดรวมทั้งสิ้น</span>
            <span className="text-2xl font-bold text-primary">{formatMoney(q.grandTotal, q.currency)}</span>
          </div>
        </CardContent>
      </Card>

      {/* CEO Action Buttons */}
      {isPending && (
        <Card className="border-2 border-primary/20">
          <CardContent className="pt-6 space-y-4">
            <h2 className="font-semibold">การตัดสินใจ</h2>
            <div className="grid grid-cols-1 gap-3">

              {/* 🔴 ปฏิเสธ */}
              <button onClick={handleReject} disabled={acting !== null}
                className="flex items-center gap-4 p-4 rounded-xl border-2 border-red-200 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-left disabled:opacity-50">
                <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  {acting === 'reject' ? <Loader2 className="h-5 w-5 animate-spin text-red-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                </div>
                <div>
                  <div className="font-semibold text-red-700 dark:text-red-400">🔴 ปฏิเสธ</div>
                  <div className="text-xs text-muted-foreground mt-0.5">ระบบจะปรับส่วนลดลงเหลือ 20% อัตโนมัติ Sales สามารถส่งขออนุมัติต่อได้ทันที</div>
                </div>
              </button>

              {/* 🟡 อนุมัติบางส่วน */}
              <div>
                <button onClick={() => setShowModifyInput((v) => !v)} disabled={acting !== null}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-amber-200 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all text-left disabled:opacity-50">
                  <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    <Star className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-amber-700 dark:text-amber-400">🟡 อนุมัติบางส่วน</div>
                    <div className="text-xs text-muted-foreground mt-0.5">กำหนด % ที่อนุมัติเอง (20–50%)</div>
                  </div>
                </button>
                {showModifyInput && (
                  <div className="mt-2 p-4 rounded-xl border border-amber-300 bg-amber-50/50 dark:bg-amber-900/10 space-y-3">
                    <Label className="text-xs font-semibold text-amber-800 dark:text-amber-300">ระบุ % ที่อนุมัติ (20–50%)</Label>
                    <div className="flex gap-2">
                      <Input type="number" min="20" max="50" step="0.5" value={modifyPct}
                        onChange={(e) => setModifyPct(e.target.value)} placeholder="เช่น 25" className="w-32 border-amber-300" />
                      <span className="flex items-center text-sm text-muted-foreground">%</span>
                      <Button onClick={handleModify} disabled={acting !== null || !modifyPct}
                        className="bg-amber-600 hover:bg-amber-700" size="sm">
                        {acting === 'modify' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}ยืนยัน
                      </Button>
                    </div>
                    {modifyPct && (Number(modifyPct) < 20 || Number(modifyPct) > 50) && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />กรุณาระบุระหว่าง 20-50
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 🟢 อนุมัติ */}
              <button onClick={handleApprove} disabled={acting !== null}
                className="flex items-center gap-4 p-4 rounded-xl border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all text-left disabled:opacity-50">
                <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  {acting === 'approve' ? <Loader2 className="h-5 w-5 animate-spin text-emerald-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                </div>
                <div>
                  <div className="font-semibold text-emerald-700 dark:text-emerald-400">🟢 อนุมัติ {sd.specialDiscountPercent}%</div>
                  <div className="text-xs text-muted-foreground mt-0.5">อนุมัติตามที่ Sales ขอ ({sd.specialDiscountPercent}%) Sales สามารถส่งขออนุมัติต่อได้ทันที</div>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center">
        <Button asChild variant="outline">
          <Link href={`/quotations/${id}`}><FileText className="h-4 w-4" />ดูใบเสนอราคา {q.quotationNo}</Link>
        </Button>
      </div>
    </div>
  );
}