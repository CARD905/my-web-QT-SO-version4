'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users, RefreshCw, Crown, Star, Mail, Phone,
  Shield, TrendingUp, Clock, CheckCircle2, XCircle,
  ChevronUp, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';

// ─── Types ────────────────────────────────────────────────────────────────────

type ManagerLevel = 'DIVISION' | 'DEPARTMENT' | 'SECTION';

interface Member {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
  isTeamLead: boolean;
  lastLoginAt?: string | null;
  managerLevel?: ManagerLevel | null;
  approvalLimit?: string | number | null;
  reportsToId?: string | null;
  reportsTo?: { id: string; name: string } | null;
  role: { code: string; nameTh: string };
  _count: { createdQuotations: number };
}

interface TeamData {
  id: string;
  name: string;
  code?: string | null;
  members: Member[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_COLOR: Record<ManagerLevel, string> = {
  DIVISION:   'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700',
  DEPARTMENT: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
  SECTION:    'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
};

const LEVEL_LABEL: Record<ManagerLevel, string> = {
  DIVISION:   'Division Manager',
  DEPARTMENT: 'Department Manager',
  SECTION:    'Section Manager',
};

function fmt(n?: string | number | null) {
  const v = Number(n ?? 0);
  return v.toLocaleString('th-TH');
}

// ─── Member Card ──────────────────────────────────────────────────────────────

function MemberCard({
  member,
  canPromote,
  onPromote,
  onDemote,
  promoting,
}: {
  member: Member;
  canPromote: boolean;
  onPromote: (id: string) => void;
  onDemote: (id: string) => void;
  promoting: string | null;
}) {
  const isManager = member.role.code === 'MANAGER';
  const initial = member.name.slice(0, 1).toUpperCase();

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${member.isActive ? 'bg-card hover:bg-muted/30' : 'bg-muted/30 opacity-60'}`}>
      {/* Avatar */}
      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${
        isManager ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-blue-400 to-cyan-500'
      }`}>
        {initial}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-sm">{member.name}</span>
          {isManager && member.managerLevel && (
            <Badge variant="outline" className={`text-[10px] ${LEVEL_COLOR[member.managerLevel]}`}>
              {LEVEL_LABEL[member.managerLevel]}
            </Badge>
          )}
          {!isManager && member.isTeamLead && (
            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/20 dark:text-amber-300">
              <Star className="h-2.5 w-2.5 mr-0.5" /> Lead
            </Badge>
          )}
          {!member.isActive && (
            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200">Inactive</Badge>
          )}
        </div>

        <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
          <Mail className="h-3 w-3 shrink-0" />
          <span className="truncate">{member.email}</span>
        </div>
        {member.phone && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" />
            <span>{member.phone}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mt-1.5">
          {isManager && member.approvalLimit && Number(member.approvalLimit) > 0 && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3 text-amber-500" />
              วงเงิน ฿{fmt(member.approvalLimit)}
            </span>
          )}
          {!isManager && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-blue-500" />
              {member._count.createdQuotations} quotation
            </span>
          )}
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {member.lastLoginAt ? `เข้าสู่ระบบ ${formatDate(member.lastLoginAt)}` : 'ยังไม่เคย login'}
          </span>
        </div>
      </div>

      {/* Promote / Demote — officers only */}
      {canPromote && !isManager && member.isActive && (
        <div className="shrink-0">
          {member.isTeamLead ? (
            <Button
              size="sm" variant="outline"
              className="h-7 text-[11px] text-amber-600 border-amber-300 hover:bg-amber-50"
              disabled={promoting === member.id}
              onClick={() => onDemote(member.id)}
            >
              <ChevronDown className="h-3 w-3" /> ถอด Lead
            </Button>
          ) : (
            <Button
              size="sm" variant="outline"
              className="h-7 text-[11px] text-emerald-600 border-emerald-300 hover:bg-emerald-50"
              disabled={promoting === member.id}
              onClick={() => onPromote(member.id)}
            >
              <ChevronUp className="h-3 w-3" /> ตั้ง Lead
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MyTeamPage() {
  const { user } = usePermissions();
  const [team, setTeam]       = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: TeamData }>('/manager/my-team');
      setTeam(res.data.data);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePromote = async (memberId: string) => {
    setPromoting(memberId);
    try {
      await api.patch(`/manager/team-members/${memberId}/promote-lead`, {});
      toast.success('ตั้งเป็น Officer Lead แล้ว');
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setPromoting(null);
    }
  };

  const handleDemote = async (memberId: string) => {
    setPromoting(memberId);
    try {
      await api.patch(`/manager/team-members/${memberId}/demote-lead`, {});
      toast.success('ถอด Officer Lead แล้ว');
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setPromoting(null);
    }
  };

  // Separate managers from officers
  const managers = team?.members.filter((m) => m.role.code === 'MANAGER') ?? [];
  const officers = team?.members.filter((m) => m.role.code === 'OFFICER' || m.role.code === 'SALES') ?? [];
  const activeOfficers = officers.filter((m) => m.isActive).length;
  const totalQuotations = officers.reduce((s, m) => s + m._count.createdQuotations, 0);

  // Current user is the manager — can promote officers
  const canPromote = true;

  if (loading) {
    return (
      <div className="space-y-5 max-w-3xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="max-w-3xl">
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">คุณยังไม่ได้สังกัดทีม กรุณาติดต่อ Admin</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-amber-500" />
            {team.name}
          </h1>
          {team.code && (
            <span className="text-xs font-mono text-muted-foreground">{team.code}</span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Manager ในทีม',
            value: managers.length,
            icon: Crown,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
          },
          {
            label: 'Officer ทั้งหมด',
            value: `${activeOfficers} / ${officers.length}`,
            icon: Users,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
          },
          {
            label: 'Quotation รวม',
            value: totalQuotations,
            icon: TrendingUp,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                <s.icon className={`h-4.5 w-4.5 ${s.color}`} />
              </div>
              <div>
                <div className="text-lg font-bold leading-none">{s.value}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Managers section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            Manager Accounts ({managers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {managers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มี Manager ในทีมนี้</p>
          ) : (
            managers.map((m) => (
              <MemberCard
                key={m.id} member={m}
                canPromote={false}
                onPromote={handlePromote} onDemote={handleDemote}
                promoting={promoting}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Officers section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            Officer / Sales ({officers.length})
            <div className="ml-auto flex items-center gap-2 text-[11px] font-normal text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />{activeOfficers} active
              {officers.length - activeOfficers > 0 && (
                <><XCircle className="h-3 w-3 text-red-400" />{officers.length - activeOfficers} inactive</>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {officers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มี Officer ในทีมนี้</p>
          ) : (
            officers.map((m) => (
              <MemberCard
                key={m.id} member={m}
                canPromote={canPromote}
                onPromote={handlePromote} onDemote={handleDemote}
                promoting={promoting}
              />
            ))
          )}
        </CardContent>
      </Card>

    </div>
  );
}
