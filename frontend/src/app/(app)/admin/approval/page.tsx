'use client';

import { useEffect, useState } from 'react';
import { Shield, Save, Loader2, RefreshCw, Info, Users, Percent } from 'lucide-react';
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
  discountLimit: string | null;
  isDiscountMixed: boolean;
  userCount: number;
}

interface UserAuthority {
  id: string;
  name: string;
  email: string;
  approvalLimit: string | null;
  discountLimit: string | null;
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
  const [ceoDiscountLimit, setCeoDiscountLimit] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [moneyEdits, setMoneyEdits] = useState<Record<ManagerLevel, string | undefined>>({
    DIVISION: undefined, DEPARTMENT: undefined, SECTION: undefined,
  });
  const [discountEdits, setDiscountEdits] = useState<Record<ManagerLevel | 'CEO', string | undefined>>({
    DIVISION: undefined, DEPARTMENT: undefined, SECTION: undefined, CEO: undefined,
  });
  const [savingMoney, setSavingMoney] = useState<ManagerLevel | null>(null);
  const [savingDiscount, setSavingDiscount] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/admin/approval-authority');
      setLevels(res.data.data?.managerLevels ?? []);
      setUsers(res.data.data?.users ?? []);
      setCeoDiscountLimit(res.data.data?.ceoDiscountLimit ?? null);
      setMoneyEdits({ DIVISION: undefined, DEPARTMENT: undefined, SECTION: undefined });
      setDiscountEdits({ DIVISION: undefined, DEPARTMENT: undefined, SECTION: undefined, CEO: undefined });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const saveMoneyLimit = async (level: ManagerLevel) => {
    const value = moneyEdits[level];
    if (value === undefined) return;
    setSavingMoney(level);
    try {
      const limit = value === '' ? null : Number(value);
      const res = await api.patch(`/admin/approval-authority/manager-levels/${level}`, { limit });
      toast.success(`อัปเดตวงเงิน ${level} เรียบร้อย (${res.data.data?.updatedUsers ?? 0} users)`);
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSavingMoney(null);
    }
  };

  const saveDiscountLimit = async (level: ManagerLevel | 'CEO') => {
    const value = discountEdits[level];
    if (value === undefined) return;
    setSavingDiscount(level);
    try {
      const limit = value === '' ? null : Number(value);
      if (limit !== null && (limit < 0 || limit > 100)) {
        toast.error('ส่วนลดต้องอยู่ระหว่าง 0–100%'); return;
      }
      const res = await api.patch(
        `/admin/approval-authority/manager-levels/${level}/discount-limit`, { limit }
      );
      toast.success(`อัปเดตสิทธิ์ส่วนลด ${level} เรียบร้อย (${res.data.data?.updatedUsers ?? 0} users)`);
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSavingDiscount(null);
    }
  };

  const managersByLevel = (level: ManagerLevel) =>
    users.filter((user) => user.role.code === 'MANAGER' && user.managerLevel === level);

  const ceoUsers = users.filter((u) => u.role.code === 'CEO');

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-amber-500" />Approval Authority
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            กำหนดวงเงินและสิทธิ์อนุมัติส่วนลดตามตำแหน่ง — sync ให้ทุก user ในตำแหน่งเดียวกันทันที
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4" />Refresh
        </Button>
      </div>

      <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 text-sm">
        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-blue-800 dark:text-blue-300 text-xs">
          <strong>วงเงินอนุมัติ (฿)</strong> — ถ้ามูลค่า Quotation เกินวงเงิน ต้องส่งต่อระดับถัดไป ·{' '}
          <strong>สิทธิ์อนุมัติส่วนลด (%)</strong> — ถ้าส่วนลดเกิน % ที่กำหนด ต้องส่งต่อระดับถัดไปจนถึง CEO
        </div>
      </div>

