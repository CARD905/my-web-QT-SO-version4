'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Search, Users, X, Loader2, Edit2, Trash2, Lock,
  SendHorizonal, ChevronDown, ChevronRight, CheckCircle2, XCircle,
  Clock, AlertTriangle, User, Building2, FileText, Phone, Mail,
  MapPin, Hash,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { usePermissions } from '@/hooks/use-permissions';
import { formatDate } from '@/lib/utils';
import type { ApiResponse, Customer } from '@/types/api';

/* ── Types ── */
interface CustomerChangeRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string;
  changes: Record<string, string | null>;
  adminNote?: string | null;
  createdAt: string;
  requester: { id: string; name: string; email: string };
  reviewedBy?: { id: string; name: string } | null;
}

const CHANGE_FIELD_META: Record<string, { label: string; icon: React.ReactNode }> = {
  contactName:     { label: 'Contact Name',        icon: <User       className="h-3 w-3" /> },
  company:         { label: 'บริษัท',               icon: <Building2  className="h-3 w-3" /> },
  taxId:           { label: 'Tax ID',               icon: <Hash       className="h-3 w-3" /> },
  email:           { label: 'Email',                icon: <Mail       className="h-3 w-3" /> },
  phone:           { label: 'เบอร์โทร',              icon: <Phone      className="h-3 w-3" /> },
  billingAddress:  { label: 'ที่อยู่ออกใบเสร็จ',    icon: <MapPin     className="h-3 w-3" /> },
  shippingAddress: { label: 'ที่อยู่จัดส่ง',         icon: <MapPin     className="h-3 w-3" /> },
};

