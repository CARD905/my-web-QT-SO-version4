'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Inbox, AlertTriangle, FileText, ShoppingCart,
  CheckCircle2, ChevronRight, RefreshCw, ArrowUpRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, formatMoney, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
import type { ApiResponse, Quotation, SaleOrder } from '@/types/api';

// ─── Status config ─────────────────────────────────────────────────────────────
const QT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:           { label: 'Pending',        color: '#f59e0b', bg: '#fef3c7' },
  PENDING_BACKUP:    { label: 'Pending Backup',  color: '#f97316', bg: '#ffedd5' },
  PENDING_ESCALATED: { label: 'Escalated',       color: '#ef4444', bg: '#fee2e2' },
  PO_PENDING:        { label: 'PO รอตรวจ',      color: '#06b6d4', bg: '#cffafe' },
};

const SO_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:         { label: 'Draft',         color: '#94a3b8', bg: '#f1f5f9' },
  PENDING_REVIEW:{ label: 'รอ Manager',   color: '#f59e0b', bg: '#fef3c7' },
  CONFIRMED:     { label: 'Confirmed',     color: '#10b981', bg: '#d1fae5' },
  REJECTED:      { label: 'Rejected',      color: '#ef4444', bg: '#fee2e2' },
};

function StatusPill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color, background: bg }}>
      {label}
    </span>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────
function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2">
      <Inbox className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Quotation card ────────────────────────────────────────────────────────────
function QtCard({ q, isManager }: { q: Quotation; isManager: boolean }) {
  const cfg = QT_STATUS[q.status] ?? { label: q.status, color: '#94a3b8', bg: '#f1f5f9' };
  const isPo = q.status === 'PO_PENDING';
  const href = isPo ? `/quotations/${q.id}` : (isManager ? `/quotations/${q.id}` : `/quotations/${q.id}`);
  const ageMs = q.submittedAt ? Date.now() - new Date(q.submittedAt as string).getTime() : null;
  const ageHrs = ageMs ? ageMs / (1000 * 60 * 60) : null;
  const isUrgent = ageHrs && ageHrs > 48;

  return (
    <Link href={href}
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5 ${
        isUrgent ? 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10' : 'border-border/60 hover:border-border'
      }`}>
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
        isPo ? 'bg-cyan-100 dark:bg-cyan-900/30' : isUrgent ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
      }`}>
        <FileText className={`h-4 w-4 ${isPo ? 'text-cyan-600' : isUrgent ? 'text-red-500' : 'text-amber-600'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold">{q.quotationNo}</span>
          <StatusPill {...cfg} />
          {isUrgent && <span className="text-[10px] font-bold text-red-600 animate-pulse">⚡ ด่วน</span>}
        </div>
        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
          {q.customerCompany}
          {q.createdBy?.name && <> · โดย {q.createdBy.name}</>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[13px] font-bold tabular-nums">{formatMoney(q.grandTotal, q.currency)}</div>
        <div className="text-[10px] text-muted-foreground">
          {q.submittedAt ? formatRelativeTime(q.submittedAt as string) : formatDate(q.issueDate as string)}
        </div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </Link>
  );
}

// ─── Sale Order card ───────────────────────────────────────────────────────────
function SoCard({ so }: { so: SaleOrder }) {
  const cfg = SO_STATUS[so.status] ?? { label: so.status, color: '#94a3b8', bg: '#f1f5f9' };
  const isPendingReview = so.status === 'PENDING_REVIEW';
  const isRejected = so.status === 'REJECTED';

  return (
    <Link href={`/sale-orders/${so.id}`}
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5 ${
        isRejected ? 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10'
        : isPendingReview ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10'
        : 'border-border/60 hover:border-border'
      }`}>
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
        isRejected ? 'bg-red-100 dark:bg-red-900/30'
        : isPendingReview ? 'bg-amber-100 dark:bg-amber-900/30'
        : 'bg-slate-100 dark:bg-slate-800'
      }`}>
        <ShoppingCart className={`h-4 w-4 ${isRejected ? 'text-red-500' : isPendingReview ? 'text-amber-600' : 'text-slate-500'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold">{so.saleOrderNo}</span>
          <StatusPill {...cfg} />
        </div>
        <div className="text-[11px] text-muted-foreground truncate mt-0.5">{so.customerCompany}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[13px] font-bold tabular-nums">{formatMoney(so.grandTotal, so.currency)}</div>
        <div className="text-[10px] text-muted-foreground">{formatDate(so.issueDate as string)}</div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </Link>
  );
}

