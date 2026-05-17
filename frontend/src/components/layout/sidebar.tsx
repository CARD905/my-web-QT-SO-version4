'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, ClipboardList, Users, Package,
  Building2, Shield, ChevronLeft, ChevronRight, ChevronDown, X,
  CheckSquare, Star, Mail,History,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { usePermissions } from '@/hooks/use-permissions';

interface NavItem {
  href?: string;
  labelKey: string;
  icon: LucideIcon;
  requires?: { resource: string; action: string; scope?: 'OWN' | 'TEAM' | 'DEPARTMENT' | 'ALL' };
  onlyRoles?: string[];
  children?: NavItem[];
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    labelKey: 'nav.dashboard',
    icon: LayoutDashboard,
    requires: { resource: 'dashboard', action: 'view', scope: 'OWN' },
  },
  {
    labelKey: 'nav.quotations',
    icon: FileText,
    requires: { resource: 'quotation', action: 'view', scope: 'OWN' },
    children: [
      {
        href: '/quotations',
        labelKey: 'nav.quotationList',
        icon: FileText,
        requires: { resource: 'quotation', action: 'view', scope: 'OWN' },
      },
      {
        href: '/quotations/checklist',
        labelKey: 'nav.quotationChecklist',
        icon: CheckSquare,
        requires: { resource: 'quotation', action: 'view', scope: 'OWN' },
      },
    ],
  },
  {
    href: '/sale-orders',
    labelKey: 'nav.saleOrders',
    icon: ClipboardList,
    requires: { resource: 'saleOrder', action: 'view', scope: 'OWN' },
  },
  {
    href: '/special-discount',
    labelKey: 'nav.specialDiscount',
    icon: Star,
    requires: { resource: 'quotation', action: 'approve', scope: 'ALL' },
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
  // ✅ MANAGER เห็น My Team (invite:TEAM)
  {
    href: '/manager/team',
    labelKey: 'nav.myTeam',
    icon: Users,
    requires: { resource: 'user', action: 'invite', scope: 'TEAM' },
    onlyRoles: ['MANAGER'],
  },
  {
    href: '/history',
    labelKey: 'nav.history',
    icon: History,
    requires: { resource: 'quotation', action: 'approve', scope: 'TEAM' },
  },
  // ✅ ADMIN เห็น Invitations (invite:ALL)
  {
    href: '/admin/invitations',
    labelKey: 'nav.invitations',
    icon: Mail,
    requires: { resource: 'user', action: 'invite', scope: 'ALL' },
    onlyRoles: ['ADMIN', 'CEO']
  },
  {
    href: '/company',
    labelKey: 'nav.company',
    icon: Building2,
    requires: { resource: 'company', action: 'view', scope: 'ALL' },
  },
  { href: '/permissions', labelKey: 'nav.permissions', icon: Shield },
];

interface RoleTheme {
  brandLabel: string;
  tagline: string;
  accentColor: string;
  gradientStops: [string, string, string, string];
}

const ROLE_THEMES: Record<string, RoleTheme> = {
  OFFICER:  { brandLabel: 'WISDOM', tagline: 'Officer',  accentColor: '#06b6d4', gradientStops: ['#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1'] },
  SALES:    { brandLabel: 'WISDOM', tagline: 'Sales',    accentColor: '#06b6d4', gradientStops: ['#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1'] },
  MANAGER:  { brandLabel: 'WISDOM', tagline: 'Manager',  accentColor: '#f59e0b', gradientStops: ['#fbbf24', '#f59e0b', '#f97316', '#ef4444'] },
  ADMIN:    { brandLabel: 'WISDOM', tagline: 'Admin',    accentColor: '#ef4444', gradientStops: ['#fb7185', '#f43f5e', '#ef4444', '#dc2626'] },
  CEO:      { brandLabel: 'WISDOM', tagline: 'CEO',      accentColor: '#d4a574', gradientStops: ['#fde68a', '#d4a574', '#a855f7', '#ec4899'] },
};

