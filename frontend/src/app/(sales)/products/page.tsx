'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Plus, Search, Package, X, Loader2, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/utils';
import type { ApiResponse, Product } from '@/types/api';
import { usePermissions } from '@/hooks/use-permissions';

export default function ProductsPage() {
  const t = useT();
  const { can } = usePermissions();
  const canManage = can('product', 'create', 'ALL');

  const [list, setList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async (q: string) => {
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
  };

  useEffect(() => {
    const handler = setTimeout(() => load(search), 300);
    return () => clearTimeout(handler);
  }, [search]);

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('product.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{list.length} products</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {t('product.newProduct')}
          </Button>
        )}
      </div>

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

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
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
                      <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {p.description}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-lg font-bold text-primary">
                        {formatMoney(p.unitPrice)}
                        <span className="text-xs text-muted-foreground font-normal ml-1">
                          / {p.unit}
                        </span>
                      </div>
                      {canManage && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditingId(p.id)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => remove(p.id, p.name)}
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

      {showCreate && (
        <ProductModal
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            load(search);
          }}
        />
      )}

      {editingId && (
        <ProductModal
          mode="edit"
          id={editingId}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            load(search);
          }}
        />
      )}
    </div>
  );
}

function ProductModal({
  mode,
  id,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  id?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState({
    sku: '',
    name: '',
    description: '',
    unitPrice: 0,
    unit: 'pcs',
  });
  const [loading, setLoading] = useState(mode === 'edit');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && id) {
      (async () => {
        try {
          const res = await api.get<ApiResponse<Product>>(`/products/${id}`);
          const p = res.data.data;
          if (p) {
            setForm({
              sku: p.sku,
              name: p.name,
              description: p.description || '',
              unitPrice: Number(p.unitPrice),
              unit: p.unit,
            });
          }
        } catch (err) {
          toast.error(getApiErrorMessage(err));
          onClose();
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [mode, id, onClose]);

  const submit = async () => {
    if (!form.sku || !form.name) {
      toast.error('SKU and Name are required');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'create') {
        await api.post('/products', form);
        toast.success('Product created');
      } else if (id) {
        await api.patch(`/products/${id}`, form);
        toast.success('Product updated');
      }
      onSaved();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <Card className="w-full max-w-md shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">
            {mode === 'create' ? t('product.newProduct') : 'แก้ไขสินค้า'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-md">
            <X className="h-5 w-5" />
          </button>
        </div>
        {loading ? (
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        ) : (
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">
                  {t('product.sku')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="mt-1.5"
                  autoFocus
                  placeholder="PRD-0001"
                />
              </div>
              <div>
                <Label className="text-xs">
                  {t('product.unitPrice')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitPrice}
                  onChange={(e) => setForm({ ...form, unitPrice: parseFloat(e.target.value) || 0 })}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">
                {t('product.name')} <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">{t('product.description')}</Label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="mt-1.5 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">หน่วย / Unit</Label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
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
            </div>
          </CardContent>
        )}
        <div className="flex justify-end gap-2 p-6 border-t">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} disabled={submitting || loading}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('common.save')}
          </Button>
        </div>
      </Card>
    </div>
  );
}