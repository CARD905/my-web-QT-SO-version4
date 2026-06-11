'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Plus, Save, Send, Trash2, X, Lock, RefreshCw,
  FileText, Users, Package, Calculator, CreditCard, StickyNote,
  Sparkles, Building2, Phone, Mail, MapPin, Hash,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { cn, formatDateInput, formatMoney, formatNumber } from '@/lib/utils';
import type { ApiResponse, Customer, Product, ProductCategory } from '@/types/api';

interface LineItem {
  id: string;
  productId?: string;
  productSku?: string;
  productName: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  minUnitPrice: number; // ราคาขั้นต่ำจาก master data (0 = ไม่มีข้อจำกัด)
  discount: number;
  discountType: 'PERCENTAGE' | 'FIXED';
}

const newItem = (): LineItem => ({
  id: Math.random().toString(36).slice(2),
  productName: '', description: '', quantity: 1, unit: 'pcs',
  unitPrice: 0, minUnitPrice: 0,
  discount: 0, discountType: 'PERCENTAGE',
});


export default function NewQuotationPage() {
  const t = useT();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerInfo, setCustomerInfo] = useState({ contactName: '', company: '', taxId: '', phone: '', email: '', billingAddress: '', shippingAddress: '' });
  const today = useMemo(() => formatDateInput(new Date()), []);
  const expireDefault = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return formatDateInput(d); }, []);
  const [issueDate, setIssueDate] = useState(today);
  const [expiryDate, setExpiryDate] = useState(expireDefault);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [currency, setCurrency] = useState<'THB' | 'USD'>('THB');
  const [usdExchangeRate, setUsdExchangeRate] = useState(35);
  const [rateLoading, setRateLoading] = useState(false);
  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatRate, setVatRate] = useState(7);
  const [normalDiscountMax, setNormalDiscountMax] = useState(20);
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [conditions, setConditions] = useState('');
  const [items, setItems] = useState<LineItem[]>([newItem()]);
  const [submitting, setSubmitting] = useState<'draft' | 'submit' | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [cRes, pRes, sRes, catRes] = await Promise.all([
          api.get<ApiResponse<Customer[]>>('/customers?limit=100'),
          api.get<ApiResponse<Product[]>>('/products?limit=100&isActive=true'),
          api.get<ApiResponse<{ normalDiscountMax: number; defaultVatRate: number }>>('/admin/quotation-settings'),
          api.get<ApiResponse<ProductCategory[]>>('/product-categories'),
        ]);
        setCustomers(cRes.data.data ?? []);
        setProducts(pRes.data.data ?? []);
        setCategories(catRes.data.data ?? []);
        if (sRes.data.data) {
          setNormalDiscountMax(sRes.data.data.normalDiscountMax);
          setVatRate(sRes.data.data.defaultVatRate);
          if ((sRes.data.data as any).usdExchangeRate) {
            setUsdExchangeRate(Number((sRes.data.data as any).usdExchangeRate));
          }
        }
      } catch (err) { toast.error(getApiErrorMessage(err)); }
    })();
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (submitting) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [submitting]);

  const fetchLiveRate = async (force = false): Promise<number> => {
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = `usd_thb_rate_${today}`;
    if (!force) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { rate } = JSON.parse(cached);
        setUsdExchangeRate(rate);
        return rate;
      }
    }
    setRateLoading(true);
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await res.json();
      const rawRate = data?.rates?.THB;
      if (!rawRate) throw new Error('THB rate not found');
      const rate = Math.round(rawRate * 100) / 100;
      setUsdExchangeRate(rate);
      localStorage.setItem(cacheKey, JSON.stringify({ rate }));
      return rate;
    } catch {
      return usdExchangeRate;
    } finally {
      setRateLoading(false);
    }
  };

  const handleCurrencyChange = async (newCurrency: 'THB' | 'USD') => {
    if (newCurrency === currency) return;
    let rate = usdExchangeRate;
    if (newCurrency === 'USD') rate = await fetchLiveRate();
    const factor = newCurrency === 'USD' ? 1 / rate : rate;
    setItems((prev) => prev.map((it) => ({
      ...it,
      unitPrice: it.unitPrice > 0 ? Math.round(it.unitPrice * factor * 100) / 100 : 0,
      minUnitPrice: it.minUnitPrice > 0 ? Math.round(it.minUnitPrice * factor * 100) / 100 : 0,
    })));
    setCurrency(newCurrency);
  };

  // Payment term hierarchy: index 0 = strictest, higher index = more lenient
  const PAYMENT_TERMS_ORDERED = ['Prepaid', 'COD', 'Net 7', 'Net 15', 'Net 30', 'Net 60', 'Net 90'] as const;
  type PaymentTerm = typeof PAYMENT_TERMS_ORDERED[number];

  const getAvailableTerms = (customerDefaultTerm: string): PaymentTerm[] => {
    const maxIdx = PAYMENT_TERMS_ORDERED.indexOf(customerDefaultTerm as PaymentTerm);
    if (maxIdx === -1) return [...PAYMENT_TERMS_ORDERED];
    return PAYMENT_TERMS_ORDERED.slice(0, maxIdx + 1); // only terms at or stricter than default
  };

  const handleCustomerChange = (id: string) => {
    setCustomerId(id);
    if (!id) {
      setCustomerInfo({ contactName: '', company: '', taxId: '', phone: '', email: '', billingAddress: '', shippingAddress: '' });
      setPaymentTerms('Net 30');
      return;
    }
    const c = customers.find((x) => x.id === id);
    if (c) {
      setCustomerInfo({ contactName: c.contactName, company: c.company, taxId: c.taxId || '', phone: c.phone || '', email: c.email || '', billingAddress: c.billingAddress || '', shippingAddress: c.shippingAddress || '' });
      const defaultTerm = (c as any).paymentTerm || 'Net 30';
      setPaymentTerms(defaultTerm);
    }
  };

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it) => {
      if (it.id !== id) return it;
      const updated = { ...it, ...patch };
      if ('discount' in patch || 'discountType' in patch || 'quantity' in patch || 'unitPrice' in patch) {
        const gross = updated.quantity * updated.unitPrice;
        if (updated.discountType === 'PERCENTAGE') {
          updated.discount = Math.min(updated.discount, normalDiscountMax);
        } else if (updated.discountType === 'FIXED' && gross > 0) {
          updated.discount = Math.min(updated.discount, (normalDiscountMax / 100) * gross);
        }
      }
      return updated;
    }));
  };

  const removeItem = (id: string) => setItems((prev) => prev.length > 1 ? prev.filter((it) => it.id !== id) : prev);

  const onProductSelect = (itemId: string, productId: string) => {
    if (!productId) {
      updateItem(itemId, { productId: undefined, productSku: undefined, minUnitPrice: 0 });
      return;
    }
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const thbPrice = Number(p.unitPrice);
    const priceInCurrency = currency === 'USD'
      ? Math.round((thbPrice / usdExchangeRate) * 100) / 100
      : thbPrice;
    updateItem(itemId, {
      productId: p.id, productSku: p.sku, productName: p.name,
      description: p.description || '', unitPrice: priceInCurrency,
      unit: p.unit, minUnitPrice: priceInCurrency,
    });
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

const submitForm = async (mode: 'draft' | 'submit') => {
    if (!customerId) { toast.error('Please select a customer'); return; }
    if (items.some((it) => !it.productName.trim() || it.quantity <= 0)) { toast.error('Please fill in all product names and quantities'); return; }
    if (items.some((it) => it.minUnitPrice > 0 && it.unitPrice < it.minUnitPrice)) {
      toast.error('ราคาสินค้าบางรายการต่ำกว่าราคา Master Data — กรุณาตรวจสอบก่อนบันทึก');
      return;
    }
    if (mode === 'submit') {
      if (!confirm(`ยืนยันส่งใบเสนอราคาเพื่อขออนุมัติ?\n\nหลังจากส่งแล้ว จะไม่สามารถยกเลิกหรือกลับมาแก้ไขได้`)) return;
    }
    setSubmitting(mode);
    try {
      const createRes = await api.post<ApiResponse<{ id: string; quotationNo: string }>>('/quotations', {
        customerId, issueDate, expiryDate, deliveryDate: deliveryDate || null, currency, vatEnabled, vatRate, paymentTerms, conditions,
        items: items.map((it, idx) => ({
          productId: it.productId, productSku: it.productSku, productName: it.productName,
          description: it.description, quantity: it.quantity, unit: it.unit,
          unitPrice: it.unitPrice, discount: it.discount, discountType: it.discountType, sortOrder: idx,
        })),
      });
      const quotation = createRes.data.data;
      if (!quotation) throw new Error('No data returned');
      if (mode === 'submit') {
        await api.post(`/quotations/${quotation.id}/submit`, {});
        setLocked(true);
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

  const handleCancel = () => {
    if (locked || submitting) return;
    if (confirm('ยกเลิกการสร้างใบเสนอราคา? ข้อมูลที่กรอกจะหายไป')) router.push('/quotations');
  };

  const isProcessing = submitting !== null;
  const isFullyDisabled = locked || isProcessing;

  const filteredProducts = useMemo(
    () => filterCategory ? products.filter((p) => p.categoryId === filterCategory) : products,
    [products, filterCategory],
  );

  const selectedCustomer = customers.find((x) => x.id === customerId);
  const customerDefault = customerId ? (selectedCustomer as any)?.paymentTerm || 'Net 30' : null;
  const available = customerDefault ? getAvailableTerms(customerDefault) : [...PAYMENT_TERMS_ORDERED];
  const isCodOrPrepaid = customerDefault === 'COD' || customerDefault === 'Prepaid';

  return (
    <div className="max-w-6xl pb-32">
      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button asChild={!isFullyDisabled} variant="ghost" size="icon" className="shrink-0" disabled={isFullyDisabled}>
          {isFullyDisabled
            ? <span><ArrowLeft className="h-5 w-5 opacity-30" /></span>
            : <Link href="/quotations" aria-label="back"><ArrowLeft className="h-5 w-5" /></Link>}
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-gradient">ใบเสนอราคาใหม่</h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700/40">
              <Sparkles className="h-3 w-3" />DRAFT
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">กรอกข้อมูลให้ครบถ้วนก่อนส่งขออนุมัติ</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
        {/* ══ LEFT COLUMN ══ */}
        <div className="space-y-5 min-w-0">

          {/* ── Section 1: Document Details ── */}
          <Card className="overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                  <FileText className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                </div>
                <h2 className="text-sm font-bold text-foreground">{t('quotation.documentDetails')}</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {/* Doc No */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Hash className="h-3 w-3" />{t('quotation.documentNo')}
                  </Label>
                  <Input value="auto-generated" disabled className="bg-muted/50 text-muted-foreground font-mono text-xs h-9" />
                </div>
                {/* Issue Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">{t('quotation.issueDate')}</Label>
                  <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="h-9" disabled={isFullyDisabled} />
                </div>
                {/* Expiry Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">{t('quotation.expiryDate')}</Label>
                  <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="h-9" disabled={isFullyDisabled} />
                </div>
                {/* Delivery Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">วันจัดส่ง <span className="text-muted-foreground/50">(ถ้ามี)</span></Label>
                  <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="h-9" disabled={isFullyDisabled} />
                </div>
              </div>

              {/* Currency row */}
              <div className="mt-3 pt-3 border-t flex flex-wrap items-end gap-3">
                <div className="space-y-1.5 w-36">
                  <Label className="text-xs font-medium text-muted-foreground">สกุลเงิน</Label>
                  <select value={currency} onChange={(e) => handleCurrencyChange(e.target.value as 'THB' | 'USD')}
                    disabled={isFullyDisabled || rateLoading}
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm disabled:opacity-60 appearance-none cursor-pointer">
                    <option value="THB">🇹🇭 THB — บาทไทย</option>
                    <option value="USD">🇺🇸 USD — ดอลลาร์</option>
                  </select>
                </div>
                {currency === 'USD' && (
                  <div className="flex items-end gap-2 flex-1 min-w-0">
                    <div className="space-y-1.5 flex-1 max-w-[160px]">
                      <Label className="text-xs font-medium text-muted-foreground">อัตราแลกเปลี่ยน (THB/USD)</Label>
                      <Input type="number" min="1" step="0.01" value={usdExchangeRate}
                        onChange={(e) => setUsdExchangeRate(parseFloat(e.target.value) || 35)}
                        disabled={isFullyDisabled || rateLoading} className="h-9 font-mono" />
                    </div>
                    <button type="button" onClick={() => fetchLiveRate(true)}
                      disabled={isFullyDisabled || rateLoading} title="ดึงอัตราปัจจุบัน"
                      className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-input bg-background hover:bg-muted disabled:opacity-50 transition-colors text-xs font-medium whitespace-nowrap">
                      {rateLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      อัปเดต
                    </button>
                    <div className="h-9 flex items-center px-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      1 USD = {usdExchangeRate} THB
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Section 2: Customer Info ── */}
          <Card className="overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-500" />
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-lg bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center shrink-0">
                  <Users className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                </div>
                <h2 className="text-sm font-bold">{t('quotation.customerInfo')}</h2>
              </div>

              {/* Customer selector */}
              <div className="mb-4">
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">เลือกลูกค้า (auto-fill)</Label>
                <select value={customerId} onChange={(e) => handleCustomerChange(e.target.value)}
                  disabled={isFullyDisabled}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:opacity-60 appearance-none cursor-pointer">
                  <option value="">{t('quotation.selectCustomer')}</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.company} — {c.contactName}</option>)}
                </select>
              </div>

              {/* Customer info card — แสดงเมื่อเลือกลูกค้าแล้ว */}
              {customerId && selectedCustomer ? (
                <div className="rounded-xl border border-sky-200/60 dark:border-sky-800/40 bg-sky-50/50 dark:bg-sky-900/10 p-4">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white font-bold text-base shrink-0 shadow-sm">
                      {customerInfo.company.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-base leading-tight">{customerInfo.company}</div>
                      <div className="text-sm text-muted-foreground">{customerInfo.contactName}</div>
                    </div>
                  </div>
                  {/* Details grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
                    {customerInfo.taxId && (
                      <div className="flex items-start gap-2">
                        <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Tax ID</div>
                          <div className="font-medium text-sm font-mono">{customerInfo.taxId}</div>
                        </div>
                      </div>
                    )}
                    {customerInfo.phone && (
                      <div className="flex items-start gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">โทรศัพท์</div>
                          <div className="font-medium text-sm">{customerInfo.phone}</div>
                        </div>
                      </div>
                    )}
                    {customerInfo.email && (
                      <div className="flex items-start gap-2 sm:col-span-2">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Email</div>
                          <div className="font-medium text-sm">{customerInfo.email}</div>
                        </div>
                      </div>
                    )}
                    {customerInfo.billingAddress && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">ที่อยู่ออกใบเสร็จ</div>
                          <div className="font-medium text-sm leading-relaxed">{customerInfo.billingAddress}</div>
                        </div>
                      </div>
                    )}
                    {customerInfo.shippingAddress && (
                      <div className="flex items-start gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">ที่อยู่จัดส่ง</div>
                          <div className="font-medium text-sm leading-relaxed">{customerInfo.shippingAddress}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-muted flex flex-col items-center justify-center py-8 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">เลือกลูกค้าเพื่อแสดงข้อมูล</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Section 3: Line Items ── */}
          <Card className="overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                    <Package className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h2 className="text-sm font-bold">{t('quotation.lineItems')}</h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                    {items.length} รายการ
                  </span>
                </div>
                <Button variant="outline" size="sm" disabled={isFullyDisabled}
                  onClick={() => setItems((p) => [...p, newItem()])}
                  className="h-8 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                  <Plus className="h-3.5 w-3.5" />เพิ่มสินค้า
                </Button>
              </div>

              {/* Category filter pills */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <button onClick={() => setFilterCategory('')}
                    className={cn('text-xs px-3 py-1 rounded-full border font-medium transition-all',
                      filterCategory === '' ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'border-border hover:bg-muted text-muted-foreground')}>
                    ทั้งหมด
                  </button>
                  {categories.map((cat) => (
                    <button key={cat.id} onClick={() => setFilterCategory(filterCategory === cat.id ? '' : cat.id)}
                      className={cn('text-xs px-3 py-1 rounded-full border font-medium transition-all',
                        filterCategory === cat.id ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'border-border hover:bg-muted text-muted-foreground')}>
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Table header — desktop */}
              <div className="hidden md:grid grid-cols-[24px_1.6fr_1.2fr_72px_120px_90px_80px_110px_36px] gap-2 px-2 py-2 rounded-lg bg-muted/50 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                <div className="text-center">#</div>
                <div>สินค้า</div>
                <div>คำอธิบาย</div>
                <div className="text-center">จำนวน</div>
                <div className="text-right">ราคา/หน่วย</div>
                <div className="text-right">ส่วนลด</div>
                <div className="text-center">ประเภท</div>
                <div className="text-right">รวม</div>
                <div />
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => {
                  const gross = item.quantity * item.unitPrice;
                  const isBelowMin = item.minUnitPrice > 0 && item.unitPrice < item.minUnitPrice;
                  return (
                    <div key={item.id}
                      className={cn(
                        'grid grid-cols-1 md:grid-cols-[24px_1.6fr_1.2fr_72px_120px_90px_80px_110px_36px] gap-2 p-2.5 rounded-xl border transition-colors',
                        isBelowMin
                          ? 'border-destructive/50 bg-destructive/5'
                          : 'border-border/60 hover:border-border bg-muted/20 hover:bg-muted/30'
                      )}>
                      {/* Row number */}
                      <div className="hidden md:flex items-center justify-center">
                        <span className="h-5 w-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center">{idx + 1}</span>
                      </div>
                      {/* Product selector */}
                      <div>
                        <select value={item.productId || ''} disabled={isFullyDisabled}
                          onChange={(e) => onProductSelect(item.id, e.target.value)}
                          className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-sm disabled:opacity-60">
                          <option value="">{t('quotation.selectProduct')}</option>
                          {filteredProducts.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                        </select>
                        {!item.productId && (
                          <Input value={item.productName} disabled={isFullyDisabled}
                            onChange={(e) => updateItem(item.id, { productName: e.target.value })}
                            placeholder="หรือพิมพ์ชื่อสินค้า..." className="h-8 mt-1 text-xs" />
                        )}
                      </div>
                      {/* Description */}
                      <Input value={item.description} disabled={isFullyDisabled}
                        onChange={(e) => updateItem(item.id, { description: e.target.value })}
                        placeholder="คำอธิบาย" className="h-8 text-xs" />
                      {/* Qty */}
                      <Input type="number" min="0" step="0.01" disabled={isFullyDisabled}
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-center text-xs font-mono" />
                      {/* Unit Price */}
                      <div className="space-y-0.5">
                        <Input type="number" min={item.minUnitPrice > 0 ? item.minUnitPrice : 0} step="0.01"
                          disabled={isFullyDisabled} value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            if (item.minUnitPrice > 0 && val < item.minUnitPrice) {
                              updateItem(item.id, { unitPrice: item.minUnitPrice });
                              toast.warning(`ราคาต้องไม่ต่ำกว่าราคา Master Data (${formatNumber(item.minUnitPrice)} ${currency})`);
                            }
                          }}
                          className={cn('h-8 text-right text-xs font-mono', isBelowMin && 'border-destructive ring-1 ring-destructive/40')} />
                        {item.minUnitPrice > 0 && (
                          <div className={cn('text-[9px] flex items-center justify-end gap-0.5', isBelowMin ? 'text-destructive font-bold' : 'text-muted-foreground')}>
                            <Lock className="h-2 w-2" />≥ {formatNumber(item.minUnitPrice)}
                          </div>
                        )}
                      </div>
                      {/* Discount */}
                      <Input type="number" min="0" step="0.01"
                        max={item.discountType === 'PERCENTAGE' ? normalDiscountMax : (gross > 0 ? (normalDiscountMax / 100) * gross : undefined)}
                        disabled={isFullyDisabled} value={item.discount}
                        onChange={(e) => updateItem(item.id, { discount: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-right text-xs font-mono" />
                      {/* Discount type */}
                      <select value={item.discountType} disabled={isFullyDisabled}
                        onChange={(e) => updateItem(item.id, { discountType: e.target.value as 'PERCENTAGE' | 'FIXED' })}
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs shadow-sm disabled:opacity-60">
                        <option value="PERCENTAGE">%</option>
                        <option value="FIXED">{currency}</option>
                      </select>
                      {/* Line total */}
                      <div className="h-8 flex items-center justify-end font-bold text-sm tabular-nums text-foreground">
                        {formatNumber(calc.itemTotals[idx] ?? 0)}
                      </div>
                      {/* Delete */}
                      <button onClick={() => removeItem(item.id)} disabled={items.length === 1 || isFullyDisabled}
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-25 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add item button */}
              <button onClick={() => setItems((p) => [...p, newItem()])} disabled={isFullyDisabled}
                className="mt-3 w-full h-9 rounded-xl border-2 border-dashed border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-30">
                <Plus className="h-3.5 w-3.5" />เพิ่มรายการสินค้า
              </button>
            </CardContent>
          </Card>

          {/* ── Section 4: Payment Terms + Conditions ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment Terms */}
            <Card className="overflow-hidden">
              <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500" />
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                    <CreditCard className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h2 className="text-sm font-bold">{t('quotation.paymentTerms')}</h2>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {available.map((pt) => (
                    <button key={pt} disabled={isFullyDisabled}
                      onClick={() => setPaymentTerms(pt)}
                      className={cn(
                        'text-xs px-3 py-1.5 rounded-full border font-semibold transition-all',
                        paymentTerms === pt
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                          : 'border-border hover:bg-muted text-muted-foreground disabled:opacity-50',
                      )}>
                      {pt}
                    </button>
                  ))}
                </div>
                {customerDefault && (
                  <p className="text-[11px] text-muted-foreground mt-2.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0" />
                    เงื่อนไขสูงสุด: <span className="font-bold text-foreground">{customerDefault}</span>
                    {isCodOrPrepaid && <span className="text-amber-600">· ไม่รองรับ Net</span>}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Conditions */}
            <Card className="overflow-hidden">
              <div className="h-1 w-full bg-gradient-to-r from-rose-500 to-pink-500" />
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-lg bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center shrink-0">
                    <StickyNote className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <h2 className="text-sm font-bold">{t('quotation.conditions')}</h2>
                </div>
                <textarea value={conditions} disabled={isFullyDisabled}
                  onChange={(e) => setConditions(e.target.value)}
                  placeholder={t('quotation.additionalRemarks')}
                  rows={3}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm resize-y disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-ring" />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ══ RIGHT SIDEBAR — Summary (sticky) ══ */}
        <div className="lg:sticky lg:top-20 space-y-4">
          <Card className="overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-primary via-purple-500 to-pink-500" />
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Calculator className="h-3.5 w-3.5 text-primary" />
                </div>
                <h2 className="text-sm font-bold">{t('quotation.summary')}</h2>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('quotation.subtotal')}</span>
                  <span className="font-semibold tabular-nums">{formatMoney(calc.subtotal, currency)}</span>
                </div>
                {calc.discountTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('quotation.discount')}</span>
                    <span className="font-semibold text-rose-600 tabular-nums">-{formatMoney(calc.discountTotal, currency)}</span>
                  </div>
                )}
                {/* VAT toggle */}
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>VAT ({vatRate}%)</span>
                    <button onClick={() => setVatEnabled((v) => !v)} disabled={isFullyDisabled}
                      className={cn('relative w-8 h-4 rounded-full transition-colors disabled:opacity-50',
                        vatEnabled ? 'bg-primary' : 'bg-muted-foreground/30')}>
                      <span className={cn('absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform', vatEnabled && 'translate-x-4')} />
                    </button>
                  </div>
                  <span className="font-semibold tabular-nums">{formatMoney(calc.vatAmount, currency)}</span>
                </div>

                {/* Grand Total */}
                <div className="mt-1 pt-3 border-t-2 border-dashed">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-sm">ยอดรวมทั้งสิ้น</span>
                    <div className="text-right">
                      <div className="text-xl font-extrabold text-primary tabular-nums leading-tight">{formatMoney(calc.grandTotal, currency)}</div>
                      {currency === 'USD' && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          ≈ {formatMoney(calc.grandTotal * usdExchangeRate, 'THB')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Items count breakdown */}
              <div className="mt-4 pt-3 border-t flex justify-between text-xs text-muted-foreground">
                <span>{items.length} รายการสินค้า</span>
                <span>{items.reduce((s, it) => s + it.quantity, 0)} ชิ้นรวม</span>
              </div>
            </CardContent>
          </Card>

          {/* ── Action Buttons ── */}
          <div className="space-y-2">
            <Button onClick={() => submitForm('submit')} disabled={isFullyDisabled}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm">
              {submitting === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {locked ? 'ส่งแล้ว — รออนุมัติ' : t('quotation.submitForApproval')}
            </Button>
            <Button variant="outline" onClick={() => submitForm('draft')} disabled={isFullyDisabled} className="w-full h-10">
              {submitting === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('common.saveDraft')}
            </Button>
            {!locked && (
              <Button variant="ghost" onClick={handleCancel} disabled={isProcessing} className="w-full h-9 text-muted-foreground">
                <X className="h-4 w-4" />ยกเลิก
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Sticky Bottom Bar (mobile fallback) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-card/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] lg:hidden">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">ยอดรวม</div>
            <div className="text-lg font-extrabold text-primary tabular-nums">{formatMoney(calc.grandTotal, currency)}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => submitForm('draft')} disabled={isFullyDisabled} size="sm">
              {submitting === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Draft
            </Button>
            <Button onClick={() => submitForm('submit')} disabled={isFullyDisabled} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              {submitting === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              ส่งอนุมัติ
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}