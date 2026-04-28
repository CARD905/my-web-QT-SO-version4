/**
 * PDF Template for Sale Order
 * Matches Thai-style document layout from the user's reference
 * (Screenshot_2026-04-24_161411.png)
 *
 * Uses Sarabun font (Google Fonts) for proper Thai rendering
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
    description: string | null;
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

const fmtDate = (d: Date) => {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export function buildSaleOrderHtml(so: SaleOrderForPdf, company: CompanyInfo): string {
  const itemsHtml = so.items
    .map(
      (item, idx) => `
        <tr>
          <td class="center">${idx + 1}</td>
          <td>${item.productSku ?? '-'}</td>
          <td>
            <div class="item-name">${escapeHtml(item.productName)}</div>
            ${item.description ? `<div class="item-desc">${escapeHtml(item.description)}</div>` : ''}
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

  const afterDiscount = Number(so.subtotal) - Number(so.discountTotal);

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>${so.saleOrderNo}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  @page { size: A4; margin: 18mm 14mm; }
  body { font-family: 'Sarabun', sans-serif; font-size: 11px; color: #1f2937; margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #1f2937; }
  .company { flex: 1; }
  .company .logo { font-size: 22px; font-weight: 700; color: #2563eb; margin-bottom: 2px; }
  .company .name { font-size: 14px; font-weight: 600; }
  .company .name-th { font-size: 13px; color: #4b5563; }
  .company .info { font-size: 10px; color: #6b7280; line-height: 1.5; margin-top: 4px; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 24px; margin: 0 0 8px 0; color: #1f2937; }
  .doc-meta { font-size: 11px; border: 1px solid #d1d5db; border-radius: 4px; overflow: hidden; }
  .doc-meta-row { display: flex; }
  .doc-meta-row:not(:last-child) { border-bottom: 1px solid #e5e7eb; }
  .doc-meta .lbl { background: #f3f4f6; padding: 5px 10px; font-weight: 500; border-right: 1px solid #e5e7eb; min-width: 90px; }
  .doc-meta .val { padding: 5px 10px; font-weight: 600; min-width: 110px; text-align: right; }

  .customer { display: flex; gap: 16px; margin-top: 16px; }
  .customer-block { flex: 1; padding: 10px 12px; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; }
  .customer-block h3 { margin: 0 0 6px 0; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
  .customer-block .field { margin-bottom: 3px; font-size: 11px; }
  .customer-block .field strong { color: #111827; }

  table.items { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 10.5px; }
  table.items thead { background: #1f2937; color: #fff; }
  table.items th { padding: 8px 6px; text-align: left; font-weight: 600; }
  table.items th.center, table.items td.center { text-align: center; }
  table.items th.right, table.items td.right { text-align: right; }
  table.items td { padding: 8px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  table.items tr:nth-child(even) td { background: #f9fafb; }
  .item-name { font-weight: 600; color: #111827; }
  .item-desc { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .strong { font-weight: 600; }

  .summary { display: flex; justify-content: flex-end; margin-top: 16px; }
  .summary-table { min-width: 280px; font-size: 11.5px; }
  .summary-row { display: flex; justify-content: space-between; padding: 6px 12px; }
  .summary-row.subtle { color: #6b7280; }
  .summary-row.discount { color: #dc2626; }
  .summary-divider { border-top: 1px solid #e5e7eb; margin: 4px 0; }
  .grand-total { display: flex; justify-content: space-between; padding: 10px 12px; background: #1f2937; color: #fff; border-radius: 6px; margin-top: 6px; font-size: 14px; font-weight: 700; }

  .footer-info { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 18px; font-size: 10.5px; }
  .footer-block { padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 6px; background: #f9fafb; }
  .footer-block h4 { margin: 0 0 4px 0; font-size: 10.5px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }

  .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 32px; }
  .sig-box { text-align: center; }
  .sig-line { border-top: 1px solid #1f2937; margin: 50px 8px 8px 8px; }
  .sig-label { font-size: 10.5px; color: #4b5563; }
  .sig-date { font-size: 10px; color: #6b7280; margin-top: 16px; }

  .doc-footer { margin-top: 24px; text-align: center; font-size: 9.5px; color: #9ca3af; padding-top: 8px; border-top: 1px solid #e5e7eb; }
</style>
</head>
<body>

<div class="header">
  <div class="company">
    <div class="logo">${escapeHtml(company.companyName.split(' ')[0] ?? 'COMPANY')}</div>
    <div class="name">${escapeHtml(company.companyName)}</div>
    ${company.companyNameTh ? `<div class="name-th">${escapeHtml(company.companyNameTh)}</div>` : ''}
    <div class="info">
      ${company.address ? escapeHtml(company.address) + '<br>' : ''}
      ${company.addressTh ? escapeHtml(company.addressTh) + '<br>' : ''}
      ${company.phone ? `Tel: ${escapeHtml(company.phone)}` : ''}
      ${company.email ? ` &nbsp;|&nbsp; ${escapeHtml(company.email)}` : ''}
      ${company.taxId ? `<br>Tax ID: ${escapeHtml(company.taxId)}` : ''}
    </div>
  </div>
  <div class="doc-title">
    <h1>SALE ORDER</h1>
    <div class="doc-meta">
      <div class="doc-meta-row"><div class="lbl">Document No</div><div class="val">${escapeHtml(so.saleOrderNo)}</div></div>
      <div class="doc-meta-row"><div class="lbl">Issue Date</div><div class="val">${fmtDate(so.issueDate)}</div></div>
      <div class="doc-meta-row"><div class="lbl">Quotation Ref</div><div class="val">${escapeHtml(so.quotation.quotationNo)}</div></div>
      <div class="doc-meta-row"><div class="lbl">Currency</div><div class="val">${escapeHtml(so.currency)}</div></div>
    </div>
  </div>
</div>

<div class="customer">
  <div class="customer-block">
    <h3>Bill To / ผู้ซื้อ</h3>
    <div class="field"><strong>${escapeHtml(so.customerCompany)}</strong></div>
    <div class="field">Attn: ${escapeHtml(so.customerContactName)}</div>
    ${so.customerTaxId ? `<div class="field">Tax ID: ${escapeHtml(so.customerTaxId)}</div>` : ''}
    ${so.customerPhone ? `<div class="field">Tel: ${escapeHtml(so.customerPhone)}</div>` : ''}
    ${so.customerEmail ? `<div class="field">${escapeHtml(so.customerEmail)}</div>` : ''}
    ${so.customerBillingAddress ? `<div class="field">${escapeHtml(so.customerBillingAddress)}</div>` : ''}
  </div>
  <div class="customer-block">
    <h3>Ship To / ที่อยู่จัดส่ง</h3>
    <div class="field">${escapeHtml(so.customerShippingAddress || so.customerBillingAddress || '-')}</div>
  </div>
</div>

<table class="items">
  <thead>
    <tr>
      <th class="center" style="width:30px;">#</th>
      <th style="width:80px;">SKU</th>
      <th>Description / รายการ</th>
      <th class="right" style="width:60px;">Qty</th>
      <th class="center" style="width:50px;">Unit</th>
      <th class="right" style="width:80px;">Unit Price</th>
      <th class="right" style="width:60px;">Disc.</th>
      <th class="right" style="width:90px;">Line Total</th>
    </tr>
  </thead>
  <tbody>
    ${itemsHtml}
  </tbody>
</table>

<div class="summary">
  <div class="summary-table">
    <div class="summary-row subtle">
      <span>Subtotal</span>
      <span>${fmt(so.subtotal)}</span>
    </div>
    ${
      Number(so.discountTotal) > 0
        ? `<div class="summary-row discount"><span>Discount</span><span>-${fmt(so.discountTotal)}</span></div>`
        : ''
    }
    <div class="summary-row subtle">
      <span>Net before VAT</span>
      <span>${fmt(afterDiscount)}</span>
    </div>
    ${
      so.vatEnabled
        ? `<div class="summary-row subtle"><span>VAT (${fmt(so.vatRate)}%)</span><span>${fmt(so.vatAmount)}</span></div>`
        : '<div class="summary-row subtle"><span>VAT</span><span>(no VAT)</span></div>'
    }
    <div class="grand-total">
      <span>GRAND TOTAL</span>
      <span>${fmt(so.grandTotal)} ${escapeHtml(so.currency)}</span>
    </div>
  </div>
</div>

<div class="footer-info">
  <div class="footer-block">
    <h4>Payment Terms / เงื่อนไขการชำระ</h4>
    <div>${escapeHtml(so.paymentTerms || '-')}</div>
    ${
      company.bankName
        ? `<div style="margin-top:6px;"><strong>${escapeHtml(company.bankName)}</strong>${
            company.bankAccount ? ` &nbsp; A/C: ${escapeHtml(company.bankAccount)}` : ''
          }${company.bankBranch ? ` (${escapeHtml(company.bankBranch)})` : ''}</div>`
        : ''
    }
  </div>
  <div class="footer-block">
    <h4>Conditions / Notes</h4>
    <div>${escapeHtml(so.conditions || '-')}</div>
  </div>
</div>

<div class="signatures">
  <div class="sig-box">
    <div class="sig-line"></div>
    <div class="sig-label">ผู้อนุมัติสั่งซื้อ / Authorized Buyer</div>
    <div class="sig-date">Date: _________________</div>
  </div>
  <div class="sig-box">
    <div class="sig-line"></div>
    <div class="sig-label">พนักงานขาย / Sales Representative</div>
    <div class="sig-date">Date: _________________</div>
  </div>
  <div class="sig-box">
    <div class="sig-line"></div>
    <div class="sig-label">ผู้มีอำนาจลงนาม / Authorized Signatory</div>
    <div class="sig-date">Date: _________________</div>
  </div>
</div>

<div class="doc-footer">
  Generated on ${fmtDate(new Date())} &nbsp;|&nbsp; ${escapeHtml(so.saleOrderNo)}
</div>

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
