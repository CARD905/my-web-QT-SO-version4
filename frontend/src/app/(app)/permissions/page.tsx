'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  type LucideIcon,
  Shield, CheckCircle2, Sparkles, Crown, UserCog, Users, FileText,
  Package, ShoppingCart, ShieldCheck, Bell, Settings, BarChart2,
  UploadCloud, Activity, Star, Zap, Lock, BookOpen, ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api, getApiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import type { ApiResponse, MyPermissionsResponse, PermissionScope } from '@/types/api';
import { cn } from '@/lib/utils';

// ─── Resource meta ────────────────────────────────────────────────────────────
const RESOURCE_META: Record<string, { label: string; icon: LucideIcon; grad: string; ring: string }> = {
  quotation:    { label: 'ใบเสนอราคา',   icon: FileText,      grad: 'from-blue-500 to-indigo-600',    ring: 'ring-blue-500/30' },
  customer:     { label: 'ข้อมูลลูกค้า',  icon: Users,         grad: 'from-teal-500 to-cyan-600',      ring: 'ring-teal-500/30' },
  product:      { label: 'สินค้า',         icon: Package,       grad: 'from-violet-500 to-purple-600',  ring: 'ring-violet-500/30' },
  saleOrder:    { label: 'ใบสั่งขาย',     icon: ShoppingCart,  grad: 'from-emerald-500 to-green-600',  ring: 'ring-emerald-500/30' },
  user:         { label: 'ผู้ใช้งาน',     icon: UserCog,       grad: 'from-purple-500 to-fuchsia-600', ring: 'ring-purple-500/30' },
  approval:     { label: 'การอนุมัติ',    icon: ShieldCheck,   grad: 'from-amber-500 to-orange-600',   ring: 'ring-amber-500/30' },
  notification: { label: 'การแจ้งเตือน',  icon: Bell,          grad: 'from-pink-500 to-rose-600',      ring: 'ring-pink-500/30' },
  report:       { label: 'รายงาน',         icon: BarChart2,     grad: 'from-cyan-500 to-sky-600',       ring: 'ring-cyan-500/30' },
  settings:     { label: 'การตั้งค่า',    icon: Settings,      grad: 'from-slate-500 to-gray-600',     ring: 'ring-slate-500/30' },
  dashboard:    { label: 'แดชบอร์ด',       icon: Activity,      grad: 'from-indigo-500 to-blue-600',    ring: 'ring-indigo-500/30' },
  team:         { label: 'ทีม',             icon: Users,         grad: 'from-green-500 to-emerald-600',  ring: 'ring-green-500/30' },
};
const DEFAULT_RESOURCE = { label: '', icon: Shield, grad: 'from-slate-500 to-gray-600', ring: 'ring-slate-500/30' };

const ACTION_LABEL: Record<string, string> = {
  view: 'ดู', create: 'สร้าง', update: 'แก้ไข', delete: 'ลบ',
  approve: 'อนุมัติ', reject: 'ปฏิเสธ', submit: 'ส่งขออนุมัติ',
  upload: 'อัปโหลด', export: 'ออกรายงาน', exportPdf: 'ส่งออก PDF',
  manage: 'จัดการ', escalate: 'ส่งต่อ', viewCost: 'ดูต้นทุน', cancel: 'ยกเลิก',
};

