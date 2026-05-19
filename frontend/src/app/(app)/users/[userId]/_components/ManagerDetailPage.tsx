'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, FileText, Shield, Key, UserX, UserCheck, Loader2, Crown,
  Edit, Users, LogOut, Lock, AlertTriangle, ChevronRight, Search,
  Filter, Download, RefreshCw, MoreHorizontal, Check, X, Info,
  TrendingUp, Smartphone, Monitor, Globe, Clock, Bell, Eye,
  DollarSign, Percent, ArrowUpRight, Zap, Building2, Mail,
  Phone, BadgeCheck, Calendar, Activity, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, UserPlus, UserMinus, GitBranch,
  AlertCircle, CheckCircle2, XCircle, MinusCircle, Wifi, WifiOff,
  Hash, Layers, Settings, Database, BarChart3, FileCheck, FileMinus,
  Sliders, ShieldAlert, ShieldCheck, Fingerprint, Laptop2,
} from 'lucide-react';

// ─── shadcn/ui ───────────────────────────────────────────────
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { formatDate, formatMoney, getStatusClass } from '@/lib/utils';
import type { ApiResponse } from '@/types/api';

// ─── Types ────────────────────────────────────────────────────
interface UserDetailData {
  user: {
    id: string; name: string; username?: string; email: string;
    phone?: string | null; isActive: boolean; isTeamLead: boolean;
    lastLoginAt?: string | null; createdAt: string;
    approvalLimit?: string | null; employeeId?: string;
    department?: string; position?: string; approvalTier?: number;
    saleOrderLimit?: number; maxDiscountApproval?: number;
    role: { id: string; code: string; nameTh: string };
    team?: { id: string; name: string; size?: number } | null;
    reportsTo?: { id: string; name: string; position?: string } | null;
  } | null;
  totals: { quotations: number; approvedValue: number; thisMonth: number };
  byStatus: Array<{ status: string; count: number }>;
  recent: Array<{ id: string; quotationNo: string; status: string; grandTotal: number; createdAt: string }>;
}

interface RoleOption { id: string; code: string; nameTh: string; level: number; }

interface AuditLog {
  id: string; action: string; documentRef: string; amount?: number;
  timestamp: string; ipAddress: string; device: string; browser: string;
  type: 'approved' | 'rejected' | 'updated' | 'escalated';
  status: 'success' | 'warning' | 'danger';
}

interface TeamMember {
  id: string; name: string; role: string; email: string; isActive: boolean;
}

interface Permission {
  id: string; label: string; description: string;
  enabled: boolean; inherited: boolean; custom: boolean;
}

// ─── Mock data for UI completeness ────────────────────────────
const MOCK_AUDIT_LOGS: AuditLog[] = [
  { id: '1', action: 'Approved Sale Order', documentRef: 'SO-2026-0188', amount: 850000, timestamp: '2026-05-19T09:15:00Z', ipAddress: '192.168.1.45', device: 'MacBook Pro', browser: 'Chrome 124', type: 'approved', status: 'success' },
  { id: '2', action: 'Approved Discount Override', documentRef: 'QT-2026-0091', amount: undefined, timestamp: '2026-05-19T08:42:00Z', ipAddress: '192.168.1.45', device: 'MacBook Pro', browser: 'Chrome 124', type: 'approved', status: 'success' },
  { id: '3', action: 'Rejected Quotation', documentRef: 'QT-2026-0022', amount: 320000, timestamp: '2026-05-18T16:30:00Z', ipAddress: '192.168.1.45', device: 'iPhone 15', browser: 'Safari 17', type: 'rejected', status: 'danger' },
  { id: '4', action: 'Updated Approval Limit', documentRef: 'SYSTEM', amount: undefined, timestamp: '2026-05-18T11:00:00Z', ipAddress: '10.0.0.5', device: 'Windows PC', browser: 'Edge 124', type: 'updated', status: 'warning' },
  { id: '5', action: 'Escalated to Director', documentRef: 'SO-2026-0177', amount: 2500000, timestamp: '2026-05-17T14:20:00Z', ipAddress: '192.168.1.45', device: 'MacBook Pro', browser: 'Chrome 124', type: 'escalated', status: 'warning' },
  { id: '6', action: 'Approved Quotation', documentRef: 'QT-2026-0085', amount: 475000, timestamp: '2026-05-17T10:05:00Z', ipAddress: '192.168.1.45', device: 'MacBook Pro', browser: 'Chrome 124', type: 'approved', status: 'success' },
];

