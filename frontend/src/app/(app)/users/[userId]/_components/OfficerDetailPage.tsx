'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Shield, Key, UserX, UserCheck, Loader2, Crown,
  LogOut, Edit, Lock, ShieldCheck, ShieldOff, RefreshCw,
  Monitor, Smartphone, Globe, Clock, CheckCircle2, XCircle,
  AlertTriangle, ChevronRight, Activity, Mail,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate, formatMoney, getStatusClass } from '@/lib/utils';
import type { ApiResponse } from '@/types/api';

/* ── Types ─────────────────────────────────────────────────── */
interface UserDetailData {
  user: {
    id: string; name: string; email: string; phone?: string | null;
    isActive: boolean; isTeamLead: boolean; lastLoginAt?: string | null;
    createdAt: string; approvalLimit?: string | null;
    role: { id: string; code: string; nameTh: string };
    team?: { id: string; name: string } | null;
    reportsTo?: { id: string; name: string } | null;
  } | null;
  totals: { quotations: number; approvedValue: number; thisMonth: number };
  byStatus: Array<{ status: string; count: number }>;
  recent: Array<{ id: string; quotationNo: string; status: string; grandTotal: number; createdAt: string }>;
}

interface RoleOption { id: string; code: string; nameTh: string; level: number; }

/* ── Constants ──────────────────────────────────────────────── */
const PROTECTED_ROLES = ['ADMIN', 'CEO'];

/* ── Permission data (static config) ───────────────────────── */
const PERMISSION_GROUPS = [
  {
    group: 'ใบเสนอราคา',
    items: [
      { key: 'qt_create', label: 'สร้างใบเสนอราคา', desc: 'สร้าง draft ใหม่ได้', defaultOn: true },
      { key: 'qt_edit',   label: 'แก้ไขใบเสนอราคา', desc: 'แก้ไขข้อมูลใบเสนอราคาที่มีอยู่', defaultOn: true },
      { key: 'qt_delete', label: 'ลบใบเสนอราคา',    desc: 'ลบ draft ได้', defaultOn: false },
      { key: 'qt_pdf',    label: 'ส่งออก PDF',       desc: 'ส่งออกใบเสนอราคาเป็น PDF', defaultOn: true, custom: true },
    ],
  },
  {
    group: 'ใบสั่งขาย',
    items: [
      { key: 'so_approve',  label: 'อนุมัติใบสั่งขาย', desc: 'อนุมัติได้ไม่เกิน approval limit', defaultOn: true },
      { key: 'so_convert',  label: 'แปลงเป็นใบสั่งขาย', desc: 'แปลงใบเสนอราคาเป็น SO', defaultOn: true },
    ],
  },
  {
    group: 'สินค้า',
    items: [
      { key: 'pd_cost',  label: 'ดูต้นทุนสินค้า',   desc: 'ดูราคาทุนภายในได้', defaultOn: false },
      { key: 'pd_price', label: 'แก้ไขราคามาตรฐาน', desc: 'เปลี่ยนราคา standard ได้', defaultOn: false },
    ],
  },
  {
    group: 'ลูกค้า',
    items: [
      { key: 'cu_create', label: 'เพิ่มลูกค้า',    desc: 'ลงทะเบียนลูกค้าใหม่ได้', defaultOn: true },
      { key: 'cu_edit',   label: 'แก้ไขข้อมูลลูกค้า', desc: 'แก้ไขข้อมูลติดต่อได้', defaultOn: true },
      { key: 'cu_delete', label: 'ลบข้อมูลลูกค้า',  desc: 'ลบรายการลูกค้าได้', defaultOn: false },
    ],
  },
  {
    group: 'รายงาน',
    items: [
      { key: 'rp_own',    label: 'ดูรายงานส่วนตัว', desc: 'ดูผลงานของตัวเองได้', defaultOn: true },
      { key: 'rp_export', label: 'ส่งออกรายงาน',    desc: 'ดาวน์โหลดข้อมูลรายงาน', defaultOn: true, custom: true },
    ],
  },
];

