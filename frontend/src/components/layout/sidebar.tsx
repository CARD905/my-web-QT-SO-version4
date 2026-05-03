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
  Crown,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { usePermissions } from '@/hooks/use-permissions';

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  /** Show only if user has this permission */
  requires?: { resource: string; action: string; scope?: 'OWN' | 'TEAM' | 'DEPARTMENT' | 'ALL' };
  /** Or show if user role level >= this */
  minLevel?: number;
}

// Master nav list — show/hide dynamically based on permissions
const NAV_ITEMS: NavItem[] = [
  // Officer/Sales view
  {
    href: '/dashboard',
    labelKey: 'nav.dashboard',
    icon: LayoutDashboard,
    requires: { resource: 'dashboard', action: 'view', scope: 'OWN' },
  },
  {
    href: '/quotations',
    labelKey: 'nav.quotations',
    icon: FileText,
    requires: { resource: 'quotation', action: 'view', scope: 'OWN' },
  },
  {
    href: '/sale-orders',
    labelKey: 'nav.saleOrders',
    icon: ClipboardList,
    requires: { resource: 'saleOrder', action: 'view', scope: 'OWN' },
  },
  {
    href: '/customers',
    labelKey: 'nav.customers',
    icon: Users,
    requires: { resource: 'customer', action: 'view', scope: 'ALL' },
  },
  {
    href: '/products',
    labelKey: 'nav.products',
    icon: Package,
    requires: { resource: 'product', action: 'view', scope: 'ALL' },
  },
  {
    href: '/company',
    labelKey: 'nav.company',
    icon: Building2,
    requires: { resource: 'company', action: 'view', scope: 'ALL' },
  },
  {
    href: '/permissions',
    labelKey: 'nav.permissions',
    icon: Shield,
  }, // Always visible — anyone can view their own permissions
];

const ROLE_THEME: Record<string, { gradient: string; label: string; icon: LucideIcon }> = {
  OFFICER: { gradient: 'from-blue-500 to-cyan-500', label: 'Officer', icon: Users },
  SALES: { gradient: 'from-blue-500 to-cyan-500', label: 'Sales', icon: Users },
  MANAGER: { gradient: 'from-amber-500 to-orange-500', label: 'Manager', icon: TrendingUp },
  APPROVER: { gradient: 'from-purple-500 to-fuchsia-500', label: 'Approver', icon: TrendingUp },
  ADMIN: { gradient: 'from-rose-500 to-red-500', label: 'Admin', icon: Shield },
  CEO: { gradient: 'from-purple-600 to-pink-600', label: 'CEO', icon: Crown },
};

interface SidebarProps {
  /** Optional — used as fallback if permissions not loaded yet */
  role?: string;
}

export function Sidebar({ role: initialRole }: SidebarProps) {
  const pathname = usePathname();
  const t = useT();
  const { can, role, loading } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);

  // Filter nav items based on permissions
  const items = NAV_ITEMS.filter((item) => {
    if (loading) return false; // hide everything while loading
    if (!item.requires) return true;
    return can(item.requires.resource, item.requires.action, item.requires.scope ?? 'OWN');
  });

  const roleCode = role?.code || initialRole || 'OFFICER';
  const theme = ROLE_THEME[roleCode] || ROLE_THEME.OFFICER;
  const RoleIcon = theme.icon;

  return (
    <aside
      className={cn(
        'sticky top-0 h-screen flex flex-col border-r bg-card/70 backdrop-blur-xl transition-all duration-300 z-20',
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
                theme.gradient,
              )}
            >
              <RoleIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">QT/SO</div>
              <div className="text-[10px] text-muted-foreground -mt-0.5 uppercase tracking-wider">
                {role?.nameTh || theme.label}
              </div>
            </div>
          </div>
        )}
        {collapsed && (
          <div
            className={cn(
              'h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center text-white mx-auto shadow-md',
              theme.gradient,
            )}
          >
            <RoleIcon className="h-5 w-5" />
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

      {/* Loading skeleton */}
      {loading && (
        <div className="flex-1 p-2 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 rounded-md bg-muted/50 animate-pulse" />
          ))}
        </div>
      )}

      {/* Nav */}
      {!loading && (
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
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
                      theme.gradient,
                    )}
                  />
                )}
                <Icon className={cn('h-4 w-4 shrink-0', active && 'text-foreground')} />
                {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
              </Link>
            );
          })}
        </nav>
      )}

      <div className="p-2 border-t text-[10px] text-muted-foreground text-center">
        {!collapsed ? `v2.0.0 · ${role?.code || theme.label}` : 'v2'}
      </div>
    </aside>
  );
}