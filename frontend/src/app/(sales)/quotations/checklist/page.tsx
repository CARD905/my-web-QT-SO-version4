'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, CheckSquare, FileText, Upload, ChevronRight, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/utils';
import { toast } from 'sonner';
import type { ApiResponse } from '@/types/api';

interface ChecklistItem {
  id: string;
  quotationNo: string;
  customerCompany: string;
  grandTotal: string | number;
  currency: string;
  status: 'APPROVED';
  approvedAt?: string;
  poFileUrl?: string | null;
  poFileName?: string | null;
  createdBy: { id: string; name: string };
}

export default function ChecklistPage() {
  const [list, setList] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('status', 'APPROVED');
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
  }, [search]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
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
      <div className="grid grid-cols-1 gap-3 max-w-xs">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{list.length}</span>
            </div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              รออัปโหลด PO
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาเลขที่ QT, ลูกค้า..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4 flex gap-2 items-start">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <CheckSquare className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="font-medium">ไม่มีรายการที่ต้องแนบ PO</p>
              <p className="text-xs text-muted-foreground mt-1">
                รายการที่ Manager อนุมัติแล้วจะมาแสดงที่นี่
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.map((q) => (
            <Link key={q.id} href={`/quotations/checklist/${q.id}`}>
              <Card className="cursor-pointer hover:border-primary/50 transition-all hover:-translate-y-0.5">
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 bg-blue-100 text-blue-800">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{q.quotationNo}</span>
                        <Badge
                          variant="outline"
                          className="text-xs bg-blue-100 text-blue-800 border-blue-200"
                        >
                          รออัปโหลด PO
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground truncate mt-0.5">
                        {q.customerCompany}
                      </div>
                      {q.poFileName && (
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {q.poFileName}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {formatMoney(q.grandTotal, q.currency)}
                      </div>
                      {q.approvedAt && (
                        <div className="text-xs text-muted-foreground">
                          อนุมัติ {formatDate(q.approvedAt)}
                        </div>
                      )}
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