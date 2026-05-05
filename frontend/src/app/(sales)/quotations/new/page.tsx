'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
  X,
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
  productName: '',
  description: '',
  quantity: 1,
  unit: 'pcs',
  unitPrice: 0,
  discount: 0,
  discountType: 'PERCENTAGE',
});

export default function NewQuotationPage() {
  const t = useT();
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [customerId, setCustomerId] = useState('');
  const [customerInfo, setCustomerInfo] = useState({
    contactName: '',
    company: '',
    taxId: '',
    phone: '',
    email: '',
    billingAddress: '',
    shippingAddress: '',
  });

  const today = useMemo(() => formatDateInput(new Date()), []);
  const expireDefault = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return formatDateInput(d);
  }, []);

  const [issueDate, setIssueDate] = useState(today);
  const [expiryDate, setExpiryDate] = useState(expireDefault);
  const [currency, setCurrency] = useState<'THB' | 'USD'>('THB');
  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatRate] = useState(7);
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [conditions, setConditions] = useState('');
  const [items, setItems] = useState<LineItem[]>([newItem()]);

  const [submitting, setSubmitting] = useState<'draft' | 'submit' | null>(null);
  // เมื่อ submitted สำเร็จแล้ว จะ lock ทั้งหน้า ไม่ให้ cancel ได้
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
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      }
    })();
  }, []);

  // Warn if user tries to leave with unsaved changes during submission
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (submitting) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [submitting]);

  const handleCustomerChange = (id: string) => {
    setCustomerId(id);
    if (!id) {
      setCustomerInfo({
        contactName: '', company: '', taxId: '', phone: '',
        email: '', billingAddress: '', shippingAddress: '',
      });
      return;
    }
    const c = customers.find((x) => x.id === id);
    if (c) {
      setCustomerInfo({
        contactName: c.contactName,
        company: c.company,
        taxId: c.taxId || '',
        phone: c.phone || '',
        email: c.email || '',
        billingAddress: c.billingAddress || '',
        shippingAddress: c.shippingAddress || '',
      });
    }
  };

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  };

  const onProductSelect = (itemId: string, productId: string) => {
    if (!productId) {
      updateItem(itemId, { productId: undefined, productSku: undefined });
      return;
    }
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    updateItem(itemId, {
      productId: p.id,
      productSku: p.sku,
      productName: p.name,
      description: p.description || '',
      unitPrice: Number(p.unitPrice),
      unit: p.unit,
    });
  };

  const calc = useMemo(() => {
    let grossSubtotal = 0;
    let discountTotal = 0;
    const itemTotals: number[] = [];
    for (const it of items) {
      const gross = it.quantity * it.unitPrice;
      grossSubtotal += gross;
      let disc = 0;
      if (it.discount > 0) {
        disc = it.discountType === 'PERCENTAGE' ? (gross * it.discount) / 100 : it.discount;
      }
      discountTotal += disc;
      itemTotals.push(gross - disc);
    }
    const afterDisc = grossSubtotal - discountTotal;
    const vatAmount = vatEnabled ? (afterDisc * vatRate) / 100 : 0;
    const grandTotal = afterDisc + vatAmount;
    return { subtotal: grossSubtotal, discountTotal, vatAmount, grandTotal, itemTotals };
  }, [items, vatEnabled, vatRate]);

  const submitForm = async (mode: 'draft' | 'submit') => {
    if (!customerId) {
      toast.error('Please select a customer');
      return;
    }
    if (items.some((it) => !it.productName.trim() || it.quantity <= 0)) {
      toast.error('Please fill in all product names and quantities');
      return;
    }

    // ── Confirm ก่อนส่งอนุมัติ — เน้นว่ายกเลิกไม่ได้
    if (mode === 'submit') {
      const ok = confirm(
        '⚠️ ยืนยันส่งใบเสนอราคานี้เพื่อขออนุมัติ?\n\n' +
        'หลังจากส่งแล้ว จะไม่สามารถยกเลิกหรือกลับมาแก้ไขได้\n' +
        'ต้องรอผู้อนุมัติพิจารณาเท่านั้น',
      );
      if (!ok) return;
    }

    setSubmitting(mode);
    try {
      const createRes = await api.post<ApiResponse<{ id: string; quotationNo: string }>>(
        '/quotations',
        {
          customerId, issueDate, expiryDate, currency,
          vatEnabled, vatRate, paymentTerms, conditions,
          items: items.map((it, idx) => ({
            productId: it.productId,
            productSku: it.productSku,
            productName: it.productName,
            description: it.description,
            quantity: it.quantity,
            unit: it.unit,
            unitPrice: it.unitPrice,
            discount: it.discount,
            discountType: it.discountType,
            sortOrder: idx,
          })),
        },
      );

      const quotation = createRes.data.data;
      if (!quotation) throw new Error('No data returned');

      if (mode === 'submit') {
        await api.post(`/quotations/${quotation.id}/submit`, {});
        setLocked(true); // ─── lock หลัง submit สำเร็จ
        toast.success(`${quotation.quotationNo} ส่งขออนุมัติเรียบร้อย`);
      } else {
        toast.success(`${quotation.quotationNo} บันทึก draft แล้ว`);
      }

      router.push(`/quotations/${quotation.id}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
      setSubmitting(null);
    }
  };

  // Cancel — ใช้ได้เฉพาะตอนยังไม่กดส่ง
  const handleCancel = () => {
    if (locked || submitting) return;
    if (confirm('ยกเลิกการสร้างใบเสนอราคา? ข้อมูลที่กรอกจะหายไป')) {
      router.push('/quotations');
    }
  };

  const isProcessing = submitting !== null;
  const isFullyDisabled = locked || isProcessing;

  return (
    <div className="space-y-5 max-w-6xl pb-32"> {/* pb-32 = เว้นที่ให้ sticky bar */}
      {/* ── HEADER (no buttons here anymore) ── */}
      <div className="flex flex-wrap gap-4 items-start">
        <Button
          asChild={!isFullyDisabled}
          variant="ghost"
          size="icon"
          className="mt-1"
          disabled={isFullyDisabled}
          onClick={isFullyDisabled ? undefined : undefined}
        >
          {isFullyDisabled ? (
            <span><ArrowLeft className="h-5 w-5 opacity-30" /></span>
          ) : (
            <Link href="/quotations" aria-label="back">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">QT-NEW</h1>
            <Badge className="status-draft" variant="outline">
              ● {t('common.draft')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('quotation.newQuotation')}
          </p>
        </div>
      </div>

      {/* Document Details */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-base font-semibold mb-4">{t('quotation.documentDetails')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs">{t('quotation.documentNo')}</Label>
              <Input value="auto-generated" disabled className="mt-1.5 bg-muted" />
            </div>
            <div>
              <Label className="text-xs">{t('quotation.issueDate')}</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="mt-1.5" disabled={isFullyDisabled} />
            </div>
            <div>
              <Label className="text-xs">{t('quotation.expiryDate')}</Label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="mt-1.5" disabled={isFullyDisabled} />
            </div>
            <div>
              <Label className="text-xs">Currency</Label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'THB' | 'USD')}
                disabled={isFullyDisabled}
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:opacity-60"
              >
                <option value="THB">THB</option>
                <option value="USD">USD</option>
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
              <select
                value={customerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                disabled={isFullyDisabled}
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:opacity-60"
              >
                <option value="">{t('quotation.selectCustomer')}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.company} — {c.contactName}</option>
                ))}
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
            <h2 className="text-base font-semibold">{t('quotation.lineItems')}</h2>
            <Button variant="outline" size="sm" disabled={isFullyDisabled} onClick={() => setItems((p) => [...p, newItem()])}>
              <Plus className="h-4 w-4" />{t('quotation.addItem')}
            </Button>
          </div>

          {/* Header row */}
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
            {items.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-[1.5fr_1.5fr_70px_100px_80px_80px_100px_40px] gap-2 p-2 rounded-lg border md:border-0 bg-muted/30 md:bg-transparent">
                <div>
                  <select value={item.productId || ''} disabled={isFullyDisabled} onChange={(e) => onProductSelect(item.id, e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm disabled:opacity-60">
                    <option value="">{t('quotation.selectProduct')}</option>
                    {products.map((p) => (<option key={p.id} value={p.id}>{p.sku} — {p.name}</option>))}
                  </select>
                  {!item.productId && <Input value={item.productName} disabled={isFullyDisabled} onChange={(e) => updateItem(item.id, { productName: e.target.value })} placeholder="Or type product name" className="h-9 mt-1.5" />}
                </div>
                <Input value={item.description} disabled={isFullyDisabled} onChange={(e) => updateItem(item.id, { description: e.target.value })} placeholder="Description" className="h-9" />
                <Input type="number" min="0" step="0.01" disabled={isFullyDisabled} value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })} className="h-9 text-center" />
                <Input type="number" min="0" step="0.01" disabled={isFullyDisabled} value={item.unitPrice} onChange={(e) => updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })} className="h-9 text-right" />
                <Input type="number" min="0" step="0.01" disabled={isFullyDisabled} value={item.discount} onChange={(e) => updateItem(item.id, { discount: parseFloat(e.target.value) || 0 })} className="h-9 text-right" />
                <select value={item.discountType} disabled={isFullyDisabled} onChange={(e) => updateItem(item.id, { discountType: e.target.value as 'PERCENTAGE' | 'FIXED' })} className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm disabled:opacity-60">
                  <option value="PERCENTAGE">%</option>
                  <option value="FIXED">{currency}</option>
                </select>
                <div className="h-9 flex items-center justify-end font-semibold text-sm">{formatNumber(calc.itemTotals[idx] ?? 0)}</div>
                <button onClick={() => removeItem(item.id)} disabled={items.length === 1 || isFullyDisabled} className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent" aria-label="Remove item">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end">
            <div className="w-full md:w-80 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase">{t('quotation.summary')}</div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('quotation.subtotal')}</span><span className="font-medium">{formatMoney(calc.subtotal, currency)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t('quotation.discount')}</span><span className="font-medium text-destructive">-{formatMoney(calc.discountTotal, currency)}</span></div>
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
              <option value="Net 30">Net 30</option>
              <option value="Net 60">Net 60</option>
              <option value="Net 90">Net 90</option>
              <option value="COD">COD</option>
              <option value="Prepaid">Prepaid</option>
            </select>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Label className="text-sm font-semibold">{t('quotation.conditions')}</Label>
            <textarea value={conditions} disabled={isFullyDisabled} onChange={(e) => setConditions(e.target.value)} placeholder={t('quotation.additionalRemarks')} rows={3} className="mt-2 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y disabled:opacity-60" />
          </CardContent>
        </Card>
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ── STICKY BOTTOM ACTION BAR ──                                */}
      {/* ════════════════════════════════════════════════════════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-card/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] lg:left-60 transition-[left] duration-300">
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Total recap */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">รวมสุทธิ:</span>
              <span className="text-lg font-bold text-primary">
                {formatMoney(calc.grandTotal, currency)}
              </span>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 ml-auto">
              {/* Cancel — ซ่อนเมื่อ submit แล้ว */}
              {!locked && (
                <Button
                  variant="ghost"
                  onClick={handleCancel}
                  disabled={isProcessing}
                >
                  <X className="h-4 w-4" />
                  ยกเลิก
                </Button>
              )}

              {/* Save Draft */}
              <Button
                variant="outline"
                onClick={() => submitForm('draft')}
                disabled={isFullyDisabled}
              >
                {submitting === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t('common.saveDraft')}
              </Button>

              {/* Submit */}
              <Button
                onClick={() => submitForm('submit')}
                disabled={isFullyDisabled}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {locked ? 'ส่งแล้ว — รออนุมัติ' : t('quotation.submitForApproval')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}