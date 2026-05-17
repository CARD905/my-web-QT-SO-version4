'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Plus, Save, Send, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatDateInput, formatMoney, formatNumber, getStatusClass } from '@/lib/utils';
import type { ApiResponse, Customer, DiscountType, Product, Quotation } from '@/types/api';

interface LineItem {
  id: string;
  productId?: string;
  productSku?: string;
  productName: string;
  productDescription?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  discountType: DiscountType;
}

const newItem = (): LineItem => ({
  id: Math.random().toString(36).slice(2),
  productName: '',
  productDescription: '',
  quantity: 1,
  unit: 'pcs',
  unitPrice: 0,
  discount: 0,
  discountType: 'PERCENTAGE',
});

export default function EditQuotationPage() {
  const t = useT();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [customerId, setCustomerId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [currency, setCurrency] = useState<'THB' | 'USD'>('THB');
  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatRate, setVatRate] = useState(7);
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [conditions, setConditions] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [submitting, setSubmitting] = useState<'save' | 'submit' | null>(null);

  // Load existing quotation
  useEffect(() => {
    (async () => {
      try {
        const [qRes, cRes, pRes] = await Promise.all([
          api.get<ApiResponse<Quotation>>(`/quotations/${id}`),
          api.get<ApiResponse<Customer[]>>('/customers?limit=100'),
          api.get<ApiResponse<Product[]>>('/products?limit=100&isActive=true'),
        ]);
        const q = qRes.data.data;
        if (!q) {
          toast.error('Quotation not found');
          router.push('/quotations');
          return;
        }
        if (!['DRAFT', 'REJECTED'].includes(q.status)) {
          toast.error(`Cannot edit quotation with status ${q.status}`);
          router.push(`/quotations/${id}`);
          return;
        }

        setQuotation(q);
        setCustomers(cRes.data.data ?? []);
        setProducts(pRes.data.data ?? []);

        setCustomerId(q.customerId);
        setIssueDate(formatDateInput(q.issueDate));
        setExpiryDate(formatDateInput(q.expiryDate));
        setCurrency(q.currency);
        setVatEnabled(q.vatEnabled);
        setVatRate(Number(q.vatRate));
        setPaymentTerms(q.paymentTerms || 'Net 30');
        setConditions(q.conditions || '');
        setItems(
          (q.items ?? []).map((it, idx) => ({
            id: it.id ?? `temp-${idx}`,
            productId: it.productId || undefined,
            productSku: it.productSku || undefined,
            productName: it.productName,
            productDescription: it.productDescription ?? '',
            quantity: Number(it.quantity),
            unit: it.unit,
            unitPrice: Number(it.unitPrice),
            discount: Number(it.discount),
            discountType: it.discountType,
          })),
        );
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

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
      productDescription: p.description || '',
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

  const submitForm = async (mode: 'save' | 'submit') => {
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
      await api.patch<ApiResponse<{ id: string; quotationNo: string }>>(`/quotations/${id}`, {
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
          productDescription: it.productDescription,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          discount: it.discount,
          discountType: it.discountType,
          sortOrder: idx,
        })),
      });

      if (mode === 'submit') {
        await api.post(`/quotations/${id}/submit`, {});
        toast.success('Quotation submitted for approval');
      } else {
        toast.success('Changes saved');
      }

      router.push(`/quotations/${id}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-6xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!quotation) return null;

  return (
    <div className="space-y-5 max-w-6xl pb-12">
      {/* Header */}
      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-1">
            <Link href={`/quotations/${id}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{quotation.quotationNo}</h1>
              <Badge className={getStatusClass(quotation.status)} variant="outline">
                ● {quotation.status}
              </Badge>
              <span className="text-xs text-muted-foreground">v{quotation.version}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{t('quotation.editQuotation')}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => submitForm('save')} disabled={submitting !== null}>
            {submitting === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('common.save')}
          </Button>
          <Button onClick={() => submitForm('submit')} disabled={submitting !== null}>
            {submitting === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t('quotation.submitForApproval')}
          </Button>
        </div>
      </div>

      {quotation.status === 'REJECTED' && quotation.rejectionReason && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-destructive">Previous rejection</div>
              <p className="text-sm mt-1">{quotation.rejectionReason}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Editing will create a new version snapshot. Saving will set status back to DRAFT.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Details */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-base font-semibold mb-4">{t('quotation.documentDetails')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs">{t('quotation.documentNo')}</Label>
              <Input value={quotation.quotationNo} disabled className="mt-1.5 bg-muted" />
            </div>
            <div>
              <Label className="text-xs">{t('quotation.issueDate')}</Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">{t('quotation.expiryDate')}</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">Currency</Label>
              <select
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

      {/* Customer */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-base font-semibold mb-4">{t('quotation.customerInfo')}</h2>
          <Label className="text-xs">Customer</Label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
          >
            <option value="">{t('quotation.selectCustomer')}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company} — {c.contactName}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">{t('quotation.lineItems')}</h2>
            <Button variant="outline" size="sm" onClick={() => setItems((p) => [...p, newItem()])}>
              <Plus className="h-4 w-4" />
              {t('quotation.addItem')}
            </Button>
          </div>

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
                  value={item.productDescription || ''}
                  onChange={(e) => updateItem(item.id, { productDescription: e.target.value })}
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

      {/* Payment Terms / Conditions */}
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