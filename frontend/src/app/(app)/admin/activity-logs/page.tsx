'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Search, RefreshCw, Users, Clock, FileText, CheckCircle2, XCircle, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { ApiResponse } from '@/types/api';

type ManagerLevel = 'DIVISION' | 'DEPARTMENT' | 'SECTION';

interface ActivityUser {
  id: string;
  name: string;
  email: string;
  managerLevel?: ManagerLevel | null;
  isActive: boolean;
  role: { code: string; nameTh: string };
  team?: { id: string; name: string } | null;
  activityCount: number;
  lastActivityAt?: string | null;
  lastActivity?: {
    action: string;
    entityType: string;
    description: string;
    createdAt: string;
  } | null;
}

interface LogItem {
  id: string;
  userId?: string;
  userEmail: string;
  userName: string;
  userRoleCode: string;
  action: string;
  entityType: string;
  entityId?: string;
  description: string;
  ipAddress?: string;
  createdAt: string;
  user?: {
    managerLevel?: ManagerLevel | null;
    role: { code: string; nameTh: string };
    team?: { id: string; name: string } | null;
  } | null;
}

const ENTITY_TYPES = ['Quotation', 'SaleOrder', 'User', 'Invitation', 'Team', 'SystemSetting', 'DocumentCounter'];

const LEVEL_LABEL: Record<ManagerLevel, string> = {
  DIVISION: 'Division Manager',
  DEPARTMENT: 'Department Manager',
  SECTION: 'Section Manager',
};

const ROLE_COLOR: Record<string, string> = {
  MANAGER: 'bg-amber-100 text-amber-700 border-amber-300',
  OFFICER: 'bg-blue-100 text-blue-700 border-blue-300',
  SALES: 'bg-blue-100 text-blue-700 border-blue-300',
  CEO: 'bg-purple-100 text-purple-700 border-purple-300',
  ADMIN: 'bg-red-100 text-red-700 border-red-300',
};

const ACTION_COLOR: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  update: 'bg-blue-100 text-blue-700 border-blue-300',
  delete: 'bg-red-100 text-red-700 border-red-300',
  approve: 'bg-violet-100 text-violet-700 border-violet-300',
  reject: 'bg-orange-100 text-orange-700 border-orange-300',
  submit: 'bg-sky-100 text-sky-700 border-sky-300',
  login: 'bg-slate-100 text-slate-700 border-slate-300',
};

function getActionColor(action: string): string {
  const key = Object.keys(ACTION_COLOR).find((item) => action.toLowerCase().includes(item));
  return key ? ACTION_COLOR[key] : 'bg-gray-100 text-gray-600 border-gray-300';
}

function getPosition(user: Pick<ActivityUser, 'role' | 'managerLevel'>) {
  if (user.role.code === 'MANAGER' && user.managerLevel) return LEVEL_LABEL[user.managerLevel];
  return user.role.nameTh || user.role.code;
}

function getActionIcon(action: string) {
  const normalized = action.toLowerCase();
  if (normalized.includes('approve')) return CheckCircle2;
  if (normalized.includes('reject')) return XCircle;
  if (normalized.includes('submit') || normalized.includes('escalate')) return Send;
  return FileText;
}