// ─── Panel ─────────────────────────────────────────────────────────────────────
function Panel({
  title, icon, count, loading, children, viewAllHref, accent,
}: {
  title: string; icon: React.ReactNode; count: number; loading: boolean;
  children: React.ReactNode; viewAllHref: string; accent: string;
}) {
  return (
    <Card className="border border-border/60 shadow-none rounded-2xl flex flex-col">
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-t-2xl border-b border-border/50 bg-gradient-to-r ${accent}`}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[13px] font-semibold">{title}</span>
          {count > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-white/20 text-[11px] font-bold text-white">
              {count}
            </span>
          )}
        </div>
        <Link href={viewAllHref} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          ดูทั้งหมด <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      <CardContent className="p-3 flex-1 flex flex-col gap-2 overflow-y-auto max-h-[600px]">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
          : children
        }
      </CardContent>
    </Card>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function ApprovalQueuePage() {
  const { role, loading: permLoading } = usePermissions();
  const isManager = role?.code === 'MANAGER' || role?.code === 'CEO' || role?.code === 'ADMIN';

  const [qtItems, setQtItems] = useState<Quotation[]>([]);
  const [soItems, setSoItems] = useState<SaleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);

  const fetchAll = useCallback(async () => {
    if (permLoading) return;
    setLoading(true);
    try {
      if (isManager) {
        // Manager: QTs assigned to me (pending approval) + PO_PENDING; SOs PENDING_REVIEW
        const [pendingRes, poRes, soRes] = await Promise.all([
          api.get<ApiResponse<Quotation[]>>('/quotations?status=PENDING&limit=100'),
          api.get<ApiResponse<Quotation[]>>('/quotations?status=PO_PENDING&limit=50'),
          api.get<ApiResponse<SaleOrder[]>>('/sale-orders?status=PENDING_REVIEW&limit=100'),
        ]);
        // merge: filter only QTs where I'm currentApprover for PENDING, or all PO_PENDING
        const pendingQts = (pendingRes.data.data ?? []).filter((q) => q.status === 'PENDING' || q.status === 'PENDING_ESCALATED' || q.status === 'PENDING_BACKUP');
        const poQts = poRes.data.data ?? [];
        // combine & dedupe
        const seen = new Set<string>();
        const combined: Quotation[] = [];
        for (const q of [...pendingQts, ...poQts]) {
          if (!seen.has(q.id)) { seen.add(q.id); combined.push(q); }
        }
        setQtItems(combined);
        setSoItems(soRes.data.data ?? []);
      } else {
        // Officer: their pending QTs (tracking) + draft/rejected SOs
        const [pendingRes, soRes] = await Promise.all([
          api.get<ApiResponse<Quotation[]>>('/quotations?status=PENDING&limit=100'),
          api.get<ApiResponse<SaleOrder[]>>('/sale-orders?status=DRAFT&limit=50'),
        ]);
        setQtItems(pendingRes.data.data ?? []);
        setSoItems(soRes.data.data ?? []);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [permLoading, isManager]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRefresh = async () => {
    setSpinning(true);
    await fetchAll();
    setTimeout(() => setSpinning(false), 600);
  };

  const qtLabel = isManager ? 'Quotation รออนุมัติ' : 'Quotation ของฉัน';
  const soLabel = isManager ? 'Sale Order รอตรวจสอบ' : 'Sale Order ที่ต้องดำเนินการ';

  if (permLoading) return (
    <div className="space-y-4 max-w-6xl">
      <Skeleton className="h-14 w-full rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );

  return (
    <div className="space-y-4 max-w-6xl">

      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/60 to-orange-950/40 rounded-2xl px-6 py-4 shadow-xl flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            Approval Queue
          </h1>
          <p className="text-[12px] text-amber-200/70 mt-0.5">
            {isManager
              ? 'รายการที่รอการอนุมัติ / ตรวจสอบจากคุณ'
              : 'รายการที่อยู่ระหว่างดำเนินการ'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Summary badges */}
          <div className="flex gap-2">
            <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
              <FileText className="h-3.5 w-3.5 text-amber-300" />
              <span className="text-white font-bold text-sm">{loading ? '…' : qtItems.length}</span>
              <span className="text-amber-200/70 text-[11px]">QT</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
              <ShoppingCart className="h-3.5 w-3.5 text-teal-300" />
              <span className="text-white font-bold text-sm">{loading ? '…' : soItems.length}</span>
              <span className="text-teal-200/70 text-[11px]">SO</span>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 text-white ${spinning ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Two panels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

        {/* ── Quotation Panel ── */}
        <Panel
          title={qtLabel}
          icon={<FileText className="h-4 w-4 text-amber-300" />}
          count={qtItems.length}
          loading={loading}
          viewAllHref="/quotations"
          accent="from-amber-900/30 to-orange-900/20 dark:from-amber-900/40 dark:to-orange-900/30"
        >
          {!loading && qtItems.length === 0 && (
            <EmptyPanel label={isManager ? 'ไม่มี Quotation รออนุมัติ' : 'ไม่มี Quotation ที่อยู่ระหว่างดำเนินการ'} />
          )}
          {qtItems.map((q) => <QtCard key={q.id} q={q} isManager={isManager} />)}
        </Panel>

        {/* ── Sale Order Panel ── */}
        <Panel
          title={soLabel}
          icon={<ShoppingCart className="h-4 w-4 text-teal-300" />}
          count={soItems.length}
          loading={loading}
          viewAllHref="/sale-orders"
          accent="from-teal-900/30 to-emerald-900/20 dark:from-teal-900/40 dark:to-emerald-900/30"
        >
          {!loading && soItems.length === 0 && (
            <EmptyPanel label={isManager ? 'ไม่มี Sale Order รอตรวจสอบ' : 'ไม่มี Sale Order ที่ต้องดำเนินการ'} />
          )}
          {soItems.map((so) => <SoCard key={so.id} so={so} />)}
        </Panel>

      </div>

      {/* ── Total summary footer ── */}
      {!loading && (qtItems.length + soItems.length > 0) && (
        <div className="flex items-center justify-center gap-2 text-[12px] text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" />
          รวม <span className="font-semibold text-foreground">{qtItems.length + soItems.length}</span> รายการรอดำเนินการ
          · QT <span className="font-semibold text-amber-600">{qtItems.length}</span>
          · SO <span className="font-semibold text-teal-600">{soItems.length}</span>
        </div>
      )}

    </div>
  );
}
