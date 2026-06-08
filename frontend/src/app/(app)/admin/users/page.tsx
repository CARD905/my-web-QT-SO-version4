'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Users, Search, Plus, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { ApiResponse } from '@/types/api';

interface UserItem {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  isTeamLead: boolean;
  lastLoginAt?: string | null;
  managerLevel?: 'DIVISION' | 'DEPARTMENT' | 'SECTION' | null;
  role: { id: string; code: string; nameTh: string };
  team?: { id: string; name: string } | null;
}

interface RoleOption {
  id: string;
  code: string;
  nameTh: string;
  level: number;
}

const ROLE_COLOR: Record<string, string> = {
  CEO: 'bg-purple-100 text-purple-700 border-purple-300',
  MANAGER: 'bg-amber-100 text-amber-700 border-amber-300',
  OFFICER: 'bg-blue-100 text-blue-700 border-blue-300',
  SALES: 'bg-blue-100 text-blue-700 border-blue-300',
};

const MANAGER_LEVEL_LABEL: Record<string, string> = {
  DIVISION: 'Division',
  DEPARTMENT: 'Dept',
  SECTION: 'Section',
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', p.toString());
      params.set('limit', '20');
      params.set('excludeRoleCode', 'ADMIN');
      if (search) params.set('search', search);
      if (roleFilter) params.set('roleCode', roleFilter);

      const [uRes, rRes] = await Promise.all([
        api.get<ApiResponse<UserItem[]>>(`/admin/users?${params}`),
        api.get<ApiResponse<RoleOption[]>>('/admin/users/_roles'),
      ]);

      setUsers(uRes.data.data ?? []);
      setMeta(uRes.data.meta);
      setRoles((rRes.data.data ?? []).filter((role) => role.code !== 'ADMIN'));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(1); }, 300);
    return () => clearTimeout(t);
  }, [search, roleFilter, load]);

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-500 shrink-0" />
            <span className="page-heading">จัดการ Users</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {meta ? `${meta.total} users ทั้งหมด` : 'รายการผู้ใช้งาน'}
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

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาชื่อ, email..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[140px]"
        >
          <option value="">ทุก Role</option>
          {roles.map((role) => <option key={role.id} value={role.code}>{role.nameTh}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : users.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground text-sm">ไม่พบ user</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <Link key={user.id} href={`/users/${user.id}`} className="block">
              <Card className={`transition-colors hover:bg-muted/30 ${!user.isActive ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${user.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {user.name.slice(0, 1).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{user.name}</span>
                        <Badge variant="outline" className={`text-[10px] ${ROLE_COLOR[user.role.code] ?? ''}`}>
                          {user.role.nameTh}
                        </Badge>
                        {user.isTeamLead && <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">Lead</Badge>}
                        {user.managerLevel && (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">
                            {MANAGER_LEVEL_LABEL[user.managerLevel] ?? user.managerLevel}
                          </Badge>
                        )}
                        {!user.isActive && <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-300">Inactive</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{user.email}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                        {user.team && <span>{user.team.name}</span>}
                        {user.lastLoginAt ? <span>เข้าสู่ระบบล่าสุด {formatDate(user.lastLoginAt)}</span> : <span>ยังไม่เคย login</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1); }}>ก่อนหน้า</Button>
          <span className="text-xs text-muted-foreground">หน้า {page} / {meta.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => { setPage(page + 1); load(page + 1); }}>ถัดไป</Button>
        </div>
      )}
    </div>
  );
}
