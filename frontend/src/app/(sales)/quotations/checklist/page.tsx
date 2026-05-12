'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, CheckSquare, FileText, Upload, XCircle, ChevronRight, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/utils';
import { toast } from 'sonner';
import type { ApiResponse } from '@/types/api';

interface ChecklistItem {
  id: string; quotationNo: string; customerCompany: string;
  grandTotal: string | number; currency: string;
  status: 'APPROVED' | 'PO_REJECTED';
  approvedAt?: string;
  poFileUrl?: string | null; poFileName?: string | null;
  poRejectedAt?: string | null; poRejectionReason?: string | null;
  createdBy: { id: string; name: string };
}

// Checklist แสดงเฉพาะ APPROVED + PO_REJECTED
// PO_PENDING ย้ายไปหน้า Pending Sale Order
const STATUS_CONFIG = {
  APPROVED:    { label: 'รออัปโหลด PO', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Upload, description: 'กดเข้าไปแนบใบ PO' },
  PO_REJECTED: { label: 'PO ถูกปฏิเสธ', color: 'bg-red-100 text-red-800 border-red-200',   icon: XCircle, description: 'อัปโหลด PO ใหม่' },
} as const;

export default function ChecklistPage() {
  const [list, setList] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      // เฉพาะ APPROVED + PO_REJECTED เท่านั้น
      if (statusFilter) {
        params.set('status', statusFilter);
      } else {
        // ถ้าไม่ได้ filter → fetch ทั้ง 2 status แยกแล้วรวม
        const [approvedRes, rejectedRes] = await Promise.all([
          api.get<ApiResponse<ChecklistItem[]>>('/quotations/checklist?status=APPROVED'),
          api.get<ApiResponse<ChecklistItem[]>>('/quotations/checklist?status=PO_REJECTED'),
        ]);
        const combined = [
          ...(approvedRes.data.data ?? []),
          ...(rejectedRes.data.data ?? []),
        ].sort((a, b) => {
          // PO_REJECTED ขึ้นก่อน (urgent)
          if (a.status === 'PO_REJECTED' && b.status !== 'PO_REJECTED') return -1;
          if (b.status === 'PO_REJECTED' && a.status !== 'PO_REJECTED') return 1;
          return 0;
        });
        setList(combined);
        setLoading(false);
        return;
      }
      const res = await api.get<ApiResponse<ChecklistItem[]>>(`/quotations/checklist?${params}`);
      setList(res.data.data ?? []);
    } catch (err) {
      setError(getApiErrorMessage(err));
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const h = setTimeout(fetchList, 300);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  const stats = list.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CheckSquare className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Checklist — แนบ PO</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          ใบเสนอราคาที่อนุมัติแล้ว — อัปโหลด PO แล้วส่งไปหน้า Pending Sale Order
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map((s) => {
          const cfg = STATUS_CONFIG[s];
          const Icon = cfg.icon;
          return (
            <Card key={s} className={s === 'PO_REJECTED' && (stats[s] ?? 0) > 0 ? 'border-red-300' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{stats[s] || 0}</span>
                </div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{cfg.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="ค้นหาเลขที่ QT, ลูกค้า..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1">
            {['', 'APPROVED', 'PO_REJECTED'].map((s) => (
              <button key={s || 'all'} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}`}>
                {s ? STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label || s : 'ทั้งหมด'}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4 flex gap-2 items-start">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <CheckSquare className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="font-medium">ไม่มีรายการที่ต้องแนบ PO</p>
              <p className="text-xs text-muted-foreground mt-1">รายการที่ Manager อนุมัติแล้วจะมาแสดงที่นี่</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.map((q) => {
            const cfg = STATUS_CONFIG[q.status];
            const Icon = cfg.icon;
            return (
              <Link key={q.id} href={`/quotations/checklist/${q.id}`}>
                <Card className={`cursor-pointer hover:border-primary/50 transition-all hover:-translate-y-0.5 ${q.status === 'PO_REJECTED' ? 'border-red-200' : ''}`}>
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${cfg.color.split(' ').slice(0, 2).join(' ')}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{q.quotationNo}</span>
                          <Badge variant="outline" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground truncate mt-0.5">{q.customerCompany}</div>
                        {q.status === 'PO_REJECTED' && q.poRejectionReason && (
                          <div className="text-xs text-red-600 mt-1 truncate">⚠ {q.poRejectionReason}</div>
                        )}
                        {q.poFileName && (
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <FileText className="h-3 w-3" />{q.poFileName}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-lg font-bold">{formatMoney(q.grandTotal, q.currency)}</div>
                        {q.approvedAt && <div className="text-xs text-muted-foreground">อนุมัติ {formatDate(q.approvedAt)}</div>}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}