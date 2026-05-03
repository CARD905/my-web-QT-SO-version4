'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, UserCog, ArrowRight, TrendingUp, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { GlassCard } from '@/components/effects/glass-card';
import { AnimatedCounter } from '@/components/effects/animated-counter';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatRelativeTime, getRoleCode } from '@/lib/utils';
import { toast } from 'sonner';
import type { ApiResponse, UserListItem } from '@/types/api';

export default function ManagerUsersPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<ApiResponse<UserListItem[]>>('/manager-dashboard/users');
        setUsers(res.data.data ?? []);
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = users.filter((u) =>
    [u.name, u.email].some((s) => s.toLowerCase().includes(search.toLowerCase())),
  );

  // Use getRoleCode helper to handle both string and Role object
  const sales = filtered.filter((u) => {
    const code = getRoleCode(u.role);
    return code === 'OFFICER' || code === 'SALES';
  });
  const approvers = filtered.filter((u) => {
    const code = getRoleCode(u.role);
    return code === 'MANAGER' || code === 'APPROVER';
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-amber-500" />
          User Drill-Down
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          ดูข้อมูลรายบุคคลของ Officer/Sales และ Manager/Approver แต่ละคน
        </p>
      </div>

      <GlassCard className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหา ชื่อ / อีเมล..."
            className="pl-9 bg-transparent"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </GlassCard>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <>
          <section>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              Officers / Sales ({sales.length})
            </h2>
            {sales.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">ไม่มีข้อมูล</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sales.map((u) => (
                  <UserCard key={u.id} user={u} accent="from-blue-500 to-cyan-500" />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <UserCog className="h-5 w-5 text-purple-500" />
              Managers / Approvers ({approvers.length})
            </h2>
            {approvers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">ไม่มีข้อมูล</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {approvers.map((u) => (
                  <UserCard key={u.id} user={u} accent="from-purple-500 to-fuchsia-500" />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function UserCard({ user, accent }: { user: UserListItem; accent: string }) {
  return (
    <Link href={`/manager/users/${user.id}`}>
      <GlassCard className="p-4 group hover:scale-[1.02] transition-transform">
        <div className="flex items-start gap-3">
          <div
            className={`h-12 w-12 rounded-xl bg-gradient-to-br ${accent} text-white flex items-center justify-center font-bold shrink-0 shadow-lg`}
          >
            {user.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-semibold truncate">{user.name}</div>
              {!user.isActive && (
                <Badge variant="outline" className="text-xs">
                  Inactive
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <div>
                <div className="text-muted-foreground">QT ทั้งหมด</div>
                <div className="font-bold text-base">
                  <AnimatedCounter value={user.stats?.total ?? 0} />
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Approved</div>
                <div className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                  <AnimatedCounter value={user.stats?.approved ?? 0} />
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Value</div>
                <div className="font-bold text-base">
                  <AnimatedCounter
                    value={user.stats?.approvedValue ?? 0}
                    format={(n) => (n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n.toFixed(0))}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
              <div className="text-[10px] text-muted-foreground">
                {user.lastLoginAt
                  ? `Last login ${formatRelativeTime(user.lastLoginAt)}`
                  : 'ยังไม่เคยเข้าระบบ'}
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}