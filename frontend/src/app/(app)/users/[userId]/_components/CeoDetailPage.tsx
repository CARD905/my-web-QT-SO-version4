'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Shield, Key, LogOut, Lock, Loader2,
  Fingerprint, Monitor, Smartphone, Globe, Clock,
  AlertTriangle, CheckCircle2, XCircle, AlertCircle,
  Search, Filter, RefreshCw, Laptop2, Wifi, WifiOff,
  ShieldAlert, ShieldCheck, ShieldOff, Eye, EyeOff,
  Calendar, Mail, BadgeCheck, Activity, Bell,
  ChevronRight, Info, Zap, Hash, UserCog,
} from 'lucide-react';

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
import { formatDate } from '@/lib/utils';
import type { ApiResponse } from '@/types/api';

// ─── Types ────────────────────────────────────────────────────
interface CeoUserData {
  user: {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    lastLoginAt?: string | null;
    createdAt: string;
    role: { id: string; code: string; nameTh: string };
  } | null;
}

interface ActiveSession {
  id: string;
  browser: string;
  os: string;
  device: 'desktop' | 'mobile' | 'tablet';
  ipAddress: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
  isTrusted: boolean;
  isSuspicious: boolean;
}

interface SecurityLog {
  id: string;
  event: string;
  detail: string;
  timestamp: string;
  ipAddress: string;
  device: string;
  type: 'login' | 'mfa' | 'password' | 'device' | 'session' | 'alert';
  severity: 'info' | 'warning' | 'danger';
}

// ─── Mock data ────────────────────────────────────────────────
const MOCK_SESSIONS: ActiveSession[] = [
  {
    id: 's1', browser: 'Chrome 124', os: 'macOS Sonoma', device: 'desktop',
    ipAddress: '203.150.12.88', location: 'Bangkok, TH',
    lastActive: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    isCurrent: true, isTrusted: true, isSuspicious: false,
  },
  {
    id: 's2', browser: 'Safari 17', os: 'iOS 17', device: 'mobile',
    ipAddress: '203.150.12.88', location: 'Bangkok, TH',
    lastActive: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
    isCurrent: false, isTrusted: true, isSuspicious: false,
  },
  {
    id: 's3', browser: 'Chrome 123', os: 'Windows 11', device: 'desktop',
    ipAddress: '185.220.101.47', location: 'Frankfurt, DE',
    lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    isCurrent: false, isTrusted: false, isSuspicious: true,
  },
];

const MOCK_SECURITY_LOGS: SecurityLog[] = [
  { id: 'l1', event: 'Successful Login', detail: 'Chrome on macOS — Bangkok, TH', timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), ipAddress: '203.150.12.88', device: 'MacBook Pro', type: 'login', severity: 'info' },
  { id: 'l2', event: 'Suspicious Login Blocked', detail: 'Unknown device — Frankfurt, DE', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), ipAddress: '185.220.101.47', device: 'Unknown', type: 'alert', severity: 'danger' },
  { id: 'l3', event: 'MFA Verification Success', detail: 'TOTP authentication passed', timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), ipAddress: '203.150.12.88', device: 'MacBook Pro', type: 'mfa', severity: 'info' },
  { id: 'l4', event: 'Trusted Device Added', detail: 'iPhone 15 Pro — Bangkok, TH', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), ipAddress: '203.150.12.88', device: 'iPhone 15 Pro', type: 'device', severity: 'info' },
  { id: 'l5', event: 'Password Changed', detail: 'Initiated by System Admin', timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), ipAddress: '10.0.0.5', device: 'Admin Console', type: 'password', severity: 'warning' },
  { id: 'l6', event: 'Session Revoked', detail: 'Remote session terminated by admin', timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), ipAddress: '10.0.0.5', device: 'Admin Console', type: 'session', severity: 'warning' },
  { id: 'l7', event: 'Successful Login', detail: 'Safari on iOS — Bangkok, TH', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), ipAddress: '203.150.12.88', device: 'iPhone 15 Pro', type: 'login', severity: 'info' },
];

// ─── Helper: time ago ─────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────
function SecurityStatusBadge({ ok, label }: { ok: boolean | 'warn'; label: string }) {
  if (ok === 'warn') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{label}
    </span>
  );
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />{label}
    </span>
  );
}

function DeviceIcon({ device }: { device: ActiveSession['device'] }) {
  if (device === 'mobile') return <Smartphone className="h-4 w-4 text-slate-500" />;
  return <Laptop2 className="h-4 w-4 text-slate-500" />;
}

