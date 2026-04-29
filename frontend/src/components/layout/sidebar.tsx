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
  Building2,
  Shield,
  TrendingUp,
  Settings,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
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
  { href: '/company', labelKey: 'nav.company', icon: Building2 },
  { href: '/permissions', labelKey: 'nav.permissions', icon: Shield },
];

const APPROVER_ITEMS: NavItem[] = [
  { href: '/approver/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { href: '/approver/approval-queue', labelKey: 'nav.approvalQueue', icon: Inbox },
  { href: '/approver/history', labelKey: 'nav.history', icon: History },
  { href: '/approver/company', labelKey: 'nav.company', icon: Building2 },
  { href: '/approver/permissions', labelKey: 'nav.permissions', icon: Shield },
];

const MANAGER_ITEMS: NavItem[] = [
  { href: '/manager/dashboard', labelKey: 'nav.teamOverview', icon: LayoutDashboard },
  { href: '/manager/approval-queue', labelKey: 'nav.approvalQueue', icon: Inbox },
  { href: '/manager/users', labelKey: 'nav.userDrillDown', icon: TrendingUp },
  { href: '/manager/customers', labelKey: 'nav.customers', icon: Users },
  { href: '/manager/products', labelKey: 'nav.products', icon: Package },
  { href: '/manager/company', labelKey: 'nav.company', icon: Building2 },
  { href: '/manager/manage-permissions', labelKey: 'nav.managePermissions', icon: Settings },
  { href: '/manager/permissions', labelKey: 'nav.permissions', icon: Shield },
];

interface SidebarProps {
  role: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const t = useT();
  const [collapsed, setCollapsed] = useState(false);

  const items =
    role === 'MANAGER' || role === 'ADMIN'
      ? MANAGER_ITEMS
      : role === 'APPROVER'
        ? APPROVER_ITEMS
        : SALES_ITEMS;

  const roleColor = {
    SALES: 'from-blue-500 to-cyan-500',
    APPROVER: 'from-purple-500 to-fuchsia-500',
    MANAGER: 'from-amber-500 to-orange-500',
    ADMIN: 'from-rose-500 to-red-500',
  }[role];

  const roleLabel = {
    SALES: 'Sales',
    APPROVER: 'Approver',
    MANAGER: 'Manager',
    ADMIN: 'Admin',
  }[role];

  return (
    <aside
      className={cn(
        'sticky top-0 h-screen flex flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Brand */}
      <div className="h-16 px-3 flex items-center justify-between border-b shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cn(
                'h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center text-white shrink-0 shadow-md',
                roleColor,
              )}
            >
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">QT/SO</div>
              <div className="text-[10px] text-muted-foreground -mt-0.5 uppercase tracking-wider">
                {roleLabel}
              </div>
            </div>
          </div>
        )}
        {collapsed && (
          <div
            className={cn(
              'h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center text-white mx-auto shadow-md',
              roleColor,
            )}
          >
            <FileText className="h-5 w-5" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/dashboard' &&
              item.href !== '/approver/dashboard' &&
              item.href !== '/manager/dashboard' &&
              pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all relative',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
              title={collapsed ? t(item.labelKey) : undefined}
            >
              {active && (
                <span
                  className={cn(
                    'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-gradient-to-b',
                    roleColor,
                  )}
                />
              )}
              <Icon className={cn('h-4 w-4 shrink-0', active && 'text-foreground')} />
              {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t text-[10px] text-muted-foreground text-center">
        {!collapsed ? `v1.0.0 · ${roleLabel}` : 'v1'}
      </div>
    </aside>
  );
}