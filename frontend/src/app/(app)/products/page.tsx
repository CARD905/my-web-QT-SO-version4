'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus, Search, Package, X, Loader2, Edit2, Trash2,
  Sparkles, Calculator, TrendingUp, AlertTriangle, CheckCircle,
  Info, ShoppingCart, Globe, Target, ChevronRight, Tag, FolderOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import type { ApiResponse, Product, ProductCategory } from '@/types/api';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTS PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function ProductsPage() {
  const t = useT();
  const { role } = usePermissions();

  const roleCode = role?.code ?? '';
  const canManage = roleCode === 'ADMIN' || roleCode === 'CEO';

  const [list, setList]               = useState<Product[]>([]);
  const [categories, setCategories]   = useState<ProductCategory[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filterCat, setFilterCat]     = useState('');
  const [showCreate, setShowCreate]   = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [showCatMgr, setShowCatMgr]   = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<ProductCategory[]>>('/product-categories?includeInactive=true');
      setCategories(res.data.data ?? []);
    } catch { /* silent */ }
  }, []);

  const load = useCallback(async (q: string, catId: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('search', q);
      if (catId) params.set('categoryId', catId);
      params.set('limit', '100');
      const res = await api.get<ApiResponse<Product[]>>(`/products?${params}`);
      setList(res.data.data ?? []);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  useEffect(() => {
    const handler = setTimeout(() => load(search, filterCat), 300);
    return () => clearTimeout(handler);
  }, [search, filterCat, load]);

  const handleCloseCreate = useCallback(() => setShowCreate(false), []);
  const handleSavedCreate = useCallback(() => { setShowCreate(false); load(search, filterCat); }, [load, search, filterCat]);
  const handleCloseEdit   = useCallback(() => setEditingId(null), []);
  const handleSavedEdit   = useCallback(() => { setEditingId(null); load(search, filterCat); }, [load, search, filterCat]);

  const remove = async (id: string, name: string) => {
    if (!confirm(`ลบสินค้า "${name}" ใช่หรือไม่?`)) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success('ลบสินค้าแล้ว');
      load(search, filterCat);
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
        <div className="flex gap-2">
          {canManage && (
            <Button variant="outline" onClick={() => setShowCatMgr(true)}>
              <Tag className="h-4 w-4" />จัดการประเภท
            </Button>
          )}
          {canManage && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />{t('product.newProduct')}
            </Button>
          )}
        </div>
      </div>

      {/* Search + Category Filter */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`${t('common.search')}... (SKU, name)`}
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* Category filter chips */}
          {categories.filter(c => c.isActive).length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterCat('')}
                className={cn(
                  'text-xs px-3 py-1 rounded-full border transition-colors',
                  filterCat === ''
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-muted',
                )}
              >
                ทั้งหมด
              </button>
              {categories.filter(c => c.isActive).map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setFilterCat(filterCat === cat.id ? '' : cat.id)}
                  className={cn(
                    'text-xs px-3 py-1 rounded-full border transition-colors',
                    filterCat === cat.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-muted',
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
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
                    {p.category && (
                      <Badge variant="secondary" className="text-[10px] mt-0.5 h-4">
                        <Tag className="h-2.5 w-2.5 mr-1" />{p.category.name}
                      </Badge>
                    )}
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
        <ProductModal
          mode="create" categories={categories}
          onClose={handleCloseCreate} onSaved={handleSavedCreate}
        />
      )}
      {editingId && (
        <ProductModal
          mode="edit" id={editingId} categories={categories}
          onClose={handleCloseEdit} onSaved={handleSavedEdit}
        />
      )}
      {showCatMgr && (
        <CategoryManagerModal
          categories={categories}
          onClose={() => setShowCatMgr(false)}
          onChanged={loadCategories}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY MANAGER MODAL
// ═══════════════════════════════════════════════════════════════════════════

function CategoryManagerModal({
  categories, onClose, onChanged,
}: {
  categories: ProductCategory[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [newName, setNewName]   = useState('');
  const [newDesc, setNewDesc]   = useState('');
  const [saving, setSaving]     = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  const create = async () => {
    if (!newName.trim()) { toast.error('กรุณาระบุชื่อประเภท'); return; }
    setSaving(true);
    try {
      await api.post('/product-categories', { name: newName.trim(), description: newDesc.trim() || null });
      toast.success(`เพิ่มประเภท "${newName}" แล้ว`);
      setNewName('');
      setNewDesc('');
      onChanged();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (cat: ProductCategory) => {
    if (!confirm(`ลบประเภท "${cat.name}" ใช่หรือไม่?`)) return;
    try {
      await api.delete(`/product-categories/${cat.id}`);
      toast.success('ลบประเภทแล้ว');
      onChanged();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-md bg-background rounded-2xl shadow-2xl border border-border/60">
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-violet-500 via-purple-400 to-violet-600" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
              <FolderOpen className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold">จัดการประเภทสินค้า</h2>
              <p className="text-xs text-muted-foreground">{categories.length} ประเภท</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Add new */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
            <Label className="text-xs font-semibold">เพิ่มประเภทใหม่</Label>
            <Input
              placeholder="ชื่อประเภท เช่น Electronics, Furniture"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
              className="h-9 text-sm"
            />
            <Input
              placeholder="คำอธิบาย (ถ้ามี)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="h-9 text-sm"
            />
            <Button onClick={create} disabled={saving} size="sm" className="w-full">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              เพิ่มประเภท
            </Button>
          </div>

          {/* Existing list */}
          {categories.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">ยังไม่มีประเภทสินค้า</div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-background"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{cat.name}</div>
                    {cat.description && <div className="text-xs text-muted-foreground">{cat.description}</div>}
                    {cat._count !== undefined && (
                      <div className="text-xs text-muted-foreground">{cat._count.products} สินค้า</div>
                    )}
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => remove(cat)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
  targetMarginPct: number;
}

interface PricingResult {
  baseCost: number;
  minPrice: number;
  suggestedPrice: number;
  actualMarginPct: number;        // margin at last price (if available), else at standard price
  lastPriceMarginPct: number | null;
  marketPriceMarginPct: number | null;
  barSugPct: number;
  marketBarPct: number | null;
  lastBarPct: number | null;
  insights: { type: 'ok' | 'warn' | 'info'; text: string }[];
}

type ModalView = 'form' | 'analyzer';

// ═══════════════════════════════════════════════════════════════════════════
// PRICING ENGINE
// ═══════════════════════════════════════════════════════════════════════════

function runPricingEngine(p: PricingInputs): PricingResult | null {
  const { costPrice, lastPrice, marketPrice, targetMarginPct } = p;
  if (!costPrice && !lastPrice && !marketPrice) return null;

  const insights: PricingResult['insights'] = [];
  let sug = 0;
  let minP = 0;

  if (costPrice > 0) {
    minP = Math.round(costPrice / (1 - targetMarginPct / 100));
    sug  = minP;
    insights.push({ type: 'ok', text: 'คำนวณจากต้นทุน + target margin — ราคาขั้นต่ำที่ยังได้กำไรตามเป้าหมาย' });

    if (lastPrice > 0) {
      const ratio = lastPrice / sug;
      if (ratio > 1.1)
        insights.push({ type: 'ok',   text: `Last price สูงกว่า standard ${((ratio - 1) * 100).toFixed(0)}% — ลูกค้าเคยยอมรับราคาที่สูงกว่า อาจเพิ่ม margin ได้` });
      else if (ratio > 1.02)
        insights.push({ type: 'info', text: `Last price สูงกว่า standard ${((ratio - 1) * 100).toFixed(0)}% — ราคาที่เคยขายสอดคล้องกับ standard` });
      else if (ratio >= 0.93)
        insights.push({ type: 'ok',   text: `Last price ใกล้เคียง standard (${ratio >= 1 ? '+' : ''}${((ratio - 1) * 100).toFixed(0)}%) — ราคาสอดคล้องกับประสบการณ์การขาย` });
      else
        insights.push({ type: 'warn', text: `Last price ต่ำกว่า standard ${((1 - ratio) * 100).toFixed(0)}% — เคยขายต่ำกว่าเป้า ตรวจสอบเหตุผล (ส่วนลดพิเศษ / ต้นทุนสูงขึ้น?)` });
    }
  } else if (lastPrice > 0) {
    minP = lastPrice;
    sug  = lastPrice;
    insights.push({ type: 'warn', text: 'ไม่มีต้นทุน — ใช้ Last price เป็นฐานอ้างอิง ยืนยัน margin ไม่ได้ ควรใส่ Cost price ก่อน' });
  } else {
    sug = Math.round(marketPrice * 0.9);
    insights.push({ type: 'warn', text: 'ไม่มีข้อมูลต้นทุน — ยืนยัน margin ไม่ได้ ควรใส่ Cost price ก่อน' });
  }

  if (marketPrice > 0 && sug > 0) {
    const ratio = sug / marketPrice;
    if (ratio > 1.15)
      insights.push({ type: 'warn', text: `ราคาสูงกว่าตลาด ${((ratio - 1) * 100).toFixed(0)}% — ควรลด target margin หรือเพิ่ม value proposition` });
    else if (ratio > 1.02)
      insights.push({ type: 'info', text: `ราคาสูงกว่าตลาด ${((ratio - 1) * 100).toFixed(0)}% — premium positioning ตรวจสอบว่าตลาดยอมรับได้` });
    else if (ratio >= 0.88)
      insights.push({ type: 'ok',   text: `ราคาต่ำกว่าตลาด ${((1 - ratio) * 100).toFixed(0)}% — แข่งขันได้ดี มีโอกาสปิดการขาย` });
    else
      insights.push({ type: 'info', text: `ราคาต่ำกว่าตลาดมาก ${((1 - ratio) * 100).toFixed(0)}% — พิจารณาเพิ่ม target margin` });
  }

  // Margin at last price (real historical margin — most useful metric)
  const lastPriceMarginPct  = costPrice > 0 && lastPrice > 0   ? ((lastPrice   - costPrice) / lastPrice)   * 100 : null;
  const marketPriceMarginPct = costPrice > 0 && marketPrice > 0 ? ((marketPrice - costPrice) / marketPrice) * 100 : null;

  if (costPrice > 0) {
    if (lastPriceMarginPct !== null) {
      const gap = (targetMarginPct - lastPriceMarginPct).toFixed(1);
      if (lastPriceMarginPct >= targetMarginPct)
        insights.push({ type: 'ok',   text: `margin ที่ last price ${lastPriceMarginPct.toFixed(1)}% ≥ target ${targetMarginPct}% ✓ — ราคาเดิมทำกำไรได้ตามเป้า` });
      else if (lastPriceMarginPct > 0)
        insights.push({ type: 'warn', text: `margin ที่ last price ${lastPriceMarginPct.toFixed(1)}% ต่ำกว่า target ${gap}% — ควรปรับราคาขึ้น หรือลดต้นทุน` });
      else
        insights.push({ type: 'warn', text: `last price ต่ำกว่าต้นทุน (margin ${lastPriceMarginPct.toFixed(1)}%) — ขายแล้วขาดทุน` });
    }
    if (marketPriceMarginPct !== null) {
      if (marketPriceMarginPct >= targetMarginPct)
        insights.push({ type: 'ok',   text: `margin ถ้าขาย market price ${marketPriceMarginPct.toFixed(1)}% ≥ target ${targetMarginPct}% ✓` });
      else if (marketPriceMarginPct > 0)
        insights.push({ type: 'info', text: `margin ถ้าขาย market price ${marketPriceMarginPct.toFixed(1)}% — ราคาตลาดยังต่ำกว่า target ${(targetMarginPct - marketPriceMarginPct).toFixed(1)}%` });
      else
        insights.push({ type: 'warn', text: `market price ต่ำกว่าต้นทุน — ขายที่ราคาตลาดแล้วขาดทุน` });
    }
  }

  // actualMarginPct = last price margin if available (meaningful), else standard price margin
  const actualMarginPct = lastPriceMarginPct !== null ? lastPriceMarginPct
    : costPrice > 0 && sug > 0 ? ((sug - costPrice) / sug) * 100 : 0;

  const hi = Math.max(sug, marketPrice || 0, lastPrice || 0, minP) * 1.1 || 1;
  const lo = Math.max(minP * 0.85, 0);
  const rng = hi - lo || 1;
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - lo) / rng) * 100));
  const barSugPct    = pct(sug);
  const marketBarPct = marketPrice > 0 ? pct(marketPrice) : null;
  const lastBarPct   = lastPrice > 0   ? pct(lastPrice)   : null;

  return { baseCost: costPrice || lastPrice, minPrice: minP, suggestedPrice: sug, actualMarginPct, lastPriceMarginPct, marketPriceMarginPct, barSugPct, marketBarPct, lastBarPct, insights };
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
    costPrice: 0, lastPrice: 0, marketPrice: 0, targetMarginPct: 30,
  });
  const [result,   setResult]   = useState<PricingResult | null>(null);
  const [hasInput, setHasInput] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const update = (k: keyof PricingInputs, v: number) => {
    const next     = { ...inputs, [k]: v };
    const r        = runPricingEngine(next);
    const anyInput = !!(next.costPrice || next.lastPrice || next.marketPrice);
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
            <TrendingUp className="h-3 w-3" /> Last price
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">฿</span>
            <Input type="number" min="0" placeholder="0" className="pl-6 h-9 text-sm"
              onChange={(e) => update('lastPrice', parseFloat(e.target.value) || 0)} />
          </div>
        </div>

        <div className="space-y-1.5 col-span-2">
          <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
            <Globe className="h-3 w-3" /> Market price
            <span className="text-[10px] text-muted-foreground/70">(ราคาตลาด / ราคาคู่แข่ง)</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">฿</span>
            <Input type="number" min="0" placeholder="0" className="pl-6 h-9 text-sm"
              onChange={(e) => update('marketPrice', parseFloat(e.target.value) || 0)} />
          </div>
        </div>
      </div>

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

      {!hasInput && (
        <div className="py-6 text-center text-sm text-muted-foreground">
          <div className="text-2xl mb-2 opacity-30">↑</div>
          กรอกข้อมูลด้านบนเพื่อดูผลการวิเคราะห์
        </div>
      )}

      {result && (
        <div ref={resultRef} className="space-y-3">
          {(() => {
            const lastM  = result.lastPriceMarginPct;
            const mktM   = result.marketPriceMarginPct;
            const col4Label = lastM !== null ? 'margin @ last' : mktM !== null ? 'margin @ ตลาด' : 'margin @ standard';
            const col4Pct   = lastM !== null ? lastM : mktM !== null ? mktM : result.actualMarginPct;
            const col4Color = col4Pct >= inputs.targetMarginPct
              ? 'text-emerald-600 dark:text-emerald-400'
              : col4Pct > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-red-500';
            return (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'ต้นทุน',        value: result.baseCost,       pct: null, color: 'text-foreground',  highlight: false },
                  { label: 'target price',   value: result.minPrice,       pct: null, color: 'text-violet-600 dark:text-violet-400', highlight: false },
                  { label: 'standard price', value: result.suggestedPrice, pct: null, color: 'text-primary',     highlight: true  },
                  { label: col4Label,        value: null,                  pct: col4Pct, color: col4Color,       highlight: false },
                ].map((m, i) => (
                  <div key={i} className={cn('rounded-xl p-2.5 text-center transition-all duration-300',
                    m.highlight ? 'bg-primary/10 ring-1 ring-primary/30 dark:bg-primary/20' : 'bg-muted/60')}>
                    <div className="text-[10px] text-muted-foreground mb-1">{m.label}</div>
                    <div className={cn('text-sm font-bold tabular-nums', m.color)}>
                      {m.value !== null ? <AnimatedPrice value={m.value} /> : `${m.pct?.toFixed(1)}%`}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="space-y-1.5">
            <div className="relative h-2 bg-muted rounded-full overflow-visible">
              <div className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${result.barSugPct}%` }} />
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-primary ring-2 ring-background transition-all duration-500 shadow-sm"
                style={{ left: `${result.barSugPct}%` }} />
              {result.lastBarPct !== null && (
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-violet-500 ring-2 ring-background transition-all duration-500"
                  style={{ left: `${result.lastBarPct}%` }} />
              )}
              {result.marketBarPct !== null && (
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-amber-400 ring-2 ring-background transition-all duration-500"
                  style={{ left: `${result.marketBarPct}%` }} />
              )}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{result.minPrice ? formatMoney(result.minPrice) : ''}</span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-primary" /> standard
                </span>
                {result.lastBarPct !== null && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-violet-500" /> last
                  </span>
                )}
                {result.marketBarPct !== null && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> ตลาด
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 dark:bg-muted/20 divide-y divide-border/50">
            {result.insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2.5 px-3 py-2 text-xs text-muted-foreground">
                <InsightIcon type={ins.type} />
                <span>{ins.text}</span>
              </div>
            ))}
          </div>

          <Button
            className="w-full h-10 gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 shadow-sm transition-all duration-200 hover:shadow-emerald-500/25 hover:shadow-lg"
            onClick={() => onUseSuggested(result.suggestedPrice, result.baseCost)}
          >
            <CheckCircle className="h-4 w-4" />
            ใช้ standard price — {formatMoney(result.suggestedPrice)}
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
  mode, id, categories, onClose, onSaved,
}: {
  mode: 'create' | 'edit';
  id?: string;
  categories: ProductCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState({
    sku: '', name: '', description: '', unitPrice: 0, unit: 'pcs', categoryId: '',
  });
  const [loading,       setLoading]       = useState(mode === 'edit');
  const [submitting,    setSubmitting]    = useState(false);
  const [view,          setView]          = useState<ModalView>('form');
  const [liveMargin,    setLiveMargin]    = useState<string | null>(null);
  const [costForMargin, setCostForMargin] = useState(0);
  const backdropRef = useRef<HTMLDivElement>(null);

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
          categoryId: p.categoryId || '',
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
      const payload = {
        ...form,
        categoryId: form.categoryId || null,
      };
      if (mode === 'create') {
        await api.post('/products', payload);
        toast.success('สร้างสินค้าสำเร็จ');
      } else if (id) {
        await api.patch(`/products/${id}`, payload);
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

  const activeCategories = categories.filter(c => c.isActive);

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

                  {/* Category selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Tag className="h-3 w-3" /> ประเภทสินค้า
                    </Label>
                    <select
                      value={form.categoryId}
                      onChange={(e) => update('categoryId', e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1
                                 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1
                                 focus-visible:ring-ring"
                    >
                      <option value="">— ไม่ระบุประเภท —</option>
                      {activeCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
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
