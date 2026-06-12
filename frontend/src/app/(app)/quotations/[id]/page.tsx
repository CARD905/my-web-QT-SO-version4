'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft, Send, X, Check, Loader2, FileText,
  CheckCircle2, Clock, AlertTriangle, Upload, ExternalLink,
  Printer, RefreshCw, Crown, XCircle, ArrowRight, MessageSquare,
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
import type { ApiResponse, CompanySettings, Quotation, QuotationApproval } from '@/types/api';

const ELEVATED_ROLES = ['MANAGER', 'CEO', 'ADMIN'];
const COMMENT_ALLOWED_STATUSES = ['PENDING', 'PENDING_BACKUP', 'PO_PENDING', 'REJECTED', 'REVISED'];
const PDF_ALLOWED_STATUSES = ['APPROVED', 'PO_PENDING', 'PO_APPROVED', 'PO_REJECTED', 'SENT', 'SIGNED'];

// ════════════════════════════════════════════════════════════════════════════
// Thai Baht Text
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
// Confirm Popover
// ════════════════════════════════════════════════════════════════════════════
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
            <textarea value={comment} onChange={(e) => setComment(e.target.value)}
              rows={2} autoFocus
              placeholder={requireComment ? 'ระบุเหตุผลที่ปฏิเสธ...' : 'เพิ่มหมายเหตุ...'}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
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

// ════════════════════════════════════════════════════════════════════════════
// Quotation PDF Document
// ════════════════════════════════════════════════════════════════════════════

/** One labeled field in the Customer Information / Terms sections */
function DocField({ label, value, bold, wide }: { label: string; value?: string | null; bold?: boolean; wide?: boolean }) {
  if (!value) return null;
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <div className="text-[9.5px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-[11px] mt-0.5 ${bold ? 'font-bold text-[13px]' : 'font-medium text-gray-900'}`}>{value}</div>
    </div>
  );
}

/** One row in the totals summary */
function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline py-1.5 border-b border-gray-100 text-[11px] ${accent ? 'font-bold text-base' : ''}`}>
      <span className={accent ? 'text-gray-900' : 'text-gray-600'}>{label}</span>
      <span className={`font-semibold tabular-nums ${accent ? 'text-[#5B21B6] text-base' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}

