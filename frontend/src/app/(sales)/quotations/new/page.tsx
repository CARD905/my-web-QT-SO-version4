'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
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
  id: string; // local id
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

  // Auto-fill when customer changes
  const handleCustomerChange = (id: string) => {
    setCustomerId(id);
    if (!id) {
      setCustomerInfo({
        contactName: '',
        company: '',
        taxId: '',
        phone: '',
        email: '',
        billingAddress: '',
        shippingAddress: '',
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

  // Item handlers
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

  // Calculation
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

  // Submit
  const submitForm = async (mode: 'draft' | 'submit') => {
    if (!customerId) {
      toast.error('Please select a customer');
      return;
    }
    if (items.some((it) => !it.productName.trim() || it.quantity <= 0)) {
      toast.error('Please fill in all product names and quantities');
      return;
    }

    setSubmitting(mode);
    try {
      // 1. Create as DRAFT
      const createRes = await api.post<ApiResponse<{ id: string; quotationNo: string }>>(
        '/quotations',
        {
          customerId,
          issueDate,
          expiryDate,
          currency,
          vatEnabled,
          vatRate,
          paymentTerms,
          conditions,
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

      // 2. Optionally submit
      if (mode === 'submit') {
        await api.post(`/quotations/${quotation.id}/submit`, {});
        toast.success(`${quotation.quotationNo} submitted for approval`);
      } else {
        toast.success(`${quotation.quotationNo} saved as draft`);
      }

      router.push(`/quotations/${quotation.id}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-5 max-w-6xl pb-12">
      {/* Header */}
      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-1">
            <Link href="/quotations">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">QT-NEW</h1>
              <Badge className="status-draft" variant="outline">
                ● {t('common.draft')}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{t('quotation.newQuotation')}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => submitForm('draft')}
            disabled={submitting !== null}
          >
            {submitting === 'draft' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t('common.saveDraft')}
          </Button>
          <Button onClick={() => submitForm('submit')} disabled={submitting !== null}>
            {submitting === 'submit' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t('quotation.submitForApproval')}
          </Button>
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
              <Label htmlFor="issueDate" className="text-xs">
                {t('quotation.issueDate')}
              </Label>
              <Input
                id="issueDate"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="expiryDate" className="text-xs">
                {t('quotation.expiryDate')}
              </Label>
              <Input
                id="expiryDate"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="currency" className="text-xs">
                Currency
              </Label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'THB' | 'USD')}
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
              >
                <option value="THB">THB</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Information */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-base font-semibold mb-4">{t('quotation.customerInfo')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="customer" className="text-xs">
                Customer (auto-fill)
              </Label>
              <select
                id="customer"
                value={customerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
              >
                <option value="">{t('quotation.selectCustomer')}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company} — {c.contactName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">{t('customer.contactName')}</Label>
              <Input value={customerInfo.contactName} disabled className="mt-1.5 bg-muted" />
            </div>
            <div>
              <Label className="text-xs">{t('customer.company')}</Label>
              <Input value={customerInfo.company} disabled className="mt-1.5 bg-muted" />
            </div>
            <div>
              <Label className="text-xs">{t('customer.taxId')}</Label>
              <Input value={customerInfo.taxId} disabled className="mt-1.5 bg-muted" />
            </div>
            <div>
              <Label className="text-xs">{t('customer.phone')}</Label>
              <Input value={customerInfo.phone} disabled className="mt-1.5 bg-muted" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">{t('customer.email')}</Label>
              <Input value={customerInfo.email} disabled className="mt-1.5 bg-muted" />
            </div>
            <div>
              <Label className="text-xs">{t('customer.billingAddress')}</Label>
              <Input value={customerInfo.billingAddress} disabled className="mt-1.5 bg-muted" />
            </div>
            <div>
              <Label className="text-xs">{t('customer.shippingAddress')}</Label>
              <Input value={customerInfo.shippingAddress} disabled className="mt-1.5 bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">{t('quotation.lineItems')}</h2>
            <Button variant="outline" size="sm" onClick={() => setItems((p) => [...p, newItem()])}>
              <Plus className="h-4 w-4" />
              {t('quotation.addItem')}
            </Button>
          </div>

          {/* Header row (desktop) */}
          <div className="hidden md:grid grid-cols-[1.5fr_1.5fr_70px_100px_80px_80px_100px_40px] gap-2 px-2 pb-2 text-xs font-semibold text-muted-foreground uppercase border-b">
            <div>Product</div>
            <div>Description</div>
            <div className="text-center">Qty</div>
            <div className="text-right">Unit Price</div>
            <div className="text-right">Discount</div>
            <div className="text-center">Type</div>
            <div className="text-right">Line Total</div>
            <div></div>
          </div>

          <div className="space-y-2 mt-2">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="grid grid-cols-1 md:grid-cols-[1.5fr_1.5fr_70px_100px_80px_80px_100px_40px] gap-2 p-2 rounded-lg border md:border-0 bg-muted/30 md:bg-transparent"
              >
                <div>
                  <select
                    value={item.productId || ''}
                    onChange={(e) => onProductSelect(item.id, e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm"
                  >
                    <option value="">{t('quotation.selectProduct')}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.name}
                      </option>
                    ))}
                  </select>
                  {!item.productId && (
                    <Input
                      value={item.productName}
                      onChange={(e) => updateItem(item.id, { productName: e.target.value })}
                      placeholder="Or type product name"
                      className="h-9 mt-1.5"
                    />
                  )}
                </div>
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(item.id, { description: e.target.value })}
                  placeholder="Description"
                  className="h-9"
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                  className="h-9 text-center"
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(e) =>
                    updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })
                  }
                  className="h-9 text-right"
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.discount}
                  onChange={(e) => updateItem(item.id, { discount: parseFloat(e.target.value) || 0 })}
                  className="h-9 text-right"
                />
                <select
                  value={item.discountType}
                  onChange={(e) =>
                    updateItem(item.id, { discountType: e.target.value as 'PERCENTAGE' | 'FIXED' })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm"
                >
                  <option value="PERCENTAGE">%</option>
                  <option value="FIXED">{currency}</option>
                </select>
                <div className="h-9 flex items-center justify-end font-semibold text-sm">
                  {formatNumber(calc.itemTotals[idx] ?? 0)}
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  disabled={items.length === 1}
                  className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label="Remove item"
                >
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
              <div className="text-xs font-semibold text-muted-foreground uppercase">
                {t('quotation.summary')}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('quotation.subtotal')}</span>
                <span className="font-medium">{formatMoney(calc.subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('quotation.discount')}</span>
                <span className="font-medium text-destructive">
                  -{formatMoney(calc.discountTotal, currency)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  {t('quotation.vat')} ({vatRate}%)
                  <button
                    onClick={() => setVatEnabled((v) => !v)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      vatEnabled ? 'bg-primary' : 'bg-muted'
                    }`}
                    aria-pressed={vatEnabled}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        vatEnabled ? 'translate-x-4' : ''
                      }`}
                    />
                  </button>
                </span>
                <span className="font-medium">{formatMoney(calc.vatAmount, currency)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between items-baseline">
                <span className="font-semibold">{t('quotation.grandTotal')}</span>
                <span className="text-2xl font-bold text-primary">
                  {formatMoney(calc.grandTotal, currency)}
                </span>
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
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
            >
              <option value="Net 30">Net 30</option>
              <option value="Net 60">Net 60</option>
              <option value="Net 90">Net 90</option>
              <option value="COD">COD (เก็บเงินปลายทาง)</option>
              <option value="Prepaid">Prepaid (ชำระล่วงหน้า)</option>
            </select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <Label className="text-sm font-semibold">{t('quotation.conditions')}</Label>
            <textarea
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              placeholder={t('quotation.additionalRemarks')}
              rows={3}
              className="mt-2 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