/* ── Mock audit log ─────────────────────────────────────────── */
const MOCK_LOGS = [
  { icon: 'login',      label: 'เข้าสู่ระบบสำเร็จ',                       time: 'วันนี้ 09:14', device: 'Chrome · macOS',    ip: '192.168.1.42' },
  { icon: 'create',     label: 'สร้างใบเสนอราคา QT-2026-0148',             time: 'วันนี้ 09:31', device: 'Chrome · macOS',    ip: '192.168.1.42' },
  { icon: 'edit',       label: 'แก้ไขราคาใน QT-2026-0145',                  time: 'วันนี้ 10:05', device: 'Chrome · macOS',    ip: '192.168.1.42' },
  { icon: 'export',     label: 'ส่งออก PDF: QT-2026-0141',                  time: 'เมื่อวาน 16:50', device: 'Chrome · macOS', ip: '192.168.1.42' },
  { icon: 'permission', label: 'ชุด permission ถูกแก้ไขโดย admin',          time: '3 วันที่แล้ว',   device: 'Admin panel',     ip: '10.0.0.1'     },
  { icon: 'key',        label: 'รหัสผ่านถูก reset โดย admin',               time: '14 วันที่แล้ว',  device: 'Admin panel',     ip: '10.0.0.1'     },
];

const LOG_ICON: Record<string, { icon: React.ReactNode; bg: string; color: string }> = {
  login:      { icon: <Activity className="h-3.5 w-3.5" />, bg: 'bg-green-50',  color: 'text-green-700'  },
  create:     { icon: <Globe     className="h-3.5 w-3.5" />, bg: 'bg-blue-50',   color: 'text-blue-700'   },
  edit:       { icon: <Edit      className="h-3.5 w-3.5" />, bg: 'bg-amber-50',  color: 'text-amber-700'  },
  export:     { icon: <Globe     className="h-3.5 w-3.5" />, bg: 'bg-blue-50',   color: 'text-blue-700'   },
  permission: { icon: <Shield    className="h-3.5 w-3.5" />, bg: 'bg-slate-100', color: 'text-slate-600'  },
  key:        { icon: <Key       className="h-3.5 w-3.5" />, bg: 'bg-red-50',    color: 'text-red-600'    },
};

/* ── Sub-components ─────────────────────────────────────────── */

function SidebarInfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[13px] font-medium text-foreground break-words">{value}</span>
    </div>
  );
}

function SectionCard({ title, icon, children, action }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <Card className="border border-border/60 shadow-none rounded-xl">
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[13px] font-semibold text-foreground flex items-center gap-2">
            {icon && <span className="text-muted-foreground">{icon}</span>}
            {title}
          </CardTitle>
          {action}
        </div>
      </CardHeader>
      <div className="h-px bg-border/50 mx-5" />
      <CardContent className="px-5 pt-4 pb-5">{children}</CardContent>
    </Card>
  );
}

function PermToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <Switch checked={on} onCheckedChange={onChange} className="scale-90" />;
}

