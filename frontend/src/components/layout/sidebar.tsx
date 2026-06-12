'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, ClipboardList, Users, Package,
  Building2, Shield, ChevronLeft, ChevronRight, ChevronDown, X,
  CheckSquare, Mail, History, Settings, Activity,
  Key, BarChart3, LogIn, BookOpen,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api';

interface NavItem {
  href?: string;
  labelKey: string;
  icon: LucideIcon;
  requires?: { resource: string; action: string; scope?: 'OWN' | 'TEAM' | 'DEPARTMENT' | 'ALL' };
  onlyRoles?: string[];
  excludeRoles?: string[];
  children?: NavItem[];
  showBadge?: boolean;              // manager approval-queue count
  officerBadge?: 'qt' | 'checklist' | 'so';  // officer sidebar counts
  showCustomerRequestBadge?: boolean; // admin customer pending-request count
  dividerLabel?: string;            // section group label (CEO nav groups)
}

// ── Manager approval-queue badge ─────────────────────────────────────────────
function ApprovalBadge({ collapsed }: { collapsed: boolean }) {
  const [count, setCount] = useState<number | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    api.get<{ success: boolean; data?: { total: number } }>('/manager-dashboard/pending-count')
      .then((res) => { if (!cancelled) setCount(res.data.data?.total ?? 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pathname]);

  if (!count || count <= 0) return null;
  if (collapsed) {
    return (
      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center shadow">
        {count > 9 ? '9+' : count}
      </span>
    );
  }
  return (
    <span className="ml-auto h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center shadow shrink-0">
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ── Officer nav-count badge (shared single fetch via module cache) ─────────────
type OfficerCounts = { qt: number; checklist: number; so: number };
let _officerCountsCache: Promise<OfficerCounts> | null = null;
function getOfficerCounts(): Promise<OfficerCounts> {
  if (!_officerCountsCache) {
    _officerCountsCache = api
      .get<{ success: boolean; data?: OfficerCounts }>('/manager-dashboard/nav-counts')
      .then((r) => r.data.data ?? { qt: 0, checklist: 0, so: 0 })
      .catch(() => ({ qt: 0, checklist: 0, so: 0 }));
    // expire after 60s so counts refresh on next page visit
    setTimeout(() => { _officerCountsCache = null; }, 60_000);
  }
  return _officerCountsCache;
}

function OfficerNavBadge({ type, collapsed }: { type: 'qt' | 'checklist' | 'so'; collapsed: boolean }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOfficerCounts().then((c) => {
      if (!cancelled) setCount(c[type]);
    });
    return () => { cancelled = true; };
  }, [type]);

  if (!count || count <= 0) return null;
  if (collapsed) {
    return (
      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-500 text-[9px] font-bold text-white flex items-center justify-center shadow">
        {count > 9 ? '9+' : count}
      </span>
    );
  }
  return (
    <span className="ml-auto h-5 min-w-[20px] px-1 rounded-full bg-blue-500 text-[10px] font-bold text-white flex items-center justify-center shadow shrink-0">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function OfficerGroupBadge({ types, collapsed }: { types: ReadonlyArray<'qt' | 'checklist' | 'so'>; collapsed: boolean }) {
  const [total, setTotal] = useState<number | null>(null);
  const key = types.join(',');

  useEffect(() => {
    let cancelled = false;
    getOfficerCounts().then((c) => {
      if (!cancelled) setTotal(types.reduce((s, t) => s + (c[t] ?? 0), 0));
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!total || total <= 0) return null;
  if (collapsed) {
    return (
      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-500 text-[9px] font-bold text-white flex items-center justify-center shadow">
        {total > 9 ? '9+' : total}
      </span>
    );
  }
  return (
    <span className="ml-auto h-5 min-w-[20px] px-1 rounded-full bg-blue-500 text-[10px] font-bold text-white flex items-center justify-center shadow shrink-0">
      {total > 99 ? '99+' : total}
    </span>
  );
}


// ── Admin customer edit-request pending badge ─────────────────────────────
function CustomerRequestBadge({ collapsed }: { collapsed: boolean }) {
  const [count, setCount] = useState<number | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    api.get<{ success: boolean; data?: { count: number } }>('/customers/edit-requests/pending-count')
      .then((res) => { if (!cancelled) setCount(res.data.data?.count ?? 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pathname]);

  if (!count || count <= 0) return null;
  if (collapsed) {
    return (
      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-orange-500 text-[9px] font-bold text-white flex items-center justify-center shadow">
        {count > 9 ? '9+' : count}
      </span>
    );
  }
  return (
    <span className="ml-auto h-5 min-w-[20px] px-1 rounded-full bg-orange-500 text-[10px] font-bold text-white flex items-center justify-center shadow shrink-0">
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// NAV ITEMS — แบ่งตาม role ชัดเจน
// ════════════════════════════════════════════════════════════════════════════
const NAV_ITEMS: NavItem[] = [

  // ── Dashboard (ทุก role เห็น — redirect ตาม role ใน page.tsx) ──────────
  {
    href: '/dashboard',
    labelKey: 'nav.dashboard',
    icon: LayoutDashboard,
    requires: { resource: 'dashboard', action: 'view', scope: 'OWN' },
  },

  // ── PIPELINE ─────────────────────────────────────────────────────────────
  { dividerLabel: 'PIPELINE', labelKey: '', icon: FileText, excludeRoles: ['ADMIN'] },
  {
    labelKey: 'nav.quotations',
    icon: FileText,
    excludeRoles: ['ADMIN'],
    requires: { resource: 'quotation', action: 'view', scope: 'OWN' },
    children: [
      {
        href: '/quotations',
        labelKey: 'nav.quotationList',
        icon: FileText,
        requires: { resource: 'quotation', action: 'view', scope: 'OWN' },
        officerBadge: 'qt' as const,
      },
      {
        href: '/quotations/checklist',
        labelKey: 'nav.quotationChecklist',
        icon: CheckSquare,
        requires: { resource: 'quotation', action: 'view', scope: 'OWN' },
        officerBadge: 'checklist' as const,
      },
    ],
  },
  {
    href: '/sale-orders',
    labelKey: 'nav.saleOrders',
    icon: ClipboardList,
    excludeRoles: ['ADMIN'],
    requires: { resource: 'saleOrder', action: 'view', scope: 'OWN' },
    officerBadge: 'so' as const,
  },
  {
    href: '/approval-queue',
    labelKey: 'nav.approvalQueue',
    icon: CheckSquare,
    excludeRoles: ['ADMIN', 'OFFICER'],
    showBadge: true,
  },
  {
    href: '/history',
    labelKey: 'nav.history',
    icon: History,
    excludeRoles: ['ADMIN', 'OFFICER'],
    requires: { resource: 'quotation', action: 'approve', scope: 'TEAM' },
  },

  // ── MASTER DATA ───────────────────────────────────────────────────────────
  { dividerLabel: 'MASTERDATA', labelKey: '', icon: Package },
  {
    href: '/customers',
    labelKey: 'nav.customers',
    icon: Users,
    requires: { resource: 'customer', action: 'view', scope: 'ALL' },
    showCustomerRequestBadge: true,
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

  // ── ORGANIZATION ─────────────────────────────────────────────────────────
  { dividerLabel: 'ORGANIZATION', labelKey: '', icon: Users, onlyRoles: ['MANAGER'] },
  {
    href: '/team',
    labelKey: 'nav.myTeam',
    icon: Users,
    onlyRoles: ['MANAGER'],
    requires: { resource: 'user', action: 'invite', scope: 'TEAM' },
  },

  // ── ANALYTICS ────────────────────────────────────────────────────────────
  { dividerLabel: 'ANALYTICS', labelKey: '', icon: BarChart3, onlyRoles: ['MANAGER'] },
  {
    href: '/prediction',
    labelKey: 'predictions',
    icon: BarChart3,
    onlyRoles: ['MANAGER'],
  },

  // ── REFERENCE ────────────────────────────────────────────────────────────
  { dividerLabel: 'REFERENCE', labelKey: '', icon: BookOpen, onlyRoles: ['OFFICER', 'SALES', 'MANAGER'] },
  {
    href: '/manual',
    labelKey: 'nav.manual',
    icon: BookOpen,
    onlyRoles: ['OFFICER', 'SALES', 'MANAGER'],
  },

  // ── ADMIN PANEL — เฉพาะ ADMIN เห็น ──────────────────────────────────────
  { dividerLabel: 'ADMIN PANEL', labelKey: '', icon: Shield, onlyRoles: ['ADMIN'] },
  {
    href: '/admin',
    labelKey: 'nav.adminPanel',
    icon: Shield,
    onlyRoles: ['ADMIN'],
    requires: { resource: 'user', action: 'manage', scope: 'ALL' },
    children: [
      {
        href: '/admin/users',
        labelKey: 'nav.adminUsers',
        icon: Users,
        requires: { resource: 'user', action: 'manage', scope: 'ALL' },
      },
      {
        href: '/admin/invitations',
        labelKey: 'nav.invitations',
        icon: Mail,
        requires: { resource: 'user', action: 'manage', scope: 'ALL' },
      },
      {
        href: '/admin/teams',
        labelKey: 'nav.adminTeams',
        icon: Building2,
        requires: { resource: 'user', action: 'manage', scope: 'ALL' },
      },
      {
        href: '/admin/approval',
        labelKey: 'nav.adminApproval',
        icon: Shield,
        requires: { resource: 'user', action: 'manage', scope: 'ALL' },
      },
      {
        href: '/admin/running-numbers',
        labelKey: 'nav.runningNumbers',
        icon: BarChart3,
        requires: { resource: 'user', action: 'manage', scope: 'ALL' },
      },
      {
        href: '/admin/login-history',
        labelKey: 'nav.loginHistory',
        icon: LogIn,
        requires: { resource: 'user', action: 'manage', scope: 'ALL' },
      },
      {
        href: '/admin/activity-logs',
        labelKey: 'nav.activityLogs',
        icon: Activity,
        requires: { resource: 'user', action: 'manage', scope: 'ALL' },
      },
      {
        href: '/admin/settings',
        labelKey: 'nav.adminSettings',
        icon: Settings,
        requires: { resource: 'user', action: 'manage', scope: 'ALL' },
      },
    ],
  },

  // ── CEO เห็น invitations ─────────────────────────────────────────────────
  {
    href: '/admin/invitations',
    labelKey: 'nav.invitations',
    icon: Mail,
    onlyRoles: ['CEO'],
    requires: { resource: 'user', action: 'invite', scope: 'ALL' },
  },

  // ── Permissions (ทุก role เห็น) ──────────────────────────────────────────
  { href: '/permissions', labelKey: 'nav.permissions', icon: Key },
];

// ════════════════════════════════════════════════════════════════════════════
// CEO-SPECIFIC NAV — grouped with section labels
// ════════════════════════════════════════════════════════════════════════════
const CEO_NAV_ITEMS: NavItem[] = [
  // ── GROUP 1: EXECUTIVE ──────────────────────────────────────────────────
  { dividerLabel: 'EXECUTIVE', labelKey: '', icon: LayoutDashboard },
  { href: '/dashboard',      labelKey: 'nav.dashboard',    icon: LayoutDashboard },
  { href: '/approval-queue', labelKey: 'nav.approvalQueue', icon: CheckSquare, showBadge: true },

  // ── GROUP 2: PIPELINE ───────────────────────────────────────────────────
  { dividerLabel: 'PIPELINE', labelKey: '', icon: FileText },
  { href: '/quotations',  labelKey: 'nav.quotationList', icon: FileText },
  { href: '/sale-orders', labelKey: 'nav.saleOrders',    icon: ClipboardList },

  // ── GROUP 2b: MASTERDATA ────────────────────────────────────────────────
  { dividerLabel: 'MASTERDATA', labelKey: '', icon: Package },
  { href: '/customers', labelKey: 'nav.customers', icon: Users },
  { href: '/products',  labelKey: 'nav.products',  icon: Package },

  // ── GROUP 3: ORGANIZATION ───────────────────────────────────────────────
  { dividerLabel: 'ORGANIZATION', labelKey: '', icon: Building2 },
  { href: '/users', labelKey: 'nav.staff', icon: Users },

  // ── GROUP 4: REPORTS ────────────────────────────────────────────────────
  // Full approval decision history across the organization
  { dividerLabel: 'REPORTS', labelKey: '', icon: BarChart3 },
  { href: '/predictions', labelKey: 'predictions', icon: BarChart3 },
  { href: '/history', labelKey: 'nav.auditTrail', icon: History },

  // ── GROUP 5: SETTINGS ───────────────────────────────────────────────────
  // Company profile, product master data
  { dividerLabel: 'SETTINGS', labelKey: '', icon: Settings },
  { href: '/company',  labelKey: 'nav.company',  icon: Building2 },
  
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
  OFFICER: { brandLabel: 'WISDOM', tagline: 'Officer',  accentColor: '#06b6d4', gradientStops: ['#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1'] },
  SALES:   { brandLabel: 'WISDOM', tagline: 'Sales',    accentColor: '#06b6d4', gradientStops: ['#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1'] },
  MANAGER: { brandLabel: 'WISDOM', tagline: 'Manager',  accentColor: '#f59e0b', gradientStops: ['#fbbf24', '#f59e0b', '#f97316', '#ef4444'] },
  ADMIN:   { brandLabel: 'WISDOM', tagline: 'Admin',    accentColor: '#ef4444', gradientStops: ['#fb7185', '#f43f5e', '#ef4444', '#dc2626'] },
  CEO:     { brandLabel: 'WISDOM', tagline: 'CEO',      accentColor: '#d4a574', gradientStops: ['#fde68a', '#d4a574', '#a855f7', '#ec4899'] },
};

// ════════════════════════════════════════════════════════════════════════════
// AURORA LOGO
// ════════════════════════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════════════════════════
// NAV COMPONENTS
// ════════════════════════════════════════════════════════════════════════════
interface NavItemViewProps {
  item: NavItem; pathname: string; collapsed: boolean;
  theme: RoleTheme; t: (k: string) => string;
  roleCode: string;
  onMobileClose?: () => void; level?: number;
}

function NavGroupItem({ item, pathname, collapsed, theme, t, roleCode, onMobileClose, level = 0 }: NavItemViewProps) {
  const Icon = item.icon;
  const children = item.children!;
  const anyChildActive = children.some((c) =>
    c.href ? pathname === c.href || (c.href !== '/dashboard' && pathname.startsWith(c.href + '/')) : false,
  );
  const [open, setOpen] = useState(anyChildActive);
  useEffect(() => { if (anyChildActive) setOpen(true); }, [anyChildActive]);

  const groupBadgeTypes = roleCode === 'OFFICER'
    ? (children.map((c) => c.officerBadge).filter(Boolean) as Array<'qt' | 'checklist' | 'so'>)
    : [];

  if (collapsed) {
    const firstChild = children[0];
    if (!firstChild?.href) return null;
    return (
      <Link href={firstChild.href} onClick={onMobileClose}
        className={cn('group relative flex items-center justify-center p-2.5 rounded-lg transition-all duration-200',
          anyChildActive ? 'text-foreground bg-white/10 dark:bg-white/10 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-foreground dark:hover:text-white hover:bg-white/8 dark:hover:bg-white/8')}
        title={t(item.labelKey)}>
        <div className="relative flex items-center justify-center">
          <Icon className="h-4 w-4" style={{ color: anyChildActive ? theme.accentColor : undefined, filter: anyChildActive ? `drop-shadow(0 0 4px ${theme.accentColor}80)` : undefined }} />
          {groupBadgeTypes.length > 0 && <OfficerGroupBadge types={groupBadgeTypes} collapsed={true} />}
        </div>
      </Link>
    );
  }

  return (
    <div>
      <button onClick={() => setOpen((v) => !v)}
        className={cn('group w-full relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
          anyChildActive ? 'text-foreground dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-foreground dark:hover:text-white')}
        style={anyChildActive
          ? { background: `linear-gradient(135deg, ${theme.accentColor}18, ${theme.gradientStops[2]}12)`, border: `1px solid ${theme.accentColor}25` }
          : undefined}>
        <div className="relative flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4" style={{ color: anyChildActive ? theme.accentColor : undefined, filter: anyChildActive ? `drop-shadow(0 0 4px ${theme.accentColor}80)` : undefined }} />
        </div>
        <span className="truncate flex-1 text-left">{t(item.labelKey)}</span>
        {groupBadgeTypes.length > 0 && <OfficerGroupBadge types={groupBadgeTypes} collapsed={false} />}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200 shrink-0', open && 'rotate-180')} style={{ color: theme.accentColor, opacity: 0.7 }} />
      </button>
      <div className={cn('overflow-hidden transition-all duration-300 ease-out', open ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0')}>
        <div className="pl-3 ml-3 border-l border-border/50 space-y-0.5">
          {children.map((child) => (
            <NavItemView key={child.href ?? child.labelKey} item={child} pathname={pathname} collapsed={collapsed} theme={theme} t={t} roleCode={roleCode} onMobileClose={onMobileClose} level={level + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

function NavItemView({ item, pathname, collapsed, theme, t, roleCode, onMobileClose, level = 0 }: NavItemViewProps) {
  const Icon = item.icon;
  const isLeafActive = item.href
    ? pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
    : false;

  // Section divider label (CEO grouped nav)
  if (item.dividerLabel) {
    if (collapsed) return null;
    const sectionColors: Record<string, { dot: string; text: string; bg: string; border: string }> = {
      PIPELINE:     { dot: '#06b6d4', text: '#0891b2', bg: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.20)' },
      MASTERDATA:   { dot: '#10b981', text: '#059669', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.20)' },
      ORGANIZATION: { dot: '#a855f7', text: '#9333ea', bg: 'rgba(168,85,247,0.08)',  border: 'rgba(168,85,247,0.20)' },
      ANALYTICS:    { dot: '#f59e0b', text: '#d97706', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.20)' },
      REFERENCE:    { dot: '#ec4899', text: '#db2777', bg: 'rgba(236,72,153,0.08)',  border: 'rgba(236,72,153,0.20)' },
      'ADMIN PANEL':{ dot: '#ef4444', text: '#dc2626', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.20)' },
      EXECUTIVE:    { dot: '#d4a574', text: '#b7874b', bg: 'rgba(212,165,116,0.08)', border: 'rgba(212,165,116,0.20)' },
      REPORTS:      { dot: '#7c3aed', text: '#6d28d9', bg: 'rgba(124,58,237,0.08)',  border: 'rgba(124,58,237,0.20)' },
      SETTINGS:     { dot: '#64748b', text: '#475569', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.20)' },
    };
    const sc = sectionColors[item.dividerLabel] ?? { dot: theme.accentColor, text: theme.accentColor, bg: `${theme.accentColor}14`, border: `${theme.accentColor}30` };
    return (
      <div className="px-2 pt-4 pb-1 first:pt-2">
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.16em] select-none"
          style={{ color: sc.text, background: sc.bg, border: `1px solid ${sc.border}` }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: sc.dot }} />
          {item.dividerLabel}
        </span>
      </div>
    );
  }

  if (item.children && item.children.length > 0) {
    return <NavGroupItem item={item} pathname={pathname} collapsed={collapsed} theme={theme} t={t} roleCode={roleCode} onMobileClose={onMobileClose} level={level} />;
  }
  if (!item.href) return null;

  return (
    <Link href={item.href} onClick={onMobileClose}
      className={cn('group relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
        isLeafActive
          ? 'text-foreground dark:text-white shadow-sm'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:translate-x-0.5',
        level > 0 && 'py-1.5 text-[13px]')}
      style={isLeafActive
        ? { background: `linear-gradient(135deg, ${theme.accentColor}18, ${theme.gradientStops[2]}12)`, borderColor: `${theme.accentColor}25`, border: `1px solid ${theme.accentColor}25` }
        : undefined}
      onMouseEnter={!isLeafActive ? (e) => { (e.currentTarget as HTMLElement).style.background = `${theme.accentColor}0d`; } : undefined}
      onMouseLeave={!isLeafActive ? (e) => { (e.currentTarget as HTMLElement).style.background = ''; } : undefined}
      title={collapsed ? t(item.labelKey) : undefined}>
      {isLeafActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
          style={{ background: `linear-gradient(to bottom, ${theme.gradientStops[0]}, ${theme.gradientStops[2]})`, boxShadow: `0 0 12px ${theme.accentColor}80` }} />
      )}
      <div className={cn('relative flex items-center justify-center shrink-0', isLeafActive && 'scale-110')}>
        <Icon className={cn('h-4 w-4', level > 0 && 'h-3.5 w-3.5')}
          style={{ color: isLeafActive ? theme.accentColor : undefined, filter: isLeafActive ? `drop-shadow(0 0 4px ${theme.accentColor}80)` : undefined }} />
        {item.showBadge && collapsed && <ApprovalBadge collapsed={true} />}
        {item.officerBadge && collapsed && roleCode === 'OFFICER' && <OfficerNavBadge type={item.officerBadge} collapsed={true} />}
        {item.showCustomerRequestBadge && collapsed && roleCode === 'ADMIN' && <CustomerRequestBadge collapsed={true} />}
      </div>
      {!collapsed && <span className="truncate flex-1">{t(item.labelKey)}</span>}
      {!collapsed && item.showBadge && <ApprovalBadge collapsed={false} />}
      {!collapsed && item.officerBadge && roleCode === 'OFFICER' && <OfficerNavBadge type={item.officerBadge} collapsed={false} />}
      {!collapsed && item.showCustomerRequestBadge && roleCode === 'ADMIN' && <CustomerRequestBadge collapsed={false} />}
    </Link>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ════════════════════════════════════════════════════════════════════════════
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
        // ✅ onlyRoles filter
        if (item.onlyRoles && !item.onlyRoles.includes(roleCode)) return false;
        // ✅ excludeRoles filter
        if (item.excludeRoles && item.excludeRoles.includes(roleCode)) return false;
        // permission filter
        if (!item.requires) return true;
        if (loading) return true;
        if (!permissions || permissions.length === 0) return true;
        return can(item.requires.resource, item.requires.action, item.requires.scope ?? 'OWN');
      })
      .map((item) => ({ ...item, children: item.children ? filterItems(item.children) : undefined }));
  };

  const items = roleCode === 'CEO' ? CEO_NAV_ITEMS : filterItems(NAV_ITEMS);

  const brandHeader = (showClose = false, idSuffix = 'desktop') => (
    <div className="h-20 px-4 flex items-center justify-between border-b border-border/60 shrink-0 relative overflow-hidden">
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
        <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-all hover:scale-110 relative z-10">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      ) : (
        <button onClick={onMobileClose} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-all hover:rotate-90 relative z-10">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  const navContent = (
    <>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 relative">
        {items.map((item) => (
          <NavItemView key={item.href ?? item.labelKey} item={item} pathname={pathname} collapsed={collapsed} theme={theme} t={t} roleCode={roleCode} onMobileClose={onMobileClose} />
        ))}
      </nav>
      <div className="p-3 border-t border-border/60 shrink-0">
        {!collapsed ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400 dark:text-slate-600 font-mono">v2.0.0</span>
            <div className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `linear-gradient(to right, ${theme.gradientStops[0]}20, ${theme.gradientStops[2]}20)`, color: theme.accentColor, border: `1px solid ${theme.accentColor}30` }}>
              {role?.code || theme.tagline}
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-slate-400 dark:text-slate-600 text-center font-mono">v2</div>
        )}
      </div>
    </>
  );

  return (
    <>
      <aside className={cn('sidebar-bg hidden lg:flex sticky top-0 h-screen flex-col border-r transition-all duration-300 z-20 overflow-hidden', collapsed ? 'w-16' : 'w-64')}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, ${theme.accentColor}0a 0%, transparent 60%)` }} />
        <div className="absolute right-0 top-0 bottom-0 w-px opacity-40" style={{ background: `linear-gradient(to bottom, transparent, ${theme.accentColor}, transparent)` }} />
        {brandHeader(false, 'desktop')}
        {navContent}
      </aside>
      <aside className={cn('sidebar-bg fixed inset-y-0 left-0 z-40 w-72 flex flex-col border-r transition-transform duration-300 lg:hidden shadow-2xl', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
        {brandHeader(true, 'mobile')}
        {navContent}
      </aside>
    </>
  );
}
