'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus, Search, Package, X, Loader2, Edit2, Trash2,
  Sparkles, Calculator, TrendingUp, AlertTriangle, CheckCircle,
  Info, ShoppingCart, Globe, Store, Target, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import type { ApiResponse, Product } from '@/types/api';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTS PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function ProductsPage() {
  const t = useT();
  const { role } = usePermissions();

  const roleCode = role?.code ?? '';
  const canManage = roleCode === 'ADMIN' || roleCode === 'CEO';

  const [list, setList]           = useState<Product[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('search', q);
      params.set('limit', '100');
      const res = await api.get<ApiResponse<Product[]>>(`/products?${params}`);
      setList(res.data.data ?? []);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => load(search), 300);
    return () => clearTimeout(handler);
  }, [search, load]);

  const handleCloseCreate = useCallback(() => setShowCreate(false), []);
  const handleSavedCreate = useCallback(() => { setShowCreate(false); load(search); }, [load, search]);
  const handleCloseEdit   = useCallback(() => setEditingId(null), []);
  const handleSavedEdit   = useCallback(() => { setEditingId(null); load(search); }, [load, search]);

  const remove = async (id: string, name: string) => {
    if (!confirm(`ลบสินค้า "${name}" ใช่หรือไม่?`)) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success('ลบสินค้าแล้ว');
      load(search);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('product.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{list.length} products</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />{t('product.newProduct')}
          </Button>
        )}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`${t('common.search')}... (SKU, name)`}
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <Package className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t('common.noData')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((p) => (
            <Card key={p.id} className="group transition-all hover:border-primary/40">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground font-mono">{p.sku}</div>
                    <div className="font-semibold truncate">{p.name}</div>
                    {p.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.description}</div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-lg font-bold text-primary">
                        {formatMoney(p.unitPrice)}
                        <span className="text-xs text-muted-foreground font-normal ml-1">/ {p.unit}</span>
                      </div>
                      {canManage && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => setEditingId(p.id)} title="แก้ไข"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => remove(p.id, p.name)} title="ลบ"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <ProductModal mode="create" onClose={handleCloseCreate} onSaved={handleSavedCreate} />
      )}
      {editingId && (
        <ProductModal mode="edit" id={editingId} onClose={handleCloseEdit} onSaved={handleSavedEdit} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface PricingInputs {
  costPrice: number;
  lastPrice: number;
  marketPrice: number;
  competitorPrice: number;
  targetMarginPct: number;
}

interface PricingResult {
  baseCost: number;
  minPrice: number;
  suggestedPrice: number;
  actualMarginPct: number;
  barSugPct: number;
  barCompPct: number | null;
  insights: { type: 'ok' | 'warn' | 'info'; text: string }[];
}

type ModalView = 'form' | 'analyzer';

// ═══════════════════════════════════════════════════════════════════════════
// PRICING ENGINE
// ═══════════════════════════════════════════════════════════════════════════

function runPricingEngine(p: PricingInputs): PricingResult | null {
  const { costPrice, lastPrice, marketPrice, competitorPrice, targetMarginPct } = p;
  const base = Math.max(costPrice, lastPrice);
  if (!base && !marketPrice && !competitorPrice) return null;

  const minP = base > 0 ? Math.round(base / (1 - targetMarginPct / 100)) : 0;
  let sug = 0;
  const insights: PricingResult['insights'] = [];

  if (base && marketPrice && competitorPrice) {
    sug = Math.round(
      (base / (1 - targetMarginPct / 100)) * 0.5 +
      marketPrice * 0.95 * 0.3 +
      competitorPrice * 0.97 * 0.2,
    );
    insights.push({ type: 'ok', text: 'ข้อมูลครบทุกมิติ — ถ่วงน้ำหนัก ต้นทุน 50% + ตลาด 30% + คู่แข่ง 20%' });
  } else if (base && marketPrice) {
    sug = Math.round(Math.max(base / (1 - targetMarginPct / 100), marketPrice * 0.92));
    insights.push({ type: 'info', text: 'ใช้ต้นทุน + ราคาตลาด — เพิ่ม competitor price เพื่อความแม่นยำ' });
  } else if (base && competitorPrice) {
    sug = Math.round(Math.max(base / (1 - targetMarginPct / 100), competitorPrice * 0.97));
    insights.push({ type: 'info', text: 'ใช้ต้นทุน + คู่แข่ง — เพิ่ม market price เพื่อเปรียบเทียบ' });
  } else if (base) {
    sug = Math.round(base / (1 - targetMarginPct / 100));
    insights.push({ type: 'warn', text: 'มีเฉพาะต้นทุน — ควรเพิ่มราคาตลาดหรือคู่แข่งเพื่อตั้งราคาแข่งขันได้' });
  } else {
    sug = Math.round((marketPrice || competitorPrice) * 0.9);
    insights.push({ type: 'warn', text: 'ไม่มีต้นทุน — ยืนยัน margin ไม่ได้ ควรใส่ cost price ก่อน' });
  }

  if (base && sug < minP) {
    sug = minP;
    insights.push({ type: 'warn', text: 'ราคาปรับขึ้นมาที่ min price เพื่อให้ได้ target margin' });
  }
  if (marketPrice && sug > marketPrice * 1.1)
    insights.push({ type: 'warn', text: 'สูงกว่าตลาด >10% — อาจแข่งขันยาก ลองลด target margin' });
  if (competitorPrice && sug > competitorPrice)
    insights.push({ type: 'warn', text: 'สูงกว่าคู่แข่ง — ควรพิจารณา value proposition' });

  const actualMarginPct = base && sug ? ((sug - base) / sug) * 100 : 0;
  if (base && actualMarginPct >= targetMarginPct)
    insights.push({ type: 'ok', text: `margin จริง ${actualMarginPct.toFixed(1)}% ≥ target ${targetMarginPct}% ✓` });

  const hi = Math.max(sug, marketPrice, competitorPrice, minP) * 1.08 || 1;
  const lo = Math.max(minP * 0.9, 0);
  const rng = hi - lo || 1;
  const barSugPct  = Math.min(100, Math.max(0, ((sug - lo) / rng) * 100));
  const barCompPct = competitorPrice
    ? Math.min(100, Math.max(0, ((competitorPrice - lo) / rng) * 100))
    : null;

  return { baseCost: base, minPrice: minP, suggestedPrice: sug, actualMarginPct, barSugPct, barCompPct, insights };
}

// ═══════════════════════════════════════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function InsightIcon({ type }: { type: 'ok' | 'warn' | 'info' }) {
  if (type === 'ok')   return <CheckCircle   className="h-3.5 w-3.5 shrink-0 text-emerald-500" />;
  if (type === 'warn') return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />;
  return                      <Info          className="h-3.5 w-3.5 shrink-0 text-blue-500" />;
}

function AnimatedPrice({ value, prefix = '฿' }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    const start     = prev.current;
    const end       = value;
    const duration  = 400;
    const startTime = performance.now();
    const tick = (now: number) => {
      const t     = Math.min((now - startTime) / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setDisplay(Math.round(start + (end - start) * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    prev.current = value;
  }, [value]);

  return <span>{prefix}{display.toLocaleString('th-TH')}</span>;
}

// ═══════════════════════════════════════════════════════════════════════════
// PRICING ANALYZER PANEL
// ═══════════════════════════════════════════════════════════════════════════

function PricingAnalyzer({
  onUseSuggested,
}: {
  onUseSuggested: (price: number, cost: number) => void;
}) {
  const [inputs, setInputs] = useState<PricingInputs>({
    costPrice: 0, lastPrice: 0, marketPrice: 0, competitorPrice: 0, targetMarginPct: 30,
  });
  const [result,   setResult]   = useState<PricingResult | null>(null);
  const [hasInput, setHasInput] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const update = (k: keyof PricingInputs, v: number) => {
    const next     = { ...inputs, [k]: v };
    const r        = runPricingEngine(next);
    const anyInput = !!(next.costPrice || next.lastPrice || next.marketPrice || next.competitorPrice);
    setInputs(next);
    setHasInput(anyInput);
    setResult(r);
    if (r && !result)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  };

  const marginColor =
    result && result.actualMarginPct >= inputs.targetMarginPct
      ? 'text-emerald-600 dark:text-emerald-400'
      : result && result.actualMarginPct >= 0
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-500';

  return (
    <div className="space-y-4">
      {/* Inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
            <ShoppingCart className="h-3 w-3" /> Cost price
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">฿</span>
            <Input type="number" min="0" placeholder="0" className="pl-6 h-9 text-sm"
              onChange={(e) => update('costPrice', parseFloat(e.target.value) || 0)} />
          </div>
          <p className="text-[10px] text-muted-foreground leading-tight">รวม shipping + ภาษี</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-3 w-3" /> Last purchase price
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">฿</span>
            <Input type="number" min="0" placeholder="0" className="pl-6 h-9 text-sm"
              onChange={(e) => update('lastPrice', parseFloat(e.target.value) || 0)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
            <Globe className="h-3 w-3" /> Market price
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">฿</span>
            <Input type="number" min="0" placeholder="0" className="pl-6 h-9 text-sm"
              onChange={(e) => update('marketPrice', parseFloat(e.target.value) || 0)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
            <Store className="h-3 w-3" /> Competitor price
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">฿</span>
            <Input type="number" min="0" placeholder="0" className="pl-6 h-9 text-sm"
              onChange={(e) => update('competitorPrice', parseFloat(e.target.value) || 0)} />
          </div>
        </div>
      </div>

      {/* Target Margin slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
            <Target className="h-3 w-3" /> Target margin
          </Label>
          <span className="text-sm font-semibold text-primary tabular-nums">{inputs.targetMarginPct}%</span>
        </div>
        <div className="relative">
          <input
            type="range" min="5" max="60" step="1"
            value={inputs.targetMarginPct}
            onChange={(e) => update('targetMarginPct', parseInt(e.target.value))}
            className="pricing-slider w-full"
          />
          <div
            className="pointer-events-none absolute top-1/2 left-0 h-1.5 rounded-full bg-primary -translate-y-1/2 transition-all"
            style={{ width: `${((inputs.targetMarginPct - 5) / 55) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>5%</span><span>60%</span>
        </div>
      </div>

      {/* Empty state */}
      {!hasInput && (
        <div className="py-6 text-center text-sm text-muted-foreground">
          <div className="text-2xl mb-2 opacity-30">↑</div>
          กรอกข้อมูลด้านบนเพื่อดูผลการวิเคราะห์
        </div>
      )}

      {/* Result */}
      {result && (
        <div ref={resultRef} className="space-y-3">
          {/* Metric cards */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'ต้นทุน',      value: result.baseCost,      color: 'text-foreground' },
              { label: 'min price',   value: result.minPrice,       color: 'text-red-500' },
              { label: 'suggested',   value: result.suggestedPrice, color: 'text-primary', highlight: true },
              { label: 'margin จริง', value: null, pct: result.actualMarginPct, color: marginColor },
            ].map((m, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-xl p-2.5 text-center transition-all duration-300',
                  m.highlight ? 'bg-primary/10 ring-1 ring-primary/30 dark:bg-primary/20' : 'bg-muted/60',
                )}
              >
                <div className="text-[10px] text-muted-foreground mb-1">{m.label}</div>
                <div className={cn('text-sm font-bold tabular-nums', m.color)}>
                  {m.value !== null && m.value !== undefined
                    ? <AnimatedPrice value={m.value} />
                    : `${m.pct?.toFixed(1)}%`}
                </div>
              </div>
            ))}
          </div>

          {/* Position bar */}
          <div className="space-y-1.5">
            <div className="relative h-2 bg-muted rounded-full overflow-visible">
              <div className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${result.barSugPct}%` }} />
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-primary ring-2 ring-background transition-all duration-500 shadow-sm"
                style={{ left: `${result.barSugPct}%` }} />
              {result.barCompPct !== null && (
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-orange-400 ring-2 ring-background transition-all duration-500"
                  style={{ left: `${result.barCompPct}%` }} />
              )}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{result.minPrice ? formatMoney(result.minPrice) : ''}</span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-primary" /> suggested
                </span>
                {result.barCompPct !== null && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-orange-400" /> competitor
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Insights */}
          <div className="rounded-xl border bg-muted/30 dark:bg-muted/20 divide-y divide-border/50">
            {result.insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2.5 px-3 py-2 text-xs text-muted-foreground">
                <InsightIcon type={ins.type} />
                <span>{ins.text}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <Button
            className="w-full h-10 gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 shadow-sm transition-all duration-200 hover:shadow-emerald-500/25 hover:shadow-lg"
            onClick={() => onUseSuggested(result.suggestedPrice, result.baseCost)}
          >
            <CheckCircle className="h-4 w-4" />
            ใช้ suggested price — {formatMoney(result.suggestedPrice)}
            <ChevronRight className="h-4 w-4 ml-auto" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT MODAL
// ═══════════════════════════════════════════════════════════════════════════

function ProductModal({
  mode, id, onClose, onSaved,
}: {
  mode: 'create' | 'edit';
  id?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState({
    sku: '', name: '', description: '', unitPrice: 0, unit: 'pcs',
  });
  const [loading,       setLoading]       = useState(mode === 'edit');
  const [submitting,    setSubmitting]    = useState(false);
  const [view,          setView]          = useState<ModalView>('form');
  const [liveMargin,    setLiveMargin]    = useState<string | null>(null);
  const [costForMargin, setCostForMargin] = useState(0);
  const backdropRef = useRef<HTMLDivElement>(null);

  // fetch edit data
  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    let cancelled = false;
    setLoading(true);
    api.get<ApiResponse<Product>>(`/products/${id}`)
      .then((res) => {
        if (cancelled) return;
        const p = res.data.data;
        if (p) setForm({
          sku: p.sku, name: p.name,
          description: p.description || '',
          unitPrice: Number(p.unitPrice), unit: p.unit,
        });
      })
      .catch((err) => { if (!cancelled) { toast.error(getApiErrorMessage(err)); onClose(); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, id]);

  const update = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm((prev) => {
      const next = { ...prev, [k]: v };
      if (k === 'unitPrice') {
        const price = Number(v);
        if (price && costForMargin) {
          const m = ((price - costForMargin) / price) * 100;
          setLiveMargin(`${m >= 0 ? '+' : ''}${m.toFixed(1)}% margin`);
        } else {
          setLiveMargin(null);
        }
      }
      return next;
    });

  // รับ price + cost จาก analyzer — set ทั้งคู่พร้อมกัน
  const handleUseSuggested = (price: number, cost: number) => {
    setCostForMargin(cost);
    setForm((prev) => ({ ...prev, unitPrice: price }));
    if (price && cost) {
      const m = ((price - cost) / price) * 100;
      setLiveMargin(`${m >= 0 ? '+' : ''}${m.toFixed(1)}% margin`);
    }
    setView('form');
    toast.success(`ใส่ suggested price ${formatMoney(price)} แล้ว`, { duration: 2500 });
  };

  const submit = async () => {
    if (!form.sku || !form.name) { toast.error('SKU and Name are required'); return; }
    setSubmitting(true);
    try {
      if (mode === 'create') {
        await api.post('/products', form);
        toast.success('สร้างสินค้าสำเร็จ');
      } else if (id) {
        await api.patch(`/products/${id}`, form);
        toast.success('แก้ไขสินค้าสำเร็จ');
      }
      onSaved();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center p-4
                 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div
        className={cn(
          'relative w-full bg-background rounded-2xl shadow-2xl',
          'border border-border/60 animate-slide-up transition-all duration-300',
          view === 'form' ? 'max-w-md' : 'max-w-lg',
        )}
      >
        {/* Top stripe */}
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            {view === 'analyzer' ? (
              <>
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                  <Calculator className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-semibold leading-none">Pricing Analyzer</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">วิเคราะห์จากหลายมิติ — ตัดสินใจเองได้เสมอ</p>
                </div>
              </>
            ) : (
              <>
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm">
                  <Package className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-base font-semibold">
                  {mode === 'create' ? t('product.newProduct') : 'แก้ไขสินค้า'}
                </h2>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            {view === 'analyzer' && (
              <Button
                variant="ghost" size="sm"
                className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => setView('form')}
              >
                ← กลับ
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto max-h-[75vh]">

          {/* ── FORM VIEW ── */}
          {view === 'form' && (
            <>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        {t('product.sku')} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={form.sku}
                        onChange={(e) => update('sku', e.target.value)}
                        placeholder="PRD-0001"
                        className="h-9 text-sm font-mono"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        {t('product.name')} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={form.name}
                        onChange={(e) => update('name', e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('product.description')}</Label>
                    <textarea
                      value={form.description}
                      onChange={(e) => update('description', e.target.value)}
                      rows={2}
                      placeholder="รายละเอียดสินค้า (ถ้ามี)"
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                                 shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1
                                 focus-visible:ring-ring transition-shadow"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">หน่วย / Unit</Label>
                    <select
                      value={form.unit}
                      onChange={(e) => update('unit', e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1
                                 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1
                                 focus-visible:ring-ring"
                    >
                      <option value="pcs">pcs (ชิ้น)</option>
                      <option value="set">set (ชุด)</option>
                      <option value="box">box (กล่อง)</option>
                      <option value="hr">hr (ชั่วโมง)</option>
                      <option value="day">day (วัน)</option>
                      <option value="month">month (เดือน)</option>
                      <option value="lot">lot</option>
                      <option value="kg">kg</option>
                      <option value="m">m (เมตร)</option>
                    </select>
                  </div>

                  {/* Unit Price */}
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">
                        {t('product.unitPrice')} (Standard Price){' '}
                        <span className="text-destructive">*</span>
                      </Label>
                      {liveMargin && (
                        <span className={cn(
                          'text-xs font-medium tabular-nums',
                          liveMargin.startsWith('-') ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400',
                        )}>
                          {liveMargin}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">฿</span>
                      <Input
                        type="number" min="0" step="0.01"
                        value={form.unitPrice || ''}
                        onChange={(e) => update('unitPrice', parseFloat(e.target.value) || 0)}
                        className="pl-7 h-10 text-base font-semibold"
                        placeholder="0"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      ตั้งได้อิสระ — หรือใช้ผลจากการวิเคราะห์ด้านล่าง
                    </p>
                  </div>

                  {/* Analyzer CTA */}
                  <button
                    type="button"
                    onClick={() => setView('analyzer')}
                    className="group w-full rounded-xl border border-violet-200 dark:border-violet-800
                               bg-gradient-to-r from-violet-50 to-purple-50
                               dark:from-violet-950/40 dark:to-purple-950/40
                               px-4 py-3 flex items-center gap-3
                               hover:border-violet-300 dark:hover:border-violet-700
                               hover:from-violet-100 hover:to-purple-100
                               dark:hover:from-violet-950/60 dark:hover:to-purple-950/60
                               transition-all duration-200 text-left"
                  >
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600
                                    flex items-center justify-center shadow-sm shrink-0
                                    group-hover:scale-105 transition-transform duration-200">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-violet-900 dark:text-violet-300">
                        วิเคราะห์ราคาอัจฉริยะ
                      </div>
                      <div className="text-xs text-violet-600/70 dark:text-violet-400/70 mt-0.5">
                        ใส่ต้นทุน + ราคาตลาด ให้ระบบแนะนำ standard price ที่เหมาะสม
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-violet-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── ANALYZER VIEW ── */}
          {view === 'analyzer' && (
            <PricingAnalyzer onUseSuggested={handleUseSuggested} />
          )}
        </div>

        {/* Footer — form view only */}
        {view === 'form' && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/60">
            <Button variant="outline" onClick={onClose} disabled={submitting} className="h-9">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={submit}
              disabled={submitting || loading}
              className="h-9 min-w-[80px] bg-gradient-to-r from-emerald-500 to-teal-500
                         hover:from-emerald-600 hover:to-teal-600 text-white border-0
                         shadow-sm hover:shadow-emerald-500/30 hover:shadow-md transition-all"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t('common.save')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}