const SCOPE_META: Record<PermissionScope, { label: string; cls: string }> = {
  OWN:        { label: 'ของตัวเอง', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  TEAM:       { label: 'ทีม',       cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  DEPARTMENT: { label: 'แผนก',      cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  ALL:        { label: 'ทั้งหมด',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
};

// ─── Role meta (สอดคล้องกับ manual/page.tsx) ─────────────────────────────────
const ROLE_META: Record<string, { grad: string; icon: LucideIcon; description: string; ring: string }> = {
  OFFICER: { grad: 'from-cyan-400 via-blue-500 to-indigo-600',    icon: Users,     description: 'ดูแลงานด้านเอกสารและการขาย',    ring: 'ring-blue-500/40' },
  SALES:   { grad: 'from-cyan-400 via-blue-500 to-indigo-600',    icon: Users,     description: 'ดูแลงานด้านเอกสารและการขาย',    ring: 'ring-blue-500/40' },
  MANAGER: { grad: 'from-amber-500 via-orange-500 to-rose-500',   icon: Crown,     description: 'ดูแลทีมและอนุมัติใบเสนอราคา',  ring: 'ring-amber-500/40' },
  CEO:     { grad: 'from-purple-600 via-violet-500 to-indigo-500', icon: Star,     description: 'ผู้บริหารสูงสุด',                ring: 'ring-purple-500/40' },
  ADMIN:   { grad: 'from-rose-500 via-pink-500 to-fuchsia-500',   icon: Sparkles,  description: 'ผู้ดูแลระบบทั้งหมด',            ring: 'ring-rose-500/40' },
};
const DEFAULT_ROLE_META = { grad: 'from-slate-500 to-gray-600', icon: Shield, description: 'ผู้ใช้งาน', ring: 'ring-slate-500/40' };

// ─── Capability highlights per role ──────────────────────────────────────────
const CAPABILITIES: Record<string, Array<{ icon: LucideIcon; title: string; desc: string; grad: string; href?: string }>> = {
  OFFICER: [
    { icon: FileText,     title: 'สร้างใบเสนอราคา',   desc: 'ร่าง แก้ไข และส่งขออนุมัติ QT',       grad: 'from-blue-500 to-indigo-600',   href: '/quotations/new' },
    { icon: Users,        title: 'ดูข้อมูลลูกค้า',    desc: 'ค้นหาและดูข้อมูลบริษัท/ผู้ติดต่อ',     grad: 'from-teal-500 to-cyan-600',     href: '/customers' },
    { icon: UploadCloud,  title: 'อัปโหลด PO',         desc: 'แนบไฟล์ PO หลังใบเสนอราคาผ่านอนุมัติ', grad: 'from-emerald-500 to-green-600', href: '/quotations/checklist' },
    { icon: ShoppingCart, title: 'ติดตาม Sale Order',  desc: 'ดูและติดตาม SO ที่สร้างจาก QT ของตัวเอง', grad: 'from-violet-500 to-purple-600', href: '/sale-orders' },
    { icon: Bell,         title: 'รับการแจ้งเตือน',   desc: 'แจ้งเตือนอัตโนมัติเมื่อสถานะเปลี่ยน',  grad: 'from-pink-500 to-rose-600' },
  ],
  SALES: [
    { icon: FileText,     title: 'สร้างใบเสนอราคา',   desc: 'ร่าง แก้ไข และส่งขออนุมัติ QT',       grad: 'from-blue-500 to-indigo-600',   href: '/quotations/new' },
    { icon: Users,        title: 'ดูข้อมูลลูกค้า',    desc: 'ค้นหาและดูข้อมูลบริษัท/ผู้ติดต่อ',     grad: 'from-teal-500 to-cyan-600',     href: '/customers' },
    { icon: UploadCloud,  title: 'อัปโหลด PO',         desc: 'แนบไฟล์ PO หลังใบเสนอราคาผ่านอนุมัติ', grad: 'from-emerald-500 to-green-600', href: '/quotations/checklist' },
    { icon: ShoppingCart, title: 'ติดตาม Sale Order',  desc: 'ดูและติดตาม SO ที่สร้างจาก QT ของตัวเอง', grad: 'from-violet-500 to-purple-600', href: '/sale-orders' },
    { icon: Bell,         title: 'รับการแจ้งเตือน',   desc: 'แจ้งเตือนอัตโนมัติเมื่อสถานะเปลี่ยน',  grad: 'from-pink-500 to-rose-600' },
  ],
  MANAGER: [
    { icon: ShieldCheck,  title: 'อนุมัติ / ปฏิเสธ', desc: 'ตัดสินใจ QT ตามวงเงินที่ได้รับมอบ',     grad: 'from-amber-500 to-orange-600', href: '/approval-queue' },
    { icon: Crown,        title: 'ดูภาพรวมทีม',       desc: 'Dashboard สถิติ KPI และรายงานทีม',      grad: 'from-orange-500 to-red-600',   href: '/dashboard' },
    { icon: Users,        title: 'แก้ไขข้อมูลลูกค้า', desc: 'แก้ไขอีเมล โทร และที่อยู่ได้เอง',       grad: 'from-teal-500 to-cyan-600',    href: '/customers' },
    { icon: FileText,     title: 'ดู QT ทั้งทีม',      desc: 'เห็น Quotation ของสมาชิกทุกคนในทีม',    grad: 'from-blue-500 to-indigo-600',  href: '/quotations' },
    { icon: Zap,          title: 'Escalate งาน',       desc: 'ส่งต่องานเกินอำนาจไปยังระดับสูงกว่า',   grad: 'from-rose-500 to-pink-600' },
  ],
  CEO: [
    { icon: Star,         title: 'อนุมัติไม่จำกัด',   desc: 'อนุมัติ QT ทุกใบ ทุกมูลค่า',            grad: 'from-purple-600 to-violet-600', href: '/approval-queue' },
    { icon: Activity,     title: 'ภาพรวมบริษัท',      desc: 'Dashboard KPI รายได้ ทุกทีม',           grad: 'from-indigo-500 to-blue-600',  href: '/dashboard' },
    { icon: BarChart2,    title: 'Sales Forecast',    desc: 'คาดการณ์รายได้และ revenue at risk',     grad: 'from-violet-500 to-purple-600', href: '/forecast' },
    { icon: FileText,     title: 'ดูทุกเอกสาร',       desc: 'QT และ SO ทุกรายการในบริษัท',          grad: 'from-sky-500 to-cyan-600',      href: '/quotations' },
    { icon: Bell,         title: 'รับ Escalation',    desc: 'งานเกินวงเงิน Manager ส่งต่อมาให้',     grad: 'from-amber-500 to-orange-600' },
  ],
  ADMIN: [
    { icon: UserCog,      title: 'จัดการผู้ใช้',       desc: 'เพิ่ม แก้ไข กำหนด role ทุก user',       grad: 'from-rose-500 to-pink-600',    href: '/admin/users' },
    { icon: ShieldCheck,  title: 'กำหนดสิทธิ์',        desc: 'ตั้ง permission ทุก role',              grad: 'from-pink-500 to-fuchsia-600', href: '/admin/settings' },
    { icon: Settings,     title: 'ตั้งค่าระบบ',         desc: 'VAT, discount, exchange rate',         grad: 'from-fuchsia-500 to-violet-600', href: '/admin/settings' },
    { icon: Activity,     title: 'Activity Logs',     desc: 'ตรวจสอบประวัติทุก action ในระบบ',       grad: 'from-violet-500 to-indigo-600', href: '/admin/activity-logs' },
    { icon: Sparkles,     title: 'ดูแลระบบทั้งหมด',   desc: 'เข้าถึงทุกหน้าและทุกข้อมูลในระบบ',       grad: 'from-indigo-500 to-blue-600' },
  ],
};

// ─── Permission groups (ครบตาม admin/settings PERM_GROUPS) ───────────────────
const MY_PERM_GROUPS = [
  {
    group: 'ใบเสนอราคา',
    items: [
      { code: 'quotation:create:own',    label: 'สร้างใบเสนอราคา' },
      { code: 'quotation:update:own',    label: 'แก้ไขใบเสนอราคา' },
      { code: 'quotation:cancel:own',    label: 'ลบ/ยกเลิกใบเสนอราคา' },
      { code: 'quotation:exportPdf:own', label: 'ส่งออก PDF ใบเสนอราคา' },
    ],
  },
  {
    group: 'ใบสั่งขาย',
    items: [
      { code: 'quotation:approve:team',  label: 'อนุมัติใบเสนอราคา' },
      { code: 'saleOrder:create:own',    label: 'แปลงเป็นใบสั่งขาย' },
      { code: 'saleOrder:exportPdf:own', label: 'ส่งออก PDF ใบสั่งขาย' },
    ],
  },
  {
    group: 'สินค้า',
    items: [
      { code: 'product:viewCost:all',    label: 'ดูต้นทุนสินค้า' },
      { code: 'product:update:all',      label: 'แก้ไขราคามาตรฐาน' },
    ],
  },
  {
    group: 'ลูกค้า',
    items: [
      { code: 'customer:create:all',     label: 'เพิ่มลูกค้า' },
      { code: 'customer:update:all',     label: 'แก้ไขข้อมูลลูกค้า' },
      { code: 'customer:delete:all',     label: 'ลบข้อมูลลูกค้า' },
    ],
  },
  {
    group: 'รายงาน',
    items: [
      { code: 'dashboard:view:own',      label: 'ดูรายงานส่วนตัว' },
      { code: 'dashboard:view:team',     label: 'ดูรายงานทีม' },
      { code: 'saleOrder:exportPdf:all', label: 'ส่งออกรายงานทั้งหมด' },
    ],
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MyPermissionsPage() {
  const { data: session } = useSession();
  const [data, setData]   = useState<MyPermissionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]     = useState<'capabilities' | 'details'>('capabilities');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<ApiResponse<MyPermissionsResponse>>('/permissions/me');
        if (res.data.data) setData(res.data.data);
      } catch (err) { toast.error(getApiErrorMessage(err)); }
      finally { setLoading(false); }
    })();
  }, []);

  const roleCode  = data ? (typeof data.role === 'string' ? data.role : (data.role as any)?.code || 'OFFICER') : 'OFFICER';
  const roleName  = data?.roleName || (data ? ((data.role as any)?.nameTh || roleCode) : roleCode);
  const meta      = ROLE_META[roleCode] || DEFAULT_ROLE_META;
  const RoleIcon  = meta.icon;
  const caps      = CAPABILITIES[roleCode] || CAPABILITIES['OFFICER'];
  const permCount = data?.permissions.length ?? 0;

  const userName  = (session?.user as any)?.name  || '';
  const userEmail = (session?.user as any)?.email || '';

  const byResource = data?.permissionsByResource ?? {};
  const hasDetail  = Object.keys(byResource).length > 0;

  const labelGrouped = new Map<string, Array<{ key: string; label: string }>>();
  if (!hasDetail && data) {
    for (const key of data.permissions) {
      const lbl = data.labels?.[key];
      const g   = lbl?.group || 'general';
      const arr = labelGrouped.get(g) ?? [];
      arr.push({ key, label: lbl?.th || key });
      labelGrouped.set(g, arr);
    }
  }

  if (loading) return (
    <div className="max-w-4xl space-y-4">
      <Skeleton className="h-44 w-full rounded-2xl" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 rounded-full" />)}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
    </div>
  );

  if (!data) return null;

  return (
    <div className="max-w-4xl space-y-6">

      {/* ── Hero banner ── */}
      <div className={cn('relative overflow-hidden rounded-2xl bg-gradient-to-br text-white shadow-2xl ring-2', meta.grad, meta.ring)}>
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-black/10 blur-3xl" />

        <div className="relative p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-5">
            <div className="relative shrink-0">
              <div className="h-20 w-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl ring-2 ring-white/30">
                <RoleIcon className="h-10 w-10" />
              </div>
              <span className="absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow-md">
                <Shield className="h-3.5 w-3.5 text-slate-700" />
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-[0.2em] text-white/70 mb-1">บทบาทของคุณ</div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{roleName}</h1>
              <p className="mt-1 text-sm text-white/80">{meta.description}</p>
              {userName && (
                <p className="mt-1.5 text-xs text-white/60 truncate">{userName}{userEmail && ` · ${userEmail}`}</p>
              )}
            </div>

            <div className="text-right shrink-0 hidden md:block">
              <div className="text-5xl font-black tabular-nums leading-none">{permCount}</div>
              <div className="mt-1 text-xs uppercase tracking-widest text-white/70">Permissions</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs (outside hero) ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['capabilities', 'details'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-full px-5 py-2 text-sm font-semibold transition-all border',
              tab === t
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground',
            )}
          >
            {t === 'capabilities' ? '✦ ความสามารถหลัก' : '≡ รายละเอียดสิทธิ์'}
          </button>
        ))}
        <Link
          href="/manual"
          className="ml-auto flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium border border-border bg-background hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <BookOpen className="h-3.5 w-3.5" />
          ดูคู่มือใช้งาน
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ── Capabilities tab ── */}
      {tab === 'capabilities' && (
        <div className="space-y-5">
          {/* Capability cards */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-primary mb-3">สิ่งที่คุณทำได้</div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {caps.map((cap) => {
                const Icon = cap.icon;
                const inner = (
                  <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-transparent hover:ring-1 hover:ring-primary/30 h-full">
                    <div className={cn('absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 bg-gradient-to-br', cap.grad)} />
                    <div className={cn('h-10 w-10 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shadow-md mb-3 transition-transform duration-300 group-hover:scale-110', cap.grad)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-sm leading-tight">{cap.title}</h3>
                    <p className="mt-1 text-xs leading-4 text-muted-foreground">{cap.desc}</p>
                    {cap.href && (
                      <div className="mt-2 flex items-center gap-1 text-[11px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        ไปที่หน้านี้ <ArrowRight className="h-2.5 w-2.5" />
                      </div>
                    )}
                  </div>
                );
                return cap.href
                  ? <Link key={cap.title} href={cap.href} className="block">{inner}</Link>
                  : <div key={cap.title}>{inner}</div>;
              })}
            </div>
          </div>

          {/* Limit note */}
          <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/30 p-4 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
            <span>
              {roleCode === 'MANAGER'
                ? 'งานที่เกินวงเงินหรือ discount limit ของคุณจะถูกส่งต่อ (Escalate) ไปยังระดับสูงกว่าโดยอัตโนมัติ'
                : roleCode === 'CEO' || roleCode === 'ADMIN'
                  ? 'บัญชีนี้มีสิทธิ์เข้าถึงสูงสุด — ทุก action จะถูกบันทึกใน Activity Logs'
                  : 'การอนุมัติและการจัดการทีมอยู่ในอำนาจของ Manager ขึ้นไป หากต้องการสิทธิ์เพิ่ม กรุณาติดต่อ Admin'}
            </span>
          </div>

          {/* Permission checklist */}
          <Card className="border-border/60 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-primary" />
                สิทธิ์การเข้าถึงของฉัน
                <Badge variant="outline" className="ml-auto text-[10px]">{permCount} permissions</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
                {MY_PERM_GROUPS.map((grp) => (
                  <div key={grp.group}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      {grp.group}
                      <span className="text-[9px] font-normal normal-case">
                        ({grp.items.filter(i => data.permissions.includes(i.code)).length}/{grp.items.length})
                      </span>
                    </p>
                    <div className="space-y-1.5">
                      {grp.items.map((item) => {
                        const allowed = data.permissions.includes(item.code);
                        return (
                          <div key={item.code} className="flex items-center gap-2">
                            {allowed
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              : <Lock className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
                            <span className={cn('text-[13px]', !allowed && 'text-muted-foreground/50 line-through')}>
                              {item.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Detail tab ── */}
      {tab === 'details' && (
        <div className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-widest text-primary">รายละเอียดสิทธิ์ทั้งหมด</div>

          {hasDetail ? (
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(byResource).map(([resource, actions]) => {
                const rm = RESOURCE_META[resource] || { ...DEFAULT_RESOURCE, label: resource };
                const Icon = rm.icon;
                const actionEntries = Object.entries(actions) as [string, PermissionScope][];
                return (
                  <div key={resource} className={cn('rounded-2xl border bg-card/80 overflow-hidden transition-all hover:shadow-sm ring-1', rm.ring)}>
                    <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border/40">
                      <div className={cn('h-8 w-8 rounded-lg bg-gradient-to-br text-white flex items-center justify-center shadow-sm', rm.grad)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-sm">{rm.label || resource}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">{actionEntries.length}</Badge>
                    </div>
                    <div className="p-3 flex flex-wrap gap-2">
                      {actionEntries.map(([action, scope]) => {
                        const sm = SCOPE_META[scope] || { label: scope, cls: 'bg-slate-100 text-slate-700' };
                        return (
                          <div key={action} className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-background/60 px-2.5 py-1.5">
                            <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                            <span className="text-xs font-medium">{ACTION_LABEL[action] || action}</span>
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', sm.cls)}>{sm.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from(labelGrouped.entries()).map(([group, perms]) => {
                const rm = RESOURCE_META[group] || { ...DEFAULT_RESOURCE, label: group };
                const Icon = rm.icon;
                return (
                  <div key={group} className={cn('rounded-2xl border bg-card/80 overflow-hidden ring-1', rm.ring)}>
                    <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border/40">
                      <div className={cn('h-8 w-8 rounded-lg bg-gradient-to-br text-white flex items-center justify-center shadow-sm', rm.grad)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-sm capitalize">{rm.label || group}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">{perms.length}</Badge>
                    </div>
                    <div className="p-3 space-y-1.5">
                      {perms.map((p) => (
                        <div key={p.key} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="text-xs">{p.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {labelGrouped.size === 0 && (
                <div className="col-span-2 rounded-2xl border border-border/60 bg-card/60 p-8 text-center text-sm text-muted-foreground">
                  <Shield className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  ไม่พบข้อมูลสิทธิ์
                </div>
              )}
            </div>
          )}

          {/* Summary strip */}
          <div className={cn('rounded-2xl bg-gradient-to-r p-0.5 shadow-md', meta.grad)}>
            <div className="rounded-[calc(1rem-2px)] bg-card/95 dark:bg-background/90 px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <RoleIcon className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm font-semibold">สิทธิ์ทั้งหมดของ {roleName}</div>
                  <div className="text-xs text-muted-foreground">{meta.description}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('text-2xl font-black bg-gradient-to-r bg-clip-text text-transparent', meta.grad)}>{permCount}</span>
                <span className="text-xs text-muted-foreground">permissions</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