function AuroraRingLogo({ theme, size = 44, uniqueId }: { theme: RoleTheme; size?: number; uniqueId: string }) {
  const gradId = `aurora-${uniqueId}`;
  const [s1, s2, s3, s4] = theme.gradientStops;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size, filter: `drop-shadow(0 0 8px ${theme.accentColor}40)` }}>
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="10" y1="10" x2="90" y2="90">
            <stop offset="0%" stopColor={s1} /><stop offset="33%" stopColor={s2} />
            <stop offset="66%" stopColor={s3} /><stop offset="100%" stopColor={s4} />
          </linearGradient>
        </defs>
        <g className="aurora-spin-slow" style={{ transformOrigin: '50px 50px' }}>
          <circle cx="50" cy="50" r="40" fill="none" stroke={`url(#${gradId})`} strokeWidth="3" />
        </g>
        <g className="aurora-spin-rev" style={{ transformOrigin: '50px 50px' }}>
          <circle cx="50" cy="50" r="32" fill="none" stroke={`url(#${gradId})`} strokeWidth="0.8" strokeDasharray="2 4" opacity="0.6" />
        </g>
        <circle cx="50" cy="50" r="26" className="aurora-disc" />
        <text x="50" y="61" textAnchor="middle" fill="white" fontSize="26" fontWeight="600" style={{ letterSpacing: '-0.04em' }}>W</text>
      </svg>
    </div>
  );
}

interface NavItemViewProps {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  theme: RoleTheme;
  t: (k: string) => string;
  onMobileClose?: () => void;
  level?: number;
}

