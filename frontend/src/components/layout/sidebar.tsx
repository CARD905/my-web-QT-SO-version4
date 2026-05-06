'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, ClipboardList, Users, Package,
  Building2, Shield, TrendingUp, Crown, ChevronLeft, ChevronRight,
  X, Sparkles, type LucideIcon,
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
// ROLE THEME CONFIG — แต่ละ role มีเอกลักษณ์ที่ต่างกัน
// ════════════════════════════════════════════════════════════════════════════
interface RoleTheme {
  /** Brand label ที่แสดงในมุมซ้ายบน */
  brandLabel: string;
  /** Tagline เล็กๆ ใต้ brand */
  tagline: string;
  /** Gradient สำหรับโลโก้และ accent */
  gradient: string;
  /** Solid color สำหรับ glow */
  glowColor: string;
  /** Tailwind class สำหรับ glow ring */
  glowClass: string;
  /** สีของวงโคจร 3 วง */
  orbitColors: [string, string, string];
  /** Icon ของ role */
  icon: LucideIcon;
}

const ROLE_THEMES: Record<string, RoleTheme> = {
  OFFICER: {
    brandLabel: 'WISDOM',
    tagline: 'Officer',
    gradient: 'from-blue-400 via-cyan-400 to-blue-600',
    glowColor: '#06b6d4',
    glowClass: 'shadow-[0_0_20px_rgba(6,182,212,0.5)]',
    orbitColors: ['#06b6d4', '#3b82f6', '#0891b2'],
    icon: Users,
  },
  SALES: {
    brandLabel: 'WISDOM',
    tagline: 'Sales',
    gradient: 'from-blue-400 via-cyan-400 to-blue-600',
    glowColor: '#06b6d4',
    glowClass: 'shadow-[0_0_20px_rgba(6,182,212,0.5)]',
    orbitColors: ['#06b6d4', '#3b82f6', '#0891b2'],
    icon: Users,
  },
  MANAGER: {
    brandLabel: 'WISDOM',
    tagline: 'Manager',
    gradient: 'from-amber-400 via-orange-400 to-red-500',
    glowColor: '#f59e0b',
    glowClass: 'shadow-[0_0_24px_rgba(245,158,11,0.55)]',
    orbitColors: ['#f59e0b', '#f97316', '#fb923c'],
    icon: TrendingUp,
  },
  APPROVER: {
    brandLabel: 'WISDOM',
    tagline: 'Approver',
    gradient: 'from-purple-400 via-fuchsia-400 to-pink-500',
    glowColor: '#a855f7',
    glowClass: 'shadow-[0_0_22px_rgba(168,85,247,0.55)]',
    orbitColors: ['#a855f7', '#d946ef', '#c026d3'],
    icon: TrendingUp,
  },
  ADMIN: {
    brandLabel: 'WISDOM',
    tagline: 'Admin',
    gradient: 'from-rose-400 via-red-400 to-pink-600',
    glowColor: '#ef4444',
    glowClass: 'shadow-[0_0_22px_rgba(239,68,68,0.55)]',
    orbitColors: ['#ef4444', '#f43f5e', '#dc2626'],
    icon: Shield,
  },
  CEO: {
    brandLabel: 'WISDOM',
    tagline: 'CEO',
    gradient: 'from-amber-300 via-yellow-400 to-amber-600',
    glowColor: '#fbbf24',
    glowClass: 'shadow-[0_0_28px_rgba(251,191,36,0.65)]',
    orbitColors: ['#fbbf24', '#f59e0b', '#facc15'],
    icon: Crown,
  },
};

