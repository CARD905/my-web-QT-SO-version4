'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import type { ApiResponse, CompanySettings, SaleOrder } from '@/types/api';

// Convert number to Thai baht text
function toThaiBahtText(num: number): string {
  const txtNumArr = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const txtDigitArr = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  function readNum(amount: string): string {
    let result = '';
    const len = amount.length;
    for (let i = 0; i < len; i++) {
      const digit = parseInt(amount[i], 10);
      if (digit === 0) continue;
      const place = len - i - 1;
      if (place === 0 && digit === 1 && len > 1) result += 'เอ็ด';
      else if (place === 1 && digit === 2) result += 'ยี่' + txtDigitArr[1];
      else if (place === 1 && digit === 1) result += txtDigitArr[1];
      else result += txtNumArr[digit] + txtDigitArr[place];
    }
    return result;
  }

  const fixed = Math.round(num * 100) / 100;
  const [bahtStr, satangStrRaw = '0'] = fixed.toFixed(2).split('.');
  const satangStr = satangStrRaw.padEnd(2, '0').slice(0, 2);

  let bahtText = '';
  if (parseInt(bahtStr, 10) === 0) bahtText = 'ศูนย์บาท';
  else {
    let s = bahtStr;
    while (s.length > 6) {
      const head = s.slice(0, s.length - 6);
      const tail = s.slice(s.length - 6);
      bahtText += readNum(head) + 'ล้าน';
      s = tail;
    }
    bahtText += readNum(s) + 'บาท';
  }

  if (parseInt(satangStr, 10) === 0) bahtText += 'ถ้วน';
  else bahtText += readNum(satangStr) + 'สตางค์';

  return bahtText;
}

