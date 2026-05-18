'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, FileText, DollarSign, Calendar,
  Shield, Key, UserX, UserCheck, Loader2, Crown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, formatMoney, getStatusClass } from '@/lib/utils';
import type { ApiResponse } from '@/types/api';

interface UserDetailData {
  user: {
    id: string; name: string; email: string; phone?: string | null;
    isActive: boolean; isTeamLead: boolean; lastLoginAt?: string | null;
    createdAt: string; approvalLimit?: string | null;
    role: { id: string; code: string; nameTh: string };
    team?: { id: string; name: string } | null;
    reportsTo?: { id: string; name: string } | null;
  } | null;
  totals: { quotations: number; approvedValue: number; thisMonth: number };
  byStatus: Array<{ status: string; count: number }>;
  recent: Array<{ id: string; quotationNo: string; status: string; grandTotal: number; createdAt: string }>;
}

interface RoleOption { id: string; code: string; nameTh: string; level: number; }

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.userId as string;

  const [data, setData] = useState<UserDetailData | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [showResetPw, setShowResetPw] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [showAssignRole, setShowAssignRole] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [toggling, setToggling] = useState(false);

  const load = async () => {
    try {
      const [uRes, rRes] = await Promise.all([
        api.get<ApiResponse<UserDetailData>>(`/manager-dashboard/users/${userId}`),
        api.get<ApiResponse<RoleOption[]>>('/admin/users/_roles'),
      ]);
      setData(uRes.data.data ?? null);
      setRoles(rRes.data.data ?? []);
      if (uRes.data.data?.user) setSelectedRoleId(uRes.data.data.user.role.id);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [userId]);

  const handleToggleActive = async () => {
    if (!data?.user) return;
    if (!confirm(`${data.user.isActive ? 'ปิด' : 'เปิด'}การใช้งาน ${data.user.name}?`)) return;
    setToggling(true);
    try {
      await api.patch(`/admin/users/${userId}/toggle-active`);
      toast.success('อัปเดตสถานะเรียบร้อย');
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setToggling(false); }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 8) { toast.error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    setResetting(true);
    try {
      await api.post(`/admin/users/${userId}/reset-password`, { newPassword });
      toast.success('Reset password เรียบร้อย');
      setShowResetPw(false); setNewPassword('');
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setResetting(false); }
  };

  const handleAssignRole = async () => {
    if (!selectedRoleId) return;
    setAssigning(true);
    try {
      await api.patch(`/admin/users/${userId}/role`, { roleId: selectedRoleId });
      toast.success('เปลี่ยน Role เรียบร้อย');
      setShowAssignRole(false);
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setAssigning(false); }
  };

  if (loading) return (
    <div className="space-y-4 max-w-5xl">
      <Skeleton className="h-8 w-32" /><Skeleton className="h-32" /><Skeleton className="h-48" />
    </div>
  );

  if (!data?.user) return (
    <Card><CardContent className="py-16 text-center">
      <p className="text-muted-foreground">ไม่พบข้อมูลผู้ใช้</p>
      <Link href="/users" className="text-sm text-primary hover:underline mt-2 inline-block">← กลับ</Link>
    </CardContent></Card>
  );

  const { user, totals, byStatus, recent } = data;

  return (
    <div className="space-y-6 max-w-5xl">
      <Link href="/users" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />กลับรายการ Users
      </Link>

      {/* Hero */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 text-white p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center font-bold text-2xl shrink-0">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{user.name}</h1>
                {user.isTeamLead && (
                  <Badge className="bg-amber-400/30 text-amber-100 border-amber-400/50 text-xs">
                    <Crown className="h-3 w-3 mr-1" />Lead
                  </Badge>
                )}
                {!user.isActive && <Badge variant="destructive">Inactive</Badge>}
              </div>
              <div className="text-sm text-white/90 mt-1">{user.email}</div>
              <div className="text-xs text-white/70 mt-1 flex flex-wrap gap-3">
                <span>📋 {user.role.nameTh}</span>
                {user.team && <span>👥 {user.team.name}</span>}
                {user.reportsTo && <span>↑ {user.reportsTo.name}</span>}
              </div>
            </div>
            {/* Admin actions */}
            <div className="flex flex-col gap-2 shrink-0">
              <Button size="sm" variant="secondary" className="text-xs h-8"
                onClick={() => { setShowAssignRole(true); }}>
                <Shield className="h-3 w-3" />เปลี่ยน Role
              </Button>
              <Button size="sm" variant="secondary" className="text-xs h-8" onClick={() => setShowResetPw(true)}>
                <Key className="h-3 w-3" />Reset Password
              </Button>
              <Button size="sm" variant="secondary" className={`text-xs h-8 ${user.isActive ? 'text-red-600' : 'text-emerald-600'}`}
                onClick={handleToggleActive} disabled={toggling}>
                {toggling ? <Loader2 className="h-3 w-3 animate-spin" /> : user.isActive ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                {user.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: 'Total Quotations', value: totals.quotations, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Approved Value', value: formatMoney(totals.approvedValue), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'This Month', value: totals.thisMonth, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg ${s.bg} ${s.color} flex items-center justify-center`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">ข้อมูล Account</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div><span className="text-muted-foreground text-xs">สร้างเมื่อ</span><div className="font-medium">{formatDate(user.createdAt)}</div></div>
          <div><span className="text-muted-foreground text-xs">Login ล่าสุด</span><div className="font-medium">{user.lastLoginAt ? formatDate(user.lastLoginAt) : 'ยังไม่เคย'}</div></div>
          <div><span className="text-muted-foreground text-xs">Approval Limit</span><div className="font-medium">{user.approvalLimit ? formatMoney(Number(user.approvalLimit)) : 'ใช้ default'}</div></div>
          {user.phone && <div><span className="text-muted-foreground text-xs">เบอร์โทร</span><div className="font-medium">{user.phone}</div></div>}
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">สถานะใบเสนอราคา</CardTitle></CardHeader>
        <CardContent>
          {byStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">ไม่มีข้อมูล</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {byStatus.map((s) => (
                <Badge key={s.status} className={getStatusClass(s.status)} variant="outline">
                  {s.status}: {s.count}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Quotations */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">ใบเสนอราคาล่าสุด</CardTitle></CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีใบเสนอราคา</p>
          ) : (
            <div className="space-y-2">
              {recent.map((q) => (
                <Link key={q.id} href={`/quotations/${q.id}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-md border hover:border-primary/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm">{q.quotationNo}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(q.createdAt)}</div>
                  </div>
                  <Badge className={getStatusClass(q.status)} variant="outline">{q.status}</Badge>
                  <div className="font-bold text-sm shrink-0">{formatMoney(q.grandTotal)}</div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset Password Dialog */}
      <Dialog open={showResetPw} onOpenChange={(o) => { if (!o) { setShowResetPw(false); setNewPassword(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>ตั้งรหัสผ่านใหม่สำหรับ {user.name}</DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="รหัสผ่านใหม่" className="mt-1.5" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowResetPw(false); setNewPassword(''); }} disabled={resetting}>ยกเลิก</Button>
            <Button onClick={handleResetPassword} disabled={resetting || newPassword.length < 8} variant="destructive">
              {resetting && <Loader2 className="h-4 w-4 animate-spin" />}Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Role Dialog */}
      <Dialog open={showAssignRole} onOpenChange={(o) => { if (!o) setShowAssignRole(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>เปลี่ยน Role</DialogTitle>
            <DialogDescription>{user.name} — ปัจจุบัน: {user.role.nameTh}</DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">Role ใหม่</Label>
            <select value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)}
              className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {roles.map((r) => <option key={r.id} value={r.id}>{r.nameTh} (L{r.level})</option>)}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignRole(false)} disabled={assigning}>ยกเลิก</Button>
            <Button onClick={handleAssignRole} disabled={assigning || !selectedRoleId}>
              {assigning && <Loader2 className="h-4 w-4 animate-spin" />}ยืนยัน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}