/* ── Main page ──────────────────────────────────────────────── */
export function OfficerDetailPage() {
  const params  = useParams();
  const userId  = params.userId as string;

  const [data,          setData]          = useState<UserDetailData | null>(null);
  const [roles,         setRoles]         = useState<RoleOption[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [perms,         setPerms]         = useState<Record<string, boolean>>({});

  /* dialog states */
  const [showResetPw,    setShowResetPw]   = useState(false);
  const [newPassword,    setNewPassword]   = useState('');
  const [resetting,      setResetting]     = useState(false);
  const [showAssignRole, setShowAssignRole] = useState(false);
  const [selectedRoleId, setSelectedRoleId]= useState('');
  const [assigning,      setAssigning]     = useState(false);
  const [toggling,       setToggling]      = useState(false);
  const [showSuspend,    setShowSuspend]   = useState(false);
  const [showLogout,     setShowLogout]    = useState(false);
  const [showEditEmail,  setShowEditEmail] = useState(false);
  const [newEmail,       setNewEmail]      = useState('');
  const [savingEmail,    setSavingEmail]   = useState(false);

  /* ── Data loading ── */
  const load = async () => {
    try {
      const [uRes, rRes] = await Promise.all([
        api.get<ApiResponse<UserDetailData>>(`/manager-dashboard/users/${userId}`),
        api.get<ApiResponse<RoleOption[]>>('/admin/users/_roles'),
      ]);
      setData(uRes.data.data ?? null);
      setRoles(rRes.data.data ?? []);
      if (uRes.data.data?.user) setSelectedRoleId(uRes.data.data.user.role.id);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    /* init perm toggles from static config */
    const init: Record<string, boolean> = {};
    PERMISSION_GROUPS.forEach(g => g.items.forEach(p => { init[p.key] = p.defaultOn; }));
    setPerms(init);
  }, [userId]);

  /* ── Handlers ── */
  const handleToggleActive = async () => {
    if (!data?.user) return;
    setShowSuspend(false);
    setToggling(true);
    try {
      await api.patch(`/admin/users/${userId}/toggle-active`);
      toast.success('อัปเดตสถานะเรียบร้อย');
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setToggling(false); }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 8) { toast.error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    setResetting(true);
    try {
      await api.post(`/admin/users/${userId}/reset-password`, { newPassword });
      toast.success('Reset password เรียบร้อย');
      setShowResetPw(false); setNewPassword('');
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setResetting(false); }
  };

  const handleAssignRole = async () => {
    if (!selectedRoleId) return;
    setAssigning(true);
    try {
      await api.patch(`/admin/users/${userId}/role`, { roleId: selectedRoleId });
      toast.success('เปลี่ยน Role เรียบร้อย');
      setShowAssignRole(false);
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setAssigning(false); }
  };

  const handleForceLogout = async () => {
    setShowLogout(false);
    try {
      await api.post(`/admin/users/${userId}/force-logout`);
      toast.success('Force logout เรียบร้อย');
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };

  const handleSaveEmail = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) { toast.error('รูปแบบ Email ไม่ถูกต้อง'); return; }
    setSavingEmail(true);
    try {
      await api.patch(`/admin/users/${userId}`, { email: newEmail.trim().toLowerCase() });
      toast.success('เปลี่ยน Email เรียบร้อย');
      setShowEditEmail(false);
      setNewEmail('');
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setSavingEmail(false); }
  };

  /* ── Loading skeleton ── */
  if (loading) return (
    <div className="flex gap-5 max-w-6xl mx-auto p-5">
      <div className="w-56 shrink-0 space-y-3">
        <Skeleton className="h-14 w-14 rounded-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
      <div className="flex-1 space-y-4">
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );

  /* ── Not found ── */
  if (!data?.user) return (
    <Card className="max-w-md mx-auto mt-16">
      <CardContent className="py-16 text-center">
        <XCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground mb-3">ไม่พบข้อมูลผู้ใช้</p>
        <Link href="/users" className="text-sm text-primary hover:underline">← กลับรายการ Users</Link>
      </CardContent>
    </Card>
  );

  const { user } = data;
  const isProtected = PROTECTED_ROLES.includes(user.role.code);
  const initials    = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-border/60 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between gap-4">

          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/users"
              className="shrink-0 inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Users
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-border" />

            {/* identity */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-[11px] font-semibold text-blue-700 shrink-0">
                {initials}
              </div>
              <span className="text-[14px] font-semibold text-foreground truncate">{user.name}</span>

              {/* role badge */}
              <Badge variant="secondary" className="text-[11px] font-medium px-2 py-0 h-5 shrink-0">
                {user.isTeamLead && <Crown className="h-2.5 w-2.5 mr-1 text-amber-500" />}
                {user.role.nameTh}
              </Badge>

              {/* status badge */}
              {user.isActive ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  Inactive
                </span>
              )}

              {isProtected && (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                  <Lock className="h-2.5 w-2.5" /> Protected
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Online · Last login {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'ยังไม่เคย'}
          </div>
        </div>
      </div>

      {/* ── Protected banner ── */}
      {isProtected && (
        <div className="max-w-6xl mx-auto px-5 pt-4">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[13px] text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Account นี้เป็น <strong>{user.role.nameTh}</strong> — ไม่สามารถเปลี่ยน Role หรือระงับการใช้งานได้
            <span className="text-amber-600">(Reset Password ได้)</span>
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div className="max-w-6xl mx-auto px-5 py-5 flex gap-5 items-start">

        {/* ════ LEFT SIDEBAR ════ */}
        <aside className="w-52 shrink-0 sticky top-[57px] flex flex-col gap-4">

          {/* Profile card */}
          <Card className="border border-border/60 shadow-none rounded-xl overflow-hidden">
            <div className="bg-slate-100 h-14" />
            <CardContent className="px-4 pb-5">
              <div className="-mt-7 mb-3">
                <div className="h-14 w-14 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[17px] font-semibold text-blue-700">
                  {initials}
                </div>
              </div>
              <p className="text-[13px] font-semibold text-foreground leading-tight">{user.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{user.email}</p>

              <div className="mt-4 flex flex-col gap-3">
                <SidebarInfoRow label="เบอร์โทร"   value={user.phone ?? '—'} />
                <SidebarInfoRow label="Employee ID" value="EMP-2891" />
                <SidebarInfoRow label="แผนก"       value="Sales & Business Dev" />
                <SidebarInfoRow label="ตำแหน่ง"    value="Senior Officer" />
                <SidebarInfoRow label="Role"        value={user.role.nameTh} />
                <SidebarInfoRow label="สถานะ"       value={
                  user.isActive
                    ? <span className="text-green-700">Active</span>
                    : <span className="text-red-600">Inactive</span>
                } />
                <SidebarInfoRow label="สร้างเมื่อ"  value={formatDate(user.createdAt)} />
                {user.team     && <SidebarInfoRow label="ทีม"       value={user.team.name} />}
                {user.reportsTo && <SidebarInfoRow label="รายงานต่อ" value={user.reportsTo.name} />}
              </div>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card className="border border-border/60 shadow-none rounded-xl">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Quick actions
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-4 flex flex-col gap-1">

              <button
                onClick={() => toast.info('กำลังเปิด edit form...')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-foreground hover:bg-slate-100 transition-colors text-left"
              >
                <Edit className="h-3.5 w-3.5 text-muted-foreground" /> Edit user
              </button>

              <button
                onClick={() => { setNewEmail(user.email); setShowEditEmail(true); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-foreground hover:bg-slate-100 transition-colors text-left"
              >
                <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Edit email
              </button>

              {!isProtected && (
                <button
                  onClick={() => setShowAssignRole(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-foreground hover:bg-slate-100 transition-colors text-left"
                >
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" /> Change role
                </button>
              )}

              <button
                onClick={() => setShowResetPw(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-foreground hover:bg-slate-100 transition-colors text-left"
              >
                <Key className="h-3.5 w-3.5 text-muted-foreground" /> Reset password
              </button>

              <button
                onClick={() => toast.info('กำลังเปิด permission editor...')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-blue-600 hover:bg-blue-50 transition-colors text-left"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Edit permissions
              </button>

              <div className="my-1 h-px bg-border/50" />

              <button
                onClick={() => setShowLogout(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                <LogOut className="h-3.5 w-3.5" /> Force logout
              </button>

              {!isProtected && (
                <button
                  onClick={() => setShowSuspend(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-red-600 hover:bg-red-50 transition-colors text-left"
                >
                  {user.isActive
                    ? <><UserX className="h-3.5 w-3.5" /> Suspend account</>
                    : <><UserCheck className="h-3.5 w-3.5" /> Reactivate account</>
                  }
                </button>
              )}

            </CardContent>
          </Card>

        </aside>

        {/* ════ RIGHT CONTENT ════ */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* ── Section 1: Account settings ── */}
          <SectionCard
            title="Account settings"
            icon={<ShieldCheck className="h-4 w-4" />}
            action={
              <span className="text-[11px] text-muted-foreground">
                Last login: {user.lastLoginAt ? formatDate(user.lastLoginAt) : '—'}
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-3">
              {/* status */}
              <div className="flex items-center justify-between px-3.5 py-3 rounded-lg bg-slate-50 border border-border/50">
                <div>
                  <p className="text-[13px] font-medium text-foreground">สถานะ account</p>
                  <p className="text-[11px] text-muted-foreground">เข้าสู่ระบบได้</p>
                </div>
                {user.isActive
                  ? <span className="text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Active</span>
                  : <span className="text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Inactive</span>
                }
              </div>

              {/* MFA */}
              <div className="flex items-center justify-between px-3.5 py-3 rounded-lg bg-slate-50 border border-border/50">
                <div>
                  <p className="text-[13px] font-medium text-foreground">MFA</p>
                  <p className="text-[11px] text-muted-foreground">Two-factor auth</p>
                </div>
                <Switch defaultChecked onCheckedChange={v => toast.success(v ? 'เปิด MFA แล้ว' : 'ปิด MFA แล้ว')} className="scale-90" />
              </div>

              {/* email verified */}
              <div className="flex items-center justify-between px-3.5 py-3 rounded-lg bg-slate-50 border border-border/50">
                <div>
                  <p className="text-[13px] font-medium text-foreground">Email verified</p>
                  <p className="text-[11px] text-muted-foreground truncate max-w-[120px]">{user.email}</p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              </div>

              {/* password */}
              <div className="flex items-center justify-between px-3.5 py-3 rounded-lg bg-slate-50 border border-border/50">
                <div>
                  <p className="text-[13px] font-medium text-foreground">Password</p>
                  <p className="text-[11px] text-muted-foreground">เปลี่ยนล่าสุด</p>
                </div>
                <span className="text-[12px] font-medium text-foreground">14 วันที่แล้ว</span>
              </div>

              {/* sessions */}
              <div className="flex items-center justify-between px-3.5 py-3 rounded-lg bg-slate-50 border border-border/50">
                <div>
                  <p className="text-[13px] font-medium text-foreground">Active sessions</p>
                  <p className="text-[11px] text-muted-foreground">อุปกรณ์ที่ login</p>
                </div>
                <span className="text-[20px] font-semibold text-foreground">2</span>
              </div>

              {/* approval limit */}
              <div className="flex items-center justify-between px-3.5 py-3 rounded-lg bg-slate-50 border border-border/50">
                <div>
                  <p className="text-[13px] font-medium text-foreground">Approval limit</p>
                  <p className="text-[11px] text-muted-foreground">วงเงินอนุมัติ</p>
                </div>
                <span className="text-[12px] font-medium text-foreground">
                  {user.approvalLimit ? formatMoney(Number(user.approvalLimit)) : 'Default'}
                </span>
              </div>
            </div>

            {/* action buttons */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[12px] gap-1.5"
                onClick={() => setShowResetPw(true)}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Force password reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[12px] gap-1.5"
                onClick={() => setShowLogout(true)}
              >
                <LogOut className="h-3.5 w-3.5" /> Logout all devices
              </Button>
              {!isProtected && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-[12px] gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setShowSuspend(true)}
                  disabled={toggling}
                >
                  {toggling
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Lock className="h-3.5 w-3.5" />
                  }
                  {user.isActive ? 'Suspend account' : 'Reactivate account'}
                </Button>
              )}
            </div>
          </SectionCard>

          {/* ── Section 2: Permissions ── */}
          <SectionCard
            title="Permissions & access control"
            icon={<Shield className="h-4 w-4" />}
            action={
              <Button variant="outline" size="sm" className="h-7 text-[12px] gap-1.5" onClick={() => toast.success('บันทึก permissions แล้ว')}>
                <ShieldCheck className="h-3.5 w-3.5" /> Save changes
              </Button>
            }
          >
            <div className="flex flex-col gap-5">
              {PERMISSION_GROUPS.map(group => (
                <div key={group.group}>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {group.group}
                  </p>
                  <div className="flex flex-col">
                    {group.items.map((item, idx) => (
                      <div
                        key={item.key}
                        className={`flex items-center justify-between py-2.5 gap-3 ${idx < group.items.length - 1 ? 'border-b border-border/40' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-foreground">{item.label}</span>
                            {item.custom
                              ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">Custom</span>
                              : <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 font-medium">Inherited</span>
                            }
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
                        </div>
                        <Switch
                          checked={perms[item.key] ?? item.defaultOn}
                          onCheckedChange={v => {
                            setPerms(prev => ({ ...prev, [item.key]: v }));
                            toast.success(`${v ? 'เปิด' : 'ปิด'} "${item.label}" แล้ว`);
                          }}
                          className="scale-90 shrink-0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ── Section 3: Activity log ── */}
          <SectionCard title="Activity log" icon={<Activity className="h-4 w-4" />}>
            {/* filters */}
            <div className="flex gap-2 mb-4">
              <Input placeholder="ค้นหา log..." className="h-8 text-[12px] flex-1" />
              <select className="h-8 px-2 text-[12px] border border-input rounded-md bg-background text-foreground">
                <option>ทุกประเภท</option>
                <option>Login</option>
                <option>ใบเสนอราคา</option>
                <option>Settings</option>
                <option>Permissions</option>
              </select>
              <Input type="date" className="h-8 text-[12px] w-36" />
            </div>

            {/* log list */}
            <div className="flex flex-col">
              {MOCK_LOGS.map((log, idx) => {
                const style = LOG_ICON[log.icon];
                return (
                  <div key={idx} className={`flex gap-3 py-3 ${idx < MOCK_LOGS.length - 1 ? 'border-b border-border/40' : ''}`}>
                    <div className={`h-7 w-7 rounded-lg ${style.bg} ${style.color} flex items-center justify-center shrink-0 mt-0.5`}>
                      {style.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground">{log.label}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {log.time}
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Monitor className="h-3 w-3" /> {log.device}
                        </span>
                        <code className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                          {log.ip}
                        </code>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* ── Section 4: Active sessions ── */}
          <SectionCard
            title="Active sessions"
            icon={<Globe className="h-4 w-4" />}
            action={
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[12px] gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setShowLogout(true)}
              >
                <LogOut className="h-3.5 w-3.5" /> Logout all
              </Button>
            }
          >
            <div className="flex flex-col gap-0">
              {[
                { icon: Monitor,     device: 'Chrome 124 · macOS Sonoma', detail: 'Bangkok · 192.168.1.42 · Active now', current: true  },
                { icon: Smartphone,  device: 'Safari · iPhone 15 Pro',     detail: 'Bangkok · 10.0.0.8 · 2 ชั่วโมงที่แล้ว',    current: false },
              ].map((s, idx, arr) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between gap-3 py-3 ${idx < arr.length - 1 ? 'border-b border-border/40' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <s.icon className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-foreground">{s.device}</span>
                        {s.current && (
                          <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{s.detail}</p>
                    </div>
                  </div>
                  {!s.current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[12px] text-red-600 hover:bg-red-50 hover:text-red-700 gap-1.5 shrink-0"
                      onClick={() => toast.success('Terminate session แล้ว')}
                    >
                      <LogOut className="h-3.5 w-3.5" /> Terminate
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>

        </div>
      </div>

      {/* ════ DIALOGS ════ */}

      {/* Reset Password */}
      <Dialog open={showResetPw} onOpenChange={o => { if (!o) { setShowResetPw(false); setNewPassword(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Reset password</DialogTitle>
            <DialogDescription className="text-[13px]">
              ตั้งรหัสผ่านใหม่สำหรับ <strong>{user.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-[12px]">รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 h-9 text-[13px]"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setShowResetPw(false); setNewPassword(''); }} disabled={resetting}>
              ยกเลิก
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleResetPassword}
              disabled={resetting || newPassword.length < 8}
            >
              {resetting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Role */}
      {!isProtected && (
        <Dialog open={showAssignRole} onOpenChange={o => { if (!o) setShowAssignRole(false); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-[15px]">เปลี่ยน Role</DialogTitle>
              <DialogDescription className="text-[13px]">
                {user.name} — ปัจจุบัน: <strong>{user.role.nameTh}</strong>
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label className="text-[12px]">Role ใหม่</Label>
              <select
                value={selectedRoleId}
                onChange={e => setSelectedRoleId(e.target.value)}
                className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] text-foreground"
              >
                {roles
                  .filter(r => !PROTECTED_ROLES.includes(r.code))
                  .map(r => <option key={r.id} value={r.id}>{r.nameTh} (L{r.level})</option>)
                }
              </select>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowAssignRole(false)} disabled={assigning}>
                ยกเลิก
              </Button>
              <Button size="sm" onClick={handleAssignRole} disabled={assigning || !selectedRoleId}>
                {assigning && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                ยืนยัน
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Suspend confirm */}
      <Dialog open={showSuspend} onOpenChange={setShowSuspend}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[15px]">
              {user.isActive ? 'Suspend account' : 'Reactivate account'}
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              {user.isActive
                ? `ระงับการเข้าถึงของ ${user.name} ทันที session ทั้งหมดจะถูกยกเลิก`
                : `เปิดใช้งาน account ของ ${user.name} อีกครั้ง`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowSuspend(false)}>ยกเลิก</Button>
            <Button
              size="sm"
              variant={user.isActive ? 'destructive' : 'default'}
              onClick={handleToggleActive}
              disabled={toggling}
            >
              {toggling && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              {user.isActive ? 'Suspend' : 'Reactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Force logout confirm */}
      <Dialog open={showLogout} onOpenChange={setShowLogout}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Force logout all devices</DialogTitle>
            <DialogDescription className="text-[13px]">
              ยกเลิก session ทั้งหมดของ {user.name} ทันที ผู้ใช้จะต้อง login ใหม่ในทุกอุปกรณ์
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowLogout(false)}>ยกเลิก</Button>
            <Button size="sm" variant="destructive" onClick={handleForceLogout}>
              <LogOut className="h-3.5 w-3.5 mr-1" /> Force logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Email */}
      <Dialog open={showEditEmail} onOpenChange={o => { if (!o) { setShowEditEmail(false); setNewEmail(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px]">
              <Mail className="h-4 w-4 text-blue-500" /> แก้ไข Email
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              {user.name} — ปัจจุบัน: {user.email}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">Email ใหม่</Label>
            <Input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="example@company.com"
              className="mt-1.5 h-9 text-[13px]"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">Email ต้องไม่ซ้ำกับ account อื่นในระบบ</p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setShowEditEmail(false); setNewEmail(''); }} disabled={savingEmail}>
              ยกเลิก
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEmail}
              disabled={savingEmail || !newEmail.trim() || newEmail.trim() === user.email}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {savingEmail && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}