      {/* Manager Levels */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">วงเงินและสิทธิ์ส่วนลดตามตำแหน่ง Manager</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}</div>
          ) : (
            levels.map((level) => {
              const moneyEdited = moneyEdits[level.level];
              const discountEdited = discountEdits[level.level];
              const moneyDisplay = moneyEdited ?? (!level.isMixed && level.approvalLimit ? String(Number(level.approvalLimit)) : '');
              const discountDisplay = discountEdited ?? (!level.isDiscountMixed && level.discountLimit ? String(Number(level.discountLimit)) : '');
              const levelUsers = managersByLevel(level.level);

              return (
                <div key={level.level} className="rounded-lg border bg-muted/20 p-4 space-y-3">
                  {/* Level header */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] ${LEVEL_COLOR[level.level]}`}>
                      {level.label}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">{level.userCount} users</Badge>
                    {level.isMixed && <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">วงเงินไม่เท่ากัน</Badge>}
                    {level.isDiscountMixed && <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-300">ส่วนลดไม่เท่ากัน</Badge>}
                  </div>

                  {/* Two inputs: money + discount */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Money limit */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">วงเงินอนุมัติ (฿)</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number" min="0" step="1000"
                          value={moneyDisplay}
                          onChange={(e) => setMoneyEdits((p) => ({ ...p, [level.level]: e.target.value }))}
                          placeholder="ไม่จำกัด"
                          className={`h-9 text-sm ${moneyEdited !== undefined ? 'border-amber-400' : ''}`}
                        />
                        <span className="text-xs text-muted-foreground shrink-0">฿</span>
                        {moneyEdited !== undefined && (
                          <Button size="sm" className="h-9 text-xs shrink-0" onClick={() => saveMoneyLimit(level.level)} disabled={savingMoney === level.level}>
                            {savingMoney === level.level ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            บันทึก
                          </Button>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        ปัจจุบัน: {level.isMixed ? 'มีหลายค่า' : level.approvalLimit ? formatMoney(Number(level.approvalLimit)) : 'ไม่จำกัด'}
                      </p>
                    </div>

                    {/* Discount limit */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Percent className="h-3 w-3" />สิทธิ์อนุมัติส่วนลดสูงสุด (%)
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number" min="0" max="100" step="1"
                          value={discountDisplay}
                          onChange={(e) => setDiscountEdits((p) => ({ ...p, [level.level]: e.target.value }))}
                          placeholder="ไม่จำกัด"
                          className={`h-9 text-sm ${discountEdited !== undefined ? 'border-amber-400' : ''}`}
                        />
                        <span className="text-xs text-muted-foreground shrink-0">%</span>
                        {discountEdited !== undefined && (
                          <Button size="sm" className="h-9 text-xs shrink-0" onClick={() => saveDiscountLimit(level.level)} disabled={savingDiscount === level.level}>
                            {savingDiscount === level.level ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            บันทึก
                          </Button>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        ปัจจุบัน: {level.isDiscountMixed ? 'มีหลายค่า' : level.discountLimit ? `${Number(level.discountLimit)}%` : 'ไม่จำกัด'}
                      </p>
                    </div>
                  </div>

                  {/* Users list */}
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
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-muted-foreground">
                            {user.approvalLimit ? formatMoney(Number(user.approvalLimit)) : 'ไม่จำกัด'}
                          </p>
                          <p className="text-[10px] text-amber-600 font-medium">
                            {user.discountLimit ? `≤${Number(user.discountLimit)}%` : 'ส่วนลด: ไม่จำกัด'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* CEO Discount Limit */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Percent className="h-4 w-4 text-amber-500" />สิทธิ์อนุมัติส่วนลด CEO
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-20" /> : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                CEO อนุมัติส่วนลดได้สูงสุดเท่าใด
              </p>
              <div className="flex items-center gap-3">
                <Input
                  type="number" min="0" max="100" step="1"
                  value={discountEdits.CEO ?? (ceoDiscountLimit ? String(Number(ceoDiscountLimit)) : '')}
                  onChange={(e) => setDiscountEdits((p) => ({ ...p, CEO: e.target.value }))}
                  placeholder="ไม่จำกัด (แนะนำ 50)"
                  className={`w-48 h-9 text-sm ${discountEdits.CEO !== undefined ? 'border-amber-400' : ''}`}
                />
                <span className="text-sm text-muted-foreground">%</span>
                {discountEdits.CEO !== undefined && (
                  <Button size="sm" onClick={() => saveDiscountLimit('CEO')} disabled={savingDiscount === 'CEO'}>
                    {savingDiscount === 'CEO' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    บันทึก
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                ปัจจุบัน: {ceoDiscountLimit ? `${Number(ceoDiscountLimit)}%` : 'ไม่จำกัด'}
              </p>
              {ceoUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/10">
                  <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700 shrink-0">
                    {u.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{u.name}</p>
                    <p className="text-[10px] text-muted-foreground">{u.email}</p>
                  </div>
                  <p className="text-xs font-semibold text-amber-600 shrink-0">
                    {u.discountLimit ? `≤${Number(u.discountLimit)}%` : 'ไม่จำกัด'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Approvers */}
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
              <div className="text-right shrink-0">
                <p className="text-xs font-semibold">
                  {user.approvalLimit ? formatMoney(Number(user.approvalLimit)) : 'ไม่จำกัด ฿'}
                </p>
                <p className="text-[10px] text-amber-600 font-medium">
                  {user.discountLimit ? `≤${Number(user.discountLimit)}%` : 'ส่วนลด: ไม่จำกัด'}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
