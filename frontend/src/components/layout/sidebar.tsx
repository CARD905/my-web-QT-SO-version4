'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, ClipboardList, Users, Package,
  Building2, Shield, ChevronLeft, ChevronRight, X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { usePermissions } from '@/hooks/use-permissions';

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  requires?: { resource: string; action: string; scope?: 'OWN' | 'TEAM' | 'DEPARTMENT' | 'ALL' };
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',   labelKey: 'nav.dashboard',  icon: LayoutDashboard, requires: { resource: 'dashboard',  action: 'view', scope: 'OWN' } },
  { href: '/quotations',  labelKey: 'nav.quotations',  icon: FileText,        requires: { resource: 'quotation',  action: 'view', scope: 'OWN' } },
  { href: '/sale-orders', labelKey: 'nav.saleOrders',  icon: ClipboardList,   requires: { resource: 'saleOrder',  action: 'view', scope: 'OWN' } },
  { href: '/customers',   labelKey: 'nav.customers',   icon: Users,           requires: { resource: 'customer',   action: 'view', scope: 'ALL' } },
  { href: '/products',    labelKey: 'nav.products',    icon: Package,         requires: { resource: 'product',    action: 'view', scope: 'ALL' } },
  { href: '/company',     labelKey: 'nav.company',     icon: Building2,       requires: { resource: 'company',    action: 'view', scope: 'ALL' } },
  { href: '/permissions', labelKey: 'nav.permissions', icon: Shield },
];

// ════════════════════════════════════════════════════════════════════════════
// ROLE THEMES
// ════════════════════════════════════════════════════════════════════════════
interface RoleTheme {
  brandLabel: string;
  tagline: string;
  accentColor: string;
  gradientStops: [string, string, string, string];
}

