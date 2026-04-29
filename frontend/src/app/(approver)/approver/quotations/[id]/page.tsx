'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatDate, formatMoney, formatNumber, formatRelativeTime, getStatusClass } from '@/lib/utils';
import type { ApiResponse, Quotation, QuotationComment } from '@/types/api';

const HIGH_VALUE = 100000;

export default function ApproverQuotationDetailPage() {
  const t = useT();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [q, setQ] = useState<Quotation | null>(null);
  const [comments, setComments] = useState<QuotationComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [qRes, cRes] = await Promise.all([
        api.get<ApiResponse<Quotation>>(`/quotations/${id}`),
        api.get<ApiResponse<QuotationComment[]>>(`/quotations/${id}/comments`),
      ]);
      setQ(qRes.data.data ?? null);
      setComments(cRes.data.data ?? []);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const postComment = async () => {
    if (!newComment.trim()) return;
    try {
      await api.post(`/quotations/${id}/comments`, {
        message: newComment,
        isInternal: false,
      });
      setNewComment('');
      const cRes = await api.get<ApiResponse<QuotationComment[]>>(`/quotations/${id}/comments`);
      setComments(cRes.data.data ?? []);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-6xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!q) {
    return <div className="text-center py-20">Not found</div>;
  }

  const high = Number(q.grandTotal) >= HIGH_VALUE;
  const expired = new Date(q.expiryDate) < new Date();
  const canApprove = q.status === 'PENDING' && !expired;

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-1">
            <Link href="/approver/approval-queue">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{q.quotationNo}</h1>
              <Badge className={getStatusClass(q.status)} variant="outline">
                ● {q.status}
              </Badge>
              {high && (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  High Value
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              By {q.createdBy?.name} · {q.customerCompany}
            </p>
          </div>
        </div>

        {canApprove && (
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={() => setShowRejectModal(true)}
              disabled={acting !== null}
            >
              <X className="h-4 w-4" />
              {t('common.reject')}
            </Button>
            <Button
              variant="success"
              onClick={() => setShowApproveModal(true)}
              disabled={acting !== null}
            >
              <Check className="h-4 w-4" />
              {t('common.approve')}
            </Button>
          </div>
        )}
      </div>

      {/* Status alerts */}
      {expired && q.status === 'PENDING' && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-destructive">Quotation Expired</div>
              <p className="text-sm mt-1">
                Expired on {formatDate(q.expiryDate)}. Cannot be approved. Sales must update expiry date and resubmit.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {q.status === 'APPROVED' && (
        <Card className="border-success/50 bg-success/5">
          <CardContent className="pt-4 flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-success">Approved</div>
              <p className="text-sm mt-1">
                Approved on {formatDate(q.approvedAt)} by {q.approvedBy?.name || '-'}
                {q.saleOrder && ` · Sale Order ${q.saleOrder.saleOrderNo} created`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {q.status === 'REJECTED' && q.rejectionReason && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4 flex gap-3">
            <X className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-destructive">Rejected</div>
              <p className="text-sm mt-1">{q.rejectionReason}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground uppercase font-medium">Issue Date</div>
            <div className="font-semibold mt-1">{formatDate(q.issueDate)}</div>
          </CardContent>
        </Card>
        <Card className={expired ? 'border-destructive/40' : ''}>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground uppercase font-medium">Expiry Date</div>
            <div className={`font-semibold mt-1 ${expired ? 'text-destructive' : ''}`}>
              {formatDate(q.expiryDate)}
              {expired && ' ⚠️'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground uppercase font-medium">Submitted</div>
            <div className="font-semibold mt-1">
              {q.submittedAt ? formatRelativeTime(q.submittedAt) : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-3">{t('quotation.customerInfo')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-sm">
            <div>
              <span className="text-muted-foreground">Company:</span>{' '}
              <span className="font-medium">{q.customerCompany}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Contact:</span>{' '}
              <span className="font-medium">{q.customerContactName}</span>
            </div>
            {q.customerTaxId && (
              <div>
                <span className="text-muted-foreground">Tax ID:</span>{' '}
                <span className="font-medium">{q.customerTaxId}</span>
              </div>
            )}
            {q.customerPhone && (
              <div>
                <span className="text-muted-foreground">Phone:</span>{' '}
                <span className="font-medium">{q.customerPhone}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-3">{t('quotation.lineItems')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="text-left py-2">SKU</th>
                  <th className="text-left py-2">Product</th>
                  <th className="text-right py-2">Qty</th>
                  <th className="text-right py-2">Price</th>
                  <th className="text-right py-2">Discount</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {q.items?.map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td className="py-3 text-xs text-muted-foreground">{it.productSku || '-'}</td>
                    <td className="py-3">
                      <div className="font-medium">{it.productName}</div>
                      {it.description && (
                        <div className="text-xs text-muted-foreground mt-0.5">{it.description}</div>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {formatNumber(it.quantity)} {it.unit}
                    </td>
                    <td className="py-3 text-right">{formatNumber(it.unitPrice)}</td>
                    <td className="py-3 text-right">
                      {Number(it.discount) > 0
                        ? it.discountType === 'PERCENTAGE'
                          ? `${formatNumber(it.discount)}%`
                          : formatNumber(it.discount)
                        : '-'}
                    </td>
                    <td className="py-3 text-right font-semibold">{formatNumber(it.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Big Total */}
      <Card className={high ? 'border-destructive/40 bg-destructive/5' : 'bg-primary/5'}>
        <CardContent className="pt-6">
          <div className="flex justify-end items-baseline gap-4">
            <span className="text-sm text-muted-foreground uppercase font-semibold">Grand Total</span>
            <span className={`text-4xl font-bold ${high ? 'text-destructive' : 'text-primary'}`}>
              {formatMoney(q.grandTotal, q.currency)}
            </span>
          </div>
          <div className="flex justify-end mt-2 text-xs text-muted-foreground">
            Subtotal {formatNumber(q.subtotal)} − Discount {formatNumber(q.discountTotal)} +{' '}
            {q.vatEnabled ? `VAT ${formatNumber(q.vatRate)}% (${formatNumber(q.vatAmount)})` : 'No VAT'}
          </div>
        </CardContent>
      </Card>

      {/* Comments */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-4">💬 Comments</h2>
          <div className="space-y-3 mb-4">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No comments yet</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                    {c.user.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{c.user.name}</span>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                        {c.user.role}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(c.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{c.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              onKeyDown={(e) => e.key === 'Enter' && postComment()}
            />
            <Button onClick={postComment} disabled={!newComment.trim()}>
              Send
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Approve modal */}
      {showApproveModal && (
        <ConfirmModal
          title="Approve Quotation?"
          description={`This will approve ${q.quotationNo} and automatically create a Sale Order. The Sales rep will be notified.`}
          confirmLabel={`✓ ${t('common.approve')}`}
          confirmVariant="success"
          onClose={() => setShowApproveModal(false)}
          onConfirm={async (comment) => {
            setActing('approve');
            try {
              const { fireConfetti } = await import('@/lib/confetti');
              await api.post(`/quotations/${id}/approve`, { comment });
              fireConfetti();
              toast.success('🎉 Approved! Sale Order created.');
              setTimeout(() => {
                const isManager =
                  typeof window !== 'undefined' && window.location.pathname.includes('/manager/');
                router.push(isManager ? '/manager/approval-queue' : '/approver/approval-queue');
              }, 800);
            } catch (err) {
              toast.error(getApiErrorMessage(err));
              setShowApproveModal(false);
            } finally {
              setActing(null);
            }
          }}
          loading={acting === 'approve'}
        />
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <ConfirmModal
          title="Reject Quotation?"
          description="The Sales rep will be notified and can edit & resubmit. Reason is required."
          confirmLabel={`✕ ${t('common.reject')}`}
          confirmVariant="destructive"
          requireComment
          onClose={() => setShowRejectModal(false)}
          onConfirm={async (reason) => {
            if (!reason) return;
            setActing('reject');
            try {
              await api.post(`/quotations/${id}/reject`, { reason });
              toast.success('Quotation rejected');
              router.push('/approver/approval-queue');
            } catch (err) {
              toast.error(getApiErrorMessage(err));
              setShowRejectModal(false);
            } finally {
              setActing(null);
            }
          }}
          loading={acting === 'reject'}
        />
      )}
    </div>
  );
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  confirmVariant = 'default',
  requireComment = false,
  onClose,
  onConfirm,
  loading,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: 'default' | 'success' | 'destructive';
  requireComment?: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => void;
  loading: boolean;
}) {
  const [comment, setComment] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <Card className="w-full max-w-md shadow-2xl animate-slide-up">
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
          <div>
            <Label className="text-xs">
              {requireComment ? 'Reason' : 'Comment'}
              {requireComment && <span className="text-destructive ml-1">*</span>}
            </Label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="mt-1.5 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              autoFocus
              placeholder={requireComment ? 'Explain why this is rejected...' : 'Optional'}
            />
          </div>
        </CardContent>
        <div className="flex justify-end gap-2 p-6 pt-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            onClick={() => onConfirm(comment)}
            disabled={loading || (requireComment && !comment.trim())}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}
