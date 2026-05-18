'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Users, Search, Shield, UserCheck, UserX,
  Key, ChevronRight, Loader2, Plus, RefreshCw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { ApiResponse } from '@/types/api';

interface UserItem {
  id: string; name: string; email: string; phone?: string | null;
  isActive: boolean; isTeamLead: boolean; lastLoginAt?: string | null;
  createdAt: string; approvalLimit?: string | null;
  managerLevel?: 'DIVISION' | 'DEPARTMENT' | 'SECTION' | null;
  role: { id: string; code: string; nameTh: string };
  team?: { id: string; name: string } | null;
  reportsTo?: { id: string; name: string } | null;
}

interface RoleOption { id: string; code: string; nameTh: string; level: number; }

const ROLE_COLOR: Record<string, string> = {
  ADMIN:    'bg-red-100 text-red-700 border-red-300',
  CEO:      'bg-purple-100 text-purple-700 border-purple-300',
  MANAGER:  'bg-amber-100 text-amber-700 border-amber-300',
  OFFICER:  'bg-blue-100 text-blue-700 border-blue-300',
  SALES:    'bg-blue-100 text-blue-700 border-blue-300',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  // Dialog states
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [assignRoleTarget, setAssignRoleTarget] = useState<UserItem | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', p.toString()); params.set('limit', '20');
      if (search) params.set('search', search);
      if (roleFilter) params.set('roleCode', roleFilter);
      const [uRes, rRes] = await Promise.all([
        api.get<ApiResponse<UserItem[]>>(`/admin/users?${params}`),
        api.get<ApiResponse<RoleOption[]>>('/admin/users/_roles'),
      ]);
      setUsers(uRes.data.data ?? []);
      setMeta(uRes.data.meta);
      setRoles(rRes.data.data ?? []);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  }, [search, roleFilter]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(1); }, 300);
    return () => clearTimeout(t);
  }, [search, roleFilter]);

  const handleToggleActive = async (user: UserItem) => {
    if (!confirm(`${user.isActive ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'} ${user.name}?`)) return;
    setTogglingId(user.id);
    try {
      await api.patch(`/admin/users/${user.id}/toggle-active`);
      toast.success(`${user.isActive ? 'ปิด' : 'เปิด'}การใช้งาน ${user.name} แล้ว`);
      await load(page);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setTogglingId(null); }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || !newPassword || newPassword.length < 8) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return;
    }
    setResetting(true);
    try {
      await api.post(`/admin/users/${resetTarget.id}/reset-password`, { newPassword });
      toast.success(`Reset password ของ ${resetTarget.name} เรียบร้อย`);
      setResetTarget(null); setNewPassword('');
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setResetting(false); }
  };

  const handleAssignRole = async () => {
    if (!assignRoleTarget || !selectedRoleId) return;
    setAssigning(true);
    try {
      await api.patch(`/admin/users/${assignRoleTarget.id}/role`, { roleId: selectedRoleId });
      toast.success(`เปลี่ยน Role ของ ${assignRoleTarget.name} เรียบร้อย`);
      setAssignRoleTarget(null); setSelectedRoleId('');
      await load(page);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setAssigning(false); }
  };

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-500" />จัดการ Users
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {meta ? `${meta.total} users ทั้งหมด` : 'Admin — จัดการผู้ใช้ทั้งหมด'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => load(page)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/invitations"><Plus className="h-4 w-4" />เชิญ User ใหม่</Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="ค้นหาชื่อ, email..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[140px]">
          <option value="">ทุก Role</option>
          {roles.map((r) => <option key={r.id} value={r.code}>{r.nameTh}</option>)}
        </select>
      </div>

      {/* User List */}
      {loading ? (
        <div className="space-y-2">{[0,1,2,3,4].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : users.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground text-sm">ไม่พบ user</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <Card key={user.id} className={!user.isActive ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Avatar */}
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${user.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {user.name.slice(0, 1).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{user.name}</span>
                      <Badge variant="outline" className={`text-[10px] ${ROLE_COLOR[user.role.code] ?? ''}`}>
                        {user.role.nameTh}
                      </Badge>
                      {user.isTeamLead && <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">Lead</Badge>}
                      {user.managerLevel && (
                        <Badge variant="outline" className={`text-[10px] ${
                          user.managerLevel === 'DIVISION'   ? 'bg-purple-50 text-purple-700 border-purple-300' :
                          user.managerLevel === 'DEPARTMENT' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                                                                'bg-emerald-50 text-emerald-700 border-emerald-300'
                        }`}>
                          {user.managerLevel === 'DIVISION'   ? 'Division' :
                          user.managerLevel === 'DEPARTMENT' ? 'Dept' : 'Section'}
                        </Badge>
                      )}
                      {!user.isActive && <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-300">Inactive</Badge>}
                      
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{user.email}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                      {user.team && <span>👥 {user.team.name}</span>}
                      {user.lastLoginAt ? <span>เข้าสู่ระบบล่าสุด {formatDate(user.lastLoginAt)}</span> : <span>ยังไม่เคย login</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    <Button variant="outline" size="sm" className="h-8 text-xs"
                      onClick={() => { setAssignRoleTarget(user); setSelectedRoleId(user.role.id); }}>
                      <Shield className="h-3 w-3" />Role
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs"
                      onClick={() => setResetTarget(user)}>
                      <Key className="h-3 w-3" />Reset PW
                    </Button>
                    <Button variant="outline" size="sm"
                      onClick={() => handleToggleActive(user)}
                      disabled={togglingId === user.id}
                      className={`h-8 text-xs ${user.isActive ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}>
                      {togglingId === user.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : user.isActive ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                      {user.isActive ? 'ปิด' : 'เปิด'}
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
                      <Link href={`/users/${user.id}`}><ChevronRight className="h-4 w-4" /></Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1); }}>ก่อนหน้า</Button>
          <span className="text-xs text-muted-foreground">หน้า {page} / {meta.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => { setPage(page + 1); load(page + 1); }}>ถัดไป</Button>
        </div>
      )}

      {/* Reset Password Dialog */}
      {resetTarget && (
        <Dialog open onOpenChange={(o) => { if (!o) { setResetTarget(null); setNewPassword(''); } }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>ตั้งรหัสผ่านใหม่สำหรับ {resetTarget.name}</DialogDescription>
            </DialogHeader>
            <div>
              <Label className="text-xs">รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="รหัสผ่านใหม่" className="mt-1.5" autoFocus />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setResetTarget(null); setNewPassword(''); }} disabled={resetting}>ยกเลิก</Button>
              <Button onClick={handleResetPassword} disabled={resetting || newPassword.length < 8} variant="destructive">
                {resetting && <Loader2 className="h-4 w-4 animate-spin" />}Reset Password
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Assign Role Dialog */}
      {assignRoleTarget && (
        <Dialog open onOpenChange={(o) => { if (!o) { setAssignRoleTarget(null); setSelectedRoleId(''); } }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>เปลี่ยน Role</DialogTitle>
              <DialogDescription>{assignRoleTarget.name} — {assignRoleTarget.email}</DialogDescription>
            </DialogHeader>
            <div>
              <Label className="text-xs">Role ใหม่</Label>
              <select value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)}
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {roles.map((r) => <option key={r.id} value={r.id}>{r.nameTh} (L{r.level})</option>)}
              </select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setAssignRoleTarget(null); setSelectedRoleId(''); }} disabled={assigning}>ยกเลิก</Button>
              <Button onClick={handleAssignRole} disabled={assigning || !selectedRoleId}>
                {assigning && <Loader2 className="h-4 w-4 animate-spin" />}ยืนยัน
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}