const MOCK_TEAM_MEMBERS: TeamMember[] = [
  { id: '1', name: 'Somchai Rakdee', role: 'Sales Officer', email: 'somchai@company.com', isActive: true },
  { id: '2', name: 'Pranee Suthiwong', role: 'Sales Officer', email: 'pranee@company.com', isActive: true },
  { id: '3', name: 'Kittipong Malee', role: 'Sales Rep', email: 'kittipong@company.com', isActive: true },
  { id: '4', name: 'Apinya Charoenwong', role: 'Sales Rep', email: 'apinya@company.com', isActive: false },
];

const INITIAL_PERMISSIONS = {
  financial: [
    { id: 'view_cost', label: 'View Product Cost', description: 'Access to product cost and margin data', enabled: true, inherited: true, custom: false },
    { id: 'override_price', label: 'Override Standard Price', description: 'Modify standard pricing on quotations', enabled: true, inherited: false, custom: true },
    { id: 'edit_pricing', label: 'Edit Pricing Rules', description: 'Modify global pricing rule configurations', enabled: false, inherited: false, custom: false },
  ],
  approval: [
    { id: 'approve_quot', label: 'Approve Quotations', description: 'Final approval for quotation documents', enabled: true, inherited: true, custom: false },
    { id: 'approve_so', label: 'Approve Sale Orders', description: 'Final approval for sale order documents', enabled: true, inherited: true, custom: false },
    { id: 'reject_docs', label: 'Reject Documents', description: 'Reject and return documents with comments', enabled: true, inherited: true, custom: false },
  ],
  reporting: [
    { id: 'view_reports', label: 'View Team Reports', description: 'Access team performance and activity reports', enabled: true, inherited: true, custom: false },
    { id: 'export_reports', label: 'Export Reports', description: 'Download and export data to Excel/PDF', enabled: false, inherited: false, custom: false },
  ],
  system: [
    { id: 'admin_features', label: 'Access Admin Features', description: 'View admin panels and system settings', enabled: false, inherited: false, custom: false },
    { id: 'manage_workflow', label: 'Manage Team Workflow', description: 'Configure team workflows and assign tasks', enabled: true, inherited: false, custom: true },
  ],
};

const PROTECTED_ROLES = ['ADMIN', 'CEO'];

// ─── Helper components ────────────────────────────────────────
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

