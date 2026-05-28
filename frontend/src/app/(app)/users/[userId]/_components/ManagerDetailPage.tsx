'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, FileText, Shield, Key, UserX, UserCheck, Loader2, Crown,
  Edit, Users, LogOut, Lock, AlertTriangle, Search, RefreshCw,
  TrendingUp, DollarSign, ArrowUpRight, Building2, Mail, Phone, BadgeCheck,
  Calendar, Activity, UserPlus, GitBranch, AlertCircle,
  CheckCircle2, XCircle, Hash, Layers, BarChart3, FileCheck,
  Sliders, ShieldAlert, ShieldCheck, Fingerprint, Clock, Globe,
  SendHorizonal,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { usePermissions } from '@/hooks/use-permissions';
import { formatDate, formatMoney } from '@/lib/utils';
import type { ApiResponse } from '@/types/api';

interface UserDetailData {
  user: {
    id: string; name: string; email: string;
    phone?: string | null; isActive: boolean; isTeamLead: boolean;
    lastLoginAt?: string | null; createdAt: string;
    approvalLimit?: string | null; managerLevel?: string | null;
    role: { id: string; code: string; nameTh: string };
    team?: { id: string; name: string } | null;
    reportsTo?: { id: string; name: string } | null;
  } | null;
  totals: { quotations: number; approvedValue: number; thisMonth: number };
  byStatus: Array<{ status: string; count: number }>;
  recent: Array<{ id: string; quotationNo: string; status: string; grandTotal: number; createdAt: string }>;
}

interface RoleOption { id: string; code: string; nameTh: string; level: number; }
interface ActivityLogItem {
  id: string; action: string; entityType: string; description: string;
  createdAt: string; ipAddress?: string;
}
interface TeamMemberItem {
  id: string; name: string; email: string; isActive: boolean;
  role: { code: string; nameTh: string };
  team?: { id: string; name: string } | null;
}

const PROTECTED_ROLES = ['ADMIN', 'CEO'];

