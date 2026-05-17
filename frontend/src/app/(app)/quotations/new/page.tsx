'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Plus, Save, Send, Trash2, X,
  AlertTriangle, Star, CheckCircle2, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatDateInput, formatMoney, formatNumber } from '@/lib/utils';
import type { ApiResponse, Customer, Product } from '@/types/api';

// ─── Constants ────────────────────────────────────────────────────────────────
const NORMAL_DISCOUNT_MAX = 20;   // ส่วนลดปกติสูงสุด
const SPECIAL_DISCOUNT_MAX = 50;  // ส่วนลดพิเศษสูงสุด (ต้องขออนุมัติ CEO)

interface LineItem {
  id: string;
  productId?: string;
  productSku?: string;
  productName: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  discountType: 'PERCENTAGE' | 'FIXED';
}

const newItem = (): LineItem => ({
  id: Math.random().toString(36).slice(2),
  productName: '', description: '', quantity: 1, unit: 'pcs',
  unitPrice: 0, discount: 0, discountType: 'PERCENTAGE',
});

// ─── ตรวจสอบว่ามี special discount ไหม ─────────────────────────────────────
function detectSpecialDiscount(items: LineItem[]): { hasSpecial: boolean; maxPct: number } {
  let maxPct = 0;
  let hasSpecial = false;
  for (const it of items) {
    if (it.discountType === 'PERCENTAGE' && it.discount > NORMAL_DISCOUNT_MAX) {
      hasSpecial = true;
      if (it.discount > maxPct) maxPct = it.discount;
    }
  }
  return { hasSpecial, maxPct };
}

