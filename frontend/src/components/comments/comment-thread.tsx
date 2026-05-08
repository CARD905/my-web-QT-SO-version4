'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  MessageSquare,
  Lock,
  Send,
  Loader2,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api, getApiErrorMessage } from '@/lib/api';
import { usePermissions } from '@/hooks/use-permissions';
import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { ApiResponse } from '@/types/api';

const ELEVATED_ROLES = ['MANAGER', 'CEO', 'ADMIN', 'APPROVER'];

interface Comment {
  id: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
  user: {
    id: string;
    name: string;
    role: { code: string; nameTh: string };
  };
}

interface CommentThreadProps {
  quotationId: string;
}

export function CommentThread({ quotationId }: CommentThreadProps) {
  const { data: session } = useSession();
  const { role } = usePermissions();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const userId = session?.user?.id;
  const isElevated = role?.code && ELEVATED_ROLES.includes(role.code);

  // ─── Fetch comments ──────────────────────────────────────────────────────
  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<Comment[]>>(
        `/quotations/${quotationId}/comments`,
      );
      setComments(res.data.data ?? []);
    } catch (err) {
      console.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // ─── Post new comment ────────────────────────────────────────────────────
  const handlePost = async () => {
    const text = message.trim();
    if (!text) {
      toast.error('กรุณาพิมพ์ข้อความ');
      return;
    }

    setPosting(true);
    try {
      await api.post(`/quotations/${quotationId}/comments`, {
        message: text,
        isInternal: isElevated ? isInternal : false,
      });
      setMessage('');
      setIsInternal(false);
      await fetchComments();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setPosting(false);
    }
  };

  // ─── Delete comment ──────────────────────────────────────────────────────
  const handleDelete = async (commentId: string) => {
    if (!confirm('ลบความเห็นนี้ใช่ไหม?')) return;
    setDeletingId(commentId);
    try {
      await api.delete(`/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Submit on Cmd/Ctrl+Enter ───────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handlePost();
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between bg-gradient-to-r from-accent/30 to-transparent">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">การสนทนา</span>
          {!loading && (
            <Badge variant="outline" className="text-xs">
              {comments.length}
            </Badge>
          )}
        </div>
        {isElevated && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Lock className="h-2.5 w-2.5" />
            คุณเห็น Internal comments
          </span>
        )}
      </div>

      {/* Comments list */}
      <div className="max-h-[420px] overflow-y-auto px-5 py-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-3/4" />
          </div>
        ) : comments.length === 0 ? (
          <div className="py-8 flex flex-col items-center text-center gap-2 text-muted-foreground">
            <MessageSquare className="h-8 w-8 opacity-30" />
            <p className="text-sm">ยังไม่มีความเห็น เป็นคนแรกได้!</p>
          </div>
        ) : (
          comments.map((c) => {
            const isMine = c.user.id === userId;
            const canDelete = isMine || role?.code === 'CEO' || role?.code === 'ADMIN';

            return (
              <CommentItem
                key={c.id}
                comment={c}
                isMine={isMine}
                canDelete={canDelete}
                deleting={deletingId === c.id}
                onDelete={() => handleDelete(c.id)}
              />
            );
          })
        )}
      </div>

      {/* Compose */}
      <div className="border-t border-border/50 bg-muted/20 p-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="พิมพ์ข้อความ... (Ctrl+Enter ส่ง)"
          rows={3}
          disabled={posting}
          className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        />

        <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
          {/* Internal toggle — Manager+ only */}
          {isElevated ? (
            <label className="flex items-center gap-2 cursor-pointer text-sm select-none">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                disabled={posting}
                className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
              />
              <span className={cn(
                'flex items-center gap-1 transition-colors',
                isInternal ? 'text-amber-600 font-medium' : 'text-muted-foreground'
              )}>
                <Lock className="h-3 w-3" />
                Internal — Officer มองไม่เห็น
              </span>
            </label>
          ) : (
            <span className="text-xs text-muted-foreground">
              ความเห็นของคุณจะแสดงให้ทีมงานทุกคนเห็น
            </span>
          )}

          <Button
            size="sm"
            onClick={handlePost}
            disabled={posting || !message.trim()}
          >
            {posting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            ส่ง
          </Button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMMENT ITEM
// ════════════════════════════════════════════════════════════════════════════
function CommentItem({
  comment,
  isMine,
  canDelete,
  deleting,
  onDelete,
}: {
  comment: Comment;
  isMine: boolean;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  const { isInternal, user, message, createdAt } = comment;

  // Avatar initial
  const initial = user.name?.charAt(0)?.toUpperCase() ?? '?';

  // Avatar color based on role
  const avatarBg = (() => {
    switch (user.role.code) {
      case 'CEO': return 'bg-amber-500';
      case 'ADMIN': return 'bg-rose-500';
      case 'MANAGER': return 'bg-orange-500';
      case 'APPROVER': return 'bg-purple-500';
      default: return 'bg-blue-500';
    }
  })();

  return (
    <div className={cn('flex gap-3 group', isMine && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0',
          avatarBg,
        )}
        title={`${user.name} (${user.role.nameTh})`}
      >
        {initial}
      </div>

      {/* Bubble */}
      <div className={cn('flex-1 min-w-0', isMine && 'text-right')}>
        <div className="flex items-center gap-2 text-xs mb-1 flex-wrap">
          <span className="font-semibold">{user.name}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{user.role.nameTh}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{formatRelativeTime(createdAt)}</span>

          {isInternal && (
            <Badge
              variant="outline"
              className="text-[9px] h-4 px-1.5 bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400"
            >
              <Lock className="h-2 w-2 mr-0.5" />
              INTERNAL
            </Badge>
          )}
        </div>

        <div
          className={cn(
            'inline-block max-w-full px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words text-left',
            isInternal
              ? 'bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/40'
              : isMine
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted',
          )}
        >
          {message}
        </div>

        {canDelete && (
          <button
            onClick={onDelete}
            disabled={deleting}
            className={cn(
              'opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity ml-2 text-xs text-muted-foreground hover:text-destructive disabled:opacity-30',
              isMine && 'mr-2 ml-0',
            )}
            title="ลบความเห็น"
          >
            {deleting ? (
              <Loader2 className="h-3 w-3 animate-spin inline" />
            ) : (
              <Trash2 className="h-3 w-3 inline" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}