function SecurityLogRow({ log }: { log: SecurityLog }) {
  const cfg = {
    login:    { icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,  bg: 'bg-emerald-500',  line: 'border-l-emerald-300 bg-emerald-50/40' },
    mfa:      { icon: <Fingerprint  className="h-3.5 w-3.5 text-blue-500" />,     bg: 'bg-blue-500',     line: 'border-l-blue-300 bg-blue-50/40' },
    password: { icon: <Key          className="h-3.5 w-3.5 text-amber-500" />,    bg: 'bg-amber-500',    line: 'border-l-amber-300 bg-amber-50/40' },
    device:   { icon: <Monitor      className="h-3.5 w-3.5 text-violet-500" />,   bg: 'bg-violet-500',   line: 'border-l-violet-300 bg-violet-50/40' },
    session:  { icon: <LogOut       className="h-3.5 w-3.5 text-slate-500" />,    bg: 'bg-slate-400',    line: 'border-l-slate-200 bg-slate-50/40' },
    alert:    { icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,     bg: 'bg-red-500',      line: 'border-l-red-400 bg-red-50/40' },
  }[log.type];

  return (
    <div className={`border-l-2 pl-3 py-2.5 pr-3 rounded-r-xl ${cfg.line} hover:brightness-[0.97] transition-all`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {cfg.icon}
          <span className={`text-xs font-semibold ${log.severity === 'danger' ? 'text-red-700' : log.severity === 'warning' ? 'text-amber-700' : 'text-slate-700'}`}>
            {log.event}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">{timeAgo(log.timestamp)}</span>
      </div>
      <p className="text-[11px] text-slate-500 mt-0.5 ml-5">{log.detail}</p>
      <div className="flex items-center gap-3 mt-1 ml-5">
        <span className="text-[10px] text-slate-400 flex items-center gap-1"><Globe className="h-2.5 w-2.5" />{log.ipAddress}</span>
        <span className="text-[10px] text-slate-400 flex items-center gap-1"><Laptop2 className="h-2.5 w-2.5" />{log.device}</span>
      </div>
    </div>
  );
}

// ─── Confirm Dialog with secondary warning ────────────────────
function ConfirmActionDialog({
  open, onClose, title, description, warning, onConfirm, confirmLabel, loading,
}: {
  open: boolean; onClose: () => void;
  title: string; description: string; warning?: string;
  onConfirm: () => void; confirmLabel: string; loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <ShieldAlert className="h-4 w-4" />{title}
          </DialogTitle>
          <DialogDescription className="text-slate-600">{description}</DialogDescription>
        </DialogHeader>
        {warning && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">{warning}</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}{confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export function CeoDetailPage() {
  const params = useParams();
  const userId = params.userId as string;

  const [data, setData] = useState<CeoUserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ActiveSession[]>(MOCK_SESSIONS);
  const [logSearch, setLogSearch] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState<string>('all');

  // Dialogs
  const [showResetPw, setShowResetPw]       = useState(false);
  const [showForcePw, setShowForcePw]       = useState(false);
  const [showResetMfa, setShowResetMfa]     = useState(false);
  const [showForceLogout, setShowForceLogout] = useState(false);
  const [showLockAccount, setShowLockAccount] = useState(false);
  const [revokeSessionId, setRevokeSessionId] = useState<string | null>(null);

  const [newPassword, setNewPassword]   = useState('');
  const [resetting, setResetting]       = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    try {
      const res = await api.get<ApiResponse<CeoUserData>>(`/manager-dashboard/users/${userId}`);
      setData(res.data.data ?? null);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [userId]);

  const handleResetPassword = async () => {
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setResetting(true);
    try {
      await api.post(`/admin/users/${userId}/reset-password`, { newPassword });
      toast.success('Password reset successfully');
      setShowResetPw(false); setNewPassword('');
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setResetting(false); }
  };

  const handleGenericAction = async (endpoint: string, successMsg: string, onClose: () => void) => {
    setActionLoading(true);
    try {
      await api.post(`/admin/users/${userId}/${endpoint}`);
      toast.success(successMsg);
      onClose();
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setActionLoading(false); }
  };

  const handleRevokeSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    setRevokeSessionId(null);
    toast.success('Session revoked successfully');
  };

  const filteredLogs = MOCK_SECURITY_LOGS.filter(log => {
    const matchSearch = logSearch === '' ||
      log.event.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.detail.toLowerCase().includes(logSearch.toLowerCase());
    const matchType = logTypeFilter === 'all' || log.type === logTypeFilter;
    return matchSearch && matchType;
  });

  // ── Loading skeleton ───────────────────────────────────────
  if (loading) return (
    <div className="flex gap-5 max-w-[1300px] px-6 py-5">
      <div className="w-60 space-y-3 shrink-0">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
      <div className="flex-1 space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );

  if (!data?.user) return (
    <Card><CardContent className="py-16 text-center">
      <p className="text-muted-foreground">User not found</p>
      <Link href="/users" className="text-sm text-primary hover:underline mt-2 inline-block">← Back</Link>
    </CardContent></Card>
  );

  const { user } = data;
  const isOnline = user.lastLoginAt
    ? (Date.now() - new Date(user.lastLoginAt).getTime()) < 15 * 60 * 1000
    : false;
  const suspiciousSessions = sessions.filter(s => s.isSuspicious).length;

  return (
    <div className="min-h-screen bg-slate-50/60">

      {/* ── Sticky top nav ── */}
      <div className="px-6 py-3 border-b bg-white sticky top-0 z-30 flex items-center gap-3">
        <Link href="/users"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors font-medium">
          <ArrowLeft className="h-3.5 w-3.5" />Back to Users
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-xs text-slate-700 font-semibold">{user.name}</span>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-medium ml-1">CEO</span>
      </div>

      {/* ── Top Header Card ── */}
      <div className="px-6 pt-5 pb-0">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Darker, more serious gradient for executive account */}
          <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 px-6 py-5">
            <div className="flex items-center gap-5">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center font-bold text-2xl text-white shadow-lg">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-slate-900 ${isOnline ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              </div>

              {/* Identity */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-white tracking-tight">{user.name}</h1>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase tracking-wider">
                    CEO
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white/10 text-white/80 border border-white/20 flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5" />Protected Executive Account
                  </span>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1 ${user.isActive ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg ${isOnline ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-white/50'}`}>
                    {isOnline ? '● Online' : '○ Offline'}
                  </span>
                </div>
                <p className="text-white/50 text-xs mt-1.5">
                  Last login: {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                    : 'Never'}
                </p>
              </div>

              {/* Compact header actions — safe only */}
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setShowResetPw(true)}
                  className="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-xs font-medium border border-white/15 transition-all flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5" />Reset Password
                </button>
                <button onClick={() => setShowForceLogout(true)}
                  className="h-8 px-3 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium border border-red-500/25 transition-all flex items-center gap-1.5">
                  <LogOut className="h-3.5 w-3.5" />Force Logout
                </button>
              </div>
            </div>
          </div>

          {/* Restricted banner */}
          <div className="flex items-center gap-3 px-5 py-2.5 bg-amber-50 border-t border-amber-200">
            <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-xs font-medium text-amber-700">
              Administrative actions for executive accounts are restricted.
              Role changes, account deletion, and impersonation are not permitted.
            </p>
          </div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex gap-5 px-6 py-5 items-start">

        {/* ══════════════════════════════════
            LEFT SIDEBAR
        ══════════════════════════════════ */}
        <aside className="w-60 shrink-0 sticky top-14 space-y-4 max-h-[calc(100vh-4rem)] overflow-y-auto pb-4">

          {/* Executive Profile Panel */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center font-bold text-white text-sm shrink-0">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{user.name}</p>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wider">CEO</span>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-2.5 text-xs">
              {[
                { icon: Mail,       label: 'Email',        value: user.email },
                { icon: Shield,     label: 'Role',         value: user.role.nameTh },
                { icon: Calendar,   label: 'Created',      value: formatDate(user.createdAt) },
                { icon: Clock,      label: 'Last Login',   value: user.lastLoginAt ? timeAgo(user.lastLoginAt) : 'Never' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <Icon className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-slate-400 block">{label}</span>
                    <span className="text-xs font-medium text-slate-700 truncate block">{value}</span>
                  </div>
                </div>
              ))}

              <div className={`mt-1 text-[10px] font-semibold px-2 py-1 rounded-md text-center ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {user.isActive ? '● Account Active' : '○ Account Inactive'}
              </div>
            </div>
          </div>

          {/* Security Quick Actions */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Shield className="h-3 w-3" />Security Actions
              </p>
            </div>
            <div className="p-3 space-y-0.5">
              {[
                { icon: Key,          label: 'Reset Password',          action: () => setShowResetPw(true),       color: '' },
                { icon: ShieldAlert,  label: 'Force Password Reset',     action: () => setShowForcePw(true),       color: '' },
                { icon: Fingerprint,  label: 'Reset MFA',                action: () => setShowResetMfa(true),      color: '' },
                { icon: LogOut,       label: 'Force Logout All Sessions', action: () => setShowForceLogout(true),   color: 'text-amber-600 hover:bg-amber-50' },
                { icon: Lock,         label: 'Lock Account',             action: () => setShowLockAccount(true),   color: 'text-red-600 hover:bg-red-50' },
              ].map(({ icon: Icon, label, action, color }) => (
                <button key={label} onClick={action}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-slate-600 hover:bg-slate-50 ${color}`}>
                  <Icon className="h-3 w-3 shrink-0 opacity-70" />{label}
                </button>
              ))}
            </div>

            {/* Restricted note */}
            <div className="px-3 py-2.5 border-t border-slate-100 bg-slate-50 mx-0">
              <div className="flex items-start gap-1.5">
                <Info className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Some executive account permissions require higher authorization.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* ══════════════════════════════════
            RIGHT CONTENT
        ══════════════════════════════════ */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Suspicious session alert */}
          {suspiciousSessions > 0 && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-bold text-red-700">
                  {suspiciousSessions} Suspicious Session{suspiciousSessions > 1 ? 's' : ''} Detected
                </p>
                <p className="text-[10px] text-red-600 mt-0.5">
                  Login attempts from unrecognised locations detected on this executive account.
                </p>
              </div>
              <button onClick={() => setShowForceLogout(true)}
                className="h-7 px-3 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-[11px] font-semibold transition-colors shrink-0">
                Force Logout
              </button>
            </div>
          )}

          {/* ════════════════════════════
              SECTION 1 — SECURITY STATUS
          ════════════════════════════ */}
          <section>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <ShieldCheck className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Executive Security Status</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Authentication and access control overview</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'MFA Status',               value: 'Enabled',    icon: Fingerprint, ok: true,   sub: 'TOTP authenticator' },
                  { label: 'Hardware Security Key',     value: 'Registered', icon: Key,         ok: true,   sub: 'YubiKey 5 Series' },
                  { label: 'Failed Login Attempts',     value: '0',          icon: AlertCircle, ok: true,   sub: 'Last 30 days' },
                  { label: 'Suspicious Detection',      value: '1 Alert',    icon: ShieldAlert, ok: false,  sub: 'Review required' },
                  { label: 'Trusted Devices',           value: '3 devices',  icon: Monitor,     ok: true,   sub: 'Registered & verified' },
                  { label: 'Active Sessions',           value: `${sessions.length} sessions`, icon: Wifi, ok: sessions.length <= 3 ? true : 'warn', sub: suspiciousSessions > 0 ? `${suspiciousSessions} suspicious` : 'All verified' },
                  { label: 'Password Last Changed',     value: '14 days ago',icon: Key,         ok: true,   sub: 'Within policy limit' },
                  { label: 'Account Status',            value: user.isActive ? 'Active' : 'Locked', icon: ShieldCheck, ok: user.isActive, sub: user.isActive ? 'No restrictions' : 'Access denied' },
                ].map(({ label, value, icon: Icon, ok, sub }) => (
                  <div key={label} className={`p-3.5 rounded-xl border ${ok === false ? 'border-red-100 bg-red-50/60' : ok === 'warn' ? 'border-amber-100 bg-amber-50/60' : 'border-slate-100 bg-slate-50/60'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={`h-4 w-4 ${ok === false ? 'text-red-400' : ok === 'warn' ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span className={`h-2 w-2 rounded-full ${ok === false ? 'bg-red-400' : ok === 'warn' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                    </div>
                    <p className={`text-sm font-bold ${ok === false ? 'text-red-700' : ok === 'warn' ? 'text-amber-700' : 'text-slate-700'}`}>{value}</p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">{label}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ════════════════════════════
              SECTION 2 — ACTIVE SESSIONS
          ════════════════════════════ */}
          <section>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Monitor className="h-4 w-4 text-slate-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">Active Sessions</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{sessions.length} concurrent sessions — {suspiciousSessions > 0 ? `${suspiciousSessions} suspicious` : 'all verified'}</p>
                  </div>
                </div>
                <button onClick={() => setShowForceLogout(true)}
                  className="h-7 px-3 rounded-lg border border-amber-200 text-amber-600 text-xs font-medium hover:bg-amber-50 transition-colors flex items-center gap-1.5">
                  <LogOut className="h-3 w-3" />Logout All
                </button>
              </div>

              <div className="space-y-2.5">
                {sessions.map(session => (
                  <div key={session.id}
                    className={`rounded-xl border px-4 py-3.5 transition-all ${session.isSuspicious ? 'border-red-200 bg-red-50/50' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${session.isSuspicious ? 'bg-red-100' : 'bg-slate-100'}`}>
                        <DeviceIcon device={session.device} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-700">{session.browser}</span>
                          <span className="text-xs text-slate-400">{session.os}</span>
                          {session.isCurrent && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">Current</span>
                          )}
                          {session.isTrusted && !session.isSuspicious && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-0.5">
                              <ShieldCheck className="h-2.5 w-2.5" />Trusted
                            </span>
                          )}
                          {session.isSuspicious && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600 border border-red-300 flex items-center gap-0.5">
                              <AlertTriangle className="h-2.5 w-2.5" />Suspicious
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                          <span className="flex items-center gap-1"><Globe className="h-2.5 w-2.5" />{session.ipAddress}</span>
                          <span>{session.location}</span>
                          <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{timeAgo(session.lastActive)}</span>
                        </div>
                      </div>
                      {!session.isCurrent && (
                        <button
                          onClick={() => setRevokeSessionId(session.id)}
                          className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold border transition-colors shrink-0 flex items-center gap-1 ${session.isSuspicious ? 'bg-red-100 border-red-300 text-red-700 hover:bg-red-200' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                          <XCircle className="h-3 w-3" />Revoke
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ════════════════════════════
              SECTION 3 — SECURITY LOGS
          ════════════════════════════ */}
          <section>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Activity className="h-4 w-4 text-slate-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">Security Logs</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Login events, MFA changes, and security alerts only</p>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-44">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input type="text" placeholder="Search security events..."
                    value={logSearch} onChange={e => setLogSearch(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-300 focus:bg-white transition-all" />
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { key: 'all',      label: 'All' },
                    { key: 'login',    label: 'Login' },
                    { key: 'mfa',      label: 'MFA' },
                    { key: 'password', label: 'Password' },
                    { key: 'device',   label: 'Device' },
                    { key: 'alert',    label: 'Alerts' },
                  ].map(f => (
                    <button key={f.key} onClick={() => setLogTypeFilter(f.key)}
                      className={`h-7 px-2.5 rounded-lg text-[10px] font-semibold transition-all ${logTypeFilter === f.key ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {filteredLogs.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-8">No security events found</p>
                ) : (
                  filteredLogs.map(log => <SecurityLogRow key={log.id} log={log} />)
                )}
              </div>

              {filteredLogs.length > 0 && (
                <button className="w-full mt-3 h-8 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 hover:border-slate-300 hover:text-slate-500 transition-colors">
                  Load more events
                </button>
              )}
            </div>
          </section>

          {/* ════════════════════════════
              SECTION 4 — RESTRICTED CONTROLS
          ════════════════════════════ */}
          <section>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <ShieldOff className="h-4 w-4 text-red-500" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Restricted Administrative Controls</h2>
                  <p className="text-xs text-slate-400 mt-0.5">All actions require confirmation and are fully audited</p>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 mb-5">
                <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500">
                  Some executive account permissions require higher authorization.
                  Role changes, account deletion, and impersonation are permanently restricted for CEO accounts.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    icon: Key,
                    label: 'Reset Password',
                    description: 'Set a new password for this executive account.',
                    action: () => setShowResetPw(true),
                    danger: false,
                  },
                  {
                    icon: ShieldAlert,
                    label: 'Force Password Reset',
                    description: 'Require new password on next login.',
                    action: () => setShowForcePw(true),
                    danger: false,
                  },
                  {
                    icon: Fingerprint,
                    label: 'Reset MFA',
                    description: 'Clear all MFA methods. User must re-enroll.',
                    action: () => setShowResetMfa(true),
                    danger: true,
                  },
                  {
                    icon: LogOut,
                    label: 'Force Logout All Sessions',
                    description: 'Immediately terminate every active session.',
                    action: () => setShowForceLogout(true),
                    danger: true,
                  },
                ].map(({ icon: Icon, label, description, action, danger }) => (
                  <button key={label} onClick={action}
                    className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all group ${danger ? 'border-red-100 hover:border-red-300 hover:bg-red-50/50' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}>
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${danger ? 'bg-red-50 group-hover:bg-red-100' : 'bg-slate-100 group-hover:bg-slate-200'}`}>
                      <Icon className={`h-4 w-4 ${danger ? 'text-red-500' : 'text-slate-500'}`} />
                    </div>
                    <div>
                      <p className={`text-xs font-semibold ${danger ? 'text-red-700' : 'text-slate-700'}`}>{label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{description}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Lock account — full-width, most dangerous */}
              <button onClick={() => setShowLockAccount(true)}
                className="w-full mt-3 flex items-center gap-3 p-4 rounded-xl border border-red-200 hover:border-red-400 hover:bg-red-50/60 text-left transition-all group">
                <div className="h-8 w-8 rounded-lg bg-red-50 group-hover:bg-red-100 flex items-center justify-center shrink-0 transition-colors">
                  <Lock className="h-4 w-4 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-red-700">Lock Account</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Immediately block all access. Sessions terminated. Requires supervisor sign-off to unlock.</p>
                </div>
                <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-red-100 text-red-600 uppercase tracking-wider shrink-0">
                  Restricted
                </span>
              </button>
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
            <DialogTitle>Reset Executive Password</DialogTitle>
            <DialogDescription>Set a new password for {user.name}'s account. This action is logged.</DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Resetting a CEO password is a sensitive administrative action and will be recorded in the security audit log.</p>
          </div>
          <div>
            <Label className="text-xs">New password (minimum 8 characters)</Label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="New password" className="mt-1.5" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowResetPw(false); setNewPassword(''); }} disabled={resetting}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={resetting || newPassword.length < 8} variant="destructive">
              {resetting && <Loader2 className="h-4 w-4 animate-spin" />}Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Force Password Reset */}
      <ConfirmActionDialog
        open={showForcePw} onClose={() => setShowForcePw(false)}
        title="Force Password Reset"
        description={`${user.name} will be required to set a new password on their next login.`}
        warning="This will invalidate the current password immediately. The user will be logged out of all sessions."
        onConfirm={() => handleGenericAction('force-password-reset', 'Force password reset applied', () => setShowForcePw(false))}
        confirmLabel="Force Reset" loading={actionLoading}
      />

      {/* Reset MFA */}
      <ConfirmActionDialog
        open={showResetMfa} onClose={() => setShowResetMfa(false)}
        title="Reset MFA Configuration"
        description={`This will clear all MFA methods registered on ${user.name}'s account.`}
        warning="The account will have reduced security until MFA is re-enrolled. Confirm this is authorised before proceeding."
        onConfirm={() => handleGenericAction('reset-mfa', 'MFA reset successfully', () => setShowResetMfa(false))}
        confirmLabel="Reset MFA" loading={actionLoading}
      />

      {/* Force Logout All */}
      <ConfirmActionDialog
        open={showForceLogout} onClose={() => setShowForceLogout(false)}
        title="Force Logout All Sessions"
        description={`All ${sessions.length} active sessions for ${user.name} will be immediately terminated.`}
        warning="This includes any ongoing work. The user will need to re-authenticate on all devices."
        onConfirm={() => {
          setSessions([]);
          setShowForceLogout(false);
          toast.success('All sessions terminated');
        }}
        confirmLabel="Force Logout All" loading={actionLoading}
      />

      {/* Lock Account */}
      <ConfirmActionDialog
        open={showLockAccount} onClose={() => setShowLockAccount(false)}
        title="Lock Executive Account"
        description={`Locking ${user.name}'s account will immediately block all access to the system.`}
        warning="This is a high-impact action. All sessions will be terminated and the account cannot be used until manually unlocked. Ensure this action is authorised at the appropriate level."
        onConfirm={() => handleGenericAction('lock', 'Account locked successfully', () => setShowLockAccount(false))}
        confirmLabel="Lock Account" loading={actionLoading}
      />

      {/* Revoke Session */}
      <ConfirmActionDialog
        open={revokeSessionId !== null}
        onClose={() => setRevokeSessionId(null)}
        title="Revoke Session"
        description={`Terminate the session from ${sessions.find(s => s.id === revokeSessionId)?.browser ?? 'this device'}?`}
        warning={sessions.find(s => s.id === revokeSessionId)?.isSuspicious ? 'This session has been flagged as suspicious. Revoking it will prevent further access from this location.' : undefined}
        onConfirm={() => revokeSessionId && handleRevokeSession(revokeSessionId)}
        confirmLabel="Revoke Session"
      />
    </div>
  );
}