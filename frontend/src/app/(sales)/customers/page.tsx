'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Plus, Search, Users, X, Loader2, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { ApiResponse, Customer } from '@/types/api';

export default function CustomersPage() {
  const t = useT();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const canCreate = role === 'MANAGER' || role === 'ADMIN';
  const canEdit = role === 'SALES' || role === 'MANAGER' || role === 'ADMIN';
  const canDelete = role === 'MANAGER' || role === 'ADMIN';

  const [list, setList] = useState<Customer[]>([]);
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
      const res = await api.get<ApiResponse<Customer[]>>(`/customers?${params}`);
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

  const remove = async (id: string, company: string) => {
    if (!confirm(`ลบลูกค้า "${company}" ใช่หรือไม่?`)) return;
    try {
      await api.delete(`/customers/${id}`);
      toast.success('ลบลูกค้าแล้ว');
      load(search);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('customer.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{list.length} customers</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {t('customer.newCustomer')}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`${t('common.search')}...`}
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
            <Users className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t('common.noData')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.map((c) => (
            <Card key={c.id} className="group transition-all hover:border-primary/40">
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center shrink-0 font-semibold shadow-md">
                    {c.company.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold">{c.company}</div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {c.contactName} {c.email && `· ${c.email}`} {c.phone && `· ${c.phone}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c._count && (
                    <div className="text-xs text-muted-foreground hidden md:block">
                      {c._count.quotations} QT · {c._count.saleOrders} SO
                    </div>
                  )}
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingId(c.id)}
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(c.id, c.company)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <CustomerModal
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            load(search);
          }}
        />
      )}

      {editingId && (
        <CustomerModal
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

function CustomerModal({
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
    contactName: '',
    company: '',
    taxId: '',
    email: '',
    phone: '',
    billingAddress: '',
    shippingAddress: '',
  });
  const [loading, setLoading] = useState(mode === 'edit');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && id) {
      (async () => {
        try {
          const res = await api.get<ApiResponse<Customer>>(`/customers/${id}`);
          const c = res.data.data;
          if (c) {
            setForm({
              contactName: c.contactName,
              company: c.company,
              taxId: c.taxId || '',
              email: c.email || '',
              phone: c.phone || '',
              billingAddress: c.billingAddress || '',
              shippingAddress: c.shippingAddress || '',
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

  const update = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.contactName || !form.company) {
      toast.error('Contact Name and Company are required');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'create') {
        await api.post('/customers', form);
        toast.success('Customer created');
      } else if (id) {
        await api.patch(`/customers/${id}`, form);
        toast.success('Customer updated');
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
      <Card className="w-full max-w-2xl shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">
            {mode === 'create' ? t('customer.newCustomer') : 'แก้ไขลูกค้า'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-md">
            <X className="h-5 w-5" />
          </button>
        </div>
        {loading ? (
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        ) : (
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">
                  {t('customer.contactName')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.contactName}
                  onChange={(e) => update('contactName', e.target.value)}
                  className="mt-1.5"
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-xs">
                  {t('customer.company')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.company}
                  onChange={(e) => update('company', e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs">{t('customer.taxId')}</Label>
                <Input
                  value={form.taxId}
                  onChange={(e) => update('taxId', e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs">{t('customer.email')}</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs">{t('customer.phone')}</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t('customer.billingAddress')}</Label>
              <Input
                value={form.billingAddress}
                onChange={(e) => update('billingAddress', e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">{t('customer.shippingAddress')}</Label>
              <Input
                value={form.shippingAddress}
                onChange={(e) => update('shippingAddress', e.target.value)}
                className="mt-1.5"
              />
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