const ROLE_THEMES: Record<string, RoleTheme> = {
  OFFICER: {
    brandLabel: 'WISDOM', tagline: 'Officer',
    accentColor: '#06b6d4',
    gradientStops: ['#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1'],
  },
  SALES: {
    brandLabel: 'WISDOM', tagline: 'Sales',
    accentColor: '#06b6d4',
    gradientStops: ['#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1'],
  },
  MANAGER: {
    brandLabel: 'WISDOM', tagline: 'Manager',
    accentColor: '#f59e0b',
    gradientStops: ['#fbbf24', '#f59e0b', '#f97316', '#ef4444'],
  },
  APPROVER: {
    brandLabel: 'WISDOM', tagline: 'Approver',
    accentColor: '#a855f7',
    gradientStops: ['#a855f7', '#c084fc', '#d946ef', '#ec4899'],
  },
  ADMIN: {
    brandLabel: 'WISDOM', tagline: 'Admin',
    accentColor: '#ef4444',
    gradientStops: ['#fb7185', '#f43f5e', '#ef4444', '#dc2626'],
  },
  CEO: {
    brandLabel: 'WISDOM', tagline: 'CEO',
    accentColor: '#d4a574',
    gradientStops: ['#fde68a', '#d4a574', '#a855f7', '#ec4899'],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// AURORA RING LOGO
// ════════════════════════════════════════════════════════════════════════════
function AuroraRingLogo({
  theme,
  size = 44,
  uniqueId,
}: {
  theme: RoleTheme;
  size?: number;
  uniqueId: string;
}) {
  const gradId = `aurora-${uniqueId}`;
  const [s1, s2, s3, s4] = theme.gradientStops;

  return (
    <div
      className="relative shrink-0"
      style={{
        width: size,
        height: size,
        filter: `drop-shadow(0 0 8px ${theme.accentColor}40)`,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={gradId}
            gradientUnits="userSpaceOnUse"
            x1="10" y1="10" x2="90" y2="90"
          >
            <stop offset="0%"   stopColor={s1} />
            <stop offset="33%"  stopColor={s2} />
            <stop offset="66%"  stopColor={s3} />
            <stop offset="100%" stopColor={s4} />
          </linearGradient>
        </defs>

        <g className="aurora-spin-slow" style={{ transformOrigin: '50px 50px' }}>
          <circle
            cx="50" cy="50" r="40"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="3"
          />
        </g>

        <g className="aurora-spin-rev" style={{ transformOrigin: '50px 50px' }}>
          <circle
            cx="50" cy="50" r="32"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="0.8"
            strokeDasharray="2 4"
            opacity="0.6"
          />
        </g>

        <circle cx="50" cy="50" r="26" className="aurora-disc" />

        <text
          x="50" y="61"
          textAnchor="middle"
          fill="white"
          fontSize="26"
          fontWeight="600"
          style={{ letterSpacing: '-0.04em' }}
        >
          W
        </text>
      </svg>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN SIDEBAR
// ════════════════════════════════════════════════════════════════════════════
interface SidebarProps {
  role?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ role: initialRole, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const t = useT();
  const { can, role, loading } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);

  const items = NAV_ITEMS.filter((item) => {
  
    if (loading) {
      return !item.requires;
    }
    if (!item.requires) return true;
    return can(item.requires.resource, item.requires.action, item.requires.scope ?? 'OWN');
});

  const roleCode = role?.code || initialRole || 'OFFICER';
  const theme = ROLE_THEMES[roleCode] || ROLE_THEMES.OFFICER;

  // ─── Brand header ────────────────────────────────────────────────────────
  const brandHeader = (showClose = false, idSuffix = 'desktop') => (
    <div className="h-20 px-4 flex items-center justify-between border-b border-border/40 shrink-0 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          background: `radial-gradient(circle at 20% 50%, ${theme.accentColor} 0%, transparent 65%)`,
        }}
      />

      <div className="flex items-center gap-3 min-w-0 relative z-10">
        <AuroraRingLogo
          theme={theme}
          size={collapsed ? 36 : 44}
          uniqueId={`${roleCode}-${idSuffix}`}
        />

        {!collapsed && (
          <div className="min-w-0">
            <div
              className="font-bold text-base tracking-[0.08em] bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(135deg, ${theme.gradientStops[0]}, ${theme.gradientStops[2]})`,
              }}
            >
              {theme.brandLabel}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="inline-block w-1 h-1 rounded-full animate-pulse"
                style={{ backgroundColor: theme.accentColor }}
              />
              <span
                className="text-[10px] font-medium uppercase tracking-[0.2em]"
                style={{ color: theme.accentColor }}
              >
                {role?.nameTh || theme.tagline}
              </span>
            </div>
          </div>
        )}
      </div>

      {!showClose && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-all hover:scale-110 relative z-10"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      )}

      {showClose && (
        <button
          onClick={onMobileClose}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-all hover:rotate-90 relative z-10"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  // ─── Nav items ────────────────────────────────────────────────────────────
  const navContent = (
    <>
      {loading && (
        <div className="flex-1 p-2 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-10 rounded-lg bg-muted/30 animate-pulse"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      )}

      {!loading && (
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 relative">
          {items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={cn(
                  'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  active
                    ? 'text-foreground bg-gradient-to-r from-accent/80 to-accent/40 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/30 hover:translate-x-0.5',
                )}
                title={collapsed ? t(item.labelKey) : undefined}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-r-full"
                    style={{
                      background: `linear-gradient(to bottom, ${theme.gradientStops[0]}, ${theme.gradientStops[2]})`,
                      boxShadow: `0 0 12px ${theme.accentColor}80`,
                    }}
                  />
                )}

                <div
                  className={cn(
                    'relative flex items-center justify-center shrink-0 transition-all',
                    active && 'scale-110',
                  )}
                >
                  <Icon
                    className="h-4 w-4 relative z-10"
                    style={{
                      color: active ? theme.accentColor : undefined,
                      filter: active ? `drop-shadow(0 0 4px ${theme.accentColor}80)` : undefined,
                    }}
                  />
                </div>

                {!collapsed && (
                  <span className="truncate flex-1">{t(item.labelKey)}</span>
                )}

                {!active && !collapsed && (
                  <span
                    className="w-1.5 h-1.5 rounded-full opacity-0 group-hover:opacity-60 transition-opacity"
                    style={{ backgroundColor: theme.accentColor }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-border/40 shrink-0">
        {!collapsed ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground font-mono">v2.0.0</span>
            <div
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{
                background: `linear-gradient(to right, ${theme.gradientStops[0]}20, ${theme.gradientStops[2]}20)`,
                color: theme.accentColor,
                border: `1px solid ${theme.accentColor}30`,
              }}
            >
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
      {/* ── DESKTOP sidebar ── */}
      <aside
        className={cn(
          'hidden lg:flex sticky top-0 h-screen flex-col border-r border-border/40 backdrop-blur-2xl transition-all duration-300 z-20',
          'bg-card/60 dark:bg-card/40',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <div
          className="absolute right-0 top-0 bottom-0 w-px opacity-30"
          style={{
            background: `linear-gradient(to bottom, transparent, ${theme.accentColor}, transparent)`,
          }}
        />

        {brandHeader(false, 'desktop')}
        {navContent}
      </aside>

      {/* ── MOBILE drawer ── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-72 flex flex-col border-r border-border/40 bg-card/95 backdrop-blur-2xl transition-transform duration-300 lg:hidden shadow-2xl',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {brandHeader(true, 'mobile')}
        {navContent}
      </aside>
    </>
  );
}