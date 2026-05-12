'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Clock, FileText, ChevronRight, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/utils';
import { toast } from 'sonner';
import type { ApiResponse } from '@/types/api';

interface PendingSOItem {
  id: string; quotationNo: string; customerCompany: string;
  grandTotal: string | number; currency: string;
  status: 'PO_PENDING';
  approvedAt?: string;
  poFileUrl?: string | null; poFileName?: string | null;
  poSubmittedAt?: string | null;
  createdBy: { id: string; name: string };
}

export default function PendingSaleOrderPage() {
  const [list, setList] = useState<PendingSOItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('status', 'PO_PENDING');
      if (search) params.set('search', search);
      const res = await api.get<ApiResponse<PendingSOItem[]>>(`/quotations/checklist?${params}`);
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
  }, [search]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Clock className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-bold">Pending Sale Order</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          ใบเสนอราคาที่ Officer ส่ง PO มาแล้ว — Manager ตรวจสอบเพื่ออนุมัติสร้าง Sale Order
        </p>
      </div>

      {/* Stats */}
      <Card className={list.length > 0 ? 'border-amber-300 bg-amber-50/30 dark:bg-amber-900/10' : ''}>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <div className="text-3xl font-bold">{list.length}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">รายการรอการตรวจสอบ</div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="ค้นหาเลขที่ QT, ลูกค้า..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4 flex gap-2">
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
            <Clock className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="font-medium">ไม่มีรายการรอตรวจสอบ</p>
              <p className="text-xs text-muted-foreground mt-1">เมื่อ Officer ส่ง PO มาแล้ว จะมาแสดงที่นี่</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.map((q) => (
            <Link key={q.id} href={`/quotations/pending-sale-order/${q.id}`}>
              <Card className="cursor-pointer hover:border-amber-400 border-amber-200 transition-all hover:-translate-y-0.5">
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{q.quotationNo}</span>
                        <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                          รอตรวจสอบ PO
                        </Badge>
                        {q.poFileName && (
                          <Badge variant="outline" className="text-xs">
                            <FileText className="h-3 w-3 mr-1" />มี PO แนบ
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground truncate mt-0.5">{q.customerCompany}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>โดย {q.createdBy.name}</span>
                        {q.poSubmittedAt && <span>· ส่ง PO เมื่อ {formatDate(q.poSubmittedAt)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-lg font-bold">{formatMoney(q.grandTotal, q.currency)}</div>
                      {q.approvedAt && <div className="text-xs text-muted-foreground">QT อนุมัติ {formatDate(q.approvedAt)}</div>}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}