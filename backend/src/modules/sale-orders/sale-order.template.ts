/**
 * PDF Template for Sale Order — formal Thai-style
 * Matches PROSOFT-style reference template.
 */

import { Decimal } from '@prisma/client/runtime/library';

interface SaleOrderForPdf {
  saleOrderNo: string;
  issueDate: Date;
  currency: string;
  customerContactName: string;
  customerCompany: string;
  customerTaxId: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerBillingAddress: string | null;
  customerShippingAddress: string | null;
  subtotal: Decimal | number;
  discountTotal: Decimal | number;
  vatEnabled: boolean;
  vatRate: Decimal | number;
  vatAmount: Decimal | number;
  grandTotal: Decimal | number;
  paymentTerms: string | null;
  conditions: string | null;
  quotation: { quotationNo: string; expiryDate: Date };
  items: Array<{
    productSku: string | null;
    productName: string;
    productDescription: string | null;
    quantity: Decimal | number;
    unit: string;
    unitPrice: Decimal | number;
    discount: Decimal | number;
    discountType: string;
    lineTotal: Decimal | number;
  }>;
}

interface CompanyInfo {
  companyName: string;
  companyNameTh: string | null;
  taxId: string | null;
  address: string | null;
  addressTh: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankBranch: string | null;
}