function NavGroupItem({ item, pathname, collapsed, theme, t, onMobileClose, level = 0 }: NavItemViewProps) {
  const Icon = item.icon;
  const children = item.children!;
  const anyChildActive = children.some((c) =>
    c.href ? pathname === c.href || (c.href !== '/dashboard' && pathname.startsWith(c.href + '/')) : false,
  );
  const [open, setOpen] = useState(anyChildActive);
  useEffect(() => { if (anyChildActive) setOpen(true); }, [anyChildActive]);

  if (collapsed) {
    const firstChild = children[0];
    if (!firstChild?.href) return null;
    return (
      <Link href={firstChild.href} onClick={onMobileClose}
        className={cn('group relative flex items-center justify-center p-2.5 rounded-lg transition-all duration-200',
          anyChildActive ? 'text-foreground bg-gradient-to-r from-accent/80 to-accent/40 shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent/30')}
        title={t(item.labelKey)}>
        <Icon className="h-4 w-4" style={{ color: anyChildActive ? theme.accentColor : undefined, filter: anyChildActive ? `drop-shadow(0 0 4px ${theme.accentColor}80)` : undefined }} />
      </Link>
    );
  }

  return (
    <div>
      <button onClick={() => setOpen((v) => !v)}
        className={cn('group w-full relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
          anyChildActive ? 'text-foreground bg-gradient-to-r from-accent/40 to-transparent' : 'text-muted-foreground hover:text-foreground hover:bg-accent/30')}>
        <div className="relative flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4" style={{ color: anyChildActive ? theme.accentColor : undefined, filter: anyChildActive ? `drop-shadow(0 0 4px ${theme.accentColor}80)` : undefined }} />
        </div>
        <span className="truncate flex-1 text-left">{t(item.labelKey)}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200 shrink-0', open && 'rotate-180')} style={{ color: theme.accentColor, opacity: 0.7 }} />
      </button>
      <div className={cn('overflow-hidden transition-all duration-300 ease-out', open ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0')}>
        <div className="pl-3 ml-3 border-l border-border/40 space-y-0.5">
          {children.map((child) => (
            <NavItemView key={child.href ?? child.labelKey} item={child} pathname={pathname} collapsed={collapsed} theme={theme} t={t} onMobileClose={onMobileClose} level={level + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

function NavItemView({ item, pathname, collapsed, theme, t, onMobileClose, level = 0 }: NavItemViewProps) {
  const Icon = item.icon;
  const isLeafActive = item.href
    ? pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
    : false;

  if (item.children && item.children.length > 0) {
    return <NavGroupItem item={item} pathname={pathname} collapsed={collapsed} theme={theme} t={t} onMobileClose={onMobileClose} level={level} />;
  }
  if (!item.href) return null;

  return (
    <Link href={item.href} onClick={onMobileClose}
      className={cn('group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
        isLeafActive ? 'text-foreground bg-gradient-to-r from-accent/80 to-accent/40 shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent/30 hover:translate-x-0.5',
        level > 0 && 'py-1.5 text-[13px]')}
      title={collapsed ? t(item.labelKey) : undefined}>
      {isLeafActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
          style={{ background: `linear-gradient(to bottom, ${theme.gradientStops[0]}, ${theme.gradientStops[2]})`, boxShadow: `0 0 12px ${theme.accentColor}80` }} />
      )}
      <div className={cn('relative flex items-center justify-center shrink-0', isLeafActive && 'scale-110')}>
        <Icon className={cn('h-4 w-4', level > 0 && 'h-3.5 w-3.5')}
          style={{ color: isLeafActive ? theme.accentColor : undefined, filter: isLeafActive ? `drop-shadow(0 0 4px ${theme.accentColor}80)` : undefined }} />
      </div>
      {!collapsed && <span className="truncate flex-1">{t(item.labelKey)}</span>}
    </Link>
  );
}

interface SidebarProps {
  role?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ role: initialRole, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const t = useT();
  const { can, role, loading, permissions } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);
  const roleCode = role?.code || initialRole || 'OFFICER';
  const theme = ROLE_THEMES[roleCode] || ROLE_THEMES.OFFICER;
  const filterItems = (items: NavItem[]): NavItem[] => {
    return items
      .filter((item) => {
        if (item.onlyRoles && !item.onlyRoles.includes(roleCode)) return false;
        if (!item.requires) return true;
        if (loading) return true;
        if (!permissions || permissions.length === 0) return true;
        return can(item.requires.resource, item.requires.action, item.requires.scope ?? 'OWN');
      })
      .map((item) => ({ ...item, children: item.children ? filterItems(item.children) : undefined }));
  };

  const items = filterItems(NAV_ITEMS);

  const brandHeader = (showClose = false, idSuffix = 'desktop') => (
    <div className="h-20 px-4 flex items-center justify-between border-b border-border/40 shrink-0 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ background: `radial-gradient(circle at 20% 50%, ${theme.accentColor} 0%, transparent 65%)` }} />
      <div className="flex items-center gap-3 min-w-0 relative z-10">
        <AuroraRingLogo theme={theme} size={collapsed ? 36 : 44} uniqueId={`${roleCode}-${idSuffix}`} />
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-bold text-base tracking-[0.08em] bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(135deg, ${theme.gradientStops[0]}, ${theme.gradientStops[2]})` }}>
              {theme.brandLabel}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="inline-block w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: theme.accentColor }} />
              <span className="text-[10px] font-medium uppercase tracking-[0.2em]" style={{ color: theme.accentColor }}>
                {role?.nameTh || theme.tagline}
              </span>
            </div>
          </div>
        )}
      </div>
      {!showClose ? (
        <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-all hover:scale-110 relative z-10" aria-label="Toggle sidebar">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      ) : (
        <button onClick={onMobileClose} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-all hover:rotate-90 relative z-10" aria-label="Close menu">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  const navContent = (
    <>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 relative">
        {items.map((item) => (
          <NavItemView key={item.href ?? item.labelKey} item={item} pathname={pathname} collapsed={collapsed} theme={theme} t={t} onMobileClose={onMobileClose} />
        ))}
      </nav>
      <div className="p-3 border-t border-border/40 shrink-0">
        {!collapsed ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground font-mono">v2.0.0</span>
            <div className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `linear-gradient(to right, ${theme.gradientStops[0]}20, ${theme.gradientStops[2]}20)`, color: theme.accentColor, border: `1px solid ${theme.accentColor}30` }}>
              {role?.code || theme.tagline}
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground text-center font-mono">v2</div>
        )}
      </div>
    </>
  );

  return (
    <>
      <aside className={cn('hidden lg:flex sticky top-0 h-screen flex-col border-r border-border/40 backdrop-blur-2xl transition-all duration-300 z-20', 'bg-card/60 dark:bg-card/40', collapsed ? 'w-16' : 'w-64')}>
        <div className="absolute right-0 top-0 bottom-0 w-px opacity-30" style={{ background: `linear-gradient(to bottom, transparent, ${theme.accentColor}, transparent)` }} />
        {brandHeader(false, 'desktop')}
        {navContent}
      </aside>
      <aside className={cn('fixed inset-y-0 left-0 z-40 w-72 flex flex-col border-r border-border/40 bg-card/95 backdrop-blur-2xl transition-transform duration-300 lg:hidden shadow-2xl', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
        {brandHeader(true, 'mobile')}
        {navContent}
      </aside>
    </>
  );
}