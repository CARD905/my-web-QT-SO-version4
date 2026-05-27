'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Inbox, CheckCircle2, XCircle, Clock, User, ChevronRight,
  RefreshCw, Loader2, AlertTriangle, Shield, Mail, Phone,
  DollarSign, ToggleLeft,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';

/* ── Types ── */
interface ChangeRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string;
  changes: Record<string, unknown>;
  adminNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  targetUser: { id: string; name: string; email: string; role: { code: string; nameTh: string } };
  requester: { id: string; name: string; email: string };
  reviewedBy?: { id: string; name: string } | null;
}

interface PaginationMeta { total: number; page: number; limit: number; totalPages: number; }

/* ── Change field labels ── */
const CHANGE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  name:          { label: 'ชื่อ',           icon: <User className="h-3 w-3" /> },
  email:         { label: 'Email',           icon: <Mail className="h-3 w-3" /> },
  phone:         { label: 'เบอร์โทร',        icon: <Phone className="h-3 w-3" /> },
  roleId:        { label: 'Role',            icon: <Shield className="h-3 w-3" /> },
  isActive:      { label: 'สถานะ Account',   icon: <ToggleLeft className="h-3 w-3" /> },
  approvalLimit: { label: 'Approval Limit',  icon: <DollarSign className="h-3 w-3" /> },
};

function formatChangeValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return 'ลบออก (null)';
  if (key === 'isActive') return value ? 'เปิดใช้งาน (Active)' : 'ปิดใช้งาน (Inactive)';
  if (key === 'approvalLimit') return `฿${Number(value).toLocaleString()}`;
  return String(value);
}

/* ── Status badge ── */
function StatusBadge({ status }: { status: string }) {
  if (status === 'PENDING')  return <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[11px]"><Clock className="h-3 w-3 mr-1" />รอดำเนินการ</Badge>;
  if (status === 'APPROVED') return <Badge className="bg-green-50 text-green-700 border-green-200 text-[11px]"><CheckCircle2 className="h-3 w-3 mr-1" />อนุมัติแล้ว</Badge>;
  return <Badge className="bg-red-50 text-red-700 border-red-200 text-[11px]"><XCircle className="h-3 w-3 mr-1" />ปฏิเสธแล้ว</Badge>;
}