/* ── Main page ── */
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
  const canReview = isAdmin;

  const [list,       setList]       = useState<Customer[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId,  setEditingId]  = useState<string | null>(null);

  // Pending requests map: customerId → requests[]
  const [pendingMap,     setPendingMap]     = useState<Record<string, CustomerChangeRequest[]>>({});
  const [expandedIds,    setExpandedIds]    = useState<Set<string>>(new Set());
  const [loadingReqIds,  setLoadingReqIds]  = useState<Set<string>>(new Set());

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
  const handleSavedCreate = useCallback(() => { setShowCreate(false); load(search); }, [load, search]);
  const handleCloseEdit   = useCallback(() => setEditingId(null), []);
  const handleSavedEdit   = useCallback(() => { setEditingId(null); load(search); }, [load, search]);

  const remove = async (id: string, company: string) => {
    if (!confirm(`ลบลูกค้า "${company}" ใช่หรือไม่?`)) return;
    try {
      await api.delete(`/customers/${id}`);
      toast.success('ลบลูกค้าแล้ว');
      load(search);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };

  const toggleExpand = async (customerId: string) => {
    if (expandedIds.has(customerId)) {
      setExpandedIds((prev) => { const s = new Set(prev); s.delete(customerId); return s; });
      return;
    }
    setExpandedIds((prev) => new Set(prev).add(customerId));
    if (pendingMap[customerId]) return; // already loaded
    setLoadingReqIds((prev) => new Set(prev).add(customerId));
    try {
      const res = await api.get<ApiResponse<CustomerChangeRequest[]>>(
        `/customers/${customerId}/edit-requests?status=PENDING`,
      );
      setPendingMap((prev) => ({ ...prev, [customerId]: res.data.data ?? [] }));
    } catch {
      setPendingMap((prev) => ({ ...prev, [customerId]: [] }));
    } finally {
      setLoadingReqIds((prev) => { const s = new Set(prev); s.delete(customerId); return s; });
    }
  };

  const refreshRequests = async (customerId: string) => {
    try {
      const res = await api.get<ApiResponse<CustomerChangeRequest[]>>(
        `/customers/${customerId}/edit-requests?status=PENDING`,
      );
      setPendingMap((prev) => ({ ...prev, [customerId]: res.data.data ?? [] }));
    } catch { /* silent */ }
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
          {list.map((c) => {
            const requests  = pendingMap[c.id] ?? [];
            const isExpanded = expandedIds.has(c.id);
            const isLoadingReq = loadingReqIds.has(c.id);
            const pendingCount = requests.length;

            return (
              <Card key={c.id} className="group transition-all hover:border-primary/40 overflow-hidden">
                {/* ── Main row ── */}
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

                    {/* Admin: expand button with pending badge */}
                    {canReview && (
                      <button
                        onClick={() => toggleExpand(c.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors border ${
                          isExpanded
                            ? 'bg-orange-50 border-orange-200 text-orange-700'
                            : 'bg-slate-50 border-border/60 text-muted-foreground hover:text-foreground hover:bg-slate-100'
                        }`}
                        title="ดูคำขอแก้ไข"
                      >
                        {isLoadingReq
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5" />
                            : <ChevronRight className="h-3.5 w-3.5" />
                        }
                        คำขอแก้ไข
                        {pendingMap[c.id] !== undefined && pendingCount > 0 && (
                          <span className="h-4 min-w-[16px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {pendingCount}
                          </span>
                        )}
                      </button>
                    )}

                    {canEdit && (
                      <Button variant="ghost" size="icon" onClick={() => setEditingId(c.id)} title={isManager ? 'ดูข้อมูล / ขอแก้ไข' : 'แก้ไข'}>
                        {isManager ? <SendHorizonal className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
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

                {/* ── Expandable requests section ── */}
                {isExpanded && canReview && (
                  <div className="border-t border-orange-100 bg-orange-50/40">
                    {isLoadingReq ? (
                      <div className="px-5 py-4 flex gap-2 items-center text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />กำลังโหลด...
                      </div>
                    ) : requests.length === 0 ? (
                      <div className="px-5 py-4 text-sm text-muted-foreground flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />ไม่มีคำขอแก้ไขที่รอดำเนินการ
                      </div>
                    ) : (
                      <div className="divide-y divide-orange-100">
                        {requests.map((req) => (
                          <RequestRow
                            key={req.id}
                            request={req}
                            onActioned={() => refreshRequests(c.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
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

/* ── Request row (inside dropdown) ─────────────────────────────────────── */
function RequestRow({ request, onActioned }: {
  request: CustomerChangeRequest;
  onActioned: () => void;
}) {
  const [showReject, setShowReject]   = useState(false);
  const [rejectNote, setRejectNote]   = useState('');
  const [actioning,  setActioning]    = useState(false);

  const handleApprove = async () => {
    setActioning(true);
    try {
      await api.post(`/customers/edit-requests/${request.id}/approve`);
      toast.success('อนุมัติคำขอแล้ว — ข้อมูลลูกค้าถูกอัปเดต');
      onActioned();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setActioning(false); }
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) { toast.error('กรุณาระบุเหตุผล'); return; }
    setActioning(true);
    try {
      await api.post(`/customers/edit-requests/${request.id}/reject`, { note: rejectNote.trim() });
      toast.success('ปฏิเสธคำขอแล้ว');
      setShowReject(false);
      onActioned();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setActioning(false); }
  };

  return (
    <>
      <div className="px-5 py-3.5 flex items-start gap-4">
        {/* requester avatar */}
        <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0 mt-0.5">
          {request.requester.name.slice(0, 1).toUpperCase()}
        </div>

        {/* content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-foreground">{request.requester.name}</span>
            <span className="text-[11px] text-muted-foreground">· {formatDate(request.createdAt)}</span>
            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] py-0 px-1.5">
              <Clock className="h-2.5 w-2.5 mr-1" />รอดำเนินการ
            </Badge>
          </div>

          {/* reason */}
          <p className="text-[12px] text-slate-600 mt-1">
            <span className="font-medium">เหตุผล:</span> {request.reason}
          </p>

          {/* changes */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(request.changes).map(([key, value]) => {
              const meta = CHANGE_FIELD_META[key];
              return (
                <div key={key} className="inline-flex items-center gap-1 text-[11px] bg-white border border-orange-200 text-slate-700 px-2 py-1 rounded-md shadow-sm">
                  <span className="text-orange-500">{meta?.icon}</span>
                  <span className="font-semibold text-slate-500">{meta?.label ?? key}:</span>
                  <span className="font-medium">{value ?? <span className="italic text-muted-foreground">ลบออก</span>}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* action buttons */}
        <div className="flex gap-1.5 shrink-0">
          <Button
            size="sm"
            className="h-7 text-[11px] bg-green-600 hover:bg-green-700 gap-1"
            onClick={handleApprove}
            disabled={actioning}
          >
            {actioning ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            อนุมัติ
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] text-red-600 border-red-200 hover:bg-red-50 gap-1"
            onClick={() => setShowReject(true)}
            disabled={actioning}
          >
            <XCircle className="h-3 w-3" />ปฏิเสธ
          </Button>
        </div>
      </div>

      {/* Reject dialog */}
      <Dialog open={showReject} onOpenChange={(o) => { if (!o) { setShowReject(false); setRejectNote(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px]">
              <XCircle className="h-4 w-4 text-red-500" />ปฏิเสธคำขอแก้ไข
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              ระบุเหตุผลที่ปฏิเสธคำขอของ <strong>{request.requester.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs font-semibold">เหตุผล <span className="text-destructive">*</span></Label>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              placeholder="เช่น ข้อมูลไม่ถูกต้อง, ขอให้ยื่นเอกสารประกอบก่อน"
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setShowReject(false); setRejectNote(''); }} disabled={actioning}>
              ยกเลิก
            </Button>
            <Button variant="destructive" size="sm" onClick={handleReject} disabled={actioning || !rejectNote.trim()}>
              {actioning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              ยืนยันปฏิเสธ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Customer Modal
═══════════════════════════════════════════════════════════════════════════ */
function CustomerModal({ mode, id, isManager, onClose, onSaved }: {
  mode: 'create' | 'edit';
  id?: string;
  isManager: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState({
    contactName: '', company: '', taxId: '',
    email: '', phone: '', billingAddress: '', shippingAddress: '',
  });
  const [loading,          setLoading]          = useState(mode === 'edit');
  const [submitting,       setSubmitting]       = useState(false);
  const [showEditRequest,  setShowEditRequest]  = useState(false);

  const readOnly = isManager && mode === 'edit';

  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    let cancelled = false;
    setLoading(true);
    api.get<ApiResponse<Customer>>(`/customers/${id}`)
      .then((res) => {
        if (cancelled) return;
        const c = res.data.data;
        if (c) setForm({
          contactName: c.contactName, company: c.company, taxId: c.taxId || '',
          email: c.email || '', phone: c.phone || '',
          billingAddress: c.billingAddress || '', shippingAddress: c.shippingAddress || '',
        });
      })
      .catch((err) => { if (cancelled) return; toast.error(getApiErrorMessage(err)); onClose(); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, id]);

  const update = (k: keyof typeof form, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.contactName || !form.company) { toast.error('Contact Name and Company are required'); return; }
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
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setSubmitting(false); }
  };

  const FIELD_ROWS: { key: keyof typeof form; label: string; type?: string; wide?: boolean }[] = [
    { key: 'contactName',    label: t('customer.contactName') },
    { key: 'company',        label: t('customer.company') },
    { key: 'taxId',          label: t('customer.taxId') },
    { key: 'email',          label: t('customer.email'),   type: 'email' },
    { key: 'phone',          label: t('customer.phone') },
    { key: 'billingAddress', label: t('customer.billingAddress'),  wide: true },
    { key: 'shippingAddress',label: t('customer.shippingAddress'), wide: true },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
        <Card className="w-full max-w-2xl shadow-2xl animate-slide-up max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-6 border-b shrink-0">
            <div className="flex items-center gap-2">
              {readOnly && <Lock className="h-4 w-4 text-muted-foreground" />}
              <h2 className="text-xl font-bold">
                {mode === 'create' ? t('customer.newCustomer') : readOnly ? 'ข้อมูลลูกค้า' : 'แก้ไขลูกค้า'}
              </h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-muted rounded-md">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : readOnly ? (
              /* ── Read-only view for manager ── */
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-700">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  ข้อมูลลูกค้าแก้ไขได้เฉพาะ Admin — กรุณายื่นคำขอแก้ไขผ่านปุ่มด้านล่าง
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {FIELD_ROWS.map(({ key, label, wide }) => (
                    <div key={key} className={wide ? 'md:col-span-2' : ''}>
                      <Label className="text-xs text-muted-foreground">{label}</Label>
                      <div className="mt-1 px-3 py-2 rounded-md border bg-muted/30 text-sm min-h-[38px]">
                        {form[key] || <span className="text-muted-foreground">—</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* ── Editable form (admin/CEO) ── */
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div>
                    <Label className="text-xs">{t('customer.email')}</Label>
                    <Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className="mt-1.5" />
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
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 p-6 border-t shrink-0">
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              {readOnly ? 'ปิด' : t('common.cancel')}
            </Button>
            {readOnly ? (
              <Button onClick={() => setShowEditRequest(true)} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
                <SendHorizonal className="h-4 w-4" />ขอแก้ไขข้อมูล
              </Button>
            ) : (
              <Button onClick={submit} disabled={submitting || loading}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('common.save')}
              </Button>
            )}
          </div>
        </Card>
      </div>

      {showEditRequest && id && (
        <EditRequestDialog
          customerId={id}
          current={form}
          onClose={() => setShowEditRequest(false)}
          onSent={() => { setShowEditRequest(false); onClose(); }}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Edit Request Dialog
═══════════════════════════════════════════════════════════════════════════ */
type CustomerFormData = {
  contactName: string; company: string; taxId: string;
  email: string; phone: string; billingAddress: string; shippingAddress: string;
};

function EditRequestDialog({
  customerId, current, onClose, onSent,
}: {
  customerId: string;
  current: CustomerFormData;
  onClose: () => void;
  onSent: () => void;
}) {
  const t = useT();
  const [changes,    setChanges]    = useState<Partial<CustomerFormData>>({});
  const [reason,     setReason]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (k: keyof CustomerFormData, v: string) =>
    setChanges((prev) => ({ ...prev, [k]: v }));

  const FIELDS: { key: keyof CustomerFormData; label: string; type?: string; wide?: boolean }[] = [
    { key: 'contactName',     label: t('customer.contactName') },
    { key: 'company',         label: t('customer.company') },
    { key: 'taxId',           label: t('customer.taxId') },
    { key: 'email',           label: t('customer.email'),  type: 'email' },
    { key: 'phone',           label: t('customer.phone') },
    { key: 'billingAddress',  label: t('customer.billingAddress'),  wide: true },
    { key: 'shippingAddress', label: t('customer.shippingAddress'), wide: true },
  ];

  const buildPayload = () => {
    const out: Record<string, string> = {};
    for (const { key } of FIELDS) {
      const val = changes[key];
      if (val !== undefined && val.trim() !== '') out[key] = val.trim();
    }
    return out;
  };

  const submit = async () => {
    const payload = buildPayload();
    if (Object.keys(payload).length === 0) {
      toast.error('กรุณาระบุข้อมูลที่ต้องการแก้ไขอย่างน้อย 1 รายการ');
      return;
    }
    if (!reason.trim()) { toast.error('กรุณาระบุเหตุผล'); return; }
    setSubmitting(true);
    try {
      await api.post(`/customers/${customerId}/edit-request`, {
        reason: reason.trim(),
        changes: payload,
      });
      toast.success('ส่งคำขอแก้ไขไปยัง Admin แล้ว');
      onSent();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 animate-fade-in">
      <Card className="w-full max-w-lg shadow-2xl animate-slide-up max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <SendHorizonal className="h-4 w-4 text-blue-500" />ขอแก้ไขข้อมูลลูกค้า
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">{current.company}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-md"><X className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <div>
            <Label className="text-xs font-semibold">
              เหตุผลที่ต้องการแก้ไข <span className="text-destructive">*</span>
            </Label>
            <textarea
              placeholder="เช่น บริษัทเปลี่ยนชื่อ, ข้อมูลผิดพลาด, อัปเดตที่อยู่ใหม่ ฯลฯ"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            ข้อมูลที่ต้องการเปลี่ยน (เว้นว่างหากไม่ต้องการเปลี่ยน)
          </div>

          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map(({ key, label, type, wide }) => (
              <div key={key} className={wide ? 'col-span-2' : ''}>
                <Label className="text-xs">
                  {label}
                  {current[key] && (
                    <span className="ml-1 text-muted-foreground font-normal">(ปัจจุบัน: {current[key]})</span>
                  )}
                </Label>
                <Input
                  type={type ?? 'text'}
                  value={changes[key] ?? ''}
                  onChange={(e) => update(key, e.target.value)}
                  placeholder={`${label}ใหม่...`}
                  className="mt-1.5 h-9 text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-6 border-t shrink-0">
          <Button variant="outline" onClick={onClose} disabled={submitting}>ยกเลิก</Button>
          <Button onClick={submit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
            ส่งคำขอแก้ไข
          </Button>
        </div>
      </Card>
    </div>
  );
}