function QuotationDocument({ q, company }: { q: Quotation; company: CompanySettings | null }) {
  const grandTotalNum = Number(q.grandTotal);
  const bahtText = q.currency === 'THB' ? toThaiBahtText(grandTotalNum) : '';
  const padCount = Math.max(0, 7 - (q.items?.length ?? 0));

  // Validity days (issueDate → expiryDate)
  const validDays = q.issueDate && q.expiryDate
    ? Math.round((new Date(q.expiryDate as string).getTime() - new Date(q.issueDate as string).getTime()) / 86_400_000)
    : null;

  const companyName = company?.companyNameTh || company?.companyName || '';
  const companyNameEn = company?.companyNameTh && company?.companyName ? company.companyName : '';
  const initial = companyName.slice(0, 1) || 'C';

  return (
    <div
      id="qt-printable"
      className="bg-white text-black"
      style={{ fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif", fontSize: 13 }}
    >
      {/* ── HEADER ── */}
      <div className="flex items-start justify-between px-8 pt-7 pb-5 border-b border-gray-200">
        {/* Company info */}
        <div className="flex items-start gap-3 flex-1 min-w-0 pr-6">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xl shrink-0"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)' }}
          >
            {initial}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-[14px] leading-snug">{companyName}</div>
            {companyNameEn && <div className="text-[11px] text-gray-500">{companyNameEn}</div>}
            <div className="text-[11px] text-gray-600 mt-1 space-y-0.5">
              {(company?.addressTh || company?.address) && (
                <div>{company?.addressTh || company?.address}</div>
              )}
              {(company?.phone || company?.fax) && (
                <div>
                  {company?.phone && `โทร. ${company.phone}`}
                  {company?.phone && company?.fax && '  ·  '}
                  {company?.fax && `โทรสาร ${company.fax}`}
                </div>
              )}
              {company?.email && <div>อีเมล {company.email}</div>}
              {company?.taxId && <div>เลขผู้เสียภาษี {company.taxId}</div>}
            </div>
          </div>
        </div>

        {/* Document title + meta */}
        <div className="text-right shrink-0">
          <div className="text-[22px] font-extrabold tracking-widest" style={{ color: '#5B21B6' }}>QUOTATION</div>
          <div className="text-[11px] text-gray-500 -mt-0.5 tracking-wide">ใบเสนอราคา</div>
          <div className="mt-3 text-[11px] space-y-1">
            <div className="flex justify-end gap-3">
              <span className="text-gray-500">เลขที่</span>
              <span className="font-bold text-[13px]" style={{ color: '#5B21B6' }}>{q.quotationNo}</span>
            </div>
            <div className="flex justify-end gap-3">
              <span className="text-gray-500">วันที่</span>
              <span className="font-semibold">{formatDate(q.issueDate)}</span>
            </div>
            {q.currency !== 'THB' && (
              <div className="flex justify-end gap-3">
                <span className="text-gray-500">สกุลเงิน</span>
                <span className="font-semibold">{q.currency}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── CUSTOMER INFORMATION ── */}
      <div className="mx-8 mt-4 rounded-lg bg-gray-50 border border-gray-200 overflow-hidden">
        <div className="px-5 py-2 border-b border-gray-200 bg-gray-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700">Customer Information</span>
        </div>
        <div className="px-5 py-3 grid grid-cols-2 gap-x-8 gap-y-2.5">
          <DocField label="Company" value={q.customerCompany} bold />
          <DocField label="Contact Name" value={q.customerContactName} />
          {q.customerTaxId && <DocField label="Tax ID" value={q.customerTaxId} />}
          {q.customerPhone && <DocField label="Phone" value={q.customerPhone} />}
          {q.customerEmail && <DocField label="Email" value={q.customerEmail} />}
          {q.customerBillingAddress && <DocField label="Billing Address" value={q.customerBillingAddress} wide />}
          {q.customerShippingAddress && q.customerShippingAddress !== q.customerBillingAddress && (
            <DocField label="Shipping Address" value={q.customerShippingAddress} wide />
          )}
        </div>
      </div>

      {/* ── QUOTATION TERMS ── */}
      <div className="mx-8 mt-3 rounded-lg bg-gray-50 border border-gray-200 overflow-hidden">
        <div className="px-5 py-2 border-b border-gray-200 bg-gray-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700">Quotation Terms</span>
        </div>
        <div className="px-5 py-3 grid grid-cols-4 gap-x-6">
          <div>
            <div className="text-[9.5px] text-gray-500 uppercase tracking-wide">วันที่กำหนดส่ง</div>
            <div className="text-[11px] font-medium text-gray-900 mt-0.5">{q.deliveryDate ? formatDate(q.deliveryDate) : '—'}</div>
          </div>
          <div>
            <div className="text-[9.5px] text-gray-500 uppercase tracking-wide">อินราคาภายใน (วัน)</div>
            <div className="text-[11px] font-medium text-gray-900 mt-0.5">{validDays != null ? `${validDays} วัน` : '—'}</div>
          </div>
          <div>
            <div className="text-[9.5px] text-gray-500 uppercase tracking-wide">Expire Date</div>
            <div className="text-[11px] font-medium text-gray-900 mt-0.5">{formatDate(q.expiryDate)}</div>
          </div>
          <div>
            <div className="text-[9.5px] text-gray-500 uppercase tracking-wide">เงื่อนไขชำระเงิน</div>
            <div className="text-[11px] font-medium text-gray-900 mt-0.5">{q.paymentTerms || '—'}</div>
          </div>
        </div>
      </div>

      {/* ── LINE ITEMS ── */}
      <div className="mx-8 mt-3 rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-2 border-b border-gray-200 bg-gray-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700">Line Items</span>
        </div>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="px-3 py-2.5 text-left w-[70px] font-semibold tracking-wide text-[10px]">SKU</th>
              <th className="px-3 py-2.5 text-left font-semibold tracking-wide text-[10px]">PRODUCT</th>
              <th className="px-3 py-2.5 text-right w-[60px] font-semibold tracking-wide text-[10px]">QTY</th>
              <th className="px-3 py-2.5 text-center w-[40px] font-semibold tracking-wide text-[10px]">UNIT</th>
              <th className="px-3 py-2.5 text-right w-[90px] font-semibold tracking-wide text-[10px]">UNIT PRICE</th>
              <th className="px-3 py-2.5 text-right w-[70px] font-semibold tracking-wide text-[10px]">DISCOUNT</th>
              <th className="px-3 py-2.5 text-right w-[90px] font-semibold tracking-wide text-[10px]">LINE TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {q.items?.map((it, idx) => (
              <tr key={it.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                <td className="px-3 py-2.5 align-top font-mono text-[10px] text-gray-500">{it.productSku || '-'}</td>
                <td className="px-3 py-2.5 align-top">
                  <div className="font-semibold text-gray-900">{it.productName}</div>
                  {it.productDescription && <div className="text-[10px] text-gray-400 mt-0.5">{it.productDescription}</div>}
                </td>
                <td className="px-3 py-2.5 align-top text-right">{formatNumber(it.quantity)}</td>
                <td className="px-3 py-2.5 align-top text-center text-gray-500">{it.unit}</td>
                <td className="px-3 py-2.5 align-top text-right">{formatNumber(it.unitPrice)}</td>
                <td className="px-3 py-2.5 align-top text-right text-gray-500">
                  {Number(it.discount) > 0
                    ? it.discountType === 'PERCENTAGE' ? `${formatNumber(it.discount)}%` : formatNumber(it.discount)
                    : '-'}
                </td>
                <td className="px-3 py-2.5 align-top text-right font-semibold">{formatNumber(it.lineTotal)}</td>
              </tr>
            ))}
            {Array.from({ length: padCount }).map((_, i) => (
              <tr key={`pad-${i}`} className={i % 2 === (q.items?.length ?? 0) % 2 ? 'bg-white' : 'bg-gray-50/60'}>
                {Array.from({ length: 7 }).map((__, j) => (
                  <td key={j} className="px-3 py-2.5">&nbsp;</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── NOTES + TOTALS ── */}
      <div className="mx-8 mt-3 grid grid-cols-[1fr_260px] gap-4">
        {/* Notes / bank info */}
        <div className="text-[11px] space-y-3">
          {q.conditions && (
            <div>
              <div className="text-[9.5px] text-gray-500 uppercase tracking-wide font-semibold mb-1">หมายเหตุ / Notes</div>
              <div className="text-gray-700 leading-relaxed">{q.conditions}</div>
            </div>
          )}
          {bahtText && (
            <div>
              <div className="text-[9.5px] text-gray-500 uppercase tracking-wide font-semibold mb-1">จำนวนเงินตัวอักษร</div>
              <div className="italic text-gray-700">( {bahtText} )</div>
            </div>
          )}
          {company?.bankName && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="text-[9.5px] text-gray-500 uppercase tracking-wide font-semibold mb-1">โอนเงินเข้าบัญชี</div>
              <div className="font-semibold text-gray-900">{company.bankName}</div>
              {company.bankAccount && <div className="text-gray-700">{company.bankAccount}{company.bankBranch ? ` (${company.bankBranch})` : ''}</div>}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="text-[11px] self-start">
          <SummaryRow label="Subtotal" value={formatNumber(q.subtotal)} />
          <SummaryRow
            label={`Trade Discount (${Number(q.discountTotal) > 0 ? formatNumber(Number(q.discountTotal) / Number(q.subtotal) * 100) : '0.00'}%)`}
            value={`-${formatNumber(q.discountTotal)}`}
          />
          <SummaryRow label="After Discount" value={formatNumber(Number(q.subtotal) - Number(q.discountTotal))} />
          {q.vatEnabled
            ? <SummaryRow label={`VAT (${formatNumber(q.vatRate)}%)`} value={formatNumber(q.vatAmount)} />
            : <SummaryRow label="VAT" value="Exempt" />
          }
          <div className="flex justify-between items-baseline pt-2 mt-1">
            <span className="font-bold text-[13px] text-gray-900">Grand Total</span>
            <span className="font-extrabold text-[16px]" style={{ color: '#5B21B6' }}>
              {q.currency === 'THB' ? '฿' : q.currency + ' '}{formatNumber(q.grandTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* ── PAYMENT TERMS ── */}
      {q.paymentTerms && (
        <div className="mx-8 mt-4">
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-5 py-2.5">
            <div className="text-[9.5px] text-gray-500 uppercase tracking-wide font-semibold">Payment Terms</div>
            <div className="text-[12px] font-bold text-gray-900 mt-0.5">{q.paymentTerms}</div>
          </div>
        </div>
      )}

      {/* ── SIGNATURE FOOTER ── */}
      <div className="mx-8 mt-6 pt-5 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-12">
          {[{ th: 'พนักงานขาย', en: 'Sales Officer' }, { th: 'ผู้จัดการฝ่ายขาย', en: 'Sales Manager' }].map((s, i) => (
            <div key={i} className="text-center">
              <div className="flex justify-center gap-4 mb-6 text-gray-300">
                <MessageSquare className="h-4 w-4" />
                <span className="text-[10px]">T</span>
                <span className="text-[10px]">✎</span>
                <span className="text-[10px]">□</span>
              </div>
              <div className="border-t border-gray-400 mx-6 pt-2">
                <div className="text-[12px] font-semibold text-gray-900">{s.th}</div>
                <div className="text-[10px] text-gray-500">{s.en}</div>
                <div className="text-[10px] text-gray-400 mt-1.5">วันที่ / ______________</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pb-4 text-center text-[9px] text-gray-400">
          เอกสารนี้ออกโดยระบบอัตโนมัติ · ใบเสนอราคามีอายุถึง {formatDate(q.expiryDate)}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Approval Chain Display
// ════════════════════════════════════════════════════════════════════════════
function ApprovalChainStep({
  name, role, status, comment, isCurrent,
}: {
  name: string; role: string; status: 'APPROVED' | 'ESCALATED' | 'REJECTED' | 'WAITING';
  comment?: string | null; isCurrent?: boolean;
}) {
  const cfg = {
    APPROVED: { icon: <CheckCircle2 className="h-4 w-4" />, ring: 'border-emerald-500', bg: 'bg-emerald-500', text: 'อนุมัติแล้ว', label: 'text-emerald-700 dark:text-emerald-400' },
    ESCALATED: { icon: <ArrowRight className="h-4 w-4" />, ring: 'border-blue-500', bg: 'bg-blue-500', text: 'ส่งต่อแล้ว', label: 'text-blue-700 dark:text-blue-400' },
    REJECTED:  { icon: <XCircle className="h-4 w-4" />,     ring: 'border-red-500',     bg: 'bg-red-500',     text: 'ปฏิเสธ',     label: 'text-red-700 dark:text-red-400' },
    WAITING:   { icon: <Clock className="h-4 w-4" />,       ring: 'border-amber-500',   bg: 'bg-amber-500',   text: 'รออนุมัติ',  label: 'text-amber-700 dark:text-amber-400' },
  }[status];

  return (
    <div className="flex flex-col items-center gap-1 min-w-[80px] max-w-[110px]">
      <div className={`w-9 h-9 rounded-full border-2 ${cfg.ring} ${cfg.bg} text-white flex items-center justify-center shadow-sm ${isCurrent ? 'animate-pulse' : ''}`}>
        {cfg.icon}
      </div>
      <div className="text-center">
        <div className="text-[11px] font-semibold leading-tight">{name}</div>
        <div className="text-[10px] text-muted-foreground leading-tight">{role}</div>
        <div className={`text-[10px] font-medium mt-0.5 ${cfg.label}`}>{cfg.text}</div>
        {comment && <div className="text-[10px] text-muted-foreground mt-0.5 italic max-w-[100px] truncate" title={comment}>"{comment}"</div>}
      </div>
    </div>
  );
}

function ApprovalChainDisplay({
  approvals, currentApprover, isPending, projected,
}: {
  approvals: QuotationApproval[];
  currentApprover: Quotation['currentApprover'];
  isPending: boolean;
  projected?: Array<{ id: string; name: string; roleName: string; roleCode: string }>;
}) {
  const completedSteps = approvals.filter((a) => a.status === 'APPROVED' || a.status === 'ESCALATED');
  const hasAnything = completedSteps.length > 0 || (isPending && currentApprover) || (projected && projected.length > 0);
  if (!hasAnything) return null;

  return (
    <div className="mt-3 pt-3 border-t border-amber-200/60 dark:border-amber-800/40">
      <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-2 tracking-wide">ลำดับการอนุมัติ</div>
      <div className="flex items-start gap-1 flex-wrap">
        {completedSteps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-1">
            <ApprovalChainStep
              name={step.approverName}
              role={step.approverRoleName}
              status={step.status as 'APPROVED' | 'ESCALATED'}
              comment={step.comment}
            />
            {(i < completedSteps.length - 1 || isPending || (projected && projected.length > 0)) && (
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mb-4" />
            )}
          </div>
        ))}
        {isPending && currentApprover && (
          <div className="flex items-center gap-1">
            <ApprovalChainStep
              name={currentApprover.name}
              role={currentApprover.role?.nameTh ?? ''}
              status="WAITING"
              isCurrent
            />
            {projected && projected.length > 0 && (
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mb-4" />
            )}
          </div>
        )}
        {projected?.map((p, i) => (
          <div key={p.id} className="flex items-center gap-1 opacity-40">
            <ApprovalChainStep name={p.name} role={p.roleName} status="WAITING" />
            {i < projected.length - 1 && (
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mb-4" />
            )}
          </div>
        ))}
      </div>
      {projected && projected.length > 0 && (
        <p className="text-[10px] text-muted-foreground mt-1.5">
          * ขั้นตอนที่จางลงคือผู้อนุมัติที่จะรับต่อหากเกินวงเงิน
        </p>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════════════════════
export default function QuotationDetailPage() {
  const t = useT();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: session } = useSession();
  const { role, can } = usePermissions();

  const [q, setQ] = useState<Quotation | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [showApprovePopover, setShowApprovePopover] = useState(false);
  const [showRejectPopover, setShowRejectPopover] = useState(false);
  const [showEscalatePopover, setShowEscalatePopover] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);

  // ── Currency display toggle ──────────────────────────────────────────────
  const [displayCurrency, setDisplayCurrency] = useState<'THB' | 'USD'>('THB');
  const [liveRate, setLiveRate] = useState(35);      // THB per 1 USD
  const [rateFetching, setRateFetching] = useState(false);
  const rateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLiveRate = useCallback(async () => {
    setRateFetching(true);
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await res.json();
      if (data?.rates?.THB) setLiveRate(Math.round(data.rates.THB * 100) / 100);
    } catch { /* keep current rate */ }
    finally { setRateFetching(false); }
  }, []);

  // Auto-refresh while in USD mode and quotation is not yet approved
  useEffect(() => {
    if (rateIntervalRef.current) clearInterval(rateIntervalRef.current);
    if (displayCurrency !== 'USD') return;
    fetchLiveRate();
    const locked = ['APPROVED','PO_PENDING','PO_APPROVED','PO_REJECTED','SENT','SIGNED','CANCELLED','EXPIRED'].includes(q?.status ?? '');
    if (!locked) {
      rateIntervalRef.current = setInterval(fetchLiveRate, 30_000);
    }
    return () => { if (rateIntervalRef.current) clearInterval(rateIntervalRef.current); };
  }, [displayCurrency, q?.status, fetchLiveRate]);

  // Helper: format amount in display currency
  const fmtAmt = useCallback((v: number | string | null | undefined) => {
    const n = Number(v) || 0;
    const qCur = (q?.currency ?? 'THB') as string;
    if (displayCurrency === 'USD' && qCur === 'THB') return formatMoney(n / liveRate, 'USD');
    if (displayCurrency === 'THB' && qCur === 'USD') return formatMoney(n * liveRate, 'THB');
    return formatMoney(n, qCur);
  }, [q?.currency, displayCurrency, liveRate]);

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

  const handleEscalate = async (comment: string) => {
    setActing('escalate');
    try { await api.post(`/quotations/${id}/escalate`, { comment }); toast.success('ส่งต่อให้ผู้มีอำนาจอนุมัติถัดไปเรียบร้อย'); setShowEscalatePopover(false); await load(); }
    catch (err) { toast.error(getApiErrorMessage(err)); } finally { setActing(null); }
  };

  // ✅ Renew — สร้าง Draft ใหม่ v+1
  const handleRenew = async () => {
    if (!q) return;
    if (!confirm(`ต้องการต่ออายุ ${q.quotationNo}?\n\nระบบจะสร้าง Draft ใหม่เป็น v${q.version + 1} ให้อัตโนมัติ`)) return;
    setActing('renew');
    try {
      const res = await api.post<ApiResponse<{ id: string; quotationNo: string }>>(`/quotations/${id}/renew`, {});
      const newQt = res.data.data;
      toast.success(`สร้าง ${newQt?.quotationNo} (v${q.version + 1}) เรียบร้อย`);
      router.push(`/quotations/${newQt?.id}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally { setActing(null); }
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
  const isCeo = role?.code === 'CEO';
  const canEdit   = (['DRAFT', 'REJECTED', 'REVISED'] as string[]).includes(q.status) && isOwner;
  const canSubmit = (['DRAFT', 'REVISED'] as string[]).includes(q.status) && isOwner;
  const canCancel = q.status === 'DRAFT' && (isOwner || isElevated);
  const canPdf    = PDF_ALLOWED_STATUSES.includes(q.status as string) && can('quotation', 'exportPdf', 'OWN');
  const canRenew  = q.status === 'EXPIRED' && isOwner;

  // ── Approval logic ──────────────────────────────────────────────────────
  // The designated approver is tracked in q.currentApprover.
  // Only CEO can bypass the currentApprover check. ADMIN has no approval authority.
  const isCurrentApprover = !!(userId && q.currentApprover?.id === userId);
  const isPendingStatus = q.status === 'PENDING';
  const canApproveThis = isPendingStatus && (isCurrentApprover || isCeo);

  // Does the current approver's limit get exceeded by this quotation?
  const approverLimit = Number(q.currentApprover?.approvalLimit ?? 0);
  const grandTotalNum = Number(q.grandTotal);
  const exceedsMoneyLimit = isCurrentApprover && !isCeo && approverLimit > 0 && grandTotalNum > approverLimit;

  // Discount limit check per position
  const discountLimitPct = Number(q.currentApprover?.discountLimit ?? 0);
  const maxItemDiscountPct = Math.max(
    0,
    ...(q.items ?? [])
      .filter((it) => it.discountType === 'PERCENTAGE')
      .map((it) => Number(it.discount)),
  );
  const exceedsDiscountLimit = isCurrentApprover && !isCeo && discountLimitPct > 0 && maxItemDiscountPct > discountLimitPct;

  const exceedsApproverLimit = exceedsMoneyLimit || exceedsDiscountLimit;

  // Label for next level manager (used in escalate button + popover)
  const nextLevelTitle = (() => {
    const lv = q.currentApprover?.managerLevel;
    if (lv === 'SECTION') return 'Department Manager';
    if (lv === 'DEPARTMENT') return 'Division Manager';
    if (lv === 'DIVISION') return 'CEO';
    return 'ผู้มีอำนาจอนุมัติถัดไป';
  })();

  const showCommentThread = COMMENT_ALLOWED_STATUSES.includes(q.status as string);

  // ── Print View ──────────────────────────────────────────────────────────
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
            <p className="text-sm text-muted-foreground mt-0.5">
              {q.customerCompany} · {formatDate(q.issueDate)} → {formatDate(q.expiryDate)}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {/* ── Currency display toggle ── */}
          <div className="flex items-center gap-1.5 mr-1">
            <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border/60">
              <button
                onClick={() => setDisplayCurrency('THB')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${displayCurrency === 'THB' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                🇹🇭 THB
              </button>
              <button
                onClick={() => setDisplayCurrency('USD')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${displayCurrency === 'USD' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                🇺🇸 USD
              </button>
            </div>
            {displayCurrency === 'USD' && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 whitespace-nowrap">
                {rateFetching
                  ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  : <RefreshCw className="h-2.5 w-2.5 cursor-pointer hover:text-foreground" onClick={fetchLiveRate} />}
                1 USD = {liveRate} THB
                {!['APPROVED','PO_PENDING','PO_APPROVED','PO_REJECTED','SENT','SIGNED','CANCELLED','EXPIRED'].includes(q.status) && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium ml-0.5">live</span>
                )}
              </span>
            )}
          </div>

          {canEdit && (
            <Button asChild variant="outline">
              <Link href={`/quotations/${id}/edit`}><FileText className="h-4 w-4" />{t('common.edit')}</Link>
            </Button>
          )}
          {canCancel && (
            <Button variant="outline" onClick={cancel} disabled={acting !== null}>
              {acting === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              {t('common.cancel')}
            </Button>
          )}
          {canSubmit && (
            <Button onClick={submit} disabled={acting !== null}>
              {acting === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t('quotation.submitForApproval')}
            </Button>
          )}
          {/* ✅ ปุ่ม Renew */}
          {canRenew && (
            <Button onClick={handleRenew} disabled={acting !== null} variant="outline"
              className="border-violet-400 text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-900/20">
              {acting === 'renew' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Renew (v{q.version + 1})
            </Button>
          )}
          {canPdf && (
            <Button variant="outline" onClick={() => setShowPrintView(true)}>
              <Printer className="h-4 w-4" />Save PDF
            </Button>
          )}
          {q.saleOrder && (
            <Button asChild variant="secondary">
              <Link href={`/sale-orders/${q.saleOrder.id}`}>
                <FileText className="h-4 w-4" />{q.saleOrder.saleOrderNo}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* ── Status Banners ── */}

      {/* ✅ EXPIRED */}
      {q.status === 'EXPIRED' && (
        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardContent className="pt-4 flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-orange-700 dark:text-orange-400">ใบเสนอราคาหมดอายุแล้ว</div>
              <p className="text-sm mt-1">หมดอายุเมื่อ {formatDate(q.expiryDate)}</p>
              <p className="text-xs text-muted-foreground mt-1">กด "Renew" เพื่อสร้าง Draft ใหม่โดยคัดลอกข้อมูลทั้งหมดมาให้อัตโนมัติ</p>
            </div>
            {canRenew && (
              <Button size="sm" onClick={handleRenew} disabled={acting !== null}
                className="shrink-0 bg-violet-600 hover:bg-violet-700 text-white">
                {acting === 'renew' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Renew
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {q.status === 'REJECTED' && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4 flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-destructive">ถูกปฏิเสธ</div>
              {q.rejectionReason && <p className="text-sm mt-1">{q.rejectionReason}</p>}
              <p className="text-xs text-muted-foreground mt-2">
                แก้ไขแล้วส่งใหม่ได้เลย · ดูความคิดเห็นเพิ่มเติมได้ที่กล่องข้อความด้านล่าง
              </p>
            </div>
            {canEdit && (
              <Button asChild size="sm" variant="destructive" className="shrink-0">
                <Link href={`/quotations/${id}/edit`}><FileText className="h-3.5 w-3.5" />แก้ไข</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      {q.status === 'REVISED' && (
        <Card className="border-violet-500/50 bg-violet-500/5">
          <CardContent className="pt-4 flex gap-3 items-start">
            <RefreshCw className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-violet-700 dark:text-violet-400">แก้ไขแล้ว — พร้อมส่งอนุมัติ</div>
              <p className="text-sm mt-1 text-muted-foreground">
                คุณได้แก้ไขใบเสนอราคาที่ถูกปฏิเสธแล้ว กด "ส่งอนุมัติ" เพื่อส่งให้ Manager พิจารณาใหม่
              </p>
            </div>
            {canSubmit && (
              <Button size="sm" onClick={submit} disabled={acting !== null}
                className="shrink-0 bg-violet-600 hover:bg-violet-700 text-white">
                {acting === 'submit' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                ส่งอนุมัติ
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {isPendingStatus && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="pt-4">
            <div className="flex gap-3 items-start">
              <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-semibold text-amber-700 dark:text-amber-400">รออนุมัติ</div>
                </div>
                <p className="text-sm mt-1">
                  ส่งเมื่อ {formatDate(q.submittedAt)} · รอ{' '}
                  <span className="font-semibold">{q.currentApprover?.name || 'Manager'}</span>
                  {q.currentApprover?.role?.nameTh ? ` (${q.currentApprover.role.nameTh})` : ''} ตรวจสอบ
                </p>
                {isCurrentApprover && (
                  <div className={`mt-2 rounded-lg px-3 py-2 text-xs font-medium ${exceedsApproverLimit ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                    {exceedsMoneyLimit
                      ? `⚠ มูลค่า ${formatMoney(grandTotalNum, q.currency)} เกินวงเงินของคุณ (${formatMoney(approverLimit)}) — กรุณาส่งต่อ ${nextLevelTitle}`
                      : exceedsDiscountLimit
                      ? `⚠ ส่วนลด ${maxItemDiscountPct}% เกินสิทธิ์ของคุณ (${discountLimitPct}%) — กรุณาส่งต่อ ${nextLevelTitle}`
                      : `✓ อยู่ในสิทธิ์ของคุณ${approverLimit > 0 ? ` (วงเงิน ${formatMoney(approverLimit)})` : ''}${discountLimitPct > 0 ? ` (ส่วนลด ≤${discountLimitPct}%)` : ''} — สามารถอนุมัติได้เลย`}
                  </div>
                )}
                {!isCurrentApprover && !isCeo && isOwner && (
                  <p className="text-xs text-muted-foreground mt-2">⚠ ไม่สามารถยกเลิกได้หลังส่งแล้ว — ติดต่อ Manager หากต้องการยกเลิก</p>
                )}
                {!isCurrentApprover && !isCeo && !isOwner && (
                  <p className="text-xs text-muted-foreground mt-2">คุณได้ส่งต่อ Quotation นี้แล้ว — ดูสถานะและใช้ปุ่มข้อความด้านล่างเพื่อสื่อสาร</p>
                )}
                <ApprovalChainDisplay
                  approvals={q.approvals ?? []}
                  currentApprover={q.currentApprover}
                  isPending={isPendingStatus}
                  projected={q.projectedFutureApprovers}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {q.status === 'APPROVED' && (
        <Card className="border-blue-500/50 bg-blue-500/5">
          <CardContent className="pt-4 flex gap-3 items-start">
            <Upload className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-blue-900 dark:text-blue-200">อนุมัติแล้ว — กรุณาแนบใบ PO</div>
              <p className="text-sm mt-1">อนุมัติเมื่อ {formatDate(q.approvedAt)} โดย {q.approvedBy?.name || '-'}</p>
              <p className="text-xs text-muted-foreground mt-1">💡 กด "Save PDF" ส่งให้ลูกค้า แล้วนำใบ PO อัปโหลดที่ Checklist</p>
            </div>
            <Button asChild size="sm" className="shrink-0 mt-1">
              <Link href={`/quotations/checklist/${id}`}><ExternalLink className="h-3.5 w-3.5" />ไปหน้า Checklist</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      {q.status === 'PO_PENDING' && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="pt-4 flex gap-3 items-start">
            <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-amber-700 dark:text-amber-400">PO รอการตรวจสอบ</div>
              <p className="text-xs text-muted-foreground mt-1">Manager กำลังตรวจสอบใบ PO</p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 mt-1">
              <Link href={`/quotations/checklist/${id}`}><ExternalLink className="h-3.5 w-3.5" />ดูหน้า Checklist</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      {q.status === 'PO_APPROVED' && (
        <Card className="border-emerald-500/50 bg-emerald-500/5">
          <CardContent className="pt-4 flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-emerald-700 dark:text-emerald-300">PO อนุมัติแล้ว — เสร็จสิ้น</div>
              <p className="text-sm mt-1">Sale Order {q.saleOrder?.saleOrderNo} ถูกสร้างแล้ว</p>
            </div>
          </CardContent>
        </Card>
      )}
      {(q.status as string) === 'PO_REJECTED' && (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardContent className="pt-4 flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-red-700 dark:text-red-300">PO ถูกปฏิเสธ</div>
              <p className="text-xs text-muted-foreground mt-1">กรุณาอัปโหลดใบ PO ใหม่</p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 mt-1">
              <Link href={`/quotations/checklist/${id}`}><Upload className="h-3.5 w-3.5" />อัปโหลด PO ใหม่</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Content */}
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
                      <td className="py-3 text-right">{fmtAmt(it.unitPrice)}</td>
                      <td className="py-3 text-right">{Number(it.discount) > 0 ? (it.discountType === 'PERCENTAGE' ? `${formatNumber(it.discount)}%` : fmtAmt(it.discount)) : '-'}</td>
                      <td className="py-3 text-right font-semibold">{fmtAmt(it.lineTotal)}</td>
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
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('quotation.subtotal')}</span><span>{fmtAmt(q.subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('quotation.discount')}</span><span className="text-destructive">-{fmtAmt(q.discountTotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('quotation.vat')} ({formatNumber(q.vatRate)}%)</span><span>{q.vatEnabled ? fmtAmt(q.vatAmount) : 'No VAT'}</span></div>
              <div className="border-t pt-2 flex justify-between items-baseline">
                <span className="font-semibold">{t('quotation.grandTotal')}</span>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">{fmtAmt(q.grandTotal)}</div>
                  {displayCurrency !== q.currency && (
                    <div className="text-xs text-muted-foreground">{formatMoney(q.grandTotal, q.currency as string)}</div>
                  )}
                </div>
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

        {/* CEO Executive Review */}
        {isCeo && canApproveThis && (() => {
          const discountPct = Number(q.subtotal) + Number(q.discountTotal) > 0
            ? (Number(q.discountTotal) / (Number(q.subtotal) + Number(q.discountTotal))) * 100
            : 0;
          const netRevenue = Number(q.subtotal) - Number(q.discountTotal);
          const isHighValue = Number(q.grandTotal) > 5_000_000;
          const isHighDiscount = maxItemDiscountPct > 25;
          const hasRisk = isHighValue || isHighDiscount;
          return (
            <Card className="border-2 border-amber-400/60 bg-gradient-to-br from-amber-950/10 via-background to-yellow-950/5">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <Crown className="h-5 w-5 text-amber-500" />
                  <span className="font-bold text-amber-800 dark:text-amber-300 tracking-wide">CEO Executive Review</span>
                  <Badge className="ml-auto bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 text-[10px]" variant="outline">
                    EXECUTIVE ACTION REQUIRED
                  </Badge>
                </div>

                {/* Financial analysis grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-background/70 rounded-lg p-3 border border-border/40">
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Grand Total</div>
                    <div className="text-base font-bold">{fmtAmt(q.grandTotal)}</div>
                  </div>
                  <div className="bg-background/70 rounded-lg p-3 border border-border/40">
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">ส่วนลดรวม</div>
                    <div className="text-base font-bold text-orange-600">
                      -{fmtAmt(q.discountTotal)}
                    </div>
                    {discountPct > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">{discountPct.toFixed(1)}% ของราคาเต็ม</div>
                    )}
                  </div>
                  <div className="bg-background/70 rounded-lg p-3 border border-border/40">
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Net Revenue</div>
                    <div className="text-base font-bold text-emerald-600">{fmtAmt(netRevenue)}</div>
                  </div>
                  <div className="bg-background/70 rounded-lg p-3 border border-border/40">
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase mb-1">Max Discount (รายการ)</div>
                    <div className={`text-base font-bold ${maxItemDiscountPct > 25 ? 'text-red-600' : maxItemDiscountPct > 15 ? 'text-orange-500' : 'text-foreground'}`}>
                      {maxItemDiscountPct > 0 ? `${maxItemDiscountPct}%` : '—'}
                    </div>
                  </div>
                </div>

                {/* Risk flags */}
                <div className="space-y-2">
                  {isHighDiscount && (
                    <div className="flex items-start gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 px-3 py-2.5">
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <span className="font-semibold text-red-800 dark:text-red-200">
                          High Discount Alert — {maxItemDiscountPct}% เกิน 25%
                        </span>
                        <div className="text-xs text-red-700 dark:text-red-300 mt-0.5">ตรวจสอบความสมเหตุผลก่อนอนุมัติ</div>
                      </div>
                    </div>
                  )}
                  {isHighValue && (
                    <div className="flex items-start gap-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 px-3 py-2.5">
                      <AlertTriangle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <span className="font-semibold text-blue-800 dark:text-blue-200">
                          High-Value Deal — {fmtAmt(q.grandTotal)}
                        </span>
                        <div className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">ตรวจสอบรายการสินค้าและเงื่อนไขให้ครบถ้วน</div>
                      </div>
                    </div>
                  )}
                  {!hasRisk && (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 px-3 py-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                        ไม่มี Risk Flag — Quotation นี้อยู่ในเกณฑ์ปกติ สามารถอนุมัติได้เลย
                      </span>
                    </div>
                  )}
                </div>

                {/* Quick meta */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 mt-4 pt-4 border-t border-border/30 text-xs text-muted-foreground">
                  <div>สร้างโดย: <span className="font-medium text-foreground">{q.createdBy?.name || '—'}</span>{q.createdBy?.role?.nameTh ? ` (${q.createdBy.role.nameTh})` : ''}</div>
                  <div>ลูกค้า: <span className="font-medium text-foreground">{q.customerCompany}</span></div>
                  <div>อายุเอกสาร: <span className="font-medium text-foreground">{formatDate(q.issueDate)} → {formatDate(q.expiryDate)}</span></div>
                  {q.totalSteps > 0 && (
                    <div>ขั้นตอนอนุมัติ: <span className="font-medium text-foreground">{q.currentStep}/{q.totalSteps}</span></div>
                  )}
                  {Number(q.vatRate) > 0 && (
                    <div>VAT {formatNumber(q.vatRate)}%: <span className="font-medium text-foreground">+{fmtAmt(q.vatAmount)}</span></div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {canApproveThis && (
          <div className="flex justify-end gap-3 pb-2">
            <Button
              variant="destructive"
              onClick={() => { setShowApprovePopover(false); setShowEscalatePopover(false); setShowRejectPopover(true); }}
              disabled={acting !== null}
            >
              <X className="h-4 w-4" />Reject
            </Button>
            {exceedsApproverLimit ? (
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => { setShowRejectPopover(false); setShowApprovePopover(false); setShowEscalatePopover(true); }}
                disabled={acting !== null}
              >
                <Send className="h-4 w-4" />ส่งต่อ {nextLevelTitle}
              </Button>
            ) : (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => { setShowRejectPopover(false); setShowEscalatePopover(false); setShowApprovePopover(true); }}
                disabled={acting !== null}
              >
                <Check className="h-4 w-4" />Approve
              </Button>
            )}
          </div>
        )}
      </div>

      {showCommentThread && <CommentThread quotationId={id} />}
      {showApprovePopover && <ConfirmPopover title={`อนุมัติ ${q.quotationNo}?`} description="Officer จะได้รับแจ้งให้อัปโหลด PO ที่หน้า Checklist" confirmLabel="✓ Approve" onClose={() => setShowApprovePopover(false)} onConfirm={handleApprove} loading={acting === 'approve'} />}
      {showRejectPopover && <ConfirmPopover title={`ปฏิเสธ ${q.quotationNo}?`} description="Officer จะได้รับแจ้งและสามารถแก้ไขแล้วส่งใหม่ได้ทันที ไม่ผ่านขั้นตอน" confirmLabel="✕ Reject" confirmVariant="destructive" requireComment onClose={() => setShowRejectPopover(false)} onConfirm={handleReject} loading={acting === 'reject'} />}
      {showEscalatePopover && (
        <ConfirmPopover
          title={`ส่งต่อ ${q.quotationNo} ให้ ${nextLevelTitle}?`}
          description={
            exceedsDiscountLimit
              ? `ส่วนลด ${maxItemDiscountPct}% เกินสิทธิ์ของคุณ (${discountLimitPct}%) — ส่งต่อให้ ${nextLevelTitle} พิจารณาต่อ`
              : `มูลค่า ${formatMoney(grandTotalNum, q.currency)} เกินวงเงินของคุณ (${formatMoney(approverLimit)}) — ส่งต่อให้ ${nextLevelTitle} พิจารณาต่อ`
          }
          confirmLabel={`ส่งต่อ ${nextLevelTitle}`}
          onClose={() => setShowEscalatePopover(false)}
          onConfirm={handleEscalate}
          loading={acting === 'escalate'}
        />
      )}
    </div>
  );
}
