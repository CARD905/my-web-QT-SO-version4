'use client';

import { useEffect, useState } from 'react';
import { Settings, Save, Loader2, Crown, UserCog, Users, Sparkles, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/utils';
import type { ApiResponse, PermissionsMatrixResponse, UserRole } from '@/types/api';

const ROLE_ORDER: UserRole[] = ['SALES', 'APPROVER', 'MANAGER', 'ADMIN'];
const ROLE_ICONS: Record<UserRole, typeof Users> = {
  SALES: Users,
  APPROVER: UserCog,
  MANAGER: Crown,
  ADMIN: Sparkles,
};
const ROLE_COLORS: Record<UserRole, string> = {
  SALES: 'text-blue-600 dark:text-blue-400',
  APPROVER: 'text-purple-600 dark:text-purple-400',
  MANAGER: 'text-amber-600 dark:text-amber-400',
  ADMIN: 'text-rose-600 dark:text-rose-400',
};

export default function ManagePermissionsPage() {
  const t = useT();
  const [data, setData] = useState<PermissionsMatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approverLimit, setApproverLimit] = useState(0);
  const [managerLimit, setManagerLimit] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<ApiResponse<PermissionsMatrixResponse>>('/permissions/matrix');
        if (res.data.data) {
          setData(res.data.data);
          setApproverLimit(res.data.data.limits.approverLimit);
          setManagerLimit(res.data.data.limits.managerLimit);
        }
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveLimits = async () => {
    setSaving(true);
    try {
      await api.patch('/permissions/limits', {
        approverLimit: Number(approverLimit),
        managerLimit: Number(managerLimit),
      });
      toast.success(t('permissions.limitsUpdated'));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-6xl">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!data) return null;

  // Group permissions
  const grouped = new Map<string, string[]>();
  for (const key of Object.keys(data.permissions)) {
    const label = data.labels[key];
    if (!label) continue;
    const arr = grouped.get(label.group) ?? [];
    arr.push(key);
    grouped.set(label.group, arr);
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('nav.managePermissions')}</h1>
          <p className="text-sm text-muted-foreground">{t('permissions.subtitle')}</p>
        </div>
      </div>

      {/* Approval Limits */}
      <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-600" />
            {t('permissions.limits')}
          </CardTitle>
          <CardDescription>
            ใบเสนอราคาที่มูลค่าเกินวงเงินของ Approver จะถูกส่งมาให้ Manager อนุมัติ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">
                <UserCog className="inline h-3 w-3 mr-1" />
                {t('permissions.approverLimit')}
              </Label>
              <div className="relative mt-1.5">
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={approverLimit}
                  onChange={(e) => setApproverLimit(parseFloat(e.target.value) || 0)}
                  className="pr-16 text-lg font-bold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  THB
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                ปัจจุบัน: {formatMoney(approverLimit)} (มากกว่านี้ = ส่ง Manager)
              </p>
            </div>
            <div>
              <Label className="text-xs">
                <Crown className="inline h-3 w-3 mr-1" />
                {t('permissions.managerLimit')}
              </Label>
              <div className="relative mt-1.5">
                <Input
                  type="number"
                  min="0"
                  step="10000"
                  value={managerLimit}
                  onChange={(e) => setManagerLimit(parseFloat(e.target.value) || 0)}
                  className="pr-16 text-lg font-bold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  THB
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {managerLimit === 0
                  ? '🌟 ไม่จำกัด (Manager อนุมัติได้ทุกจำนวน)'
                  : `จำกัด ${formatMoney(managerLimit)}`}
              </p>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={saveLimits} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              บันทึกวงเงิน
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Permissions Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>{t('permissions.matrix')}</CardTitle>
          <CardDescription>ตารางสิทธิ์ของแต่ละบทบาท (อ่านอย่างเดียว)</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2">
                <th className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider">
                  สิทธิ์ / Permission
                </th>
                {ROLE_ORDER.map((role) => {
                  const Icon = ROLE_ICONS[role];
                  return (
                    <th key={role} className={`text-center py-3 px-2 ${ROLE_COLORS[role]}`}>
                      <div className="flex flex-col items-center gap-1">
                        <Icon className="h-4 w-4" />
                        <span className="text-xs font-bold">{role}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Array.from(grouped.entries()).map(([group, perms]) => (
                <tr key={`group-${group}`} className="border-b">
                  <td colSpan={5} className="bg-muted/40 px-3 py-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t(`permissions.groups.${group}`) || group}
                    </span>
                  </td>
                </tr>
              )).flatMap((groupRow, gi) => {
                const group = Array.from(grouped.keys())[gi];
                const perms = grouped.get(group) ?? [];
                return [
                  groupRow,
                  ...perms.map((permKey) => (
                    <tr
                      key={permKey}
                      className="border-b hover:bg-accent/30 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-sm">
                        {data.labels[permKey]?.th || permKey}
                      </td>
                      {ROLE_ORDER.map((role) => {
                        const allowed = data.permissions[permKey]?.includes(role);
                        return (
                          <td key={role} className="text-center py-2 px-2">
                            {allowed ? (
                              <Check className={`inline h-4 w-4 ${ROLE_COLORS[role]}`} />
                            ) : (
                              <X className="inline h-4 w-4 text-muted-foreground/30" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}