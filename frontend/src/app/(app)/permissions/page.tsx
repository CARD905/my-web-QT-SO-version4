'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import type { LucideIcon } from 'lucide-react';
import {
  Shield, CheckCircle2, Sparkles, Crown, UserCog, Users, FileText,
  Package, ShoppingCart, ShieldCheck, Bell, Settings, BarChart2,
  UploadCloud, Activity, Star, Zap, Lock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
  upload: 'อัปโหลด', export: 'ออกรายงาน', manage: 'จัดการ', escalate: 'ส่งต่อ',
};

const SCOPE_META: Record<PermissionScope, { label: string; cls: string }> = {
  OWN:        { label: 'ของตัวเอง', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  TEAM:       { label: 'ทีม',       cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  DEPARTMENT: { label: 'แผนก',      cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  ALL:        { label: 'ทั้งหมด',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
};

// ─── Role meta ────────────────────────────────────────────────────────────────
const ROLE_META: Record<string, { grad: string; icon: LucideIcon; description: string; ring: string }> = {
  OFFICER: { grad: 'from-blue-600 via-cyan-500 to-teal-500',     icon: Users,     description: 'ดูแลงานด้านเอกสารและการขาย',    ring: 'ring-blue-500/40' },
  SALES:   { grad: 'from-blue-600 via-cyan-500 to-teal-500',     icon: Users,     description: 'ดูแลงานด้านเอกสารและการขาย',    ring: 'ring-blue-500/40' },
  MANAGER: { grad: 'from-amber-500 via-orange-500 to-rose-500',  icon: Crown,     description: 'ดูแลทีมและอนุมัติใบเสนอราคา',  ring: 'ring-amber-500/40' },
  ADMIN:   { grad: 'from-rose-500 via-pink-500 to-fuchsia-500',  icon: Sparkles,  description: 'ผู้ดูแลระบบทั้งหมด',            ring: 'ring-rose-500/40' },
  CEO:     { grad: 'from-purple-600 via-violet-500 to-indigo-500', icon: Star,    description: 'ผู้บริหารสูงสุด',                ring: 'ring-purple-500/40' },
};
const DEFAULT_ROLE_META = { grad: 'from-slate-500 to-gray-600', icon: Shield, description: 'ผู้ใช้งาน', ring: 'ring-slate-500/40' };

// ─── Capability highlights per role ──────────────────────────────────────────
const CAPABILITIES: Record<string, Array<{ icon: LucideIcon; title: string; desc: string; grad: string }>> = {
  OFFICER: [
    { icon: FileText,     title: 'สร้างใบเสนอราคา',   desc: 'ร่าง แก้ไข และส่งขออนุมัติ QT',       grad: 'from-blue-500 to-indigo-600' },
    { icon: Users,        title: 'ดูข้อมูลลูกค้า',    desc: 'ค้นหาและดูข้อมูลบริษัท/ผู้ติดต่อ',     grad: 'from-teal-500 to-cyan-600' },
    { icon: UploadCloud,  title: 'อัปโหลด PO',         desc: 'แนบไฟล์ PO หลังใบเสนอราคาผ่านอนุมัติ', grad: 'from-emerald-500 to-green-600' },
    { icon: ShoppingCart, title: 'ติดตาม Sale Order',  desc: 'ดูและติดตาม SO ที่สร้างจาก QT ของตัวเอง',grad: 'from-violet-500 to-purple-600' },
    { icon: Bell,         title: 'รับการแจ้งเตือน',   desc: 'แจ้งเตือนอัตโนมัติเมื่อสถานะเปลี่ยน',  grad: 'from-pink-500 to-rose-600' },
  ],
  SALES: [
    { icon: FileText,     title: 'สร้างใบเสนอราคา',   desc: 'ร่าง แก้ไข และส่งขออนุมัติ QT',       grad: 'from-blue-500 to-indigo-600' },
    { icon: Users,        title: 'ดูข้อมูลลูกค้า',    desc: 'ค้นหาและดูข้อมูลบริษัท/ผู้ติดต่อ',     grad: 'from-teal-500 to-cyan-600' },
    { icon: UploadCloud,  title: 'อัปโหลด PO',         desc: 'แนบไฟล์ PO หลังใบเสนอราคาผ่านอนุมัติ', grad: 'from-emerald-500 to-green-600' },
    { icon: ShoppingCart, title: 'ติดตาม Sale Order',  desc: 'ดูและติดตาม SO ที่สร้างจาก QT ของตัวเอง',grad: 'from-violet-500 to-purple-600' },
    { icon: Bell,         title: 'รับการแจ้งเตือน',   desc: 'แจ้งเตือนอัตโนมัติเมื่อสถานะเปลี่ยน',  grad: 'from-pink-500 to-rose-600' },
  ],
  MANAGER: [
    { icon: ShieldCheck,  title: 'อนุมัติ / ปฏิเสธ', desc: 'ตัดสินใจ QT ตามวงเงินที่ได้รับมอบ',     grad: 'from-amber-500 to-orange-600' },
    { icon: Crown,        title: 'ดูภาพรวมทีม',       desc: 'Dashboard สถิติ KPI และรายงานทีม',      grad: 'from-orange-500 to-red-600' },
    { icon: Users,        title: 'แก้ไขข้อมูลลูกค้า', desc: 'แก้ไขอีเมล โทร และที่อยู่ได้เอง',       grad: 'from-teal-500 to-cyan-600' },
    { icon: FileText,     title: 'ดู QT ทั้งทีม',      desc: 'เห็น Quotation ของสมาชิกทุกคนในทีม',    grad: 'from-blue-500 to-indigo-600' },
    { icon: Zap,          title: 'Escalate งาน',       desc: 'ส่งต่องานเกินอำนาจไปยังระดับสูงกว่า',   grad: 'from-rose-500 to-pink-600' },
  ],
};

// ─── Count-up hook ────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900) {
  const [count, setCount] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current || target === 0) return;
    started.current = true;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return count;
}

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
  const roleName  = data?.roleName || roleCode;
  const meta      = ROLE_META[roleCode] || DEFAULT_ROLE_META;
  const RoleIcon  = meta.icon;
  const caps      = CAPABILITIES[roleCode] || CAPABILITIES['OFFICER'];
  const permCount = data?.permissions.length ?? 0;
  const animCount = useCountUp(permCount);

  const userName  = (session?.user as any)?.name  || '';
  const userEmail = (session?.user as any)?.email || '';

  // Build resource → action → scope map from permissionsByResource if available
  const byResource = data?.permissionsByResource ?? {};
  const hasDetail  = Object.keys(byResource).length > 0;

  // Fallback: group from labels
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
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );

  if (!data) return null;

  return (
    <div className="max-w-4xl space-y-6">

      {/* ── Hero banner ── */}
      <div className={cn('relative overflow-hidden rounded-2xl bg-gradient-to-br text-white shadow-2xl ring-2', meta.grad, meta.ring)}>
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-black/10 blur-3xl" />

        <div className="relative p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="h-20 w-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl ring-2 ring-white/30">
                <RoleIcon className="h-10 w-10" />
              </div>
              <span className="absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow-md">
                <Shield className="h-3.5 w-3.5 text-slate-700" />
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-[0.2em] text-white/70 mb-1">บทบาทของคุณ</div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{roleName}</h1>
              <p className="mt-1 text-sm text-white/80">{meta.description}</p>
              {userName && (
                <p className="mt-1.5 text-xs text-white/60 truncate">{userName}{userEmail && ` · ${userEmail}`}</p>
              )}
            </div>

            {/* Perm count */}
            <div className="text-right shrink-0 hidden md:block">
              <div className="text-5xl font-black tabular-nums leading-none">{animCount}</div>
              <div className="mt-1 text-xs uppercase tracking-widest text-white/70">Permissions</div>
            </div>
          </div>

          {/* Tab pills */}
          <div className="mt-5 flex gap-2 flex-wrap">
            {(['capabilities', 'details'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
                  tab === t
                    ? 'bg-white text-slate-800 shadow-md'
                    : 'bg-white/20 text-white/90 hover:bg-white/30',
                )}
              >
                {t === 'capabilities' ? '✦ ความสามารถหลัก' : '≡ รายละเอียดสิทธิ์'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Capabilities tab ── */}
      {tab === 'capabilities' && (
        <div className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-widest text-primary">สิ่งที่คุณทำได้</div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {caps.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.title}
                  className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-transparent hover:ring-1 hover:ring-primary/30"
                >
                  {/* hover glow */}
                  <div className={cn('absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 bg-gradient-to-br', cap.grad)} />
                  <div className={cn('h-10 w-10 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shadow-md mb-3 transition-transform duration-300 group-hover:scale-110', cap.grad)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-sm leading-tight">{cap.title}</h3>
                  <p className="mt-1 text-xs leading-4 text-muted-foreground">{cap.desc}</p>
                </div>
              );
            })}
          </div>

          {/* "Cannot do" note */}
          <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/30 p-4 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
            <span>
              {roleCode === 'MANAGER'
                ? 'งานที่เกินวงเงินหรือ discount limit ของคุณจะถูกส่งต่อ (Escalate) ไปยังระดับสูงกว่าโดยอัตโนมัติ'
                : 'การอนุมัติและการจัดการทีมอยู่ในอำนาจของ Manager ขึ้นไป หากต้องการสิทธิ์เพิ่ม กรุณาติดต่อ Admin'}
            </span>
          </div>
        </div>
      )}

      {/* ── Detail tab ── */}
      {tab === 'details' && (
        <div className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-widest text-primary">รายละเอียดสิทธิ์ทั้งหมด</div>

          {hasDetail ? (
            // Render from permissionsByResource
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(byResource).map(([resource, actions]) => {
                const rm = RESOURCE_META[resource] || { ...DEFAULT_RESOURCE, label: resource };
                const Icon = rm.icon;
                const actionEntries = Object.entries(actions) as [string, PermissionScope][];
                return (
                  <div key={resource} className={cn('rounded-2xl border bg-card/80 overflow-hidden transition-all hover:shadow-sm', rm.ring, 'ring-1')}>
                    {/* header */}
                    <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border/40">
                      <div className={cn('h-8 w-8 rounded-lg bg-gradient-to-br text-white flex items-center justify-center shadow-sm', rm.grad)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-sm">{rm.label || resource}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">{actionEntries.length}</Badge>
                    </div>
                    {/* actions */}
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
            // Fallback: label-grouped
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

          {/* Total summary */}
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