export default function AdminActivityLogsPage() {
  const [users, setUsers] = useState<ActivityUser[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');

  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;

  const officerUsers = useMemo(
    () => users.filter((user) => ['OFFICER', 'SALES'].includes(user.role.code)),
    [users],
  );
  const managerUsers = useMemo(
    () => users.filter((user) => user.role.code === 'MANAGER'),
    [users],
  );
  const otherUsers = useMemo(
    () => users.filter((user) => !['OFFICER', 'SALES', 'MANAGER'].includes(user.role.code)),
    [users],
  );

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (entityType) params.set('entityType', entityType);
      const res = await api.get<ApiResponse<ActivityUser[]>>(`/admin/activity-log-users?${params}`);
      const nextUsers = res.data.data ?? [];
      setUsers(nextUsers);
      setSelectedUserId((current) => {
        if (current && nextUsers.some((user) => user.id === current)) return current;
        return nextUsers[0]?.id ?? '';
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadLogs = async (userId: string) => {
    if (!userId) {
      setLogs([]);
      return;
    }

    setLoadingLogs(true);
    try {
      const params = new URLSearchParams();
      params.set('userId', userId);
      params.set('limit', '100');
      if (entityType) params.set('entityType', entityType);
      const res = await api.get<ApiResponse<LogItem[]>>(`/admin/activity-logs?${params}`);
      setLogs(res.data.data ?? []);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => { loadUsers(); }, 300);
    return () => clearTimeout(timer);
  }, [search, entityType]);

  useEffect(() => {
    loadLogs(selectedUserId);
  }, [selectedUserId, entityType]);

  const renderUserList = (title: string, list: ActivityUser[]) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
        <Badge variant="outline" className="text-[10px]">{list.length}</Badge>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-3 text-center">ไม่มีข้อมูล</p>
      ) : list.map((user) => (
        <button
          key={user.id}
          onClick={() => setSelectedUserId(user.id)}
          className={`w-full text-left rounded-lg border p-3 transition-colors ${selectedUserId === user.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}
        >
          <div className="flex items-start gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-medium truncate">{user.name}</span>
                <Badge variant="outline" className={`text-[9px] ${ROLE_COLOR[user.role.code] ?? ''}`}>
                  {getPosition(user)}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{user.activityCount} activities</span>
                {user.team && <span>{user.team.name}</span>}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-red-500" />Activity Logs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ดูกิจกรรมแยกตาม user พร้อม timeline รายละเอียดว่าใครทำอะไร เมื่อไหร่
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { loadUsers(); if (selectedUserId) loadLogs(selectedUserId); }}>
          <RefreshCw className="h-4 w-4" />Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="ค้นหา user หรือกิจกรรม..." className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <select value={entityType} onChange={(event) => setEntityType(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">ทุก Entity</option>
          {ENTITY_TYPES.map((entity) => <option key={entity} value={entity}>{entity}</option>)}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />Users with Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {loadingUsers ? (
              <div className="space-y-2">{[0, 1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-16" />)}</div>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">ไม่มีข้อมูล activity</p>
            ) : (
              <>
                {renderUserList('Officer', officerUsers)}
                {renderUserList('Manager', managerUsers)}
                {otherUsers.length > 0 && renderUserList('Other', otherUsers)}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                {selectedUser ? `${selectedUser.name} Activity Timeline` : 'Activity Timeline'}
              </span>
              {selectedUser && (
                <Badge variant="outline" className={`text-[10px] ${ROLE_COLOR[selectedUser.role.code] ?? ''}`}>
                  {getPosition(selectedUser)}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedUser ? (
              <div className="py-16 text-center text-muted-foreground text-sm">เลือก user เพื่อดูรายละเอียด</div>
            ) : loadingLogs ? (
              <div className="space-y-3">{[0, 1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-20" />)}</div>
            ) : logs.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">ไม่มี activity ตาม filter นี้</div>
            ) : (
              <div className="relative space-y-3">
                {logs.map((log, index) => {
                  const Icon = getActionIcon(log.action);
                  return (
                    <div key={log.id} className="relative flex gap-3">
                      {index !== logs.length - 1 && <div className="absolute left-4 top-9 bottom-[-14px] w-px bg-border" />}
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border bg-background ${getActionColor(log.action)}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 rounded-lg border bg-muted/10 p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] ${getActionColor(log.action)}`}>{log.action}</Badge>
                          <Badge variant="outline" className="text-[10px]">{log.entityType}</Badge>
                          <span className="text-[11px] text-muted-foreground">{formatDate(log.createdAt)}</span>
                        </div>
                        <p className="text-sm mt-1">{log.description}</p>
                        <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                          {log.entityId && <span>Entity ID: {log.entityId}</span>}
                          {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
