'use client';

import { useEffect, useState } from 'react';
import { Shield, Save, Loader2, RefreshCw, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatMoney } from '@/lib/utils';

interface RoleAuthority {
  id: string; code: string; nameTh: string; level: number;
  defaultApprovalLimit: string | null;
}

interface UserAuthority {
  id: string; name: string; email: string;
  approvalLimit: string | null;
  role: { code: string; nameTh: string };
  team?: { name: string } | null;
}

const ROLE_COLOR: Record<string, string> = {
  ADMIN:   'bg-red-100 text-red-700 border-red-300',
  CEO:     'bg-purple-100 text-purple-700 border-purple-300',
  MANAGER: 'bg-amber-100 text-amber-700 border-amber-300',
  OFFICER: 'bg-blue-100 text-blue-700 border-blue-300',
};

export default function AdminApprovalPage() {
  const [roles, setRoles] = useState<RoleAuthority[]>([]);
  const [users, setUsers] = useState<UserAuthority[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleEdits, setRoleEdits] = useState<Record<string, string>>({});
  const [userEdits, setUserEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/admin/approval-authority');
      setRoles(res.data.data?.roles ?? []);
      setUsers(res.data.data?.users ?? []);
      setRoleEdits({});
      setUserEdits({});
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const saveRoleLimit = async (roleId: string) => {
    const value = roleEdits[roleId];
    if (value === undefined) return;
    setSaving(roleId);
    try {
      const limit = value === '' ? null : Number(value);
      await api.patch(`/admin/approval-authority/roles/${roleId}`, { limit });
      toast.success('อัปเดต Role approval limit เรียบร้อย');
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setSaving(null); }
  };

  const saveUserLimit = async (userId: string) => {
    const value = userEdits[userId];
    if (value === undefined) return;
    setSaving(userId);
    try {
      const limit = value === '' ? null : Number(value);
      await api.patch(`/admin/approval-authority/users/${userId}`, { limit });
      toast.success('อัปเดต User approval limit เรียบร้อย');
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setSaving(null); }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-amber-500" />Approval Authority
          </h1>
          <p className="text-sm text-muted-foreground mt-1">กำหนดวงเงินอนุมัติสำหรับแต่ละ Role และ User</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4" />Refresh
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 text-sm">
        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-blue-800 dark:text-blue-300 text-xs">
          <strong>วงเงินตาม Role</strong> = ค่า default สำหรับทุกคนใน Role นั้น
          · <strong>วงเงินตาม User</strong> = override เฉพาะคน (ถ้าตั้งไว้จะใช้แทน Role limit)
          · ปล่อยว่าง = ไม่มีวงเงิน (อนุมัติได้ทุกยอด)
        </div>
      </div>

      {/* Role Limits */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">วงเงินตาม Role (Default)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="space-y-2">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            roles.map((role) => {
              const edited = roleEdits[role.id];
              const isChanged = edited !== undefined;
              const currentDisplay = edited ?? (role.defaultApprovalLimit ? String(Number(role.defaultApprovalLimit)) : '');
              return (
                <div key={role.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${ROLE_COLOR[role.code] ?? ''}`}>
                        {role.nameTh}
                      </Badge>
                      <span className="text-xs text-muted-foreground">L{role.level}</span>
                    </div>
                    {role.defaultApprovalLimit && !isChanged && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        ปัจจุบัน: {formatMoney(Number(role.defaultApprovalLimit))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number" min="0" step="1000"
                        value={currentDisplay}
                        onChange={(e) => setRoleEdits((prev) => ({ ...prev, [role.id]: e.target.value }))}
                        placeholder="ไม่จำกัด"
                        className={`w-36 h-8 text-sm ${isChanged ? 'border-amber-400' : ''}`}
                      />
                      <span className="text-xs text-muted-foreground">฿</span>
                    </div>
                    {isChanged && (
                      <Button size="sm" className="h-8 text-xs" onClick={() => saveRoleLimit(role.id)} disabled={saving === role.id}>
                        {saving === role.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        บันทึก
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* User Override Limits */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">วงเงินเฉพาะบุคคล (Override)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="space-y-2">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : users.filter((u) => ['MANAGER', 'CEO', 'ADMIN'].includes(u.role.code)).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">ไม่มี user ที่มีสิทธิ์อนุมัติ</p>
          ) : (
            users
              .filter((u) => ['MANAGER', 'CEO', 'ADMIN'].includes(u.role.code))
              .map((user) => {
                const edited = userEdits[user.id];
                const isChanged = edited !== undefined;
                const currentDisplay = edited ?? (user.approvalLimit ? String(Number(user.approvalLimit)) : '');
                return (
                  <div key={user.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {user.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{user.name}</span>
                        <Badge variant="outline" className={`text-[10px] ${ROLE_COLOR[user.role.code] ?? ''}`}>
                          {user.role.nameTh}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {user.email}{user.team && ` · ${user.team.name}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number" min="0" step="1000"
                          value={currentDisplay}
                          onChange={(e) => setUserEdits((prev) => ({ ...prev, [user.id]: e.target.value }))}
                          placeholder="ใช้ default"
                          className={`w-36 h-8 text-sm ${isChanged ? 'border-amber-400' : ''}`}
                        />
                        <span className="text-xs text-muted-foreground">฿</span>
                      </div>
                      {isChanged && (
                        <Button size="sm" className="h-8 text-xs" onClick={() => saveUserLimit(user.id)} disabled={saving === user.id}>
                          {saving === user.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          บันทึก
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </CardContent>
      </Card>
    </div>
  );
}