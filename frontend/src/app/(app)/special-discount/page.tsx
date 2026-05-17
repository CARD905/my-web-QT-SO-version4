'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, Clock, CheckCircle2, XCircle, ChevronRight, Inbox, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/utils';
import type { ApiResponse } from '@/types/api';

interface SpecialDiscountItem {
  id: string;
  quotationNo: string;
  customerCompany: string;
  grandTotal: string | number;
  currency: string;
  specialDiscountPercent: string | number;
  specialDiscountReason: string;
  specialDiscountStatus: string;
  createdAt: string;
  createdBy?: { id: string; name: string; email: string };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING_CEO: { label: 'รอ CEO อนุมัติ', color: 'bg-amber-100 text-amber-700 border-amber-300', icon: Clock },
  APPROVED:    { label: 'อนุมัติแล้ว',    color: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: CheckCircle2 },
  REJECTED:    { label: 'ปฏิเสธ',         color: 'bg-red-100 text-red-700 border-red-300', icon: XCircle },
  MODIFIED:    { label: 'ปรับแล้ว',        color: 'bg-blue-100 text-blue-700 border-blue-300', icon: CheckCircle2 },
};

export default function SpecialDiscountListPage() {
  const [list, setList] = useState<SpecialDiscountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('PENDING_CEO');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get<ApiResponse<SpecialDiscountItem[]>>(
          '/quotations/special-discount/pending',
        );
        setList(res.data.data ?? []);
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = filter === 'ALL' ? list : list.filter((i) => i.specialDiscountStatus === filter);
  const pendingCount = list.filter((i) => i.specialDiscountStatus === 'PENDING_CEO').length;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Star className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Special Discount</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              คำขอส่วนลดพิเศษที่ต้องการการอนุมัติจาก CEO
            </p>
          </div>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="ml-2">{pendingCount} รอดำเนินการ</Badge>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {[
          { value: 'PENDING_CEO', label: 'รอ CEO อนุมัติ' },
          { value: 'ALL', label: 'ทั้งหมด' },
        ].map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === f.value ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            }`}>
            {f.label}
            {f.value === 'PENDING_CEO' && pendingCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px]">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[0,1,2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <Inbox className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground font-medium">
              {filter === 'PENDING_CEO' ? 'ไม่มีคำขอที่รออนุมัติ' : 'ไม่มีคำขอ Special Discount'}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {filter === 'PENDING_CEO' ? 'คำขอทั้งหมดได้รับการพิจารณาแล้ว 🎉' : 'ยังไม่มีคำขอ Special Discount'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const sc = STATUS_CONFIG[item.specialDiscountStatus] ?? STATUS_CONFIG['PENDING_CEO'];
            const StatusIcon = sc.icon;
            const isPending = item.specialDiscountStatus === 'PENDING_CEO';

            return (
              <Link key={item.id} href={`/special-discount/${item.id}`}>
                <Card className={`cursor-pointer transition-all hover:border-primary/50 ${isPending ? 'border-amber-300 dark:border-amber-700' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* Discount bubble */}
                        <div className={`h-12 w-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${isPending ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-muted'}`}>
                          <Star className={`h-4 w-4 ${isPending ? 'text-amber-600' : 'text-muted-foreground'}`} />
                          <span className={`text-sm font-bold ${isPending ? 'text-amber-700' : 'text-muted-foreground'}`}>
                            {Number(item.specialDiscountPercent)}%
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{item.quotationNo}</span>
                            <Badge variant="outline" className={`text-[10px] ${sc.color}`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {sc.label}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-0.5">{item.customerCompany}</div>
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            เหตุผล: {item.specialDiscountReason}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            <span>Sales: {item.createdBy?.name || '-'}</span>
                            <span>·</span>
                            <span>{formatDate(item.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-2">
                        <div className="font-bold text-base">{formatMoney(item.grandTotal, item.currency as any)}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          ปกติ 20% → ขอ {Number(item.specialDiscountPercent)}%
                        </div>
                        {isPending && (
                          <div className="flex items-center gap-1 text-xs text-primary font-medium">
                            พิจารณา <ChevronRight className="h-3 w-3" />
                          </div>
                        )}
                      </div>
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