const fmt = (n: Decimal | number) => {
  const num = typeof n === 'number' ? n : Number(n);
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

// Convert number to Thai baht text (e.g. 1,234.56 → "หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบหกสตางค์ถ้วน")
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
    // Handle large numbers (over a million) by splitting
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

export function buildSaleOrderHtml(so: SaleOrderForPdf, company: CompanyInfo): string {
  const itemsHtml = so.items
    .map(
      (item, idx) => `
        <tr>
          <td class="center sku">${escapeHtml(item.productSku || '-')}</td>
          <td>
            <div class="item-name">${escapeHtml(item.productName)}</div>
            ${item.productDescription ? `<div class="item-desc">${escapeHtml(item.productDescription)}</div>` : ''}
          </td>
          <td class="right">${fmt(item.quantity)}</td>
          <td class="center">${escapeHtml(item.unit)}</td>
          <td class="right">${fmt(item.unitPrice)}</td>
          <td class="right">${
            Number(item.discount) > 0
              ? item.discountType === 'PERCENTAGE'
                ? `${fmt(item.discount)}%`
                : fmt(item.discount)
              : '-'
          }</td>
          <td class="right strong">${fmt(item.lineTotal)}</td>
        </tr>`,
    )
    .join('');

  // Pad rows to keep table height consistent
  const minRows = 8;
  const padCount = Math.max(0, minRows - so.items.length);
  const padRows = Array.from({ length: padCount })
    .map(
      () => `
        <tr class="pad-row">
          <td class="center">&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td>
        </tr>`,
    )
    .join('');

  const afterDiscount = Number(so.subtotal) - Number(so.discountTotal);
  const grandTotalNum = Number(so.grandTotal);
  const bahtText = so.currency === 'THB' ? toThaiBahtText(grandTotalNum) : '';

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>${so.saleOrderNo}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 14mm 12mm; }
  body { font-family: 'Sarabun', sans-serif; font-size: 11px; color: #1a1a1a; line-height: 1.4; }

  /* HEADER */
  .doc-header {
    border: 1.5px solid #1a1a1a;
    padding: 0;
  }
  .doc-header-inner {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: stretch;
  }
  .company {
    padding: 12px 14px;
    border-right: 1.5px solid #1a1a1a;
  }
  .company .logo-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  }
  .company .logo {
    width: 40px;
    height: 40px;
    background: #1d4ed8;
    color: white;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 18px;
    flex-shrink: 0;
  }
  .company .name-th {
    font-size: 16px;
    font-weight: 700;
  }
  .company .name-en {
    font-size: 11px;
    color: #4a4a4a;
  }
  .company .info {
    font-size: 10px;
    color: #444;
    line-height: 1.45;
    margin-top: 4px;
  }
  .doc-title-block {
    padding: 12px 16px;
    text-align: center;
    background: #f5f7fb;
    min-width: 220px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .doc-title-block h1 {
    font-size: 22px;
    font-weight: 700;
    color: #1a1a1a;
    letter-spacing: 1px;
    margin-bottom: 2px;
  }
  .doc-title-block .doc-title-th {
    font-size: 13px;
    color: #555;
    margin-bottom: 8px;
  }
  .doc-meta-table {
    border-collapse: collapse;
    width: 100%;
    font-size: 10.5px;
  }
  .doc-meta-table td {
    border: 1px solid #888;
    padding: 3px 6px;
  }
  .doc-meta-table .lbl {
    background: #fff;
    color: #555;
    font-weight: 500;
    text-align: left;
    width: 38%;
  }
  .doc-meta-table .val {
    background: #fff;
    font-weight: 600;
    text-align: right;
  }

  /* CUSTOMER */
  .customer {
    border: 1.5px solid #1a1a1a;
    border-top: none;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .customer-block {
    padding: 8px 12px;
  }
  .customer-block:first-child { border-right: 1.5px solid #1a1a1a; }
  .customer-block .row { display: flex; gap: 6px; margin-bottom: 2px; font-size: 10.5px; }
  .customer-block .row .lbl { color: #555; min-width: 90px; }
  .customer-block .row .val { font-weight: 600; flex: 1; }
  .customer-block .row .val.strong { font-size: 12px; }

  /* ITEMS TABLE */
  table.items {
    width: 100%;
    border-collapse: collapse;
    border: 1.5px solid #1a1a1a;
    border-top: none;
  }
  table.items thead {
    background: #1a1a1a;
    color: #fff;
  }
  table.items th {
    padding: 6px 5px;
    font-weight: 600;
    font-size: 10.5px;
    text-align: left;
    border-right: 1px solid #444;
  }
  table.items th:last-child { border-right: none; }
  table.items th.center, table.items td.center { text-align: center; }
  table.items th.right, table.items td.right { text-align: right; }
  table.items td {
    padding: 6px 5px;
    border-right: 1px solid #ddd;
    border-bottom: 1px solid #eee;
    vertical-align: top;
    font-size: 10.5px;
  }
  table.items td:last-child { border-right: none; }
  table.items td.sku { font-family: 'Courier New', monospace; font-size: 10px; }
  .item-name { font-weight: 600; }
  .item-desc { font-size: 9.5px; color: #666; margin-top: 1px; }
  table.items tr.pad-row td { padding: 5px 5px; color: transparent; }
  .strong { font-weight: 600; }

  /* SUMMARY */
  .summary-area {
    display: grid;
    grid-template-columns: 1fr 280px;
    border: 1.5px solid #1a1a1a;
    border-top: none;
  }
  .baht-text {
    padding: 10px 12px;
    border-right: 1.5px solid #1a1a1a;
    font-size: 10.5px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .baht-text .lbl {
    color: #555;
    font-size: 9.5px;
    margin-bottom: 2px;
  }
  .baht-text .text {
    font-weight: 600;
    font-style: italic;
  }
  .summary-table {
    font-size: 11px;
  }
  .summary-row {
    display: grid;
    grid-template-columns: 1fr auto;
    padding: 5px 12px;
    border-bottom: 1px solid #ddd;
  }
  .summary-row .lbl { color: #555; }
  .summary-row .val { font-weight: 500; min-width: 90px; text-align: right; }
  .summary-row.discount .val { color: #c00; }
  .summary-row.grand {
    background: #1a1a1a;
    color: #fff;
    border-bottom: none;
    padding: 8px 12px;
  }
  .summary-row.grand .lbl { color: #fff; font-weight: 700; }
  .summary-row.grand .val { font-weight: 700; font-size: 14px; }

  /* FOOTER (Payment + Conditions) */
  .footer-area {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border: 1.5px solid #1a1a1a;
    border-top: none;
  }
  .footer-block {
    padding: 8px 12px;
    font-size: 10.5px;
  }
  .footer-block:first-child { border-right: 1.5px solid #1a1a1a; }
  .footer-block .label {
    color: #555;
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 3px;
  }

  /* SIGNATURES */
  .signatures {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    margin-top: 24px;
    gap: 20px;
  }
  .sig-box {
    text-align: center;
    font-size: 10px;
  }
  .sig-line {
    border-top: 1px solid #1a1a1a;
    margin: 50px 12px 6px 12px;
  }
  .sig-label-th { font-weight: 500; }
  .sig-label-en { color: #666; font-size: 9px; }
  .sig-date { color: #555; font-size: 9px; margin-top: 14px; }

  .doc-meta-tail {
    margin-top: 14px;
    font-size: 9px;
    color: #888;
    text-align: center;
  }
</style>
</head>
<body>

<div class="doc-header">
  <div class="doc-header-inner">
    <div class="company">
      <div class="logo-row">
        <div class="logo">${escapeHtml((company.companyNameTh || company.companyName).slice(0, 1))}</div>
        <div>
          <div class="name-th">${escapeHtml(company.companyNameTh || company.companyName)}</div>
          ${company.companyNameTh ? `<div class="name-en">${escapeHtml(company.companyName)}</div>` : ''}
        </div>
      </div>
      <div class="info">
        ${company.addressTh ? escapeHtml(company.addressTh) + '<br>' : ''}
        ${company.address && !company.addressTh ? escapeHtml(company.address) + '<br>' : ''}
        ${company.phone ? `โทร. ${escapeHtml(company.phone)}` : ''}
        ${company.fax ? ` &nbsp; แฟกซ์ ${escapeHtml(company.fax)}` : ''}
        ${company.email ? ` &nbsp; ${escapeHtml(company.email)}` : ''}
        ${company.taxId ? `<br>เลขประจำตัวผู้เสียภาษี: ${escapeHtml(company.taxId)}` : ''}
      </div>
    </div>
    <div class="doc-title-block">
      <h1>SALE ORDER</h1>
      <div class="doc-title-th">ใบสั่งขาย</div>
      <table class="doc-meta-table">
        <tr><td class="lbl">เลขที่ / No.</td><td class="val">${escapeHtml(so.saleOrderNo)}</td></tr>
        <tr><td class="lbl">วันที่ / Date</td><td class="val">${fmtDate(so.issueDate)}</td></tr>
        <tr><td class="lbl">อ้างอิง / Ref.</td><td class="val">${escapeHtml(so.quotation.quotationNo)}</td></tr>
      </table>
    </div>
  </div>
</div>

<div class="customer">
  <div class="customer-block">
    <div class="row"><span class="lbl">ลูกค้า / Customer</span><span class="val strong">${escapeHtml(so.customerCompany)}</span></div>
    <div class="row"><span class="lbl">ผู้ติดต่อ / Contact</span><span class="val">${escapeHtml(so.customerContactName)}</span></div>
    ${so.customerTaxId ? `<div class="row"><span class="lbl">เลขผู้เสียภาษี</span><span class="val">${escapeHtml(so.customerTaxId)}</span></div>` : ''}
    ${so.customerPhone ? `<div class="row"><span class="lbl">โทรศัพท์</span><span class="val">${escapeHtml(so.customerPhone)}</span></div>` : ''}
    ${so.customerEmail ? `<div class="row"><span class="lbl">Email</span><span class="val">${escapeHtml(so.customerEmail)}</span></div>` : ''}
    ${so.customerBillingAddress ? `<div class="row"><span class="lbl">ที่อยู่</span><span class="val">${escapeHtml(so.customerBillingAddress)}</span></div>` : ''}
  </div>
  <div class="customer-block">
    <div class="row"><span class="lbl">วันครบกำหนด / Due</span><span class="val">${fmtDate(so.quotation.expiryDate)}</span></div>
    <div class="row"><span class="lbl">เงื่อนไขชำระเงิน</span><span class="val">${escapeHtml(so.paymentTerms || '-')}</span></div>
    <div class="row"><span class="lbl">สกุลเงิน / Currency</span><span class="val">${escapeHtml(so.currency)}</span></div>
    <div class="row"><span class="lbl">ที่อยู่จัดส่ง</span><span class="val">${escapeHtml(so.customerShippingAddress || so.customerBillingAddress || '-')}</span></div>
  </div>
</div>

<table class="items">
  <thead>
    <tr>
      <th class="center" style="width:75px;">รหัส / SKU</th>
      <th>รายการ / Description</th>
      <th class="right" style="width:55px;">จำนวน</th>
      <th class="center" style="width:45px;">หน่วย</th>
      <th class="right" style="width:75px;">ราคา/หน่วย</th>
      <th class="right" style="width:55px;">ส่วนลด</th>
      <th class="right" style="width:80px;">จำนวนเงิน</th>
    </tr>
  </thead>
  <tbody>
    ${itemsHtml}
    ${padRows}
  </tbody>
</table>

<div class="summary-area">
  <div class="baht-text">
    ${
      bahtText
        ? `<div><div class="lbl">จำนวนเงินตัวอักษร</div><div class="text">( ${bahtText} )</div></div>`
        : '<div></div>'
    }
    ${
      company.bankName
        ? `<div style="margin-top:8px;">
            <div class="lbl">โอนเงินเข้าบัญชี</div>
            <div style="font-weight:600;">${escapeHtml(company.bankName)}${
              company.bankAccount ? ` &nbsp; ${escapeHtml(company.bankAccount)}` : ''
            }${company.bankBranch ? ` (${escapeHtml(company.bankBranch)})` : ''}</div>
          </div>`
        : ''
    }
  </div>
  <div class="summary-table">
    <div class="summary-row"><span class="lbl">รวมเงิน</span><span class="val">${fmt(so.subtotal)}</span></div>
    ${
      Number(so.discountTotal) > 0
        ? `<div class="summary-row discount"><span class="lbl">ส่วนลด</span><span class="val">-${fmt(so.discountTotal)}</span></div>`
        : ''
    }
    <div class="summary-row"><span class="lbl">เงินหลังหักส่วนลด</span><span class="val">${fmt(afterDiscount)}</span></div>
    ${
      so.vatEnabled
        ? `<div class="summary-row"><span class="lbl">ภาษีมูลค่าเพิ่ม ${fmt(so.vatRate)}%</span><span class="val">${fmt(so.vatAmount)}</span></div>`
        : '<div class="summary-row"><span class="lbl">ภาษีมูลค่าเพิ่ม</span><span class="val">ไม่มี VAT</span></div>'
    }
    <div class="summary-row grand"><span class="lbl">จำนวนเงินทั้งสิ้น</span><span class="val">${fmt(so.grandTotal)} ${escapeHtml(so.currency)}</span></div>
  </div>
</div>

${
  so.conditions
    ? `<div class="footer-area">
        <div class="footer-block" style="grid-column:1/-1;border-right:none;">
          <div class="label">เงื่อนไข / Conditions</div>
          <div>${escapeHtml(so.conditions)}</div>
        </div>
      </div>`
    : ''
}

<div class="signatures">
  <div class="sig-box">
    <div class="sig-line"></div>
    <div class="sig-label-th">ผู้อนุมัติสั่งซื้อ</div>
    <div class="sig-label-en">Authorized Buyer</div>
    <div class="sig-date">วันที่ / Date: ____________</div>
  </div>
  <div class="sig-box">
    <div class="sig-line"></div>
    <div class="sig-label-th">พนักงานขาย</div>
    <div class="sig-label-en">Sales Representative</div>
    <div class="sig-date">วันที่ / Date: ____________</div>
  </div>
  <div class="sig-box">
    <div class="sig-line"></div>
    <div class="sig-label-th">ผู้มีอำนาจลงนาม</div>
    <div class="sig-label-en">Authorized Signatory</div>
    <div class="sig-date">วันที่ / Date: ____________</div>
  </div>
</div>

<div class="doc-meta-tail">${escapeHtml(so.saleOrderNo)} &nbsp;·&nbsp; พิมพ์เมื่อ ${fmtDate(new Date())}</div>

</body>
</html>`;
}

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}