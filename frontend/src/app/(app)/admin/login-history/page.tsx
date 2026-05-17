'use client';

import { useEffect, useState } from 'react';
import { Activity, Search, RefreshCw, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { ApiResponse } from '@/types/api';

interface LogItem {
  id: string; userId?: string; userEmail: string; userName: string;
  userRoleCode: string; action: string; entityType: string;
  entityId?: string; description: string; ipAddress?: string;
  createdAt: string;
}

const ACTION_COLOR: Record<string, string> = {
  'create': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  'update': 'bg-blue-100 text-blue-700 border-blue-300',
  'delete': 'bg-red-100 text-red-700 border-red-300',
  'approve': 'bg-violet-100 text-violet-700 border-violet-300',
  'reject':  'bg-orange-100 text-orange-700 border-orange-300',
  'login':   'bg-slate-100 text-slate-700 border-slate-300',
};

function getActionColor(action: string): string {
  const key = Object.keys(ACTION_COLOR).find((k) => action.toLowerCase().includes(k));
  return key ? ACTION_COLOR[key] : 'bg-gray-100 text-gray-600 border-gray-300';
}

export default function AdminActivityLogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', p.toString());
      params.set('limit', '50');
      if (search) params.set('search', search);
      if (entityType) params.set('entityType', entityType);
      const res = await api.get<any>(`/admin/activity-logs?${params}`);
      setLogs(res.data.data ?? []);
      setMeta(res.data.meta);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(1); }, 300);
    return () => clearTimeout(t);
  }, [search, entityType]);

  const ENTITY_TYPES = ['Quotation', 'SaleOrder', 'User', 'Invitation', 'Team', 'SystemSetting', 'DocumentCounter'];

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-red-500" />Activity Logs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {meta ? `${meta.total?.toLocaleString()} records` : 'ดู activity ทั้งหมดในระบบ'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(page)}>
          <RefreshCw className="h-4 w-4" />Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="ค้นหา user, description..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">ทุก Entity</option>
          {ENTITY_TYPES.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[0,1,2,3,4].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">ไม่มีข้อมูล</div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 hover:bg-muted/20">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary mt-0.5">
                    {log.userName?.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold">{log.userName}</span>
                      <Badge variant="outline" className="text-[9px] py-0">{log.userRoleCode}</Badge>
                      <Badge variant="outline" className={`text-[9px] py-0 ${getActionColor(log.action)}`}>{log.action}</Badge>
                      <Badge variant="outline" className="text-[9px] py-0">{log.entityType}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{log.description}</p>
                    <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-2">
                      <span>{formatDate(log.createdAt)}</span>
                      {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
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