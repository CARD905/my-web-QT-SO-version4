'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MessageCircle, Send, X, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { ApiResponse, QuotationComment } from '@/types/api';

interface CommentThreadProps {
  quotationId: string;
}

export function CommentThread({ quotationId }: CommentThreadProps) {
  // ─── State ───────────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<QuotationComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);

  // ─── Drag state ──────────────────────────────────────────────────────────
  const [pos, setPos] = useState({ x: 0, y: 0 });
// เพิ่ม useEffect นี้หลัง useState
  useEffect(() => {
    setPos({
      x: window.innerWidth - 80,
      y: window.innerHeight - 80,
    });
  }, []);// bottom-right offset
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, bx: 0, by: 0 });

  // ─── Refs ─────────────────────────────────────────────────────────────────
  const popupRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevCountRef = useRef(0);

  // ─── Fetch comments ───────────────────────────────────────────────────────
  const fetchComments = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get<ApiResponse<QuotationComment[]>>(
        `/quotations/${quotationId}/comments`,
      );
      const data = res.data.data ?? [];
      setComments(data);
      if (!open && data.length > prevCountRef.current) {
        setUnread((u) => u + (data.length - prevCountRef.current));
      }
      prevCountRef.current = data.length;
    } catch {
      // silent fail
    } finally {
      if (!silent) setLoading(false);
    }
  }, [quotationId, open]);

  useEffect(() => {
    fetchComments();
    const iv = setInterval(() => fetchComments(true), 15000);
    return () => clearInterval(iv);
  }, [fetchComments]);

  // scroll to bottom when open or new messages
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  }, [open, comments]);

  // ─── Click outside to close ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // ─── Drag handlers ────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = false;
    dragStart.current = { mx: e.clientX, my: e.clientY, bx: pos.x, by: pos.y };

    const onMove = (ev: MouseEvent) => {
      const dx = Math.abs(ev.clientX - dragStart.current.mx);
      const dy = Math.abs(ev.clientY - dragStart.current.my);
      if (dx > 4 || dy > 4) dragging.current = true;

      const newX = Math.max(8, Math.min(
        window.innerWidth - 64,
        dragStart.current.bx + (ev.clientX - dragStart.current.mx),
      ));
      const newY = Math.max(8, Math.min(
        window.innerHeight - 64,
        dragStart.current.by + (ev.clientY - dragStart.current.my),
      ));
      setPos({ x: newX, y: newY });
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleBtnClick = () => {
    if (!dragging.current) setOpen((v) => !v);
  };

  // ─── Send message ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    const msg = message.trim();
    if (!msg) return;
    setSending(true);
    try {
      await api.post(`/quotations/${quotationId}/comments`, { message: msg, isInternal: false });
      setMessage('');
      await fetchComments(true);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Popup position ───────────────────────────────────────────────────────
  // popup opens upward-left from the button
  const popupStyle: React.CSSProperties = {
    position: 'fixed',
    left: pos.x + 56 + 8 > window.innerWidth / 2
      ? pos.x - 320 - 8
      : pos.x + 56 + 8,
    top: pos.y + 420 > window.innerHeight
      ? pos.y - 420 + 56
      : pos.y,
    width: 320,
    zIndex: 9999,
  };

  const btnStyle: React.CSSProperties = {
    position: 'fixed',
    left: pos.x,
    top: pos.y,
    zIndex: 10000,
    cursor: 'grab',
    userSelect: 'none',
  };

  return (
    <>
      {/* ── Floating Button ── */}
      <button
        ref={btnRef}
        style={btnStyle}
        onMouseDown={onMouseDown}
        onClick={handleBtnClick}
        className={`
          relative w-14 h-14 rounded-full shadow-2xl
          flex items-center justify-center
          transition-all duration-200 active:scale-95
          ${open
            ? 'bg-primary text-primary-foreground shadow-primary/40'
            : 'bg-background border-2 border-primary/30 text-primary hover:border-primary hover:shadow-primary/20'
          }
        `}
        title="แชทงาน"
      >
        {open
          ? <X className="h-6 w-6" />
          : <MessageCircle className="h-6 w-6" />
        }

        {/* unread badge */}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-bounce">
            {unread > 9 ? '9+' : unread}
          </span>
        )}

        {/* pulse ring เมื่อมีข้อความใหม่ */}
        {!open && unread > 0 && (
          <span className="absolute inset-0 rounded-full border-2 border-destructive animate-ping opacity-40" />
        )}
      </button>

      {/* ── Popup Chat ── */}
      {open && (
        <div
          ref={popupRef}
          style={popupStyle}
          className="bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-primary/5">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">แชทงาน</span>
              {comments.length > 0 && (
                <span className="text-xs text-muted-foreground">({comments.length})</span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[240px] max-h-[320px]">
            {loading ? (
              <div className="flex items-center justify-center h-full py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 gap-2">
                <MessageCircle className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">ยังไม่มีข้อความ</p>
                <p className="text-xs text-muted-foreground/60">เริ่มการสนทนาได้เลย</p>
              </div>
            ) : (
              comments.map((c, i) => {
                const isMe = false; // TODO: compare c.user.id with session userId ถ้าต้องการ
                return (
                  <div key={c.id || i} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                    {/* Avatar */}
                    <div className={`
                      w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold
                      ${isMe
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground border border-border'
                      }
                    `}>
                      {c.user.name.slice(0, 1).toUpperCase()}
                    </div>

                    <div className={`flex flex-col gap-0.5 max-w-[72%] ${isMe ? 'items-end' : ''}`}>
                      <div className={`flex items-baseline gap-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <span className="text-[10px] font-semibold text-foreground leading-none">
                          {c.user.name}
                        </span>
                        <span className="text-[9px] text-muted-foreground leading-none">
                          {c.user.role?.nameTh || c.user.role?.code || ''}
                        </span>
                      </div>
                      <div className={`
                        px-3 py-2 rounded-2xl text-xs leading-relaxed
                        ${isMe
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-muted text-foreground rounded-tl-sm'
                        }
                      `}>
                        {c.message}
                      </div>
                      <span className="text-[9px] text-muted-foreground px-1">
                        {formatDate(c.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t p-3">
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="พิมพ์ข้อความ... (Enter ส่ง)"
                rows={1}
                className="
                  flex-1 resize-none rounded-xl border border-input bg-muted/40
                  px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring
                  placeholder:text-muted-foreground/60
                  max-h-24 overflow-y-auto
                "
                style={{ lineHeight: '1.5' }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 96) + 'px';
                }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !message.trim()}
                className="
                  w-9 h-9 rounded-xl bg-primary text-primary-foreground
                  flex items-center justify-center shrink-0
                  disabled:opacity-40 disabled:cursor-not-allowed
                  hover:bg-primary/90 active:scale-95 transition-all
                "
              >
                {sending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />
                }
              </button>
            </div>
            <p className="text-[9px] text-muted-foreground/50 mt-1.5 text-center">
              Enter ส่ง · Shift+Enter ขึ้นบรรทัดใหม่
            </p>
          </div>
        </div>
      )}
    </>
  );
}