'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Search,
  UserCog,
  CheckCircle2,
  XCircle,
  KeyRound,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatRelativeTime, getRoleDisplay, getRoleCode } from '@/lib/utils';
import type { ApiResponse } from '@/types/api';
import { usePermissions } from '@/hooks/use-permissions';

// ===========================
// Types
// ===========================
interface AdminUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  roleId: string;
  role: { id: string; code: string; nameTh: string; level: number };
  teamId: string | null;
  team: {
    id: string;
    name: string;
    department: { id: string; name: string } | null;
  } | null;
  reportsToId: string | null;
  reportsTo: { id: string; name: string; email: string } | null;
  _count: { reports: number }
}

interface RoleOption {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  level: number;
}

interface TeamOption {
  id: string;
  name: string;
  code: string | null;
  department: { id: string; name: string; code: string } | null;
}

// ===========================
// Page Component
// ===========================
export default function AdminUsersPage() {
  const { can, loading: permLoading } = usePermissions();
  const canManage = can('user', 'update', 'ALL');

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [resetting, setResetting] = useState<AdminUser | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uRes, rRes, tRes] = await Promise.all([
        api.get<ApiResponse<AdminUser[]>>('/admin/users?limit=200'),
        api.get<ApiResponse<RoleOption[]>>('/admin/users/_roles'),
        api.get<ApiResponse<TeamOption[]>>('/admin/users/_teams'),
      ]);
      setUsers(uRes.data.data ?? []);
      setRoles(rRes.data.data ?? []);
      setTeams(tRes.data.data ?? []);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permLoading && canManage) fetchData();
  }, [permLoading, canManage]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return users.filter((u) => {
      if (term && !u.name.toLowerCase().includes(term) && !u.email.toLowerCase().includes(term)) {
        return false;
      }
      if (filterRole && u.roleId !== filterRole) return false;
      if (filterTeam && u.teamId !== filterTeam) return false;
      if (filterActive === 'active' && !u.isActive) return false;
      if (filterActive === 'inactive' && u.isActive) return false;
      return true;
    });
  }, [users, search, filterRole, filterTeam, filterActive]);

  const toggleActive = async (user: AdminUser) => {
    const action = user.isActive ? 'deactivate' : 'activate';
    if (!confirm(`${user.isActive ? 'ระงับ' : 'เปิดใช้งาน'} user ${user.email} ใช่หรือไม่?`)) return;
    try {
      await api.post(`/admin/users/${user.id}/${action}`);
      toast.success(`User ${action}d`);
      fetchData();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  if (permLoading) {
    return <Skeleton className="h-32 w-full max-w-7xl" />;
  }
  if (!canManage) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserCog className="h-6 w-6 text-rose-500" />
          User Administration
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          จัดการผู้ใช้ทั้งหมด — เปลี่ยน role, ย้ายทีม, เปิด/ปิดใช้งาน, รีเซ็ตรหัสผ่าน
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อ / อีเมล..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
          >
            <option value="">All Roles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nameTh} (L{r.level})
              </option>
            ))}
          </select>
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
          >
            <option value="">All Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.department?.name} / {t.name}
              </option>
            ))}
          </select>
        </CardContent>

        <CardContent className="pt-0 pb-4 flex gap-1">
          {(['all', 'active', 'inactive'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilterActive(v)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                filterActive === v
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
            >
              {v === 'all' ? 'All' : v === 'active' ? '✓ Active' : '✗ Inactive'}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground self-center">
            {filtered.length} of {users.length} users
          </span>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            ไม่พบผู้ใช้
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((user) => (
            <Card key={user.id} className={!user.isActive ? 'opacity-60' : ''}>
              <CardContent className="p-4 flex flex-wrap items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-white flex items-center justify-center font-bold shrink-0">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{user.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {getRoleDisplay(user.role)}
                    </Badge>
                    {!user.isActive && (
                    <Badge variant="destructive" className="text-xs">
                        Disabled
                    </Badge>
                    )}
                    {user._count.reports > 0 && (
                    <Badge variant="secondary" className="text-xs">
                        +{user._count.reports} reports
                    </Badge>
)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {user.email}
                    {user.team && ` · ${user.team.department?.name} / ${user.team.name}`}
                    {user.reportsTo && ` · reports to ${user.reportsTo.name}`}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {user.lastLoginAt
                      ? `Last login ${formatRelativeTime(user.lastLoginAt)}`
                      : 'Never logged in'}
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => setEditing(user)}>
                    <Save className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setResetting(user)}>
                    <KeyRound className="h-3.5 w-3.5" />
                    Reset PW
                  </Button>
                  <Button
                    variant={user.isActive ? 'destructive' : 'default'}
                    size="sm"
                    onClick={() => toggleActive(user)}
                  >
                    {user.isActive ? (
                      <>
                        <XCircle className="h-3.5 w-3.5" />
                        Disable
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Enable
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <EditUserDialog
          user={editing}
          roles={roles}
          teams={teams}
          allUsers={users}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            fetchData();
          }}
        />
      )}

      {resetting && (
        <ResetPasswordDialog
          user={resetting}
          onClose={() => setResetting(null)}
          onDone={() => setResetting(null)}
        />
      )}
    </div>
  );
}

// ===========================
// Edit User Dialog
// ===========================
function EditUserDialog({
  user,
  roles,
  teams,
  allUsers,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  roles: RoleOption[];
  teams: TeamOption[];
  allUsers: AdminUser[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');
  const [roleId, setRoleId] = useState(user.roleId);
  const [teamId, setTeamId] = useState(user.teamId || '');
  const [reportsToId, setReportsToId] = useState(user.reportsToId || '');
  const [saving, setSaving] = useState(false);

  const potentialSupervisors = useMemo(() => {
    return allUsers.filter((u) => u.id !== user.id && u.isActive);
  }, [allUsers, user.id]);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/admin/users/${user.id}`, {
        name,
        phone: phone || null,
        roleId,
        teamId: teamId || null,
        reportsToId: reportsToId || null,
      });
      toast.success('User updated');
      onSaved();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open: boolean) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </div>

          <div>
            <Label className="text-xs">Phone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1.5"
              placeholder="optional"
            />
          </div>

          <div>
            <Label className="text-xs">Role</Label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nameTh} (L{r.level})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs">Team</Label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— No team —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.department?.name} / {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs">Reports To</Label>
            <select
              value={reportsToId}
              onChange={(e) => setReportsToId(e.target.value)}
              className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— No supervisor —</option>
              {potentialSupervisors.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({getRoleCode(u.role)})
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===========================
// Reset Password Dialog
// ===========================
function ResetPasswordDialog({
  user,
  onClose,
  onDone,
}: {
  user: AdminUser;
  onClose: () => void;
  onDone: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/admin/users/${user.id}/reset-password`, { newPassword });
      toast.success(`Password reset for ${user.email}. User must log in again.`);
      onDone();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open: boolean) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Reset password for <span className="font-mono">{user.email}</span>
            <br />
            <span className="text-amber-600 text-xs">
              ⚠️ User will be logged out from all sessions.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">New Password (min 8 chars)</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1.5"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs">Confirm Password</Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving} variant="destructive">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Reset Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}