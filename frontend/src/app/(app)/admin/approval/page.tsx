'use client';

import { useEffect, useState } from 'react';
import { Shield, Save, Loader2, RefreshCw, Info, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatMoney } from '@/lib/utils';

type ManagerLevel = 'DIVISION' | 'DEPARTMENT' | 'SECTION';

interface ManagerLevelAuthority {
  level: ManagerLevel;
  label: string;
  approvalLimit: string | null;
  isMixed: boolean;
  userCount: number;
}

interface UserAuthority {
  id: string;
  name: string;
  email: string;
  approvalLimit: string | null;
  managerLevel: ManagerLevel | null;
  role: { code: string; nameTh: string };
  team?: { id: string; name: string } | null;
}

const LEVEL_COLOR: Record<ManagerLevel, string> = {
  DIVISION: 'bg-purple-100 text-purple-700 border-purple-300',
  DEPARTMENT: 'bg-blue-100 text-blue-700 border-blue-300',
  SECTION: 'bg-emerald-100 text-emerald-700 border-emerald-300',
};

export default function AdminApprovalPage() {
  const [levels, setLevels] = useState<ManagerLevelAuthority[]>([]);
  const [users, setUsers] = useState<UserAuthority[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<ManagerLevel, string | undefined>>({
    DIVISION: undefined,
    DEPARTMENT: undefined,
    SECTION: undefined,
  });
  const [saving, setSaving] = useState<ManagerLevel | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/admin/approval-authority');
      setLevels(res.data.data?.managerLevels ?? []);
      setUsers(res.data.data?.users ?? []);
      setEdits({ DIVISION: undefined, DEPARTMENT: undefined, SECTION: undefined });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const saveLevelLimit = async (level: ManagerLevel) => {
    const value = edits[level];
    if (value === undefined) return;
    setSaving(level);
    try {
      const limit = value === '' ? null : Number(value);
      const res = await api.patch(`/admin/approval-authority/manager-levels/${level}`, { limit });
      toast.success(`อัปเดตวงเงิน ${level} เรียบร้อย (${res.data.data?.updatedUsers ?? 0} users)`);
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const managersByLevel = (level: ManagerLevel) =>
    users.filter((user) => user.role.code === 'MANAGER' && user.managerLevel === level);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-amber-500" />Approval Authority
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            กำหนดวงเงินอนุมัติตามตำแหน่ง Manager และ sync ให้ทุก user ในตำแหน่งเดียวกัน
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4" />Refresh
        </Button>
      </div>

      <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 text-sm">
        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-blue-800 dark:text-blue-300 text-xs">
          ปรับวงเงินที่ตำแหน่ง เช่น Section Manager แล้วระบบจะอัปเดตวงเงินให้ Manager ทุกคนที่เป็น Section Manager เท่ากันทันที
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">วงเงินตามตำแหน่ง Manager</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
          ) : (
            levels.map((level) => {
              const edited = edits[level.level];
              const isChanged = edited !== undefined;
              const currentDisplay = edited ?? (!level.isMixed && level.approvalLimit ? String(Number(level.approvalLimit)) : '');
              const levelUsers = managersByLevel(level.level);

              return (
                <div key={level.level} className="rounded-lg border bg-muted/20 p-3 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] ${LEVEL_COLOR[level.level]}`}>
                          {level.label}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">{level.userCount} users</Badge>
                        {level.isMixed && <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">วงเงินไม่เท่ากัน</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        ปัจจุบัน: {level.isMixed ? 'มีหลายค่า' : level.approvalLimit ? formatMoney(Number(level.approvalLimit)) : 'ไม่จำกัด'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Input
                        type="number"
                        min="0"
                        step="1000"
                        value={currentDisplay}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [level.level]: e.target.value }))}
                        placeholder="ไม่จำกัด"
                        className={`w-40 h-9 text-sm ${isChanged ? 'border-amber-400' : ''}`}
                      />
                      <span className="text-xs text-muted-foreground">฿</span>
                      {isChanged && (
                        <Button size="sm" className="h-9 text-xs" onClick={() => saveLevelLimit(level.level)} disabled={saving === level.level}>
                          {saving === level.level ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          บันทึก
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    {levelUsers.length === 0 ? (
                      <p className="text-xs text-muted-foreground rounded-lg border border-dashed bg-background p-3 md:col-span-2">
                        ยังไม่มี Manager ในตำแหน่งนี้
                      </p>
                    ) : levelUsers.map((user) => (
                      <div key={user.id} className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {user.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{user.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {user.email}{user.team ? ` · ${user.team.name}` : ''}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {user.approvalLimit ? formatMoney(Number(user.approvalLimit)) : 'ไม่จำกัด'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />Approver Accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">ไม่มี user ที่มีสิทธิ์อนุมัติ</p>
          ) : users.map((user) => (
            <div key={user.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/10">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {user.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{user.name}</span>
                  {user.managerLevel ? (
                    <Badge variant="outline" className={`text-[10px] ${LEVEL_COLOR[user.managerLevel]}`}>
                      {user.managerLevel}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">{user.role.nameTh}</Badge>
                  )}
                  {user.team && <Badge variant="secondary" className="text-[10px]">{user.team.name}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <span className="text-xs font-semibold shrink-0">
                {user.approvalLimit ? formatMoney(Number(user.approvalLimit)) : 'ไม่จำกัด'}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