/* ── Main page ── */
export default function ChangeRequestsPage() {
  const [items,         setItems]         = useState<ChangeRequest[]>([]);
  const [meta,          setMeta]          = useState<PaginationMeta | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [statusFilter,  setStatusFilter]  = useState<string>('PENDING');
  const [page,          setPage]          = useState(1);

  const [selected,      setSelected]      = useState<ChangeRequest | null>(null);
  const [showApprove,   setShowApprove]   = useState(false);
  const [showReject,    setShowReject]    = useState(false);
  const [rejectNote,    setRejectNote]    = useState('');
  const [actioning,     setActioning]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter, page: String(page), limit: '20' });
      const res = await api.get<any>(`/admin/change-requests?${params}`);
      setItems(res.data.data ?? []);
      setMeta(res.data.meta ?? null);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [statusFilter]);

  const handleApprove = async () => {
    if (!selected) return;
    setActioning(true);
    try {
      await api.post(`/admin/change-requests/${selected.id}/approve`);
      toast.success('อนุมัติคำขอเรียบร้อย');
      setShowApprove(false);
      setSelected(null);
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setActioning(false); }
  };

  const handleReject = async () => {
    if (!selected || !rejectNote.trim()) { toast.error('กรุณาระบุเหตุผลที่ปฏิเสธ'); return; }
    setActioning(true);
    try {
      await api.post(`/admin/change-requests/${selected.id}/reject`, { note: rejectNote.trim() });
      toast.success('ปฏิเสธคำขอเรียบร้อย');
      setShowReject(false);
      setSelected(null);
      setRejectNote('');
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setActioning(false); }
  };

  const TABS = [
    { key: 'PENDING',  label: 'รอดำเนินการ', color: 'text-amber-600' },
    { key: 'APPROVED', label: 'อนุมัติแล้ว',  color: 'text-green-600' },
    { key: 'REJECTED', label: 'ปฏิเสธแล้ว',  color: 'text-red-600'   },
  ];

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Inbox className="h-5 w-5 text-orange-500" />คำขอแก้ไขข้อมูลผู้ใช้
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manager ยื่นคำขอมาเพื่อขอแก้ไขข้อมูลสมาชิกในทีม
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />รีเฟรช
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/60">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === tab.key
                ? `border-primary ${tab.color}`
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[0,1,2,3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">ไม่มีคำขอในสถานะนี้</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="border border-border/60 shadow-none rounded-xl hover:border-border transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">

                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 shrink-0">
                    {item.targetUser.name.slice(0, 1).toUpperCase()}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{item.targetUser.name}</span>
                      <Badge variant="secondary" className="text-[11px] px-1.5 py-0">{item.targetUser.role.nameTh}</Badge>
                      <StatusBadge status={item.status} />
                    </div>

                    <p className="text-xs text-muted-foreground mt-0.5">
                      ยื่นโดย <span className="font-medium text-foreground">{item.requester.name}</span>
                      {' · '}{formatDate(item.createdAt)}
                    </p>

                    {/* Reason */}
                    <div className="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                      <span className="font-semibold text-slate-500">เหตุผล:</span> {item.reason}
                    </div>

                    {/* Proposed changes */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(item.changes).map(([key, value]) => {
                        const meta = CHANGE_LABELS[key];
                        return (
                          <div key={key} className="inline-flex items-center gap-1.5 text-[11px] bg-blue-50 border border-blue-100 text-blue-700 px-2 py-1 rounded-md">
                            {meta?.icon}
                            <span className="font-semibold">{meta?.label ?? key}:</span>
                            <span>{formatChangeValue(key, value)}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Admin note (if reviewed) */}
                    {item.adminNote && (
                      <div className="mt-2 text-xs text-slate-500 flex items-start gap-1.5">
                        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                        <span>หมายเหตุ Admin: {item.adminNote}</span>
                        {item.reviewedBy && <span className="ml-1">— {item.reviewedBy.name}</span>}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {item.status === 'PENDING' && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        className="h-8 text-[12px] bg-green-600 hover:bg-green-700 gap-1.5"
                        onClick={() => { setSelected(item); setShowApprove(true); }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />อนุมัติ
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-[12px] text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
                        onClick={() => { setSelected(item); setShowReject(true); }}
                      >
                        <XCircle className="h-3.5 w-3.5" />ปฏิเสธ
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            ← ก่อนหน้า
          </Button>
          <span className="text-sm text-muted-foreground">หน้า {page} / {meta.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}>
            ถัดไป →
          </Button>
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog open={showApprove} onOpenChange={(o) => { if (!o) { setShowApprove(false); setSelected(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />อนุมัติคำขอแก้ไข
            </DialogTitle>
            <DialogDescription>
              การอนุมัติจะนำการเปลี่ยนแปลงไปใช้กับ Account ของ{' '}
              <strong>{selected?.targetUser.name}</strong> ทันที
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground bg-slate-50 rounded-lg px-3 py-2">
                <p className="font-semibold text-slate-600 mb-1">เหตุผล:</p>
                <p>{selected.reason}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">การเปลี่ยนแปลงที่จะนำไปใช้:</p>
                <div className="space-y-1.5">
                  {Object.entries(selected.changes).map(([key, value]) => {
                    const m = CHANGE_LABELS[key];
                    return (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground w-28 shrink-0">
                          {m?.icon}{m?.label ?? key}
                        </span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-foreground">{formatChangeValue(key, value)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowApprove(false); setSelected(null); }} disabled={actioning}>
              ยกเลิก
            </Button>
            <Button onClick={handleApprove} disabled={actioning} className="bg-green-600 hover:bg-green-700">
              {actioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              ยืนยันอนุมัติ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showReject} onOpenChange={(o) => { if (!o) { setShowReject(false); setSelected(null); setRejectNote(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />ปฏิเสธคำขอแก้ไข
            </DialogTitle>
            <DialogDescription>
              ระบุเหตุผลที่ปฏิเสธคำขอของ <strong>{selected?.requester.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs font-semibold">เหตุผลที่ปฏิเสธ <span className="text-destructive">*</span></Label>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              placeholder="เช่น ข้อมูลไม่ถูกต้อง, ขอให้ยื่นใหม่พร้อมเอกสารประกอบ"
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowReject(false); setSelected(null); setRejectNote(''); }} disabled={actioning}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={actioning || !rejectNote.trim()}>
              {actioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              ยืนยันปฏิเสธ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
