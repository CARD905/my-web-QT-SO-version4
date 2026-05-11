'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  CheckSquare,
  FileText,
  Upload,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatDate, formatMoney } from '@/lib/utils';
import type { ApiResponse } from '@/types/api';

// ─── Type ────────────────────────────────────────────────────────────────
interface ChecklistItem {
  id: string;
  quotationNo: string;
  customerCompany: string;
  grandTotal: string | number;
  currency: string;
  status: 'APPROVED' | 'PO_PENDING' | 'PO_APPROVED' | 'PO_REJECTED';
  approvedAt?: string;
  poFileUrl?: string | null;
  poFileName?: string | null;
  poUploadedAt?: string | null;
  poSubmittedAt?: string | null;
  poApprovedAt?: string | null;
  poRejectedAt?: string | null;
  poRejectionReason?: string | null;
  createdBy: { id: string; name: string };
  saleOrder?: { id: string; saleOrderNo: string } | null;
}

// ─── Status configuration ────────────────────────────────────────────────
const STATUS_CONFIG = {
  APPROVED: {
    label: 'รออัปโหลด PO',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200',
    icon: Upload,
    description: 'กดเข้าไปแนบใบ PO',
  },
  PO_PENDING: {
    label: 'PO รอการตรวจสอบ',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200',
    icon: Clock,
    description: 'รอ Manager ตรวจสอบ',
  },
  PO_APPROVED: {
    label: 'PO อนุมัติแล้ว',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200',
    icon: CheckCircle2,
    description: 'สร้าง Sale Order แล้ว',
  },
  PO_REJECTED: {
    label: 'PO ถูกปฏิเสธ',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200',
    icon: XCircle,
    description: 'กรุณาอัปโหลด PO ใหม่',
  },
} as const;

const STATUS_TABS = ['', 'APPROVED', 'PO_PENDING', 'PO_APPROVED', 'PO_REJECTED'];

export default function ChecklistPage() {
  const t = useT();
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
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get<ApiResponse<ChecklistItem[]>>(
        `/quotations/checklist?${params}`,
      );
      setList(res.data.data ?? []);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Debounced fetch
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchList();
    }, 300);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  // ─── Group by status (สำหรับ stats) ─────────────────────────────────────
  const stats = list.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CheckSquare className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-gradient-aurora">Checklist Quotation</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          รายการใบเสนอราคาที่อนุมัติแล้ว — แนบใบ PO และส่งให้ Manager ตรวจสอบ
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map((status) => {
          const cfg = STATUS_CONFIG[status];
          const Icon = cfg.icon;
          return (
            <Card key={status} className="hover-lift">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold number-ticker">
                    {stats[status] || 0}
                  </span>
                </div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {cfg.label}
                </div>
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
            <Input
              placeholder="ค้นหาเลขที่ QT, ลูกค้า..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {STATUS_TABS.map((s) => (
              <button
                key={s || 'all'}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === s
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                {s ? STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label || s : 'ทั้งหมด'}
              </button>
            ))}
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
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <CheckSquare className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="font-medium">ไม่มีรายการ Checklist</p>
              <p className="text-xs text-muted-foreground mt-1">
                ใบเสนอราคาที่ Manager อนุมัติแล้วจะมาแสดงที่นี่
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/quotations">
                <FileText className="h-4 w-4" />
                ไปหน้า Quotations
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 animate-stagger">
          {list.map((q) => {
            const cfg = STATUS_CONFIG[q.status];
            const Icon = cfg.icon;
            return (
              <Link key={q.id} href={`/quotations/checklist/${q.id}`}>
                <Card className="cursor-pointer hover:border-primary/50 hover-lift transition-all">
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                    {/* Left: status icon + info */}
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div
                        className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${cfg.color.split(' ').slice(0, 2).join(' ')}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{q.quotationNo}</span>
                          <Badge variant="outline" className={`text-xs ${cfg.color}`}>
                            {cfg.label}
                          </Badge>
                          {q.saleOrder && (
                            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                              {q.saleOrder.saleOrderNo}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground truncate mt-0.5">
                          {q.customerCompany}
                        </div>
                        {q.status === 'PO_REJECTED' && q.poRejectionReason && (
                          <div className="text-xs text-red-600 dark:text-red-400 mt-1 truncate">
                            ⚠ {q.poRejectionReason}
                          </div>
                        )}
                        {q.poFileName && (
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {q.poFileName}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: amount + action */}
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
            );
          })}
        </div>
      )}
    </div>
  );
}