// ════════════════════════════════════════════════════════════════════════════
// Special Discount Panel
// ════════════════════════════════════════════════════════════════════════════
function SpecialDiscountPanel({
  maxPct,
  reason,
  onReasonChange,
}: {
  maxPct: number;
  reason: string;
  onReasonChange: (v: string) => void;
}) {
  return (
    <Card className="border-2 border-amber-400 bg-amber-50 dark:bg-amber-900/20">
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center shrink-0">
            <Star className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <div className="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                ขอ Special Discount
                <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-400">
                  {maxPct}% → ต้องขออนุมัติ CEO
                </Badge>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                ส่วนลดเกิน {NORMAL_DISCOUNT_MAX}% ต้องได้รับการอนุมัติจาก CEO ก่อน
                ระบบจะส่ง Notification ให้ CEO พิจารณาโดยอัตโนมัติเมื่อบันทึก
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div>
                <Label className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                  เหตุผลที่ขอส่วนลดพิเศษ <span className="text-destructive">*</span>
                </Label>
                <textarea
                  value={reason}
                  onChange={(e) => onReasonChange(e.target.value)}
                  rows={3}
                  placeholder="เช่น ลูกค้า VIP ซื้อปริมาณมาก, โปรเจกต์ระยะยาว, ลูกค้าใหม่ที่มีศักยภาพสูง..."
                  className="mt-1.5 w-full rounded-md border border-amber-300 bg-white dark:bg-amber-950/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none placeholder:text-amber-400"
                />
                {!reason.trim() && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    กรุณาระบุเหตุผลก่อนบันทึก
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-100 dark:bg-amber-800/30">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
                <div>CEO จะได้รับ Notification พร้อม 3 ตัวเลือก:</div>
                <div>🔴 ปฏิเสธ → ระบบลด discount เหลือ {NORMAL_DISCOUNT_MAX}% อัตโนมัติ</div>
                <div>🟡 อนุมัติบางส่วน → CEO กำหนด % ใหม่เอง</div>
                <div>🟢 อนุมัติ → ผ่านตามที่ขอ ({maxPct}%)</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════════════════════
export default function NewQuotationPage() {
  const t = useT();
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [customerInfo, setCustomerInfo] = useState({
    contactName: '', company: '', taxId: '', phone: '',
    email: '', billingAddress: '', shippingAddress: '',
  });

  const today = useMemo(() => formatDateInput(new Date()), []);
  const expireDefault = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return formatDateInput(d); }, []);

  const [issueDate, setIssueDate] = useState(today);
  const [expiryDate, setExpiryDate] = useState(expireDefault);
  const [currency, setCurrency] = useState<'THB' | 'USD'>('THB');
  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatRate] = useState(7);
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [conditions, setConditions] = useState('');
  const [items, setItems] = useState<LineItem[]>([newItem()]);

  // ✅ Special Discount state
  const [specialDiscountReason, setSpecialDiscountReason] = useState('');

  const [submitting, setSubmitting] = useState<'draft' | 'submit' | null>(null);
  const [locked, setLocked] = useState(false);

  // Load customers + products
  useEffect(() => {
    (async () => {
      try {
        const [cRes, pRes] = await Promise.all([
          api.get<ApiResponse<Customer[]>>('/customers?limit=100'),
          api.get<ApiResponse<Product[]>>('/products?limit=100&isActive=true'),
        ]);
        setCustomers(cRes.data.data ?? []);
        setProducts(pRes.data.data ?? []);
      } catch (err) { toast.error(getApiErrorMessage(err)); }
    })();
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (submitting) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [submitting]);

  const handleCustomerChange = (id: string) => {
    setCustomerId(id);
    if (!id) { setCustomerInfo({ contactName: '', company: '', taxId: '', phone: '', email: '', billingAddress: '', shippingAddress: '' }); return; }
    const c = customers.find((x) => x.id === id);
    if (c) setCustomerInfo({ contactName: c.contactName, company: c.company, taxId: c.taxId || '', phone: c.phone || '', email: c.email || '', billingAddress: c.billingAddress || '', shippingAddress: c.shippingAddress || '' });
  };

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it) => {
      if (it.id !== id) return it;
      const updated = { ...it, ...patch };
      // ✅ Cap discount ที่ SPECIAL_DISCOUNT_MAX
      if ('discount' in patch && updated.discountType === 'PERCENTAGE') {
        updated.discount = Math.min(updated.discount, SPECIAL_DISCOUNT_MAX);
      }
      return updated;
    }));
  };

  const removeItem = (id: string) => setItems((prev) => prev.length > 1 ? prev.filter((it) => it.id !== id) : prev);

  const onProductSelect = (itemId: string, productId: string) => {
    if (!productId) { updateItem(itemId, { productId: undefined, productSku: undefined }); return; }
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    updateItem(itemId, { productId: p.id, productSku: p.sku, productName: p.name, description: p.description || '', unitPrice: Number(p.unitPrice), unit: p.unit });
  };

  const calc = useMemo(() => {
    let grossSubtotal = 0, discountTotal = 0;
    const itemTotals: number[] = [];
    for (const it of items) {
      const gross = it.quantity * it.unitPrice;
      grossSubtotal += gross;
      let disc = 0;
      if (it.discount > 0) disc = it.discountType === 'PERCENTAGE' ? (gross * it.discount) / 100 : it.discount;
      discountTotal += disc;
      itemTotals.push(gross - disc);
    }
    const afterDisc = grossSubtotal - discountTotal;
    const vatAmount = vatEnabled ? (afterDisc * vatRate) / 100 : 0;
    return { subtotal: grossSubtotal, discountTotal, vatAmount, grandTotal: afterDisc + vatAmount, itemTotals };
  }, [items, vatEnabled, vatRate]);

  // ✅ Detect special discount
  const { hasSpecial, maxPct } = useMemo(() => detectSpecialDiscount(items), [items]);

  const submitForm = async (mode: 'draft' | 'submit') => {
    if (!customerId) { toast.error('Please select a customer'); return; }
    if (items.some((it) => !it.productName.trim() || it.quantity <= 0)) { toast.error('Please fill in all product names and quantities'); return; }

    // ✅ Validate special discount reason
    if (hasSpecial && !specialDiscountReason.trim()) {
      toast.error('กรุณาระบุเหตุผลสำหรับ Special Discount ก่อนบันทึก');
      return;
    }

    if (mode === 'submit') {
      const msg = hasSpecial
        ? `⚠️ ยืนยันส่งใบเสนอราคาพร้อม Special Discount ${maxPct}%?\n\nระบบจะส่งคำขอไปให้ CEO อนุมัติ และจะดำเนินการต่อได้หลัง CEO ตอบกลับ`
        : `⚠️ ยืนยันส่งใบเสนอราคาเพื่อขออนุมัติ?\n\nหลังจากส่งแล้ว จะไม่สามารถยกเลิกหรือกลับมาแก้ไขได้`;
      if (!confirm(msg)) return;
    }

    setSubmitting(mode);
    try {
      const createRes = await api.post<ApiResponse<{ id: string; quotationNo: string }>>(
        '/quotations',
        {
          customerId, issueDate, expiryDate, currency, vatEnabled, vatRate, paymentTerms, conditions,
          // ✅ ส่ง special discount info
          specialDiscountReason: hasSpecial ? specialDiscountReason.trim() : undefined,
          items: items.map((it, idx) => ({
            productId: it.productId, productSku: it.productSku, productName: it.productName,
            description: it.description, quantity: it.quantity, unit: it.unit,
            unitPrice: it.unitPrice, discount: it.discount, discountType: it.discountType, sortOrder: idx,
          })),
        },
      );

      const quotation = createRes.data.data;
      if (!quotation) throw new Error('No data returned');

      if (mode === 'submit' && !hasSpecial) {
        await api.post(`/quotations/${quotation.id}/submit`, {});
        setLocked(true);
        toast.success(`${quotation.quotationNo} ส่งขออนุมัติเรียบร้อย`);
      } else if (hasSpecial) {
        toast.success(`${quotation.quotationNo} บันทึกแล้ว — ส่งคำขอ Special Discount ให้ CEO พิจารณา`);
      } else {
        toast.success(`${quotation.quotationNo} บันทึก draft แล้ว`);
      }

      router.push(`/quotations/${quotation.id}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
      setSubmitting(null);
    }
  };

  const handleCancel = () => {
    if (locked || submitting) return;
    if (confirm('ยกเลิกการสร้างใบเสนอราคา? ข้อมูลที่กรอกจะหายไป')) router.push('/quotations');
  };

  const isProcessing = submitting !== null;
  const isFullyDisabled = locked || isProcessing;

  return (
    <div className="space-y-5 max-w-6xl pb-32">
      {/* Header */}
      <div className="flex flex-wrap gap-4 items-start">
        <Button asChild={!isFullyDisabled} variant="ghost" size="icon" className="mt-1" disabled={isFullyDisabled}>
          {isFullyDisabled ? <span><ArrowLeft className="h-5 w-5 opacity-30" /></span> : <Link href="/quotations" aria-label="back"><ArrowLeft className="h-5 w-5" /></Link>}
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">QT-NEW</h1>
            <Badge className="status-draft" variant="outline">● {t('common.draft')}</Badge>
            {hasSpecial && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-400 text-[10px]"><Star className="h-3 w-3 mr-1" />Special Discount</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{t('quotation.newQuotation')}</p>
        </div>
      </div>

      {/* Document Details */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-base font-semibold mb-4">{t('quotation.documentDetails')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><Label className="text-xs">{t('quotation.documentNo')}</Label><Input value="auto-generated" disabled className="mt-1.5 bg-muted" /></div>
            <div><Label className="text-xs">{t('quotation.issueDate')}</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="mt-1.5" disabled={isFullyDisabled} /></div>
            <div><Label className="text-xs">{t('quotation.expiryDate')}</Label><Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="mt-1.5" disabled={isFullyDisabled} /></div>
            <div>
              <Label className="text-xs">Currency</Label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as 'THB' | 'USD')} disabled={isFullyDisabled} className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:opacity-60">
                <option value="THB">THB</option><option value="USD">USD</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-base font-semibold mb-4">{t('quotation.customerInfo')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label className="text-xs">Customer (auto-fill)</Label>
              <select value={customerId} onChange={(e) => handleCustomerChange(e.target.value)} disabled={isFullyDisabled} className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:opacity-60">
                <option value="">{t('quotation.selectCustomer')}</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.company} — {c.contactName}</option>)}
              </select>
            </div>
            <div><Label className="text-xs">{t('customer.contactName')}</Label><Input value={customerInfo.contactName} disabled className="mt-1.5 bg-muted" /></div>
            <div><Label className="text-xs">{t('customer.company')}</Label><Input value={customerInfo.company} disabled className="mt-1.5 bg-muted" /></div>
            <div><Label className="text-xs">{t('customer.taxId')}</Label><Input value={customerInfo.taxId} disabled className="mt-1.5 bg-muted" /></div>
            <div><Label className="text-xs">{t('customer.phone')}</Label><Input value={customerInfo.phone} disabled className="mt-1.5 bg-muted" /></div>
            <div className="md:col-span-2"><Label className="text-xs">{t('customer.email')}</Label><Input value={customerInfo.email} disabled className="mt-1.5 bg-muted" /></div>
            <div><Label className="text-xs">{t('customer.billingAddress')}</Label><Input value={customerInfo.billingAddress} disabled className="mt-1.5 bg-muted" /></div>
            <div><Label className="text-xs">{t('customer.shippingAddress')}</Label><Input value={customerInfo.shippingAddress} disabled className="mt-1.5 bg-muted" /></div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">{t('quotation.lineItems')}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                ส่วนลดปกติสูงสุด <span className="font-semibold text-foreground">{NORMAL_DISCOUNT_MAX}%</span>
                {' · '}Special Discount สูงสุด <span className="font-semibold text-amber-600">{SPECIAL_DISCOUNT_MAX}%</span> (ต้องขออนุมัติ CEO)
              </p>
            </div>
            <Button variant="outline" size="sm" disabled={isFullyDisabled} onClick={() => setItems((p) => [...p, newItem()])}>
              <Plus className="h-4 w-4" />{t('quotation.addItem')}
            </Button>
          </div>

          <div className="hidden md:grid grid-cols-[1.5fr_1.5fr_70px_100px_80px_80px_100px_40px] gap-2 px-2 pb-2 text-xs font-semibold text-muted-foreground uppercase border-b">
            <div>Product</div><div>Description</div>
            <div className="text-center">Qty</div>
            <div className="text-right">Unit Price</div>
            <div className="text-right">Discount</div>
            <div className="text-center">Type</div>
            <div className="text-right">Line Total</div>
            <div></div>
          </div>

          <div className="space-y-2 mt-2">
            {items.map((item, idx) => {
              const isSpecialItem = item.discountType === 'PERCENTAGE' && item.discount > NORMAL_DISCOUNT_MAX;
              return (
                <div key={item.id} className={`grid grid-cols-1 md:grid-cols-[1.5fr_1.5fr_70px_100px_80px_80px_100px_40px] gap-2 p-2 rounded-lg border md:border-0 ${isSpecialItem ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-900/10' : 'bg-muted/30 md:bg-transparent'}`}>
                  <div>
                    <select value={item.productId || ''} disabled={isFullyDisabled} onChange={(e) => onProductSelect(item.id, e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm disabled:opacity-60">
                      <option value="">{t('quotation.selectProduct')}</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                    </select>
                    {!item.productId && <Input value={item.productName} disabled={isFullyDisabled} onChange={(e) => updateItem(item.id, { productName: e.target.value })} placeholder="Or type product name" className="h-9 mt-1.5" />}
                  </div>
                  <Input value={item.description} disabled={isFullyDisabled} onChange={(e) => updateItem(item.id, { description: e.target.value })} placeholder="Description" className="h-9" />
                  <Input type="number" min="0" step="0.01" disabled={isFullyDisabled} value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })} className="h-9 text-center" />
                  <Input type="number" min="0" step="0.01" disabled={isFullyDisabled} value={item.unitPrice} onChange={(e) => updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })} className="h-9 text-right" />

                  {/* ✅ Discount input พร้อม visual feedback */}
                  <div className="relative">
                    <Input
                      type="number" min="0" step="0.01"
                      max={item.discountType === 'PERCENTAGE' ? SPECIAL_DISCOUNT_MAX : undefined}
                      disabled={isFullyDisabled}
                      value={item.discount}
                      onChange={(e) => updateItem(item.id, { discount: parseFloat(e.target.value) || 0 })}
                      className={`h-9 text-right ${isSpecialItem ? 'border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300' : ''}`}
                    />
                    {isSpecialItem && (
                      <Star className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-amber-500 pointer-events-none" />
                    )}
                  </div>

                  <select value={item.discountType} disabled={isFullyDisabled} onChange={(e) => updateItem(item.id, { discountType: e.target.value as 'PERCENTAGE' | 'FIXED' })} className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm disabled:opacity-60">
                    <option value="PERCENTAGE">%</option>
                    <option value="FIXED">{currency}</option>
                  </select>
                  <div className="h-9 flex items-center justify-end font-semibold text-sm">{formatNumber(calc.itemTotals[idx] ?? 0)}</div>
                  <button onClick={() => removeItem(item.id)} disabled={items.length === 1 || isFullyDisabled} className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-30" aria-label="Remove item">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ✅ Special Discount Panel — แสดงเมื่อมี discount > 20% */}
      {hasSpecial && (
        <SpecialDiscountPanel
          maxPct={maxPct}
          reason={specialDiscountReason}
          onReasonChange={setSpecialDiscountReason}
        />
      )}

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end">
            <div className="w-full md:w-80 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase">{t('quotation.summary')}</div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('quotation.subtotal')}</span><span className="font-medium">{formatMoney(calc.subtotal, currency)}</span></div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  {t('quotation.discount')}
                  {hasSpecial && <Star className="h-3 w-3 text-amber-500" />}
                </span>
                <span className="font-medium text-destructive">-{formatMoney(calc.discountTotal, currency)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  {t('quotation.vat')} ({vatRate}%)
                  <button onClick={() => setVatEnabled((v) => !v)} disabled={isFullyDisabled} className={`relative w-9 h-5 rounded-full transition-colors disabled:opacity-50 ${vatEnabled ? 'bg-primary' : 'bg-muted'}`} aria-pressed={vatEnabled}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${vatEnabled ? 'translate-x-4' : ''}`} />
                  </button>
                </span>
                <span className="font-medium">{formatMoney(calc.vatAmount, currency)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between items-baseline">
                <span className="font-semibold">{t('quotation.grandTotal')}</span>
                <span className="text-2xl font-bold text-primary">{formatMoney(calc.grandTotal, currency)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Terms + Conditions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
          <CardContent className="pt-6">
            <Label className="text-sm font-semibold">{t('quotation.paymentTerms')}</Label>
            <select value={paymentTerms} disabled={isFullyDisabled} onChange={(e) => setPaymentTerms(e.target.value)} className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:opacity-60">
              <option value="Net 30">Net 30</option><option value="Net 60">Net 60</option>
              <option value="Net 90">Net 90</option><option value="COD">COD</option><option value="Prepaid">Prepaid</option>
            </select>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Label className="text-sm font-semibold">{t('quotation.conditions')}</Label>
            <textarea value={conditions} disabled={isFullyDisabled} onChange={(e) => setConditions(e.target.value)} placeholder={t('quotation.additionalRemarks')} rows={3} className="mt-2 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm resize-y disabled:opacity-60" />
          </CardContent>
        </Card>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-card/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] lg:left-60 transition-[left] duration-300">
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">รวมสุทธิ:</span>
                <span className="text-lg font-bold text-primary">{formatMoney(calc.grandTotal, currency)}</span>
              </div>
              {hasSpecial && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300 text-xs text-amber-700 dark:text-amber-300">
                  <Star className="h-3 w-3" />
                  Special Discount {maxPct}% — รอ CEO อนุมัติ
                </div>
              )}
            </div>

            <div className="flex gap-2 ml-auto">
              {!locked && <Button variant="ghost" onClick={handleCancel} disabled={isProcessing}><X className="h-4 w-4" />ยกเลิก</Button>}
              <Button variant="outline" onClick={() => submitForm('draft')} disabled={isFullyDisabled || (hasSpecial && !specialDiscountReason.trim())}>
                {submitting === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {hasSpecial ? 'บันทึก + ส่งขอ Special Discount' : t('common.saveDraft')}
              </Button>
              {!hasSpecial && (
                <Button onClick={() => submitForm('submit')} disabled={isFullyDisabled} className="bg-emerald-600 hover:bg-emerald-700">
                  {submitting === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {locked ? 'ส่งแล้ว — รออนุมัติ' : t('quotation.submitForApproval')}
                </Button>
              )}
              {hasSpecial && (
                <Button onClick={() => submitForm('draft')} disabled={isFullyDisabled || !specialDiscountReason.trim()} className="bg-amber-600 hover:bg-amber-700">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                  ส่งขอ Special Discount
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}