function PermissionToggle({ perm, onChange }: {
  perm: Permission;
  onChange: (id: string, val: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between py-3 px-4 rounded-lg hover:bg-slate-50 transition-colors group">
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-700">{perm.label}</span>
          {perm.inherited && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-wide">Inherited</span>
          )}
          {perm.custom && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 uppercase tracking-wide">Custom</span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">{perm.description}</p>
      </div>
      <button
        onClick={() => onChange(perm.id, !perm.enabled)}
        className={`relative flex-shrink-0 h-5 w-9 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${perm.enabled ? 'bg-blue-500' : 'bg-slate-200'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200 ${perm.enabled ? 'left-4' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function AuditLogItem({ log }: { log: AuditLog }) {
  const icons = {
    approved: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
    rejected: <XCircle className="h-3.5 w-3.5 text-red-500" />,
    updated: <RefreshCw className="h-3.5 w-3.5 text-amber-500" />,
    escalated: <ArrowUpRight className="h-3.5 w-3.5 text-blue-500" />,
  };
  const colors = {
    approved: 'border-l-emerald-400 bg-emerald-50/30',
    rejected: 'border-l-red-400 bg-red-50/30',
    updated: 'border-l-amber-400 bg-amber-50/30',
    escalated: 'border-l-blue-400 bg-blue-50/30',
  };

  return (
    <div className={`border-l-2 pl-3 py-2.5 pr-3 rounded-r-lg ${colors[log.type]} hover:brightness-95 transition-all`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {icons[log.type]}
          <span className="text-sm font-medium text-slate-700 truncate">{log.action}</span>
          <span className="text-xs font-mono text-blue-600 shrink-0">{log.documentRef}</span>
          {log.amount && (
            <span className="text-xs font-semibold text-slate-600 shrink-0">
              ฿{log.amount.toLocaleString()}
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-400 shrink-0">
          {new Date(log.timestamp).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-1">
        <span className="text-[10px] text-slate-400 flex items-center gap-1">
          <Globe className="h-2.5 w-2.5" />{log.ipAddress}
        </span>
        <span className="text-[10px] text-slate-400 flex items-center gap-1">
          <Laptop2 className="h-2.5 w-2.5" />{log.device}
        </span>
        <span className="text-[10px] text-slate-400">{log.browser}</span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export function ManagerDetailPage() {
  const params = useParams();
  const userId = params.userId as string;
  const mainRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<UserDetailData | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('approval');
  const [permissions, setPermissions] = useState(INITIAL_PERMISSIONS);

  // Modals
  const [showResetPw, setShowResetPw] = useState(false);
  const [showAssignRole, setShowAssignRole] = useState(false);
  const [showEditLimits, setShowEditLimits] = useState(false);
  const [showConfirmLock, setShowConfirmLock] = useState(false);
  const [showConfirmSuspend, setShowConfirmSuspend] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [resetting, setResetting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [toggling, setToggling] = useState(false);

  // Approval limits (editable)
  const [quotLimit, setQuotLimit] = useState('500000');
  const [soLimit, setSoLimit] = useState('1000000');
  const [discountLimit, setDiscountLimit] = useState('15');

  // Audit log filters
  const [logSearch, setLogSearch] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState('all');

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

  useEffect(() => { load(); }, [userId]);

  const handleToggleActive = async () => {
    if (!data?.user) return;
    if (!confirm(`${data.user.isActive ? 'ปิด' : 'เปิด'}การใช้งาน ${data.user.name}?`)) return;
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

  const handleSaveLimits = async () => {
    try {
      await api.patch(`/admin/users/${userId}/approval-limits`, {
        quotationLimit: Number(quotLimit),
        saleOrderLimit: Number(soLimit),
        maxDiscount: Number(discountLimit),
      });
      toast.success('บันทึก Approval Limits เรียบร้อย');
      setShowEditLimits(false);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };

  const handlePermissionChange = (group: keyof typeof permissions, id: string, val: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [group]: prev[group].map(p => p.id === id ? { ...p, enabled: val, custom: true, inherited: false } : p),
    }));
    toast.success('Permission updated');
  };

  const filteredLogs = MOCK_AUDIT_LOGS.filter(log => {
    const matchSearch = logSearch === '' || log.action.toLowerCase().includes(logSearch.toLowerCase()) || log.documentRef.toLowerCase().includes(logSearch.toLowerCase());
    const matchType = logTypeFilter === 'all' || log.type === logTypeFilter;
    return matchSearch && matchType;
  });

  const navItems = [
    { id: 'approval', label: 'Approval Settings', icon: DollarSign },
    { id: 'hierarchy', label: 'Team Hierarchy', icon: GitBranch },
    { id: 'permissions', label: 'Permissions', icon: Shield },
    { id: 'security', label: 'Security', icon: ShieldAlert },
    { id: 'logs', label: 'Activity Logs', icon: Activity },
  ];

  if (loading) return (
    <div className="flex gap-6 max-w-[1400px]">
      <div className="w-72 space-y-3 shrink-0"><Skeleton className="h-96" /><Skeleton className="h-48" /></div>
      <div className="flex-1 space-y-4"><Skeleton className="h-20" /><Skeleton className="h-64" /><Skeleton className="h-48" /></div>
    </div>
  );

  if (!data?.user) return (
    <Card><CardContent className="py-16 text-center">
      <p className="text-muted-foreground">ไม่พบข้อมูลผู้ใช้</p>
      <Link href="/users" className="text-sm text-primary hover:underline mt-2 inline-block">← กลับ</Link>
    </CardContent></Card>
  );

  const { user } = data;
  const isProtected = PROTECTED_ROLES.includes(user.role.code);
  const isOnline = user.lastLoginAt ? (Date.now() - new Date(user.lastLoginAt).getTime()) < 15 * 60 * 1000 : false;
  const approvalTier = user.approvalTier ?? 2;

  const tierColors: Record<number, string> = {
    1: 'bg-slate-100 text-slate-600',
    2: 'bg-blue-50 text-blue-700',
    3: 'bg-violet-50 text-violet-700',
    4: 'bg-amber-50 text-amber-700',
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* ── Back nav ── */}
      <div className="px-6 py-3 border-b bg-white sticky top-0 z-30 flex items-center gap-3">
        <Link href="/users" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors font-medium">
          <ArrowLeft className="h-3.5 w-3.5" />กลับรายการ Users
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-xs text-slate-700 font-semibold">{user.name}</span>
      </div>

      {/* ── Top Header Card ── */}
      <div className="px-6 pt-5 pb-0">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-violet-700 px-6 py-5">
            <div className="flex items-center gap-5">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center font-bold text-2xl text-white shadow-lg">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${isOnline ? 'bg-emerald-400' : 'bg-slate-300'}`} />
              </div>

              {/* Identity */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-white tracking-tight">{user.name}</h1>
                  {isProtected && (
                    <Badge className="bg-white/15 text-white border-white/25 text-[10px] font-semibold">
                      <Lock className="h-2.5 w-2.5 mr-1" />Protected
                    </Badge>
                  )}
                  {user.isTeamLead && (
                    <Badge className="bg-amber-400/20 text-amber-100 border-amber-400/40 text-[10px] font-semibold">
                      <Crown className="h-2.5 w-2.5 mr-1" />Team Lead
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white/15 text-white border border-white/20">
                    Manager
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${tierColors[approvalTier]} bg-white/80`}>
                    Approval Tier {approvalTier}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${user.isActive ? 'bg-emerald-400/20 text-emerald-100 border-emerald-400/30' : 'bg-red-400/20 text-red-100 border-red-400/30'} border`}>
                    {user.isActive ? '● Active' : '○ Inactive'}
                  </span>
                  <OnlineIndicator isOnline={isOnline} />
                </div>
                <p className="text-white/60 text-xs mt-1.5">
                  Last login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'}
                </p>
              </div>

              {/* Quick header actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setShowEditLimits(true)} className="h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium border border-white/20 transition-all flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5" />Edit Limits
                </button>
                <button onClick={() => setShowResetPw(true)} className="h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium border border-white/20 transition-all flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5" />Reset Password
                </button>
                {!isProtected && (
                  <button onClick={handleToggleActive} disabled={toggling} className="h-8 px-3 rounded-lg bg-red-500/20 hover:bg-red-500/35 text-red-100 text-xs font-medium border border-red-400/30 transition-all flex items-center gap-1.5">
                    {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex gap-5 px-6 py-5 items-start">

        {/* ══════════════════════════════════
            LEFT SIDEBAR
        ══════════════════════════════════ */}
        <aside className="w-64 shrink-0 sticky top-14 space-y-4 max-h-[calc(100vh-4rem)] overflow-y-auto pb-4">

          {/* Profile Panel */}
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
                { icon: Hash, label: 'Username', value: user.username ?? `@${user.name.toLowerCase().replace(' ', '.')}` },
                { icon: Mail, label: 'Email', value: user.email, truncate: true },
                { icon: Phone, label: 'Phone', value: user.phone ?? '—' },
                { icon: BadgeCheck, label: 'Employee ID', value: user.employeeId ?? 'MGR-0042' },
                { icon: Building2, label: 'Department', value: user.department ?? 'Sales' },
                { icon: Layers, label: 'Position', value: user.position ?? 'Senior Manager' },
                { icon: Shield, label: 'Role', value: user.role.nameTh },
                { icon: TrendingUp, label: 'Approval Tier', value: `Tier ${approvalTier}` },
                { icon: Users, label: 'Reports To', value: user.reportsTo?.name ?? '—' },
                { icon: Users, label: 'Team Size', value: `${user.team?.size ?? MOCK_TEAM_MEMBERS.length} members` },
                { icon: Calendar, label: 'Created', value: formatDate(user.createdAt) },
              ].map(({ icon: Icon, label, value, truncate }) => (
                <div key={label} className="flex items-start gap-2">
                  <Icon className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-slate-400 block">{label}</span>
                    <span className={`text-xs font-medium text-slate-700 ${truncate ? 'truncate block' : ''}`}>{value}</span>
                  </div>
                </div>
              ))}

              {/* Status */}
              <div className="pt-1">
                <div className={`text-[10px] font-semibold px-2 py-1 rounded-md text-center ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {user.isActive ? '● Account Active' : '○ Account Inactive'}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-2 mb-2">Sections</p>
              {navItems.map(item => (
                <button key={item.id} onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${activeSection === item.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}>
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
                {[
                  { icon: Edit, label: 'Edit Manager', action: () => toast.info('Open edit modal'), color: '' },
                  { icon: Shield, label: 'Change Role', action: () => !isProtected && setShowAssignRole(true), color: '', disabled: isProtected },
                  { icon: Sliders, label: 'Edit Approval Limits', action: () => setShowEditLimits(true), color: '' },
                  { icon: UserPlus, label: 'Assign Team Members', action: () => toast.info('Open team modal'), color: '' },
                  { icon: Key, label: 'Reset Password', action: () => setShowResetPw(true), color: '' },
                  { icon: LogOut, label: 'Force Logout', action: () => toast.warning('Force logout sent'), color: 'text-amber-600 hover:bg-amber-50' },
                  { icon: Lock, label: 'Lock Account', action: () => setShowConfirmLock(true), color: 'text-red-500 hover:bg-red-50' },
                  { icon: AlertTriangle, label: 'Suspend Account', action: () => setShowConfirmSuspend(true), color: 'text-red-600 hover:bg-red-50' },
                ].map(({ icon: Icon, label, action, color, disabled }) => (
                  <button key={label} onClick={action} disabled={disabled}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${disabled ? 'opacity-40 cursor-not-allowed text-slate-400' : `text-slate-600 hover:bg-slate-50 ${color}`}`}>
                    <Icon className="h-3 w-3 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* ══════════════════════════════════
            RIGHT CONTENT
        ══════════════════════════════════ */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Protected banner */}
          {isProtected && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-700">
              <Lock className="h-4 w-4 text-amber-500 shrink-0" />
              <span>Account นี้เป็น <strong>{user.role.nameTh}</strong> — ไม่สามารถเปลี่ยน Role หรือปิดการใช้งานได้</span>
            </div>
          )}

          {/* ════════════════════════════
              SECTION 1 — APPROVAL SETTINGS
          ════════════════════════════ */}
          {(activeSection === 'approval' || true) && (
            <section id="approval">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                <SectionHeader
                  icon={DollarSign}
                  title="Approval Settings"
                  subtitle="Configure approval authority and financial limits for this manager"
                  action={
                    <button onClick={() => setShowEditLimits(true)} className="h-7 px-3 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5">
                      <Edit className="h-3 w-3" />Edit Limits
                    </button>
                  }
                />

                {/* Limit Cards */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: 'Quotation Approval Limit', value: `฿${Number(quotLimit).toLocaleString()}`, icon: FileText, color: 'blue', sub: 'Per quotation document' },
                    { label: 'Sale Order Approval Limit', value: `฿${Number(soLimit).toLocaleString()}`, icon: FileCheck, color: 'violet', sub: 'Per sale order document' },
                    { label: 'Max Discount Approval', value: `${discountLimit}%`, icon: Percent, color: 'emerald', sub: 'Maximum discount rate' },
                  ].map(({ label, value, icon: Icon, color, sub }) => (
                    <div key={label} className={`rounded-xl border-2 p-4 bg-gradient-to-br ${color === 'blue' ? 'border-blue-100 from-blue-50 to-blue-50/30' : color === 'violet' ? 'border-violet-100 from-violet-50 to-violet-50/30' : 'border-emerald-100 from-emerald-50 to-emerald-50/30'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${color === 'blue' ? 'bg-blue-100' : color === 'violet' ? 'bg-violet-100' : 'bg-emerald-100'}`}>
                          <Icon className={`h-3.5 w-3.5 ${color === 'blue' ? 'text-blue-600' : color === 'violet' ? 'text-violet-600' : 'text-emerald-600'}`} />
                        </div>
                        <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Limit</span>
                      </div>
                      <div className={`text-xl font-bold tracking-tight ${color === 'blue' ? 'text-blue-700' : color === 'violet' ? 'text-violet-700' : 'text-emerald-700'}`}>{value}</div>
                      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
                      <p className="text-[10px] text-slate-400">{sub}</p>
                    </div>
                  ))}
                </div>

                {/* Approval Permissions */}
                <div className="mb-5">
                  <p className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />Approval Permissions
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      { label: 'Approve Quotation', active: true },
                      { label: 'Approve Sale Order', active: true },
                      { label: 'Approve Discount Override', active: true },
                      { label: 'Approve Price Override', active: false },
                      { label: 'Approve Credit Limit', active: false },
                    ].map(({ label, active }) => (
                      <div key={label} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-slate-50 text-slate-400'}`}>
                        {active ? <Check className="h-3 w-3 text-emerald-500 shrink-0" /> : <X className="h-3 w-3 text-slate-300 shrink-0" />}
                        {label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Escalation Rules */}
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-2">
                    <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />Escalation Rules
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                      <div className="h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                        <ArrowUpRight className="h-3.5 w-3.5 text-amber-600" />
                      </div>
                      <div className="flex-1 text-xs">
                        <span className="font-semibold text-slate-700">Amount exceeds ฿{Number(soLimit).toLocaleString()}</span>
                        <span className="text-slate-400 mx-2">→</span>
                        <span className="text-amber-600 font-semibold">Escalate to Director</span>
                      </div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-700">Auto</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <Percent className="h-3.5 w-3.5 text-slate-500" />
                      </div>
                      <div className="flex-1 text-xs">
                        <span className="font-semibold text-slate-700">Discount exceeds {discountLimit}%</span>
                        <span className="text-slate-400 mx-2">→</span>
                        <span className="text-blue-600 font-semibold">Requires additional approval</span>
                      </div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-600">Manual</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ════════════════════════════
              SECTION 2 — TEAM HIERARCHY
          ════════════════════════════ */}
          <section id="hierarchy">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <SectionHeader
                icon={GitBranch}
                title="Team Hierarchy Management"
                subtitle="Reporting structure and team member assignments"
                action={
                  <button onClick={() => toast.info('Open assign modal')} className="h-7 px-3 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors flex items-center gap-1.5">
                    <UserPlus className="h-3 w-3" />Assign Officer
                  </button>
                }
              />

              {/* Mini org tree */}
              <div className="mb-5 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-4">Reporting Structure</p>
                <div className="flex flex-col items-center gap-0">
                  {/* Director level */}
                  <div className="flex flex-col items-center">
                    <div className="px-4 py-2 rounded-xl bg-violet-100 border border-violet-200 text-xs font-semibold text-violet-700 shadow-sm">
                      Director — {user.reportsTo?.name ?? 'Wanchai Tanapon'}
                    </div>
                    <div className="w-px h-5 bg-slate-200" />
                  </div>
                  {/* Manager (current) */}
                  <div className="flex flex-col items-center">
                    <div className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md ring-2 ring-blue-300 ring-offset-1">
                      {user.name} — Manager ★
                    </div>
                    <div className="w-px h-5 bg-slate-200" />
                  </div>
                  {/* Officers */}
                  <div className="flex items-start gap-3">
                    {MOCK_TEAM_MEMBERS.slice(0, 3).map((m, i) => (
                      <div key={m.id} className="flex flex-col items-center">
                        {i === 1 && <div className="w-px h-5 bg-slate-200" />}
                        {i !== 1 && <div className="w-px h-5 bg-transparent" />}
                        <div className={`px-3 py-1.5 rounded-lg border text-[10px] font-medium ${m.isActive ? 'bg-white border-slate-200 text-slate-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                          {m.name.split(' ')[0]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Team members table */}
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-3">Team Members ({MOCK_TEAM_MEMBERS.length})</p>
                <div className="space-y-1.5">
                  {MOCK_TEAM_MEMBERS.map(member => (
                    <div key={member.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all group">
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${member.isActive ? 'bg-gradient-to-br from-blue-500 to-violet-500' : 'bg-slate-300'}`}>
                        {member.name.slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{member.name}</p>
                        <p className="text-[10px] text-slate-400">{member.role}</p>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${member.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                        <button className="h-5 w-5 rounded flex items-center justify-center hover:bg-slate-100 text-slate-400 transition-colors">
                          <Edit className="h-2.5 w-2.5" />
                        </button>
                        <button className="h-5 w-5 rounded flex items-center justify-center hover:bg-red-50 text-red-400 transition-colors" onClick={() => toast.warning(`Remove ${member.name}?`)}>
                          <UserMinus className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ════════════════════════════
              SECTION 3 — PERMISSIONS
          ════════════════════════════ */}
          <section id="permissions">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <SectionHeader
                icon={Shield}
                title="Permissions & Administrative Access"
                subtitle="Fine-grained permission controls for this manager account"
              />

              <div className="grid grid-cols-2 gap-4">
                {([
                  { key: 'financial', label: 'Financial Permissions', icon: DollarSign },
                  { key: 'approval', label: 'Approval Permissions', icon: CheckCircle2 },
                  { key: 'reporting', label: 'Reporting Permissions', icon: BarChart3 },
                  { key: 'system', label: 'System Access', icon: Database },
                ] as const).map(({ key, label, icon: Icon }) => (
                  <div key={key} className="rounded-xl border border-slate-100 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-slate-500" />
                      <span className="text-xs font-semibold text-slate-600">{label}</span>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {permissions[key].map(perm => (
                        <PermissionToggle
                          key={perm.id}
                          perm={perm}
                          onChange={(id, val) => handlePermissionChange(key, id, val)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ════════════════════════════
              SECTION 4 — SECURITY
          ════════════════════════════ */}
          <section id="security">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <SectionHeader
                icon={ShieldAlert}
                title="Security & Account Control"
                subtitle="Authentication status, active sessions, and security configuration"
              />

              {/* High privilege warning */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 mb-5">
                <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-amber-700">High Privilege Account</p>
                  <p className="text-[10px] text-amber-600">This account has elevated approval permissions. Monitor security activity closely.</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-amber-100 text-amber-700">Tier {approvalTier}</span>
              </div>

              {/* Security status grid */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: 'MFA Status', value: 'Enabled', icon: Fingerprint, status: 'ok' },
                  { label: 'Failed Logins', value: '0 attempts', icon: AlertCircle, status: 'ok' },
                  { label: 'Active Sessions', value: '2 devices', icon: Monitor, status: 'warn' },
                  { label: 'Trusted Devices', value: '3 devices', icon: Smartphone, status: 'ok' },
                  { label: 'Password Age', value: '14 days ago', icon: Key, status: 'ok' },
                  { label: 'Security Alerts', value: 'None', icon: Bell, status: 'ok' },
                ].map(({ label, value, icon: Icon, status }) => (
                  <div key={label} className={`p-3 rounded-xl border ${status === 'warn' ? 'border-amber-100 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <Icon className={`h-3.5 w-3.5 ${status === 'warn' ? 'text-amber-500' : 'text-slate-400'}`} />
                      <span className={`h-1.5 w-1.5 rounded-full ${status === 'ok' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">{value}</p>
                    <p className="text-[10px] text-slate-400">{label}</p>
                  </div>
                ))}
              </div>

              {/* Security actions */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Reset MFA', icon: Fingerprint, color: 'border-slate-200 text-slate-600 hover:bg-slate-50' },
                  { label: 'Force Logout All', icon: LogOut, color: 'border-amber-200 text-amber-600 hover:bg-amber-50' },
                  { label: 'Lock Account', icon: Lock, color: 'border-red-200 text-red-600 hover:bg-red-50', action: () => setShowConfirmLock(true) },
                  { label: 'Force Password Reset', icon: Key, color: 'border-red-200 text-red-500 hover:bg-red-50', action: () => setShowResetPw(true) },
                ].map(({ label, icon: Icon, color, action }) => (
                  <button key={label} onClick={action ?? (() => toast.info(label))}
                    className={`h-8 px-3 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 ${color}`}>
                    <Icon className="h-3.5 w-3.5" />{label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ════════════════════════════
              SECTION 5 — AUDIT LOGS
          ════════════════════════════ */}
          <section id="logs">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <SectionHeader
                icon={Activity}
                title="Approval Activity Logs"
                subtitle="Audit trail of all approval actions performed by this manager"
                action={
                  <button onClick={() => toast.info('Exporting...')} className="h-7 px-3 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors flex items-center gap-1.5">
                    <Download className="h-3 w-3" />Export
                  </button>
                }
              />

              {/* Filters */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={logSearch}
                    onChange={e => setLogSearch(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-300 focus:bg-white transition-all"
                  />
                </div>
                <div className="flex items-center gap-1">
                  {(['all', 'approved', 'rejected', 'updated', 'escalated'] as const).map(type => (
                    <button key={type} onClick={() => setLogTypeFilter(type)}
                      className={`h-7 px-2.5 rounded-lg text-[10px] font-semibold capitalize transition-all ${logTypeFilter === type ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Log items */}
              <div className="space-y-2">
                {filteredLogs.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-8">No logs found</p>
                ) : (
                  filteredLogs.map(log => <AuditLogItem key={log.id} log={log} />)
                )}
              </div>

              {filteredLogs.length > 0 && (
                <button className="w-full mt-3 h-8 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 hover:border-slate-300 hover:text-slate-600 transition-colors">
                  Load more logs
                </button>
              )}
            </div>
          </section>

        </div>
      </div>

      {/* ══════════════════════════════════
          DIALOGS
      ══════════════════════════════════ */}

      {/* Reset Password */}
      <Dialog open={showResetPw} onOpenChange={o => { if (!o) { setShowResetPw(false); setNewPassword(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Set new password for {user.name}</DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">New password (minimum 8 characters)</Label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" className="mt-1.5" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowResetPw(false); setNewPassword(''); }} disabled={resetting}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={resetting || newPassword.length < 8} variant="destructive">
              {resetting && <Loader2 className="h-4 w-4 animate-spin" />}Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role */}
      {!isProtected && (
        <Dialog open={showAssignRole} onOpenChange={o => { if (!o) setShowAssignRole(false); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Change Role</DialogTitle>
              <DialogDescription>{user.name} — Current: {user.role.nameTh}</DialogDescription>
            </DialogHeader>
            <div>
              <Label className="text-xs">New Role</Label>
              <select value={selectedRoleId} onChange={e => setSelectedRoleId(e.target.value)}
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {roles.filter(r => !PROTECTED_ROLES.includes(r.code)).map(r => (
                  <option key={r.id} value={r.id}>{r.nameTh} (L{r.level})</option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAssignRole(false)} disabled={assigning}>Cancel</Button>
              <Button onClick={handleAssignRole} disabled={assigning || !selectedRoleId}>
                {assigning && <Loader2 className="h-4 w-4 animate-spin" />}Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Approval Limits */}
      <Dialog open={showEditLimits} onOpenChange={setShowEditLimits}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Approval Limits</DialogTitle>
            <DialogDescription>Configure financial approval authority for {user.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Quotation Approval Limit (฿)</Label>
              <Input type="number" value={quotLimit} onChange={e => setQuotLimit(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs">Sale Order Approval Limit (฿)</Label>
              <Input type="number" value={soLimit} onChange={e => setSoLimit(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs">Maximum Discount Approval (%)</Label>
              <div className="flex items-center gap-3 mt-1.5">
                <input type="range" min="0" max="50" value={discountLimit} onChange={e => setDiscountLimit(e.target.value)} className="flex-1 accent-blue-600" />
                <span className="text-sm font-bold text-blue-700 w-10 text-right">{discountLimit}%</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditLimits(false)}>Cancel</Button>
            <Button onClick={handleSaveLimits} className="bg-blue-600 hover:bg-blue-700">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lock Account Confirm */}
      <Dialog open={showConfirmLock} onOpenChange={setShowConfirmLock}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2"><Lock className="h-4 w-4" />Lock Account</DialogTitle>
            <DialogDescription>This will prevent {user.name} from logging in. All active sessions will be terminated.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmLock(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { toast.error('Account locked'); setShowConfirmLock(false); }}>Lock Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Account Confirm */}
      <Dialog open={showConfirmSuspend} onOpenChange={setShowConfirmSuspend}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Suspend Account</DialogTitle>
            <DialogDescription>Suspending {user.name} will revoke all approvals and access. This action is logged and reversible.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmSuspend(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { toast.error('Account suspended'); setShowConfirmSuspend(false); }}>Suspend Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}