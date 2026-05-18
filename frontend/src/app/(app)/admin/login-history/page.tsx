'use client';

import { useEffect, useState } from 'react';
import { LogIn, Search, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface LoginHistoryItem {
  id: string;
  userId?: string;
  email: string;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
  createdAt: string;
  user?: { id: string; name: string } | null;
}

const REASON_LABEL: Record<string, string> = {
  WRONG_PASSWORD:   'รหัสผ่านผิด',
  USER_NOT_FOUND:   'ไม่พบ User',
  ACCOUNT_DISABLED: 'Account ถูกปิด',
};

export default function AdminLoginHistoryPage() {
  const [logs, setLogs] = useState<LoginHistoryItem[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'success' | 'fail'>('all');
  const [page, setPage] = useState(1);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', p.toString());
      params.set('limit', '50');
      if (filter === 'success') params.set('success', 'true');
      if (filter === 'fail') params.set('success', 'false');
      if (search) params.set('search', search);
      // ✅ ใช้ endpoint ที่ถูกต้อง
      const res = await api.get<any>(`/admin/login-history?${params}`);
      setLogs(res.data.data ?? []);
      setMeta(res.data.meta);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(1); }, 300);
    return () => clearTimeout(t);
  }, [search, filter]);

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LogIn className="h-6 w-6 text-slate-500" />Login History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {meta ? `${meta.total?.toLocaleString()} records` : 'ประวัติการเข้าสู่ระบบทั้งหมด'}
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
          <Input placeholder="ค้นหา email..." className="pl-9" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {(['all', 'success', 'fail'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}`}>
              {f === 'all' ? 'ทั้งหมด' : f === 'success' ? '✅ สำเร็จ' : '❌ ล้มเหลว'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary badges */}
      {meta && (
        <div className="flex gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />ทั้งหมด {meta.total} รายการ
          </div>
          {filter === 'fail' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-700 dark:text-red-300">
              <XCircle className="h-3.5 w-3.5" />Login ล้มเหลว
            </div>
          )}
        </div>
      )}

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
                <div key={log.id} className={`flex items-start gap-3 p-3 hover:bg-muted/20 ${!log.success ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${log.success ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    {log.success
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      : <XCircle className="h-4 w-4 text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold">{log.email}</span>
                      {log.user?.name && (
                        <Badge variant="outline" className="text-[9px] py-0">{log.user.name}</Badge>
                      )}
                      {log.success ? (
                        <Badge variant="outline" className="text-[9px] py-0 bg-emerald-50 text-emerald-700 border-emerald-300">✅ สำเร็จ</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] py-0 bg-red-50 text-red-700 border-red-300">
                          ❌ {log.reason ? (REASON_LABEL[log.reason] ?? log.reason) : 'ล้มเหลว'}
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                      <span>{formatDate(log.createdAt)}</span>
                      {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                      {log.userAgent && (
                        <span className="truncate max-w-[300px]" title={log.userAgent}>
                          {log.userAgent.split(' ')[0]}
                        </span>
                      )}
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
          <Button variant="outline" size="sm" disabled={page <= 1}
            onClick={() => { setPage(page - 1); load(page - 1); }}>ก่อนหน้า</Button>
          <span className="text-xs text-muted-foreground">หน้า {page} / {meta.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= meta.totalPages}
            onClick={() => { setPage(page + 1); load(page + 1); }}>ถัดไป</Button>
        </div>
      )}
    </div>
  );
}