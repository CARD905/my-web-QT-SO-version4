'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Shield, CheckCircle2, Sparkles, Crown, UserCog, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import type { ApiResponse, MyPermissionsResponse } from '@/types/api';

const ROLE_META: Record<string, { icon: typeof Shield; gradient: string; bg: string }> = {
  OFFICER: { icon: Users, gradient: 'from-blue-500 to-cyan-500', bg: 'bg-blue-500/10' },
  SALES: { icon: Users, gradient: 'from-blue-500 to-cyan-500', bg: 'bg-blue-500/10' },
  MANAGER: { icon: Crown, gradient: 'from-amber-500 to-orange-500', bg: 'bg-amber-500/10' },
  APPROVER: { icon: UserCog, gradient: 'from-purple-500 to-fuchsia-500', bg: 'bg-purple-500/10' },
  ADMIN: { icon: Sparkles, gradient: 'from-rose-500 to-red-500', bg: 'bg-rose-500/10' },
  CEO: { icon: Crown, gradient: 'from-purple-600 to-pink-600', bg: 'bg-purple-500/10' },
};

const DEFAULT_META = {
  icon: Shield,
  gradient: 'from-slate-500 to-gray-500',
  bg: 'bg-slate-500/10',
};

export default function MyPermissionsPage() {
  const t = useT();
  const { data: session } = useSession();
  const [data, setData] = useState<MyPermissionsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<ApiResponse<MyPermissionsResponse>>('/permissions/me');
        if (res.data.data) setData(res.data.data);
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) return null;

  // Role can be string or object — extract code safely
  const roleCode =
    typeof data.role === 'string' ? data.role : (data.role as { code?: string })?.code || 'OFFICER';
  const roleName = data.roleName || roleCode;

  const meta = ROLE_META[roleCode] || DEFAULT_META;
  const RoleIcon = meta.icon;

  // Group permissions (handles both old `labels` shape and new flat array)
  const grouped = new Map<string, Array<{ key: string; label: string }>>();
  for (const key of data.permissions) {
    const label = data.labels?.[key];
    const groupName = label?.group || 'general';
    const displayLabel = label?.th || key;
    const arr = grouped.get(groupName) ?? [];
    arr.push({ key, label: displayLabel });
    grouped.set(groupName, arr);
  }

  const userName = (session?.user as { name?: string | null })?.name || '';
  const userEmail = (session?.user as { email?: string | null })?.email || '';

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Hero card */}
      <Card className="overflow-hidden border-2">
        <div className={`bg-gradient-to-br ${meta.gradient} text-white p-8`}>
          <div className="flex items-center gap-5">
            <div className="h-20 w-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-xl">
              <RoleIcon className="h-10 w-10" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-widest text-white/80 mb-1">
                {t('permissions.myRole')}
              </div>
              <h1 className="text-4xl font-bold tracking-tight">{roleName}</h1>
              <div className="text-sm text-white/90 mt-1">
                {userName} · {userEmail}
              </div>
            </div>
            <div className="text-right hidden md:block">
              <div className="text-5xl font-bold">{data.permissions.length}</div>
              <div className="text-xs uppercase tracking-wider text-white/80">Permissions</div>
            </div>
          </div>
        </div>
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">{t('permissions.subtitle')}</p>
        </CardContent>
      </Card>

      {/* Permissions grouped */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from(grouped.entries()).map(([group, perms]) => (
          <Card key={group}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full bg-gradient-to-r ${meta.gradient}`} />
                {t(`permissions.groups.${group}`) || group}
                <Badge variant="outline" className="ml-auto text-xs">
                  {perms.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {perms.map((p) => (
                  <li key={p.key} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                    <span className="truncate">{p.label}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}