function OnlineIndicator({ isOnline }: { isOnline: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
      {isOnline ? 'Online' : 'Offline'}
    </span>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, action }: {
  icon: any; title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
          <Icon className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ─── Change Request Dialog ─────────────────────────────────────────────────
function ChangeRequestDialog({
  user, roles, open, onClose, onSubmitted, isDirectEdit = false,
}: {
  user: NonNullable<UserDetailData['user']>;
  roles: RoleOption[];
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  isDirectEdit?: boolean;
}) {
  const [reason, setReason] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [isActive, setIsActive] = useState<'' | 'true' | 'false'>('');
  const [approvalLimit, setApprovalLimit] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setReason(''); setName(''); setEmail(''); setPhone('');
    setRoleId(''); setIsActive(''); setApprovalLimit('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!isDirectEdit && !reason.trim()) { toast.error('กรุณาระบุเหตุผล'); return; }
    const changes: Record<string, unknown> = {};
    if (name.trim() && name.trim() !== user.name) changes.name = name.trim();
    if (email.trim() && email.trim() !== user.email) changes.email = email.trim().toLowerCase();
    if (phone.trim() !== '') changes.phone = phone.trim() || null;
    if (roleId && roleId !== user.role.id) changes.roleId = roleId;
    if (isActive !== '') changes.isActive = isActive === 'true';
    if (approvalLimit !== '') changes.approvalLimit = approvalLimit ? Number(approvalLimit) : null;

    if (Object.keys(changes).length === 0) {
      toast.error('กรุณาระบุข้อมูลที่ต้องการเปลี่ยนแปลงอย่างน้อย 1 รายการ');
      return;
    }

    setSubmitting(true);
    try {
      if (isDirectEdit) {
        await api.patch(`/admin/users/${user.id}`, changes);
        toast.success('แก้ไขข้อมูลเรียบร้อย');
      } else {
        await api.post('/admin/change-requests', {
          targetUserId: user.id,
          reason: reason.trim(),
          changes,
        });
        toast.success('ส่งคำขอแก้ไขไปยัง Admin เรียบร้อย');
      }
      handleClose();
      onSubmitted();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SendHorizonal className="h-4 w-4 text-blue-500" />
            {isDirectEdit ? 'แก้ไขข้อมูลผู้ใช้' : 'ขอแก้ไขข้อมูลผู้ใช้'}
          </DialogTitle>
          <DialogDescription>
            {isDirectEdit
              ? 'แก้ไขข้อมูลได้ทันที — กรอกเฉพาะข้อมูลที่ต้องการเปลี่ยนแปลง'
              : 'คำขอจะถูกส่งให้ Admin อนุมัติก่อน — กรอกเฉพาะข้อมูลที่ต้องการเปลี่ยนแปลง'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Reason — required only for non-admin */}
          {!isDirectEdit && (
            <div>
              <Label className="text-xs font-semibold">เหตุผลในการขอแก้ไข <span className="text-destructive">*</span></Label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="ระบุเหตุผลที่ต้องการแก้ไขข้อมูล เช่น เปลี่ยนตำแหน่ง, อีเมลเดิมใช้งานไม่ได้"
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          )}

          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">ข้อมูลที่ต้องการเปลี่ยน (เว้นว่างหากไม่ต้องการเปลี่ยน)</div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">ชื่อใหม่</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)}
                placeholder={user.name} className="mt-1.5 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Email ใหม่</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder={user.email} className="mt-1.5 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">เบอร์โทรใหม่</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder={user.phone ?? 'ไม่มี'} className="mt-1.5 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Role ใหม่</Label>
              <select value={roleId} onChange={(e) => setRoleId(e.target.value)}
                className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">— ไม่เปลี่ยน —</option>
                {roles.filter((r) => !PROTECTED_ROLES.includes(r.code)).map((r) => (
                  <option key={r.id} value={r.id}>{r.nameTh} (L{r.level})</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">สถานะ Account</Label>
              <select value={isActive} onChange={(e) => setIsActive(e.target.value as any)}
                className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">— ไม่เปลี่ยน —</option>
                <option value="true">เปิดใช้งาน (Active)</option>
                <option value="false">ปิดใช้งาน (Inactive)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Approval Limit (฿)</Label>
              <Input type="number" min="0" step="10000" value={approvalLimit}
                onChange={(e) => setApprovalLimit(e.target.value)}
                placeholder={user.approvalLimit ? String(Math.round(Number(user.approvalLimit))) : 'ไม่จำกัด'}
                className="mt-1.5 h-9 text-sm" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>ยกเลิก</Button>
          <Button onClick={handleSubmit} disabled={submitting || (!isDirectEdit && !reason.trim())} className="bg-blue-600 hover:bg-blue-700">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
            {isDirectEdit ? 'บันทึก' : 'ส่งคำขอแก้ไข'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main ──────────────────────────────────────────────────────
export function ManagerDetailPage() {
  const params = useParams();
  const userId = params.userId as string;

  const [data,        setData]        = useState<UserDetailData | null>(null);
  const [roles,       setRoles]       = useState<RoleOption[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activeSection, setActiveSection] = useState('approval');

  const [activityLogs,   setActivityLogs]   = useState<ActivityLogItem[]>([]);
  const [teamMembers,    setTeamMembers]     = useState<TeamMemberItem[]>([]);
  const [logsLoading,    setLogsLoading]     = useState(false);
  const [membersLoading, setMembersLoading]  = useState(false);

  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [showForceLogout,   setShowForceLogout]   = useState(false);
  const [showToggleActive,  setShowToggleActive]  = useState(false);
  const [actionLoading,     setActionLoading]     = useState(false);
  const [logSearch,         setLogSearch]         = useState('');

  // Must be at top level — before any early returns
  const { hasRole } = usePermissions();
  const isAdmin = hasRole('ADMIN');

  const load = async () => {
    try {
      const [uRes, rRes] = await Promise.all([
        api.get<ApiResponse<UserDetailData>>(`/manager-dashboard/users/${userId}`),
        api.get<ApiResponse<RoleOption[]>>('/admin/users/_roles'),
      ]);
      setData(uRes.data.data ?? null);
      setRoles(rRes.data.data ?? []);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  };

  const loadActivityLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await api.get<any>(`/admin/activity-logs?userId=${userId}&limit=20`);
      setActivityLogs(res.data.data ?? []);
    } catch { setActivityLogs([]); }
    finally { setLogsLoading(false); }
  };

  const loadTeamMembers = async (teamId: string) => {
    setMembersLoading(true);
    try {
      const res = await api.get<any>(`/admin/users?teamId=${teamId}&limit=50`);
      setTeamMembers((res.data.data ?? []).filter((m: any) => m.id !== userId));
    } catch { setTeamMembers([]); }
    finally { setMembersLoading(false); }
  };

  useEffect(() => { load(); }, [userId]);
  useEffect(() => {
    if (data?.user) {
      loadActivityLogs();
      if (data.user.team?.id) loadTeamMembers(data.user.team.id);
      else setTeamMembers([]);
    }
  }, [data?.user?.id]);

  const handleForceLogout = async () => {
    setShowForceLogout(false);
    setActionLoading(true);
    try {
      await api.post(`/admin/users/${userId}/force-logout`);
      toast.success('Force logout เรียบร้อย — user จะต้อง login ใหม่ทุกอุปกรณ์');
      await loadActivityLogs();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setActionLoading(false); }
  };

  const handleToggleActive = async () => {
    if (!user) return;
    setShowToggleActive(false);
    setActionLoading(true);
    try {
      const endpoint = user.isActive ? 'deactivate' : 'activate';
      await api.post(`/admin/users/${userId}/${endpoint}`);
      toast.success(user.isActive ? 'ปิดบัญชีเรียบร้อย — user ไม่สามารถเข้าสู่ระบบได้' : 'เปิดบัญชีเรียบร้อย');
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setActionLoading(false); }
  };

  if (loading) return (
    <div className="flex gap-6 max-w-[1400px] p-6">
      <div className="w-64 space-y-3 shrink-0">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
      <div className="flex-1 space-y-4">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );

  if (!data?.user) return (
    <Card><CardContent className="py-16 text-center">
      <XCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm text-muted-foreground mb-3">ไม่พบข้อมูลผู้ใช้</p>
      <Link href="/users" className="text-sm text-primary hover:underline">← กลับรายการ Users</Link>
    </CardContent></Card>
  );

  const { user } = data;
  const isProtected = PROTECTED_ROLES.includes(user.role.code);
  const isOnline = user.lastLoginAt
    ? (Date.now() - new Date(user.lastLoginAt).getTime()) < 15 * 60 * 1000
    : false;

  const navItems = [
    { id: 'approval',  label: 'Approval Settings', icon: DollarSign },
    { id: 'hierarchy', label: 'Team Hierarchy',    icon: GitBranch  },
    { id: 'security',  label: 'Security',           icon: ShieldAlert },
    { id: 'logs',      label: 'Activity Logs',      icon: Activity   },
  ];

  const filteredLogs = activityLogs.filter((log) =>
    logSearch === '' ||
    log.description.toLowerCase().includes(logSearch.toLowerCase()) ||
    log.action.toLowerCase().includes(logSearch.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Top nav */}
      <div className="px-6 py-3 border-b bg-white sticky top-0 z-30 flex items-center gap-3">
        <Link href="/users" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium">
          <ArrowLeft className="h-3.5 w-3.5" />กลับรายการ Users
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-xs text-slate-700 font-semibold">{user.name}</span>
        <Badge variant="secondary" className="text-[10px] ml-1">Manager</Badge>
        {user.managerLevel && (
          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
            {user.managerLevel}
          </Badge>
        )}
      </div>

      {/* Header Card */}
      <div className="px-6 pt-5 pb-0">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-violet-700 px-6 py-5">
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center font-bold text-2xl text-white">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${isOnline ? 'bg-emerald-400' : 'bg-slate-300'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-white">{user.name}</h1>
                  {user.isTeamLead && (
                    <Badge className="bg-amber-400/20 text-amber-100 border-amber-400/40 text-[10px]">
                      <Crown className="h-2.5 w-2.5 mr-1" />Team Lead
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white/15 text-white border border-white/20">Manager</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${user.isActive ? 'bg-emerald-400/20 text-emerald-100 border-emerald-400/30' : 'bg-red-400/20 text-red-100 border-red-400/30'}`}>
                    {user.isActive ? '● Active' : '○ Inactive'}
                  </span>
                  <OnlineIndicator isOnline={isOnline} />
                </div>
                <p className="text-white/60 text-xs mt-1.5">
                  Last login: {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'ยังไม่เคย'}
                  {user.team && <span className="ml-3">👥 {user.team.name}</span>}
                  {user.approvalLimit && <span className="ml-3">💰 Limit: {formatMoney(Number(user.approvalLimit))}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(!isProtected || isAdmin) && (
                  <button
                    onClick={() => setShowChangeRequest(true)}
                    className="h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium border border-white/20 flex items-center gap-1.5"
                  >
                    <SendHorizonal className="h-3.5 w-3.5" />{isAdmin ? 'แก้ไขข้อมูล' : 'ขอแก้ไขข้อมูล'}
                  </button>
                )}
                <button
                  onClick={() => setShowForceLogout(true)}
                  className="h-8 px-3 rounded-lg bg-red-500/20 hover:bg-red-500/35 text-red-100 text-xs font-medium border border-red-400/30 flex items-center gap-1.5"
                >
                  <LogOut className="h-3.5 w-3.5" />Force Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex gap-5 px-6 py-5 items-start">

        {/* Sidebar */}
        <aside className="w-60 shrink-0 sticky top-14 space-y-4 max-h-[calc(100vh-4rem)] overflow-y-auto pb-4">

          {/* Profile info */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center font-bold text-white text-sm shrink-0">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{user.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-2.5 text-xs">
              {[
                { icon: Mail,       label: 'Email',          value: user.email },
                { icon: Phone,      label: 'Phone',          value: user.phone ?? '—' },
                { icon: Shield,     label: 'Role',           value: user.role.nameTh },
                { icon: Layers,     label: 'Level',          value: user.managerLevel ?? '—' },
                { icon: Building2,  label: 'Team',           value: user.team?.name ?? '—' },
                { icon: Users,      label: 'Reports To',     value: user.reportsTo?.name ?? '—' },
                { icon: DollarSign, label: 'Approval Limit', value: user.approvalLimit ? formatMoney(Number(user.approvalLimit)) : 'ไม่จำกัด' },
                { icon: Calendar,   label: 'Created',        value: formatDate(user.createdAt) },
                { icon: Clock,      label: 'Last Login',     value: user.lastLoginAt ? formatDate(user.lastLoginAt) : 'ยังไม่เคย' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <Icon className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-slate-400 block">{label}</span>
                    <span className="text-xs font-medium text-slate-700 truncate block">{value}</span>
                  </div>
                </div>
              ))}
              <div className={`text-[10px] font-semibold px-2 py-1 rounded-md text-center ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {user.isActive ? '● Account Active' : '○ Account Inactive'}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-2 mb-2">Sections</p>
              {navItems.map((item) => (
                <button key={item.id} onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${activeSection === item.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <item.icon className={`h-3.5 w-3.5 ${activeSection === item.id ? 'text-blue-600' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-2 mb-2">Quick Actions</p>
              <div className="space-y-0.5">
                {(!isProtected || isAdmin) && (
                  <button onClick={() => setShowChangeRequest(true)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-blue-600 hover:bg-blue-50">
                    <SendHorizonal className="h-3 w-3 shrink-0" />{isAdmin ? 'แก้ไขข้อมูล' : 'ขอแก้ไขข้อมูล'}
                  </button>
                )}
                <button onClick={() => setShowForceLogout(true)} disabled={actionLoading}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-amber-600 hover:bg-amber-50">
                  <LogOut className="h-3 w-3 shrink-0" />Force Logout
                </button>
                <button onClick={() => setShowToggleActive(true)} disabled={actionLoading}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${user.isActive ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                  {user.isActive ? <UserX className="h-3 w-3 shrink-0" /> : <UserCheck className="h-3 w-3 shrink-0" />}
                  {user.isActive ? 'ปิดบัญชี' : 'เปิดบัญชี'}
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* APPROVAL SETTINGS */}
          {activeSection === 'approval' && (
            <section>
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                <SectionHeader icon={DollarSign} title="Approval Settings"
                  subtitle="วงเงินอนุมัติและสิทธิ์ของ Manager คนนี้"
                  action={
                    !isProtected ? (
                      <button onClick={() => setShowChangeRequest(true)} className="h-7 px-3 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 flex items-center gap-1.5">
                        <SendHorizonal className="h-3 w-3" />ขอแก้ไข Limit
                      </button>
                    ) : undefined
                  }
                />

                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: 'Quotations Total', value: data.totals.quotations,                 icon: FileText,   color: 'blue'    },
                    { label: 'Approved Value',    value: formatMoney(data.totals.approvedValue), icon: DollarSign, color: 'emerald' },
                    { label: 'This Month',        value: data.totals.thisMonth,                  icon: Calendar,   color: 'violet'  },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className={`rounded-xl border-2 p-4 bg-gradient-to-br ${color === 'blue' ? 'border-blue-100 from-blue-50 to-blue-50/30' : color === 'emerald' ? 'border-emerald-100 from-emerald-50 to-emerald-50/30' : 'border-violet-100 from-violet-50 to-violet-50/30'}`}>
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center mb-2 ${color === 'blue' ? 'bg-blue-100' : color === 'emerald' ? 'bg-emerald-100' : 'bg-violet-100'}`}>
                        <Icon className={`h-3.5 w-3.5 ${color === 'blue' ? 'text-blue-600' : color === 'emerald' ? 'text-emerald-600' : 'text-violet-600'}`} />
                      </div>
                      <div className={`text-xl font-bold ${color === 'blue' ? 'text-blue-700' : color === 'emerald' ? 'text-emerald-700' : 'text-violet-700'}`}>{value}</div>
                      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 mb-4">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Approval Limit ปัจจุบัน</p>
                  <div className="text-2xl font-bold text-blue-700">
                    {user.approvalLimit ? formatMoney(Number(user.approvalLimit)) : 'ไม่จำกัด'}
                  </div>
                </div>

                {data.byStatus.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-3">Status Breakdown</p>
                    <div className="flex flex-wrap gap-2">
                      {data.byStatus.map((s) => (
                        <div key={s.status} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 text-xs">
                          <span className="font-medium text-slate-600">{s.status}</span>
                          <span className="font-bold text-slate-800">{s.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {data.recent.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-slate-600 mb-3">Quotations ล่าสุด</p>
                    <div className="space-y-2">
                      {data.recent.slice(0, 5).map((q) => (
                        <Link key={q.id} href={`/quotations/${q.id}`}
                          className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-700">{q.quotationNo}</p>
                            <p className="text-[10px] text-slate-400">{formatDate(q.createdAt)}</p>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${q.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : q.status === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                            {q.status}
                          </span>
                          <span className="text-xs font-bold text-slate-600 shrink-0">{formatMoney(q.grandTotal)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* TEAM HIERARCHY */}
          {activeSection === 'hierarchy' && (
            <section>
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                <SectionHeader icon={GitBranch} title="Team Hierarchy"
                  subtitle="ทีมและสมาชิกที่อยู่ภายใต้ Manager"
                  action={
                    <Link href="/admin/teams" className="h-7 px-3 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 flex items-center gap-1.5">
                      <UserPlus className="h-3 w-3" />Assign Officer
                    </Link>
                  }
                />
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 mb-5">
                  <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider mb-2">Current Manager</p>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                      {user.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.role.nameTh}{user.managerLevel ? ` — ${user.managerLevel}` : ''}</p>
                      {user.reportsTo && <p className="text-[10px] text-slate-400 mt-0.5">รายงานต่อ: {user.reportsTo.name}</p>}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-slate-600">
                      สมาชิกในทีม {user.team ? `(${user.team.name})` : ''}
                      {!membersLoading && ` — ${teamMembers.length} คน`}
                    </p>
                    <button onClick={() => user.team && loadTeamMembers(user.team.id)}
                      className="h-6 px-2 rounded text-[10px] border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center gap-1">
                      <RefreshCw className="h-2.5 w-2.5" />Refresh
                    </button>
                  </div>
                  {membersLoading ? (
                    <div className="space-y-2">{[0,1,2].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
                  ) : teamMembers.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      {user.team ? 'ไม่มีสมาชิกในทีม' : 'Manager ยังไม่ได้อยู่ใน Team'}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {teamMembers.map((member) => (
                        <Link key={member.id} href={`/users/${member.id}`}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all">
                          <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${member.isActive ? 'bg-gradient-to-br from-blue-500 to-violet-500' : 'bg-slate-300'}`}>
                            {member.name.slice(0, 1)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-700 truncate">{member.name}</p>
                            <p className="text-[10px] text-slate-400">{member.role.nameTh}</p>
                          </div>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${member.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            {member.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* SECURITY */}
          {activeSection === 'security' && (
            <section>
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                <SectionHeader icon={ShieldAlert} title="Security & Account Control"
                  subtitle="การควบคุมความปลอดภัยของ Account (การแก้ไขข้อมูลใช้คำขอผ่าน Admin)"
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                  {[
                    { label: 'Account Status', value: user.isActive ? 'Active' : 'Inactive', icon: ShieldCheck, ok: user.isActive },
                    { label: 'Last Login',      value: user.lastLoginAt ? formatDate(user.lastLoginAt) : 'ยังไม่เคย', icon: Clock, ok: !!user.lastLoginAt },
                    { label: 'MFA Status',      value: 'ตรวจสอบจาก Log', icon: Fingerprint, ok: true },
                  ].map(({ label, value, icon: Icon, ok }) => (
                    <div key={label} className={`p-3 rounded-xl border ${ok ? 'border-slate-100 bg-slate-50' : 'border-red-100 bg-red-50/40'}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <Icon className={`h-3.5 w-3.5 ${ok ? 'text-slate-400' : 'text-red-400'}`} />
                        <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      </div>
                      <p className="text-sm font-semibold text-slate-700 truncate">{value}</p>
                      <p className="text-[10px] text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 mb-4 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    การเปลี่ยน Role, Email, ระงับบัญชี หรือ Reset Password ต้องยื่นคำขอผ่าน Admin
                    — กดปุ่ม <strong>ขอแก้ไขข้อมูล</strong> ด้านบน
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(!isProtected || isAdmin) && (
                    <button onClick={() => setShowChangeRequest(true)}
                      className="h-8 px-3 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 text-xs font-medium flex items-center gap-1.5 transition-all">
                      <SendHorizonal className="h-3.5 w-3.5" />{isAdmin ? 'แก้ไขข้อมูล' : 'ขอแก้ไขข้อมูล / สถานะ'}
                    </button>
                  )}
                  <button onClick={() => setShowForceLogout(true)} disabled={actionLoading}
                    className="h-8 px-3 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-50">
                    <LogOut className="h-3.5 w-3.5" />Force Logout All Devices
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ACTIVITY LOGS */}
          {activeSection === 'logs' && (
            <section>
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                <SectionHeader icon={Activity} title="Activity Logs"
                  subtitle="ประวัติการดำเนินการของ Manager คนนี้"
                  action={
                    <button onClick={loadActivityLogs} disabled={logsLoading}
                      className="h-7 px-3 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 flex items-center gap-1.5">
                      <RefreshCw className={`h-3 w-3 ${logsLoading ? 'animate-spin' : ''}`} />Refresh
                    </button>
                  }
                />
                <div className="flex items-center gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input type="text" placeholder="ค้นหา log..." value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      className="w-full h-8 pl-8 pr-3 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:bg-white transition-all" />
                  </div>
                </div>
                {logsLoading ? (
                  <div className="space-y-2">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400">ไม่พบ Activity Log</div>
                ) : (
                  <div className="space-y-2">
                    {filteredLogs.map((log) => (
                      <div key={log.id} className="border-l-2 border-l-blue-300 bg-blue-50/30 pl-3 py-2.5 pr-3 rounded-r-lg">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Activity className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            <span className="text-xs font-medium text-slate-700 truncate">{log.description}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0">{formatDate(log.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 ml-5">
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">{log.action}</span>
                          {log.ipAddress && <span className="text-[10px] text-slate-400 flex items-center gap-1"><Globe className="h-2.5 w-2.5" />{log.ipAddress}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Change Request / Direct Edit Dialog */}
      {(!isProtected || isAdmin) && (
        <ChangeRequestDialog
          user={user}
          roles={roles}
          open={showChangeRequest}
          onClose={() => setShowChangeRequest(false)}
          onSubmitted={load}
          isDirectEdit={isAdmin}
        />
      )}

      {/* Force Logout */}
      <Dialog open={showForceLogout} onOpenChange={setShowForceLogout}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><LogOut className="h-4 w-4 text-amber-500" />Force Logout</DialogTitle>
            <DialogDescription>ยกเลิก session ทั้งหมดของ {user.name} ทันที ผู้ใช้ต้อง login ใหม่ทุกอุปกรณ์</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForceLogout(false)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={handleForceLogout} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}Force Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate / Deactivate */}
      <Dialog open={showToggleActive} onOpenChange={setShowToggleActive}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {user.isActive
                ? <><UserX className="h-4 w-4 text-red-500" />ปิดบัญชี</>
                : <><UserCheck className="h-4 w-4 text-emerald-500" />เปิดบัญชี</>}
            </DialogTitle>
            <DialogDescription>
              {user.isActive
                ? <>บัญชีของ <strong>{user.name}</strong> จะถูกปิดทันที — ไม่สามารถเข้าสู่ระบบได้จนกว่า Admin จะเปิดอีกครั้ง</>
                : <>เปิดการใช้งานบัญชีของ <strong>{user.name}</strong> อีกครั้ง — ผู้ใช้จะเข้าสู่ระบบได้ตามปกติ</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowToggleActive(false)}>ยกเลิก</Button>
            <Button
              variant={user.isActive ? 'destructive' : 'default'}
              className={!user.isActive ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              onClick={handleToggleActive}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : user.isActive ? <UserX className="h-3.5 w-3.5 mr-1" /> : <UserCheck className="h-3.5 w-3.5 mr-1" />}
              {user.isActive ? 'ปิดบัญชี' : 'เปิดบัญชี'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
