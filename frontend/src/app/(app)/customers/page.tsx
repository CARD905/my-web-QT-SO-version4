'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Users, X, Loader2, Edit2, Trash2, Lock, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { usePermissions } from '@/hooks/use-permissions';
import type { ApiResponse, Customer } from '@/types/api';

export default function CustomersPage() {
  const t = useT();
  const { role } = usePermissions();

  const roleCode = role?.code ?? '';
  const isAdmin   = roleCode === 'ADMIN';
  const isCEO     = roleCode === 'CEO';
  const isManager = roleCode === 'MANAGER';

  const canCreate = isAdmin || isCEO;
  const canEdit   = isAdmin || isCEO || isManager;
  const canDelete = isAdmin || isCEO;

  const [list, setList] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
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
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => load(search), 300);
    return () => clearTimeout(handler);
  }, [search, load]);

  const handleCloseCreate = useCallback(() => setShowCreate(false), []);
  const handleSavedCreate = useCallback(() => {
    setShowCreate(false);
    load(search);
  }, [load, search]);

  const handleCloseEdit = useCallback(() => setEditingId(null), []);
  const handleSavedEdit = useCallback(() => {
    setEditingId(null);
    load(search);
  }, [load, search]);

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
            <Plus className="h-4 w-4" />{t('customer.newCustomer')}
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
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
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
                      {c.contactName}{c.email && ` · ${c.email}`}{c.phone && ` · ${c.phone}`}
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
                    <Button variant="ghost" size="icon" onClick={() => setEditingId(c.id)} title="แก้ไข">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => remove(c.id, c.company)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="ลบ"
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
        <CustomerModal mode="create" isManager={false} onClose={handleCloseCreate} onSaved={handleSavedCreate} />
      )}
      {editingId && (
        <CustomerModal mode="edit" id={editingId} isManager={isManager} onClose={handleCloseEdit} onSaved={handleSavedEdit} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Customer Modal
// ════════════════════════════════════════════════════════════════════════════
function CustomerModal({ mode, id, isManager, onClose, onSaved }: {
  mode: 'create' | 'edit';
  id?: string;
  isManager: boolean;
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
  const [showEditRequest, setShowEditRequest] = useState(false);

  const restrictedForManager = isManager && mode === 'edit';

  useEffect(() => {
    if (mode !== 'edit' || !id) return;

    let cancelled = false;
    setLoading(true);

    api.get<ApiResponse<Customer>>(`/customers/${id}`)
      .then((res) => {
        if (cancelled) return;
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
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(getApiErrorMessage(err));
        onClose();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, id]);

  const update = (k: keyof typeof form, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.contactName || !form.company) {
      toast.error('Contact Name and Company are required');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'create') {
        await api.post('/customers', form);
        toast.success('สร้างลูกค้าสำเร็จ');
      } else if (id) {
        await api.patch(`/customers/${id}`, form);
        toast.success('แก้ไขลูกค้าสำเร็จ');
      }
      onSaved();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
        <Card className="w-full max-w-2xl shadow-2xl animate-slide-up">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-bold">
              {mode === 'create' ? t('customer.newCustomer') : 'แก้ไขลูกค้า'}
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-muted rounded-md"><X className="h-5 w-5" /></button>
          </div>

          {loading ? (
            <CardContent className="pt-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          ) : (
            <CardContent className="pt-6 space-y-4">
              {/* Restricted fields for manager — read-only with lock icon */}
              {restrictedForManager && (
                <div className="rounded-lg border border-muted bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" />
                      <span>ข้อมูลที่แก้ไขได้เฉพาะ Admin — ต้องขอแก้ไข</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5 border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
                      onClick={() => setShowEditRequest(true)}
                    >
                      <Send className="h-3 w-3" />
                      ขอแก้ไขข้อมูล
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('customer.contactName')}</Label>
                      <div className="mt-1.5 px-3 py-2 rounded-md border bg-background text-sm text-muted-foreground">
                        {form.contactName || '—'}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('customer.company')}</Label>
                      <div className="mt-1.5 px-3 py-2 rounded-md border bg-background text-sm text-muted-foreground">
                        {form.company || '—'}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">{t('customer.taxId')}</Label>
                      <div className="mt-1.5 px-3 py-2 rounded-md border bg-background text-sm text-muted-foreground">
                        {form.taxId || '—'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Editable fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {!restrictedForManager && (
                  <>
                    <div>
                      <Label className="text-xs">{t('customer.contactName')} <span className="text-destructive">*</span></Label>
                      <Input value={form.contactName} onChange={(e) => update('contactName', e.target.value)} className="mt-1.5" autoFocus />
                    </div>
                    <div>
                      <Label className="text-xs">{t('customer.company')} <span className="text-destructive">*</span></Label>
                      <Input value={form.company} onChange={(e) => update('company', e.target.value)} className="mt-1.5" />
                    </div>
                    <div>
                      <Label className="text-xs">{t('customer.taxId')}</Label>
                      <Input value={form.taxId} onChange={(e) => update('taxId', e.target.value)} className="mt-1.5" />
                    </div>
                  </>
                )}
                <div className={restrictedForManager ? '' : ''}>
                  <Label className="text-xs">{t('customer.email')}</Label>
                  <Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className="mt-1.5" autoFocus={restrictedForManager} />
                </div>
                <div>
                  <Label className="text-xs">{t('customer.phone')}</Label>
                  <Input value={form.phone} onChange={(e) => update('phone', e.target.value)} className="mt-1.5" />
                </div>
              </div>
              <div>
                <Label className="text-xs">{t('customer.billingAddress')}</Label>
                <Input value={form.billingAddress} onChange={(e) => update('billingAddress', e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">{t('customer.shippingAddress')}</Label>
                <Input value={form.shippingAddress} onChange={(e) => update('shippingAddress', e.target.value)} className="mt-1.5" />
              </div>
            </CardContent>
          )}

          <div className="flex justify-end gap-2 p-6 border-t">
            <Button variant="outline" onClick={onClose} disabled={submitting}>{t('common.cancel')}</Button>
            <Button onClick={submit} disabled={submitting || loading}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </div>
        </Card>
      </div>

      {showEditRequest && id && (
        <EditRequestDialog
          customerId={id}
          customerCompany={form.company}
          currentContactName={form.contactName}
          currentCompany={form.company}
          currentTaxId={form.taxId}
          onClose={() => setShowEditRequest(false)}
        />
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Edit Request Dialog — Manager sends change request to Admin
// ════════════════════════════════════════════════════════════════════════════
function EditRequestDialog({
  customerId,
  customerCompany,
  currentContactName,
  currentCompany,
  currentTaxId,
  onClose,
}: {
  customerId: string;
  customerCompany: string;
  currentContactName: string;
  currentCompany: string;
  currentTaxId: string;
  onClose: () => void;
}) {
  const [newContactName, setNewContactName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newTaxId, setNewTaxId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const buildRequestedChanges = () => {
    const lines: string[] = [];
    if (newContactName.trim()) lines.push(`Contact Name: "${currentContactName}" → "${newContactName.trim()}"`);
    if (newCompany.trim()) lines.push(`Company: "${currentCompany}" → "${newCompany.trim()}"`);
    if (newTaxId.trim()) lines.push(`Tax ID: "${currentTaxId || '(ว่าง)'}" → "${newTaxId.trim()}"`);
    return lines.join(', ');
  };

  const submit = async () => {
    const requestedChanges = buildRequestedChanges();
    if (!requestedChanges) {
      toast.error('กรุณาระบุข้อมูลที่ต้องการแก้ไข');
      return;
    }
    if (!reason.trim()) {
      toast.error('กรุณาระบุเหตุผลที่ต้องการแก้ไข');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/customers/${customerId}/edit-request`, {
        reason: reason.trim(),
        requestedChanges,
      });
      toast.success('ส่งคำขอแก้ไขไปยัง Admin แล้ว');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 animate-fade-in">
      <Card className="w-full max-w-lg shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-bold">ขอแก้ไขข้อมูลลูกค้า</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{customerCompany}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-md"><X className="h-5 w-5" /></button>
        </div>

        <CardContent className="pt-6 space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-medium">ข้อมูลที่ต้องการแก้ไข (ระบุเฉพาะที่ต้องการเปลี่ยน)</p>

            <div>
              <Label className="text-xs text-muted-foreground">Contact Name ปัจจุบัน: <span className="font-medium text-foreground">{currentContactName || '—'}</span></Label>
              <Input
                placeholder="ชื่อผู้ติดต่อใหม่ (เว้นว่างหากไม่ต้องการเปลี่ยน)"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Company ปัจจุบัน: <span className="font-medium text-foreground">{currentCompany || '—'}</span></Label>
              <Input
                placeholder="ชื่อบริษัทใหม่ (เว้นว่างหากไม่ต้องการเปลี่ยน)"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Tax ID ปัจจุบัน: <span className="font-medium text-foreground">{currentTaxId || '—'}</span></Label>
              <Input
                placeholder="Tax ID ใหม่ (เว้นว่างหากไม่ต้องการเปลี่ยน)"
                value={newTaxId}
                onChange={(e) => setNewTaxId(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium">เหตุผลที่ต้องการแก้ไข <span className="text-destructive">*</span></Label>
            <textarea
              placeholder="อธิบายเหตุผลที่ต้องการแก้ไขข้อมูล เช่น บริษัทเปลี่ยนชื่อ, ข้อมูลผิดพลาด ฯลฯ"
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>
        </CardContent>

        <div className="flex justify-end gap-2 p-6 border-t">
          <Button variant="outline" onClick={onClose} disabled={submitting}>ยกเลิก</Button>
          <Button onClick={submit} disabled={submitting} className="bg-amber-600 hover:bg-amber-700">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            ส่งคำขอแก้ไข
          </Button>
        </div>
      </Card>
    </div>
  );
}
