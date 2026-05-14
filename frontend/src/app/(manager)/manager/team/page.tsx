'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Users, Plus, Crown, UserCheck, UserX, Mail, Copy,
  ChevronRight, Loader2, X, Star, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { ApiResponse } from '@/types/api';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
  isTeamLead: boolean;
  reportsToId?: string | null;
  reportsTo?: { id: string; name: string } | null;
  role: { code: string; nameTh: string };
  lastLoginAt?: string | null;
  _count?: { createdQuotations: number };
}

interface MyTeam {
  id: string;
  name: string;
  code?: string | null;
  members: TeamMember[];
}

interface PendingInvitation {
  id: string;
  email: string;
  name: string | null;
  status: string;
  expiresAt: string;
  token: string;
  role: { code: string; nameTh: string };
}

export default function ManagerTeamPage() {
  const [team, setTeam] = useState<MyTeam | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [demotingId, setDemotingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [teamRes, invRes] = await Promise.all([
        api.get<ApiResponse<MyTeam>>('/manager/my-team'),
        api.get<ApiResponse<PendingInvitation[]>>('/invitations?status=PENDING&limit=50'),
      ]);
      setTeam(teamRes.data.data ?? null);
      setPendingInvites(invRes.data.data ?? []);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePromote = async (member: TeamMember) => {
    if (!confirm(`เลื่อน ${member.name} เป็น Officer Lead?\n\nเขาจะสามารถดูงาน และ assign งานให้ Officer ในทีมได้`)) return;
    setPromotingId(member.id);
    try {
      await api.patch(`/manager/team-members/${member.id}/promote-lead`);
      toast.success(`${member.name} เป็น Officer Lead แล้ว`);
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setPromotingId(null); }
  };

  const handleDemote = async (member: TeamMember) => {
    if (!confirm(`ถอด ${member.name} จาก Officer Lead?\n\nOfficer ที่อยู่ใต้เขาจะยังคงอยู่ในทีม`)) return;
    setDemotingId(member.id);
    try {
      await api.patch(`/manager/team-members/${member.id}/demote-lead`);
      toast.success(`${member.name} ถูกถอดจาก Officer Lead แล้ว`);
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setDemotingId(null); }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('คัดลอก Invitation Link แล้ว');
  };

  const revokeInvite = async (inv: PendingInvitation) => {
    if (!confirm(`ยกเลิก invitation ของ ${inv.email}?`)) return;
    try {
      await api.post(`/invitations/${inv.id}/revoke`, { reason: 'Revoked by Manager' });
      toast.success('ยกเลิก invitation แล้ว');
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };

  if (loading) return (
    <div className="space-y-4 max-w-5xl">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );

  // ── Build hierarchy ────────────────────────────────────────────────────────
  const members = team?.members ?? [];
  const leads = members.filter((m) => m.isTeamLead);
  const directOfficers = members.filter((m) => !m.isTeamLead && !m.reportsToId?.startsWith('lead'));
  // Officers ที่ report ตรงต่อ Manager (reportsToId = managerId หรือ null ใน context ทีม)
  const officersUnderManager = members.filter(
    (m) => !m.isTeamLead && !leads.some((l) => l.id === m.reportsToId),
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            ทีมของฉัน
            {team && <span className="text-muted-foreground font-normal text-lg">— {team.name}</span>}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {members.length} คน · {leads.length} Lead · {pendingInvites.length} รอตอบรับ
          </p>
        </div>
        <Button onClick={() => setShowInvite(true)}>
          <Plus className="h-4 w-4" />เชิญ Officer ใหม่
        </Button>
      </div>

      {/* Team Hierarchy */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />โครงสร้างทีม
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              ยังไม่มีสมาชิกในทีม — กด "เชิญ Officer ใหม่" เพื่อเริ่มต้น
            </div>
          ) : (
            <>
              {/* Officer Leads + their members */}
              {leads.map((lead) => {
                const underLead = members.filter((m) => m.reportsToId === lead.id);
                return (
                  <div key={lead.id} className="border rounded-xl overflow-hidden">
                    {/* Lead row */}
                    <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
                      <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center shrink-0">
                        <Crown className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{lead.name}</span>
                          <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-300">
                            Officer Lead
                          </Badge>
                          {!lead.isActive && <Badge variant="outline" className="text-[10px] text-red-600">Inactive</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{lead.email}</div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                          <Link href={`/manager/users/${lead.id}`}>ดูงาน</Link>
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleDemote(lead)} disabled={demotingId === lead.id}>
                          {demotingId === lead.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
                          ถอด Lead
                        </Button>
                      </div>
                    </div>

                    {/* Officers under this Lead */}
                    {underLead.length === 0 ? (
                      <div className="px-6 py-3 text-xs text-muted-foreground italic">
                        ยังไม่มี Officer ในกลุ่มนี้
                      </div>
                    ) : (
                      underLead.map((m) => (
                        <MemberRow key={m.id} member={m} indent onPromote={handlePromote} promotingId={promotingId} leads={leads} />
                      ))
                    )}
                  </div>
                );
              })}

              {/* Officers reporting directly to Manager */}
              {officersUnderManager.length > 0 && (
                <div className="border rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-muted/40 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Officer (รายงานตรงถึง Manager)
                  </div>
                  {officersUnderManager.map((m) => (
                    <MemberRow key={m.id} member={m} indent={false} onPromote={handlePromote} promotingId={promotingId} leads={leads} />
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Invitation รอตอบรับ
              <Badge variant="outline" className="ml-auto">{pendingInvites.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{inv.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {inv.name && `${inv.name} · `}หมดอายุ {formatDate(inv.expiresAt)}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => copyInviteLink(inv.token)}>
                    <Copy className="h-3 w-3" />Copy Link
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs text-red-600" onClick={() => revokeInvite(inv)}>
                    <X className="h-3 w-3" />ยกเลิก
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Invite Dialog */}
      {showInvite && team && (
        <InviteOfficerDialog
          team={team}
          leads={leads}
          onClose={() => setShowInvite(false)}
          onCreated={(url, email) => {
            setShowInvite(false);
            navigator.clipboard.writeText(url);
            toast.success(`สร้าง Invitation สำหรับ ${email} แล้ว — คัดลอก Link แล้ว`);
            load();
          }}
        />
      )}
    </div>
  );
}

// ── Member Row ──────────────────────────────────────────────────────────────
function MemberRow({ member, indent, onPromote, promotingId, leads }: {
  member: TeamMember;
  indent: boolean;
  onPromote: (m: TeamMember) => void;
  promotingId: string | null;
  leads: TeamMember[];
}) {
  return (
    <div className={`flex items-center gap-3 p-3 border-b last:border-0 hover:bg-muted/20 transition-colors ${indent ? 'pl-8 bg-muted/10' : ''}`}>
      {indent && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0 -ml-4" />}
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
        {member.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{member.name}</span>
          {!member.isActive && <Badge variant="outline" className="text-[10px] text-red-600">Inactive</Badge>}
        </div>
        <div className="text-xs text-muted-foreground">{member.email}</div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
          <Link href={`/manager/users/${member.id}`}>ดูงาน</Link>
        </Button>
        {/* ✅ ให้ Promote ได้เฉพาะ Officer ที่ไม่ได้อยู่ใต้ Lead อื่น */}
        {!leads.some((l) => l.id === member.reportsToId) && (
          <Button variant="outline" size="sm" className="h-7 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
            onClick={() => onPromote(member)} disabled={promotingId === member.id}>
            {promotingId === member.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />}
            ตั้งเป็น Lead
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Invite Officer Dialog ────────────────────────────────────────────────────
function InviteOfficerDialog({ team, leads, onClose, onCreated }: {
  team: MyTeam;
  leads: TeamMember[];
  onClose: () => void;
  onCreated: (url: string, email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [reportsToId, setReportsToId] = useState('');  // '' = รายงานตรง Manager
  const [expiresInDays, setExpiresInDays] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  const [officerRoleId, setOfficerRoleId] = useState('');

  useEffect(() => {
    api.get<ApiResponse<{ id: string; code: string }[]>>('/admin/users/_roles').then((res) => {
      const officer = (res.data.data ?? []).find((r) => r.code === 'OFFICER');
      if (officer) setOfficerRoleId(officer.id);
    });
  }, []);

  const submit = async () => {
    if (!email.trim()) { toast.error('กรุณากรอก Email'); return; }
    if (!officerRoleId) { toast.error('ไม่พบ Role OFFICER'); return; }
    setSubmitting(true);
    try {
      const res = await api.post<ApiResponse<{ token: string; invitationUrl: string }>>(
        '/invitations',
        {
          email, name: name || undefined,
          roleId: officerRoleId,
          teamId: team.id,
          reportsToId: reportsToId || undefined,
          channel: 'MANUAL',
          expiresInDays,
        },
      );
      const url = res.data.data?.invitationUrl || `${window.location.origin}/invite/${res.data.data?.token}`;
      onCreated(url, email);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>เชิญ Officer เข้าทีม {team.name}</DialogTitle>
          <DialogDescription>Officer จะได้รับ Invitation Link เพื่อสร้าง Account</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Email <span className="text-destructive">*</span></Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="officer@example.com" className="mt-1.5" autoFocus />
          </div>
          <div>
            <Label className="text-xs">ชื่อ (optional)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อ-นามสกุล" className="mt-1.5" />
          </div>

          <div>
            <Label className="text-xs">รายงานต่อ (สังกัด)</Label>
            <select value={reportsToId} onChange={(e) => setReportsToId(e.target.value)}
              className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">— รายงานตรงต่อ Manager —</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>📋 {l.name} (Officer Lead)</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              เลือก Officer Lead ถ้าต้องการให้อยู่ในกลุ่มย่อย
            </p>
          </div>

          <div>
            <Label className="text-xs">Link หมดอายุใน (วัน)</Label>
            <Input type="number" min={1} max={30} value={expiresInDays}
              onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 3)} className="mt-1.5" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>ยกเลิก</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <Mail className="h-4 w-4" />สร้าง Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}