export default function SaleOrderDetailPage() {
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
      <div className="space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[800px] w-full" />
      </div>
    );
  }

  if (!so) {
    return <div className="text-center py-20">Not found</div>;
  }

  const afterDiscount = Number(so.subtotal) - Number(so.discountTotal);
  const grandTotalNum = Number(so.grandTotal);
  const bahtText = so.currency === 'THB' ? toThaiBahtText(grandTotalNum) : '';

  // Pad table to minimum rows for consistent look
  const minRows = 8;
  const itemCount = so.items?.length ?? 0;
  const padCount = Math.max(0, minRows - itemCount);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between mb-4 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/sale-orders">
            <ArrowLeft className="h-4 w-4" />
            กลับ
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
            พิมพ์ / Save PDF
          </Button>
        </div>
      </div>

      {/* DOCUMENT — formal A4-style */}
      <div className="bg-white text-black shadow-sm" style={{ fontFamily: 'Sarabun, sans-serif' }}>
        {/* HEADER */}
        <div className="border-2 border-black">
          <div className="grid grid-cols-[1fr_280px]">
            {/* Left: Company info */}
            <div className="px-4 py-3 border-r-2 border-black">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 border-2 border-black flex items-center justify-center font-bold text-lg shrink-0">
                  {(company?.companyNameTh || company?.companyName || 'C').slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-base leading-tight">
                    {company?.companyNameTh || company?.companyName || 'Your Company Co., Ltd.'}
                  </div>
                  {company?.companyNameTh && company?.companyName && (
                    <div className="text-xs text-gray-700">{company.companyName}</div>
                  )}
                  <div className="text-[11px] leading-snug mt-1 text-gray-800">
                    {company?.addressTh || company?.address}
                    {(company?.phone || company?.fax) && (
                      <div>
                        {company?.phone && `โทร. ${company.phone}`}
                        {company?.fax && `  แฟกซ์ ${company.fax}`}
                      </div>
                    )}
                    {company?.email && <div>อีเมล {company.email}</div>}
                    {company?.taxId && <div>เลขประจำตัวผู้เสียภาษี: {company.taxId}</div>}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Doc title + meta */}
            <div className="flex flex-col">
              <div className="text-center py-2 border-b-2 border-black">
                <div className="text-xl font-bold tracking-widest">SALE ORDER</div>
                <div className="text-xs text-gray-700">ใบสั่งขาย</div>
              </div>
              <table className="w-full text-[11px]">
                <tbody>
                  <tr className="border-b border-black">
                    <td className="px-2 py-1 border-r border-black w-[42%] text-gray-700">
                      เลขที่ / No.
                    </td>
                    <td className="px-2 py-1 font-semibold text-right">{so.saleOrderNo}</td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="px-2 py-1 border-r border-black text-gray-700">
                      วันที่ / Date
                    </td>
                    <td className="px-2 py-1 font-semibold text-right">
                      {formatDate(so.issueDate)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1 border-r border-black text-gray-700">
                      อ้างอิง / Ref.
                    </td>
                    <td className="px-2 py-1 font-semibold text-right">
                      {so.quotation?.quotationNo || '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* CUSTOMER */}
        <div className="border-2 border-t-0 border-black grid grid-cols-2">
          <div className="px-4 py-2 border-r-2 border-black">
            <CustomerRow label="ลูกค้า / Customer" value={so.customerCompany} bold />
            <CustomerRow label="ผู้ติดต่อ / Contact" value={so.customerContactName} />
            {so.customerTaxId && (
              <CustomerRow label="เลขผู้เสียภาษี" value={so.customerTaxId} />
            )}
            {so.customerPhone && (
              <CustomerRow label="โทรศัพท์" value={so.customerPhone} />
            )}
            {so.customerEmail && <CustomerRow label="Email" value={so.customerEmail} />}
            {so.customerBillingAddress && (
              <CustomerRow label="ที่อยู่" value={so.customerBillingAddress} />
            )}
          </div>
          <div className="px-4 py-2">
            <CustomerRow
              label="วันครบกำหนด / Due"
              value={so.quotation?.expiryDate ? formatDate(so.quotation.expiryDate) : '-'}
            />
            <CustomerRow label="เงื่อนไขชำระเงิน" value={so.paymentTerms || '-'} />
            <CustomerRow label="สกุลเงิน / Currency" value={so.currency} />
            {so.customerShippingAddress && (
              <CustomerRow label="ที่อยู่จัดส่ง" value={so.customerShippingAddress} />
            )}
          </div>
        </div>

        {/* ITEMS TABLE */}
        <table className="w-full border-2 border-t-0 border-black border-collapse text-[11px]">
          <thead>
            <tr className="bg-black text-white">
              <th className="border-r border-gray-700 px-2 py-2 text-left font-semibold w-[80px]">
                รหัส / SKU
              </th>
              <th className="border-r border-gray-700 px-2 py-2 text-left font-semibold">
                รายการ / Description
              </th>
              <th className="border-r border-gray-700 px-2 py-2 text-right font-semibold w-[60px]">
                จำนวน
              </th>
              <th className="border-r border-gray-700 px-2 py-2 text-center font-semibold w-[50px]">
                หน่วย
              </th>
              <th className="border-r border-gray-700 px-2 py-2 text-right font-semibold w-[80px]">
                ราคา/หน่วย
              </th>
              <th className="border-r border-gray-700 px-2 py-2 text-right font-semibold w-[60px]">
                ส่วนลด
              </th>
              <th className="px-2 py-2 text-right font-semibold w-[90px]">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>
            {so.items?.map((it, idx) => (
              <tr key={it.id || idx} className="border-b border-gray-300">
                <td className="border-r border-gray-300 px-2 py-2 align-top font-mono text-[10px]">
                  {it.productSku || '-'}
                </td>
                <td className="border-r border-gray-300 px-2 py-2 align-top">
                  <div className="font-semibold">{it.productName}</div>
                  {it.productDescription && (
                    <div className="text-[10px] text-gray-700 mt-0.5">{it.productDescription}</div>
                  )}
                </td>
                <td className="border-r border-gray-300 px-2 py-2 align-top text-right">
                  {formatNumber(it.quantity)}
                </td>
                <td className="border-r border-gray-300 px-2 py-2 align-top text-center">
                  {it.unit}
                </td>
                <td className="border-r border-gray-300 px-2 py-2 align-top text-right">
                  {formatNumber(it.unitPrice)}
                </td>
                <td className="border-r border-gray-300 px-2 py-2 align-top text-right">
                  {Number(it.discount) > 0
                    ? it.discountType === 'PERCENTAGE'
                      ? `${formatNumber(it.discount)}%`
                      : formatNumber(it.discount)
                    : '-'}
                </td>
                <td className="px-2 py-2 align-top text-right font-semibold">
                  {formatNumber(it.lineTotal)}
                </td>
              </tr>
            ))}
            {Array.from({ length: padCount }).map((_, i) => (
              <tr key={`pad-${i}`} className="border-b border-gray-300">
                <td className="border-r border-gray-300 px-2 py-2">&nbsp;</td>
                <td className="border-r border-gray-300 px-2 py-2"></td>
                <td className="border-r border-gray-300 px-2 py-2"></td>
                <td className="border-r border-gray-300 px-2 py-2"></td>
                <td className="border-r border-gray-300 px-2 py-2"></td>
                <td className="border-r border-gray-300 px-2 py-2"></td>
                <td className="px-2 py-2"></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* SUMMARY AREA */}
        <div className="border-2 border-t-0 border-black grid grid-cols-[1fr_300px]">
          {/* Left: amount in words + bank */}
          <div className="px-4 py-3 border-r-2 border-black flex flex-col justify-between">
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
                  {company.bankName}
                  {company.bankAccount && `   ${company.bankAccount}`}
                  {company.bankBranch && ` (${company.bankBranch})`}
                </div>
              </div>
            )}
          </div>

          {/* Right: totals */}
          <div className="text-[11px]">
            <SummaryRow label="รวมเงิน" value={formatNumber(so.subtotal)} />
            {Number(so.discountTotal) > 0 && (
              <SummaryRow label="ส่วนลด" value={`-${formatNumber(so.discountTotal)}`} />
            )}
            <SummaryRow label="หลังหักส่วนลด" value={formatNumber(afterDiscount)} />
            {so.vatEnabled ? (
              <SummaryRow
                label={`ภาษีมูลค่าเพิ่ม ${formatNumber(so.vatRate)}%`}
                value={formatNumber(so.vatAmount)}
              />
            ) : (
              <SummaryRow label="ภาษีมูลค่าเพิ่ม" value="ไม่มี VAT" />
            )}
            <div className="bg-black text-white px-3 py-2 flex justify-between items-baseline">
              <span className="font-bold">จำนวนเงินทั้งสิ้น</span>
              <span className="font-bold text-base">
                {formatNumber(so.grandTotal)} {so.currency}
              </span>
            </div>
          </div>
        </div>

        {/* CONDITIONS */}
        {so.conditions && (
          <div className="border-2 border-t-0 border-black px-4 py-2">
            <div className="text-[10px] text-gray-700 mb-1">เงื่อนไข / Conditions</div>
            <div className="text-[11px] whitespace-pre-wrap">{so.conditions}</div>
          </div>
        )}

        {/* SIGNATURES */}
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
                <div className="text-[10px] text-gray-700 mt-3">วันที่ / Date: ____________</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CustomerRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex gap-2 text-[11px] py-0.5">
      <span className="text-gray-700 w-[110px] shrink-0">{label}</span>
      <span className={`flex-1 ${bold ? 'font-bold text-[12px]' : 'font-semibold'}`}>
        {value}
      </span>
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