// ════════════════════════════════════════════════════════════════════════════
// ORBITAL LOGO — โลโก้วงกลมพร้อมวงโคจร 3 วง
// ════════════════════════════════════════════════════════════════════════════
function OrbitalLogo({ theme, size = 40 }: { theme: RoleTheme; size?: number }) {
  return (
    <div
      className={cn('relative flex items-center justify-center shrink-0', theme.glowClass)}
      style={{ width: size, height: size }}
    >
      {/* SVG วงโคจร — หมุนอยู่ด้านหลัง */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full overflow-visible"
        aria-hidden="true"
      >
        {/* วงโคจรชั้นที่ 1 — เอียง 0° */}
        <g className="orbit-ring orbit-ring-1" style={{ transformOrigin: '50px 50px' }}>
          <ellipse
            cx="50" cy="50" rx="48" ry="14"
            fill="none"
            stroke={theme.orbitColors[0]}
            strokeWidth="0.8"
            opacity="0.45"
          />
          <circle r="2.5" fill={theme.orbitColors[0]}>
            <animateMotion
              dur="3.5s"
              repeatCount="indefinite"
              path="M 2 50 A 48 14 0 1 1 98 50 A 48 14 0 1 1 2 50"
            />
          </circle>
        </g>

        {/* วงโคจรชั้นที่ 2 — เอียง 60° */}
        <g
          className="orbit-ring orbit-ring-2"
          style={{ transformOrigin: '50px 50px', transform: 'rotate(60deg)' }}
        >
          <ellipse
            cx="50" cy="50" rx="48" ry="14"
            fill="none"
            stroke={theme.orbitColors[1]}
            strokeWidth="0.8"
            opacity="0.45"
          />
          <circle r="2" fill={theme.orbitColors[1]}>
            <animateMotion
              dur="5s"
              repeatCount="indefinite"
              path="M 2 50 A 48 14 0 1 0 98 50 A 48 14 0 1 0 2 50"
            />
          </circle>
        </g>

        {/* วงโคจรชั้นที่ 3 — เอียง -60° */}
        <g
          className="orbit-ring orbit-ring-3"
          style={{ transformOrigin: '50px 50px', transform: 'rotate(-60deg)' }}
        >
          <ellipse
            cx="50" cy="50" rx="48" ry="14"
            fill="none"
            stroke={theme.orbitColors[2]}
            strokeWidth="0.8"
            opacity="0.4"
          />
          <circle r="1.8" fill={theme.orbitColors[2]}>
            <animateMotion
              dur="4.2s"
              repeatCount="indefinite"
              path="M 2 50 A 48 14 0 1 1 98 50 A 48 14 0 1 1 2 50"
            />
          </circle>
        </g>
      </svg>

      {/* วงกลม core ตรงกลาง — ตัว W */}
      <div
        className={cn(
          'relative z-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-black',
          theme.gradient,
        )}
        style={{
          width: size * 0.6,
          height: size * 0.6,
          fontSize: size * 0.32,
          letterSpacing: '-0.05em',
          textShadow: '0 0 12px rgba(255,255,255,0.4)',
        }}
      >
        W
      </div>
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
    if (loading) return false;
    if (!item.requires) return true;
    return can(item.requires.resource, item.requires.action, item.requires.scope ?? 'OWN');
  });

  const roleCode = role?.code || initialRole || 'OFFICER';
  const theme = ROLE_THEMES[roleCode] || ROLE_THEMES.OFFICER;

  // ─── Brand header ────────────────────────────────────────────────────────
  const brandHeader = (showClose = false) => (
    <div className="h-20 px-3 flex items-center justify-between border-b border-border/40 shrink-0 relative overflow-hidden">
      {/* Subtle background glow ของ role */}
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          background: `radial-gradient(circle at 30% 50%, ${theme.glowColor} 0%, transparent 70%)`,
        }}
      />

      <div className="flex items-center gap-3 min-w-0 relative z-10">
        <OrbitalLogo theme={theme} size={collapsed ? 36 : 44} />

        {!collapsed && (
          <div className="min-w-0">
            <div
              className="font-black text-base tracking-wide bg-clip-text text-transparent bg-gradient-to-r"
              style={{
                backgroundImage: `linear-gradient(to right, ${theme.orbitColors[0]}, ${theme.orbitColors[1]})`,
              }}
            >
              {theme.brandLabel}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Sparkles className="h-2.5 w-2.5" style={{ color: theme.glowColor }} />
              <span
                className="text-[10px] font-bold uppercase tracking-[0.15em]"
                style={{ color: theme.glowColor }}
              >
                {role?.nameTh || theme.tagline}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Toggle button */}
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
          {items.map((item, idx) => {
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
                style={{
                  animationDelay: `${idx * 50}ms`,
                }}
                title={collapsed ? t(item.labelKey) : undefined}
              >
                {/* Active indicator — vertical bar */}
                {active && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-r-full"
                    style={{
                      background: `linear-gradient(to bottom, ${theme.orbitColors[0]}, ${theme.orbitColors[1]})`,
                      boxShadow: `0 0 12px ${theme.glowColor}80`,
                    }}
                  />
                )}

                {/* Icon — มี glow ตอน active */}
                <div
                  className={cn(
                    'relative flex items-center justify-center shrink-0 transition-all',
                    active && 'scale-110',
                  )}
                >
                  <Icon
                    className="h-4 w-4 relative z-10"
                    style={{
                      color: active ? theme.glowColor : undefined,
                      filter: active ? `drop-shadow(0 0 4px ${theme.glowColor}80)` : undefined,
                    }}
                  />
                </div>

                {!collapsed && (
                  <span className="truncate flex-1">{t(item.labelKey)}</span>
                )}

                {/* Hover dot indicator */}
                {!active && !collapsed && (
                  <span
                    className="w-1.5 h-1.5 rounded-full opacity-0 group-hover:opacity-60 transition-opacity"
                    style={{ backgroundColor: theme.glowColor }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Footer — version + role badge */}
      <div className="p-3 border-t border-border/40 shrink-0">
        {!collapsed ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground font-mono">v2.0.0</span>
            <div
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{
                background: `linear-gradient(to right, ${theme.orbitColors[0]}20, ${theme.orbitColors[1]}20)`,
                color: theme.glowColor,
                border: `1px solid ${theme.glowColor}30`,
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
        {/* Side accent line — แบ่งสีตาม role */}
        <div
          className="absolute right-0 top-0 bottom-0 w-px opacity-30"
          style={{
            background: `linear-gradient(to bottom, transparent, ${theme.glowColor}, transparent)`,
          }}
        />

        {brandHeader(false)}
        {navContent}
      </aside>

      {/* ── MOBILE drawer ── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-72 flex flex-col border-r border-border/40 bg-card/95 backdrop-blur-2xl transition-transform duration-300 lg:hidden shadow-2xl',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {brandHeader(true)}
        {navContent}
      </aside>
    </>
  );
}