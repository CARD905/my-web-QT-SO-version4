'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Settings, Users, Shield, Activity, History,
  Building2, ChevronRight, FileText, Key, BarChart3, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface AdminStats {
  totalUsers: number;
  totalTeams: number;
  totalDepartments: number;
  failedLogins: number;
  recentLogs: Array<{
    id: string; action: string; userName: string;
    description: string; createdAt: string;
  }>;
}

const QUICK_LINKS = [
  { href: '/admin/users',           icon: Users,     label: 'จัดการ Users',      color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/20' },
  { href: '/admin/settings',        icon: Settings,  label: 'System Settings',    color: 'text-violet-600',  bg: 'bg-violet-50 dark:bg-violet-900/20' },
  { href: '/admin/approval',        icon: Shield,    label: 'Approval Authority', color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20' },
  { href: '/admin/teams',           icon: Building2, label: 'Team & Department',  color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  { href: '/admin/activity-logs',   icon: Activity,  label: 'Activity Logs',      color: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-900/20' },
  { href: '/admin/login-history',   icon: History,   label: 'Login History',      color: 'text-slate-600',   bg: 'bg-slate-50 dark:bg-slate-800' },
  { href: '/admin/invitations',     icon: Key,       label: 'Invitations',        color: 'text-pink-600',    bg: 'bg-pink-50 dark:bg-pink-900/20' },
  { href: '/admin/running-numbers', icon: FileText,  label: 'Running Numbers',    color: 'text-cyan-600',    bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // ✅ ใช้ any แล้ว cast เอาเอง — หลีกเลี่ยง meta type error
        const [usersRes, logsRes, loginRes, teamsRes] = await Promise.all([
          api.get<any>('/admin/users?limit=1'),
          api.get<any>('/admin/activity-logs?limit=5'),
          api.get<any>('/admin/login-history?success=false&limit=1'),
          api.get<any>('/admin/departments'),
        ]);

        const departments = teamsRes.data.data ?? [];
        setStats({
          totalUsers:       usersRes.data.meta?.total ?? 0,
          totalTeams:       departments.reduce((acc: number, d: any) => acc + (d.teams?.length ?? 0), 0),
          totalDepartments: departments.length,
          failedLogins:     loginRes.data.meta?.total ?? 0,
          recentLogs:       logsRes.data.data ?? [],
        });
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-red-500" />Admin Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">System Administration Panel</p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0,1,2,3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Users',    value: stats?.totalUsers ?? 0,    icon: Users,         color: 'text-blue-600',   alert: false },
            { label: 'Departments',    value: stats?.totalDepartments ?? 0, icon: Building2,   color: 'text-emerald-600',alert: false },
            { label: 'Teams',          value: stats?.totalTeams ?? 0,    icon: BarChart3,      color: 'text-violet-600', alert: false },
            { label: 'Failed Logins',  value: stats?.failedLogins ?? 0,  icon: AlertTriangle,  color: 'text-red-600',    alert: true },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className={`text-3xl font-bold ${s.alert && s.value > 0 ? 'text-red-600' : ''}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <s.icon className={`h-3 w-3 ${s.color}`} />{s.label}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {QUICK_LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="hover:border-primary/50 transition-all cursor-pointer h-full">
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <div className={`h-10 w-10 rounded-xl ${link.bg} flex items-center justify-center`}>
                  <link.icon className={`h-5 w-5 ${link.color}`} />
                </div>
                <span className="text-xs font-medium">{link.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Activity ล่าสุด
            <Link href="/admin/activity-logs" className="ml-auto text-[11px] text-primary hover:underline flex items-center gap-0.5">
              ดูทั้งหมด <ChevronRight className="h-3 w-3" />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[0,1,2,3,4].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (stats?.recentLogs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">ไม่มี activity</p>
          ) : (
            <div className="divide-y">
              {(stats?.recentLogs ?? []).map((log: any) => (
                <div key={log.id} className="py-2.5 flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                    {log.userName?.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">{log.description}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-2">
                      <span>{log.userName}</span>
                      <Badge variant="outline" className="text-[9px] py-0">{log.action}</Badge>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground shrink-0">{formatRelativeTime(log.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}