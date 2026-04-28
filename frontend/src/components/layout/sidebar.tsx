'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Users,
  Package,
  Inbox,
  History,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import type { UserRole } from '@/types/api';

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
}

const SALES_ITEMS: NavItem[] = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { href: '/quotations', labelKey: 'nav.quotations', icon: FileText },
  { href: '/sale-orders', labelKey: 'nav.saleOrders', icon: ClipboardList },
  { href: '/customers', labelKey: 'nav.customers', icon: Users },
  { href: '/products', labelKey: 'nav.products', icon: Package },
];

const APPROVER_ITEMS: NavItem[] = [
  { href: '/approver/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { href: '/approver/approval-queue', labelKey: 'nav.approvalQueue', icon: Inbox },
  { href: '/approver/history', labelKey: 'nav.history', icon: History },
];

interface SidebarProps {
  role: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  const t = useT();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const items = role === 'APPROVER' ? APPROVER_ITEMS : SALES_ITEMS;

  return (
    <aside
      className={cn(
        'sticky top-0 h-screen border-r bg-card transition-all duration-300 flex flex-col',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className={cn('h-16 flex items-center border-b px-4 shrink-0', collapsed && 'justify-center px-2')}>
        {collapsed ? (
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-bold">
            Q
          </div>
        ) : (
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-bold">
              Q
            </div>
            <span className="text-base">{t('common.appName')}</span>
          </Link>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {items.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname?.startsWith(item.href));
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                    collapsed && 'justify-center px-2',
                  )}
                  title={collapsed ? t(item.labelKey) : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn('w-full', collapsed ? 'justify-center px-2' : 'justify-end')}
          onClick={() => setCollapsed((v) => !v)}
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
