'use client';

import { useEffect, useState } from 'react';
import {
  Mail,
  Plus,
  Loader2,
  Copy,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import type { ApiResponse } from '@/types/api';
import { usePermissions } from '@/hooks/use-permissions';

interface Invitation {
  id: string;
  email: string;
  name: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  channel: 'MANUAL' | 'EMAIL' | 'BOTH';
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  token: string;
  role: { id: string; code: string; nameTh: string; level: number };
  team: { id: string; name: string; code: string | null } | null;
  invitedBy: { id: string; name: string; email: string };
}

interface RoleOption {
  id: string;
  code: string;
  nameTh: string;
  level: number;
}

interface TeamOption {
  id: string;
  name: string;
  code: string | null;
  department: { id: string; name: string } | null;
}

type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

const STATUS_META: Record<InvitationStatus, { color: string; icon: typeof Clock; label: string }> = {
  PENDING: { color: 'bg-amber-500/10 text-amber-600', icon: Clock, label: 'Pending' },
  ACCEPTED: { color: 'bg-emerald-500/10 text-emerald-600', icon: CheckCircle2, label: 'Accepted' },
  EXPIRED: { color: 'bg-gray-500/10 text-gray-600', icon: AlertCircle, label: 'Expired' },
  REVOKED: { color: 'bg-red-500/10 text-red-600', icon: XCircle, label: 'Revoked' },
};

export default function AdminInvitationsPage() {
  const { can, loading: permLoading } = usePermissions();
  const canInvite = can('user', 'invite', 'TEAM') || can('user', 'invite', 'ALL');

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState<'all' | Invitation['status']>('all');
  const [creating, setCreating] = useState(false);
  const [showCreated, setShowCreated] = useState<{ url: string; email: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      params.set('limit', '100');

      const [iRes, rRes, tRes] = await Promise.all([
        api.get<ApiResponse<Invitation[]>>(`/invitations?${params}`),
        api.get<ApiResponse<RoleOption[]>>('/admin/users/_roles'),
        api.get<ApiResponse<TeamOption[]>>('/admin/users/_teams'),
      ]);
      setInvitations(iRes.data.data ?? []);
      setRoles(rRes.data.data ?? []);
      setTeams(tRes.data.data ?? []);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permLoading && canInvite) fetchData();
  }, [permLoading, canInvite, filterStatus]);

  const revoke = async (inv: Invitation) => {
    const reason = prompt(`Revoke invitation to ${inv.email}? Enter reason:`);
    if (!reason) return;
    try {
      await api.post(`/invitations/${inv.id}/revoke`, { reason });
      toast.success('Invitation revoked');
      fetchData();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const copyUrl = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  };

  if (permLoading) return <Skeleton className="h-32 w-full max-w-7xl" />;
  if (!canInvite) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground">คุณไม่มีสิทธิ์เชิญผู้ใช้</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-blue-500" />
            Invitations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            เชิญผู้ใช้ใหม่เข้าสู่ระบบผ่านลิงก์
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          New Invitation
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-1">
        {(['all', 'PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filterStatus === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            }`}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : invitations.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            ยังไม่มี invitation
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {invitations.map((inv) => {
            const meta = STATUS_META[inv.status];
            const StatusIcon = meta.icon;
            return (
              <Card key={inv.id}>
                <CardContent className="p-4 flex flex-wrap items-center gap-4">
                  <div
                    className={`h-10 w-10 rounded-lg ${meta.color} flex items-center justify-center shrink-0`}
                  >
                    <StatusIcon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{inv.email}</span>
                      <Badge variant="outline" className="text-xs">
                        {inv.role.nameTh}
                      </Badge>
                      <Badge className={`text-xs ${meta.color}`} variant="outline">
                        {meta.label}
                      </Badge>
                      {inv.team && (
                        <Badge variant="secondary" className="text-xs">
                          {inv.team.name}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {inv.name && `${inv.name} · `}
                      Invited by {inv.invitedBy.name} {formatRelativeTime(inv.createdAt)}
                    </div>
                    {inv.status === 'PENDING' && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </div>
                    )}
                    {inv.status === 'ACCEPTED' && inv.acceptedAt && (
                      <div className="text-[10px] text-emerald-600 mt-0.5">
                        Accepted {formatRelativeTime(inv.acceptedAt)}
                      </div>
                    )}
                    {inv.status === 'REVOKED' && inv.revokedReason && (
                      <div className="text-[10px] text-red-600 mt-0.5">
                        Reason: {inv.revokedReason}
                      </div>
                    )}
                  </div>

                  {inv.status === 'PENDING' && (
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => copyUrl(inv.token)}>
                        <Copy className="h-3.5 w-3.5" />
                        Copy Link
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => revoke(inv)}>
                        <X className="h-3.5 w-3.5" />
                        Revoke
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Invitation Dialog */}
      {creating && (
        <CreateInvitationDialog
          roles={roles}
          teams={teams}
          onClose={() => setCreating(false)}
          onCreated={(url, email) => {
            setCreating(false);
            setShowCreated({ url, email });
            fetchData();
          }}
        />
      )}

      {/* Show Created Link Dialog */}
      {showCreated && (
        <Dialog open onOpenChange={(open) => { if (!open) setShowCreated(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>✅ Invitation Created</DialogTitle>
              <DialogDescription>
                Send this link to <span className="font-mono">{showCreated.email}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="bg-muted p-3 rounded-md break-all text-xs font-mono">
                {showCreated.url}
              </div>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(showCreated.url);
                  toast.success('Link copied');
                }}
                className="w-full"
              >
                <Copy className="h-4 w-4" />
                Copy to Clipboard
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreated(null)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ===========================
// Create Invitation Dialog
// ===========================
function CreateInvitationDialog({
  roles,
  teams,
  onClose,
  onCreated,
}: {
  roles: RoleOption[];
  teams: TeamOption[];
  onClose: () => void;
  onCreated: (url: string, email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState(roles.find((r) => r.code === 'OFFICER')?.id || '');
  const [teamId, setTeamId] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!email.trim() || !roleId) {
      toast.error('Please fill in email and role');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<ApiResponse<{ token: string; invitationUrl: string }>>(
        '/invitations',
        {
          email,
          name: name || undefined,
          roleId,
          teamId: teamId || null,
          channel: 'MANUAL',
          expiresInDays,
        },
      );
      const url = res.data.data?.invitationUrl || '';
      toast.success('Invitation created');
      onCreated(url, email);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Invitation</DialogTitle>
          <DialogDescription>เชิญผู้ใช้ใหม่เข้าระบบ</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="mt-1.5"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs">Name (optional)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label className="text-xs">Role *</Label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nameTh} (L{r.level})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Team</Label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— No team —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.department?.name} / {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Expires in (days)</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 3)}
              className="mt-1.5"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}