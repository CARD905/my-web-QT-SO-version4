'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api, getApiErrorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { formatRelativeTime } from '@/lib/utils';
import type { ApiResponse, Notification } from '@/types/api';

export function NotificationBell() {
  const t = useT();
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Periodic unread count poll
  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const res = await api.get<ApiResponse<{ count: number }>>('/notifications/unread-count');
        if (!cancelled) setUnreadCount(res.data.data?.count ?? 0);
      } catch {
        // ignore
      }
    };
    fetchCount();
    const id = setInterval(fetchCount, 60000); // poll every 60s
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Load list when dropdown opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get<ApiResponse<Notification[]>>(
          '/notifications?limit=10',
        );
        if (!cancelled) setItems(res.data.data ?? []);
      } catch (err) {
        console.error(getApiErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setUnreadCount(0);
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(getApiErrorMessage(err));
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">{t('nav.notifications')}</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {t('common.noData')}
            </div>
          ) : (
            items.map((n) => (
              <Link
                key={n.id}
                href={n.link || '#'}
                className={`block px-3 py-2.5 text-sm transition-colors hover:bg-accent ${
                  !n.isRead ? 'bg-primary/5' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.isRead && (
                    <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">{n.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {n.message}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {formatRelativeTime(n.createdAt)}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
