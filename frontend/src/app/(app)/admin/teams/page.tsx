'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Building2, Plus, ChevronDown, ChevronRight, Users,
  Shield, Loader2, RefreshCw, Crown, Check,
  UserPlus, UserMinus, ArrowRightLeft, Trash2, Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────
interface UserItem {
  id: string; name: string; email: string;
  approvalLimit: string | null;
  managerLevel: 'DIVISION' | 'DEPARTMENT' | 'SECTION' | null;
  role: { code: string; nameTh: string };
  team?: { id: string; name: string } | null;
  isActive: boolean;
}

interface TeamData {
  id: string; name: string; code?: string;
  manager?: UserItem | null;
  _count?: { members: number };
  members?: UserItem[];
}

interface DeptData {
  id: string; name: string; code: string;
  teams: TeamData[];
}

type ManagerLevel = 'DIVISION' | 'DEPARTMENT' | 'SECTION';

const LEVEL_COLOR: Record<ManagerLevel, string> = {
  DIVISION:   'bg-purple-100 text-purple-700 border-purple-300',
  DEPARTMENT: 'bg-blue-100 text-blue-700 border-blue-300',
  SECTION:    'bg-emerald-100 text-emerald-700 border-emerald-300',
};
const LEVEL_LABEL: Record<ManagerLevel, string> = {
  DIVISION:   'Division Manager',
  DEPARTMENT: 'Department Manager',
  SECTION:    'Section Manager',
};

// ─── TeamNode ────────────────────────────────────────────────
function TeamNode({
  team, managers, officers, allTeams,
  onAssignManager,
  onAssignOfficer, onMoveUser, onRemoveUser,
}: {
  team: TeamData;
  managers: UserItem[];
  officers: UserItem[];           // officers ที่ยังไม่มีทีม หรือทุก officer
  allTeams: { id: string; name: string; deptName: string }[];
  onAssignManager: (teamId: string, managerId: string, managerLevel: ManagerLevel) => Promise<void>;
  onAssignOfficer: (userId: string, teamId: string) => Promise<void>;
  onMoveUser: (userId: string, newTeamId: string) => Promise<void>;
  onRemoveUser: (userId: string, userName: string) => Promise<void>;
}) {
  const managerByLevel = (['DIVISION', 'DEPARTMENT', 'SECTION'] as ManagerLevel[]).reduce((acc, level) => {
    acc[level] = (team.members ?? []).find((m) => m.role.code === 'MANAGER' && m.managerLevel === level) ?? null;
    if (!acc[level] && team.manager?.managerLevel === level) acc[level] = team.manager;
    return acc;
  }, {} as Record<ManagerLevel, UserItem | null>);
  const [selectedManagers, setSelectedManagers] = useState<Record<ManagerLevel, string>>({
    DIVISION: managerByLevel.DIVISION?.id ?? '',
    DEPARTMENT: managerByLevel.DEPARTMENT?.id ?? '',
    SECTION: managerByLevel.SECTION?.id ?? '',
  });
  const [saving,        setSaving]     = useState(false);
  const [expanded,      setExpanded]   = useState(true);
  const [showAssignOfficer, setShowAssignOfficer] = useState(false);
  const [moveTarget,    setMoveTarget] = useState<UserItem | null>(null);
  const [officerSearch, setOfficerSearch] = useState('');
  const availableManagers = managers.filter((m) => !m.team || m.team.id === team.id);

  useEffect(() => {
    setSelectedManagers({
      DIVISION: managerByLevel.DIVISION?.id ?? '',
      DEPARTMENT: managerByLevel.DEPARTMENT?.id ?? '',
      SECTION: managerByLevel.SECTION?.id ?? '',
    });
  }, [managerByLevel.DIVISION?.id, managerByLevel.DEPARTMENT?.id, managerByLevel.SECTION?.id]);

  const handleAssign = async (level: ManagerLevel) => {
    const selectedMgr = selectedManagers[level];
    if (!selectedMgr || selectedMgr === managerByLevel[level]?.id) return;
    setSaving(true);
    try { await onAssignManager(team.id, selectedMgr, level); }
    finally { setSaving(false); }
  };

  // Officers ที่ยังไม่ได้อยู่ในทีมนี้ (สำหรับ assign)
  const availableOfficers = officers.filter(
    (o) => o.role.code === 'OFFICER' || o.role.code === 'SALES',
  ).filter((o) => !o.team);

  const filteredAvailable = availableOfficers.filter(
    (o) => o.name.toLowerCase().includes(officerSearch.toLowerCase()) ||
           o.email.toLowerCase().includes(officerSearch.toLowerCase()),
  );

  // Members ในทีมนี้ (ยกเว้น manager)
  const teamOfficers = (team.members ?? []).filter(
    (m) => m.role.code === 'OFFICER' || m.role.code === 'SALES',
  );

  return (
    <div className="rounded-lg border bg-muted/10 overflow-hidden">
      {/* Team header */}
      <div className="p-3 flex items-start gap-3 flex-wrap">
        <button onClick={() => setExpanded(v => !v)} className="mt-1 shrink-0">
          {expanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold">{team.name}</span>
            {team.code && <span className="text-[10px] text-muted-foreground font-mono">{team.code}</span>}
            <Badge variant="outline" className="text-[9px]">
              {teamOfficers.length} officer{teamOfficers.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <Crown className="h-3 w-3 text-amber-500" />
            <span className="text-xs text-muted-foreground">Managers:</span>
            {(['DIVISION', 'DEPARTMENT', 'SECTION'] as ManagerLevel[]).map((level) => (
              <Badge key={level} variant="outline" className={`text-[9px] ${managerByLevel[level] ? LEVEL_COLOR[level] : ''}`}>
                {LEVEL_LABEL[level]}: {managerByLevel[level]?.name ?? 'ว่าง'}
              </Badge>
            ))}
          </div>
        </div>

        {/* Add Officer button */}
        <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
          onClick={() => setShowAssignOfficer(true)}>
          <UserPlus className="h-3 w-3" />เพิ่ม Officer
        </Button>
      </div>

      {expanded && (
        <div className="border-t px-3 pb-3 space-y-3">

          {/* ── Assign Manager ── */}
          <div className="grid gap-2 pt-2">
            {(['DIVISION', 'DEPARTMENT', 'SECTION'] as ManagerLevel[]).map((level) => {
              const currentManager = managerByLevel[level];
              const selectedManagerId = selectedManagers[level];
              return (
                <div key={level} className="rounded-lg border bg-background p-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-[9px] ${LEVEL_COLOR[level]}`}>{LEVEL_LABEL[level]}</Badge>
                    <select
                      value={selectedManagerId}
                      onChange={(e) => setSelectedManagers((prev) => ({ ...prev, [level]: e.target.value }))}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs flex-1 min-w-[170px]"
                    >
                      <option value="">เลือก Manager</option>
                      {availableManagers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}{m.team ? ` - ${m.team.name}` : ''}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" className="h-8 text-xs" onClick={() => handleAssign(level)}
                      disabled={saving || !selectedManagerId || selectedManagerId === currentManager?.id}>
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Assign
                    </Button>
                    {currentManager && (
                      <>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setMoveTarget(currentManager)}>
                          <ArrowRightLeft className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs text-red-600" onClick={() => onRemoveUser(currentManager.id, currentManager.name)}>
                          <UserMinus className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Officer Members ── */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              Officers ในทีม ({teamOfficers.length})
            </p>
            {teamOfficers.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic py-2">ยังไม่มี Officer ในทีมนี้</p>
            ) : (
              <div className="space-y-1.5">
                {teamOfficers.map((officer) => (
                  <div key={officer.id} className="flex items-center gap-2 p-2 rounded-lg bg-background border group">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${officer.isActive ? 'bg-blue-500' : 'bg-slate-300'}`}>
                      {officer.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{officer.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{officer.email}</p>
                    </div>
                    {!officer.isActive && (
                      <Badge variant="outline" className="text-[9px] bg-red-50 text-red-600 border-red-200 shrink-0">Inactive</Badge>
                    )}
                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => setMoveTarget(officer)}
                        className="h-6 w-6 rounded flex items-center justify-center hover:bg-blue-50 text-blue-600 transition-colors"
                        title="ย้ายทีม">
                        <ArrowRightLeft className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => onRemoveUser(officer.id, officer.name)}
                        className="h-6 w-6 rounded flex items-center justify-center hover:bg-red-50 text-red-500 transition-colors"
                        title="ลบออกจากทีม">
                        <UserMinus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Dialog: Assign Officer ── */}
      <Dialog open={showAssignOfficer} onOpenChange={(o) => { if (!o) { setShowAssignOfficer(false); setOfficerSearch(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่ม Officer เข้าทีม "{team.name}"</DialogTitle>
            <DialogDescription>เลือก Officer ที่ต้องการเพิ่มเข้าทีม</DialogDescription>
          </DialogHeader>
          <div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={officerSearch} onChange={(e) => setOfficerSearch(e.target.value)}
                placeholder="ค้นหาชื่อหรือ email..." className="pl-9 h-9 text-sm" autoFocus />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {filteredAvailable.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {officerSearch ? 'ไม่พบ Officer ที่ค้นหา' : 'ไม่มี Officer ที่ยังไม่ได้อยู่ในทีมนี้'}
                </p>
              ) : (
                filteredAvailable.map((officer) => (
                  <div key={officer.id} className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors group"
                    onClick={async () => {
                      await onAssignOfficer(officer.id, team.id);
                      setShowAssignOfficer(false);
                      setOfficerSearch('');
                    }}>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${officer.isActive ? 'bg-blue-500' : 'bg-slate-300'}`}>
                      {officer.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{officer.name}</p>
                      <p className="text-[11px] text-muted-foreground">{officer.email}</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs shrink-0 opacity-0 group-hover:opacity-100">
                      เพิ่ม
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAssignOfficer(false); setOfficerSearch(''); }}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Move User ── */}
      {moveTarget && (
        <Dialog open onOpenChange={(o) => { if (!o) setMoveTarget(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>ย้ายทีม</DialogTitle>
              <DialogDescription>{moveTarget.name} — ปัจจุบันอยู่ทีม "{team.name}"</DialogDescription>
            </DialogHeader>
            <MoveTeamSelect
              userId={moveTarget.id}
              currentTeamId={team.id}
              allTeams={allTeams}
              onMove={async (newTeamId) => {
                await onMoveUser(moveTarget.id, newTeamId);
                setMoveTarget(null);
              }}
              onClose={() => setMoveTarget(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── MoveTeamSelect Component ─────────────────────────────────
function MoveTeamSelect({
  userId, currentTeamId, allTeams, onMove, onClose,
}: {
  userId: string;
  currentTeamId: string;
  allTeams: { id: string; name: string; deptName: string }[];
  onMove: (teamId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [moving, setMoving] = useState(false);

  const handleMove = async () => {
    if (!selectedTeamId) return;
    setMoving(true);
    try { await onMove(selectedTeamId); }
    finally { setMoving(false); }
  };

  return (
    <>
      <div>
        <Label className="text-xs">ทีมใหม่ <span className="text-destructive">*</span></Label>
        <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}
          className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">— เลือกทีมที่ต้องการย้ายไป —</option>
          {allTeams.filter((t) => t.id !== currentTeamId).map((t) => (
            <option key={t.id} value={t.id}>{t.deptName} → {t.name}</option>
          ))}
        </select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={moving}>ยกเลิก</Button>
        <Button onClick={handleMove} disabled={moving || !selectedTeamId} className="bg-blue-600 hover:bg-blue-700">
          {moving && <Loader2 className="h-4 w-4 animate-spin" />}
          <ArrowRightLeft className="h-4 w-4" />ย้ายทีม
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── OrgNode ─────────────────────────────────────────────────
function OrgNode({
  dept, managers, officers, allTeams,
  onAssignManager,
  onAssignOfficer, onMoveUser, onRemoveUser,
}: {
  dept: DeptData;
  managers: UserItem[];
  officers: UserItem[];
  allTeams: { id: string; name: string; deptName: string }[];
  onAssignManager: (teamId: string, managerId: string, managerLevel: ManagerLevel) => Promise<void>;
  onAssignOfficer: (userId: string, teamId: string) => Promise<void>;
  onMoveUser: (userId: string, newTeamId: string) => Promise<void>;
  onRemoveUser: (userId: string, userName: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border rounded-xl overflow-hidden">
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm">{dept.name}</span>
          <span className="text-xs text-muted-foreground ml-2 font-mono">{dept.code}</span>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">{dept.teams.length} ทีม</Badge>
      </button>

      {open && (
        <div className="p-3 space-y-2 border-t bg-background">
          {dept.teams.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มีทีม</p>
          ) : (
            dept.teams.map((team) => (
              <TeamNode
                key={team.id} team={team}
                managers={managers} officers={officers} allTeams={allTeams}
                onAssignManager={onAssignManager}
                onAssignOfficer={onAssignOfficer}
                onMoveUser={onMoveUser} onRemoveUser={onRemoveUser}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AccountStatusList({
  title,
  icon: Icon,
  unassigned,
  assigned,
}: {
  title: string;
  icon: typeof Shield;
  unassigned: UserItem[];
  assigned: UserItem[];
}) {
  const renderAccount = (user: UserItem, showTeam: boolean) => (
    <div key={user.id} className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-2">
      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
        {user.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-xs font-medium truncate">{user.name}</p>
          {user.managerLevel && (
            <Badge variant="outline" className={`text-[9px] ${LEVEL_COLOR[user.managerLevel]}`}>
              {LEVEL_LABEL[user.managerLevel]}
            </Badge>
          )}
          {!user.isActive && <Badge variant="outline" className="text-[9px] bg-red-50 text-red-700 border-red-300">Inactive</Badge>}
        </div>
        <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
      </div>
      {showTeam && user.team && <Badge variant="secondary" className="text-[9px] shrink-0">{user.team.name}</Badge>}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />{title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-amber-700">ยังไม่มีทีม</p>
            <Badge variant="outline" className="text-[10px]">{unassigned.length} คน</Badge>
          </div>
          <div className="space-y-2">
            {unassigned.length === 0 ? (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-3 text-center">ไม่มี account ที่รอจัดทีม</p>
            ) : unassigned.map((user) => renderAccount(user, false))}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-700">มีทีมแล้ว</p>
            <Badge variant="outline" className="text-[10px]">{assigned.length} คน</Badge>
          </div>
          <div className="space-y-2">
            {assigned.length === 0 ? (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-3 text-center">ยังไม่มี account ในทีม</p>
            ) : assigned.map((user) => renderAccount(user, true))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function AdminTeamsPage() {
  const [depts,    setDepts]    = useState<DeptData[]>([]);
  const [managers, setManagers] = useState<UserItem[]>([]);
  const [officers, setOfficers] = useState<UserItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [teamSearch, setTeamSearch] = useState('');

  // Create Department
  const [showCreateDept, setShowCreateDept] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [savingDept, setSavingDept] = useState(false);

  // Create Team
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [teamName,  setTeamName]  = useState('');
  const [teamCode,  setTeamCode]  = useState('');
  const [teamDeptId, setTeamDeptId] = useState('');
  const [savingTeam, setSavingTeam] = useState(false);

  // Invite Manager
  const [showInviteMgr, setShowInviteMgr] = useState(false);
  const [mgrEmail, setMgrEmail] = useState('');
  const [mgrName,  setMgrName]  = useState('');
  const [mgrLevel, setMgrLevel] = useState<ManagerLevel>('SECTION');
  const [mgrTeamId, setMgrTeamId] = useState('');
  const [savingMgr, setSavingMgr] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, mgrRes, offRes, salesRes] = await Promise.all([
        api.get<any>('/admin/departments'),
        api.get<any>('/admin/users?roleCode=MANAGER&limit=100'),
        api.get<any>('/admin/users?roleCode=OFFICER&limit=200'),
        api.get<any>('/admin/users?roleCode=SALES&limit=200'),
      ]);

      const deptsRaw: DeptData[] = deptRes.data.data ?? [];
      const allManagers: UserItem[] = mgrRes.data.data ?? [];
      const allOfficers: UserItem[] = [
        ...(offRes.data.data ?? []),
        ...(salesRes.data.data ?? []),
      ];

      setDepts(deptsRaw);
      setManagers(allManagers);
      setOfficers(allOfficers);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Handlers ────────────────────────────────────────────
  const handleAssignManager = async (teamId: string, managerId: string, managerLevel: ManagerLevel) => {
    await api.patch(`/admin/teams/${teamId}/manager`, { managerId, managerLevel });
    toast.success('Assign manager เรียบร้อย');
    await load();
  };

  // ✅ Assign Officer เข้าทีม
  const handleAssignOfficer = async (userId: string, teamId: string) => {
    try {
      await api.patch(`/admin/users/${userId}/team`, { teamId });
      toast.success('เพิ่ม Officer เข้าทีมเรียบร้อย');
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };

  // ✅ ย้ายทีม
  const handleMoveUser = async (userId: string, newTeamId: string) => {
    try {
      await api.patch(`/admin/users/${userId}/team`, { teamId: newTeamId });
      toast.success('ย้ายทีมเรียบร้อย');
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); throw err; }
  };

  // ✅ ลบออกจากทีม
  const handleRemoveUser = async (userId: string, userName: string) => {
    if (!confirm(`ลบ ${userName} ออกจากทีม?\nUser จะยังคงอยู่ในระบบแต่ไม่ได้สังกัดทีมใด`)) return;
    try {
      await api.patch(`/admin/users/${userId}/team`, { teamId: null });
      toast.success(`ลบ ${userName} ออกจากทีมเรียบร้อย`);
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };

  const handleCreateDept = async () => {
    if (!deptName.trim() || !deptCode.trim()) { toast.error('กรุณากรอกชื่อและรหัส'); return; }
    setSavingDept(true);
    try {
      await api.post('/admin/departments', { name: deptName.trim(), code: deptCode.trim().toUpperCase() });
      toast.success(`สร้าง Department "${deptName}" เรียบร้อย`);
      setShowCreateDept(false); setDeptName(''); setDeptCode('');
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setSavingDept(false); }
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim() || !teamDeptId) { toast.error('กรุณากรอกชื่อทีมและเลือก Department'); return; }
    setSavingTeam(true);
    try {
      await api.post('/admin/teams', {
        name: teamName.trim(),
        code: teamCode.trim().toUpperCase() || undefined,
        departmentId: teamDeptId,
      });
      toast.success(`สร้าง Team "${teamName}" เรียบร้อย`);
      setShowCreateTeam(false); setTeamName(''); setTeamCode(''); setTeamDeptId('');
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setSavingTeam(false); }
  };

  const handleInviteManager = async () => {
    if (!mgrEmail.trim() || !mgrTeamId) { toast.error('กรุณากรอก Email และเลือก Team'); return; }
    setSavingMgr(true);
    try {
      const roleRes = await api.get<any>('/admin/users/_roles');
      const roles: any[] = roleRes.data.data ?? [];
      const managerRole = roles.find((r: any) => r.code === 'MANAGER');
      if (!managerRole) throw new Error('ไม่พบ Role MANAGER ในระบบ');

      await api.post('/invitations', {
        email: mgrEmail.trim(), name: mgrName.trim() || undefined,
        roleId: managerRole.id, teamId: mgrTeamId,
        managerLevel: mgrLevel,
        channel: 'MANUAL',
      });
      toast.success(`ส่ง Invitation ให้ ${mgrEmail} (${LEVEL_LABEL[mgrLevel]}) เรียบร้อย`);
      setShowInviteMgr(false);
      setMgrEmail(''); setMgrName(''); setMgrLevel('SECTION'); setMgrTeamId('');
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setSavingMgr(false); }
  };

  const allTeams = depts.flatMap((d) => d.teams.map((t) => ({ id: t.id, name: t.name, deptName: d.name })));
  const normalizedTeamSearch = teamSearch.trim().toLowerCase();
  const matchesSearch = (value?: string | null) => value?.toLowerCase().includes(normalizedTeamSearch) ?? false;
  const filterUsers = (list: UserItem[]) => normalizedTeamSearch
    ? list.filter((user) =>
        matchesSearch(user.name) ||
        matchesSearch(user.email) ||
        matchesSearch(user.role.nameTh) ||
        matchesSearch(user.role.code) ||
        matchesSearch(user.managerLevel) ||
        matchesSearch(user.team?.name))
    : list;

  const filteredDepts = normalizedTeamSearch
    ? depts
        .map((dept) => ({
          ...dept,
          teams: dept.teams.filter((team) =>
            matchesSearch(dept.name) ||
            matchesSearch(dept.code) ||
            matchesSearch(team.name) ||
            matchesSearch(team.code) ||
            matchesSearch(team.manager?.name) ||
            (team.members ?? []).some((member) =>
              matchesSearch(member.name) ||
              matchesSearch(member.email) ||
              matchesSearch(member.role.nameTh) ||
              matchesSearch(member.role.code) ||
              matchesSearch(member.managerLevel))),
        }))
        .filter((dept) => matchesSearch(dept.name) || matchesSearch(dept.code) || dept.teams.length > 0)
    : depts;

  const unassignedManagers = filterUsers(managers.filter((m) => !m.team));
  const assignedManagers = filterUsers(managers.filter((m) => m.team));

  const unassignedOfficers = filterUsers(officers.filter(
    (o) => !o.team && (o.role.code === 'OFFICER' || o.role.code === 'SALES'),
  ));
  const assignedOfficers = filterUsers(officers.filter(
    (o) => o.team && (o.role.code === 'OFFICER' || o.role.code === 'SALES'),
  ));

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-emerald-500" />Teams & Departments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            จัดการโครงสร้างองค์กร Division → Department → Section → Officer
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setShowCreateDept(true)}><Plus className="h-4 w-4" />สร้าง Department</Button>
          <Button variant="outline" size="sm" onClick={() => setShowCreateTeam(true)}><Plus className="h-4 w-4" />สร้าง Team</Button>
          <Button size="sm" onClick={() => setShowInviteMgr(true)}><Plus className="h-4 w-4" />เชิญ Manager</Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 flex-wrap items-center">
        {(Object.entries(LEVEL_LABEL) as [ManagerLevel, string][]).map(([level, label]) => (
          <Badge key={level} variant="outline" className={`text-[10px] ${LEVEL_COLOR[level]}`}>{label}</Badge>
        ))}
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <ArrowRightLeft className="h-3 w-3" />Hover officer เพื่อย้ายทีม / ลบออก
        </span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={teamSearch}
          onChange={(e) => setTeamSearch(e.target.value)}
          placeholder="ค้นหา department, team, manager, officer, email..."
          className="pl-9"
        />
      </div>

      <div className="space-y-4">
        <AccountStatusList
          title="Manager Accounts"
          icon={Shield}
          unassigned={unassignedManagers}
          assigned={assignedManagers}
        />
        <AccountStatusList
          title="Officer Accounts"
          icon={Users}
          unassigned={unassignedOfficers}
          assigned={assignedOfficers}
        />
      </div>

      {/* Org Chart */}
      {loading ? (
        <div className="space-y-3">{[0,1,2].map((i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : filteredDepts.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{teamSearch ? 'ไม่พบข้อมูลที่ค้นหา' : 'ยังไม่มี Department — กด "สร้าง Department" เพื่อเริ่มต้น'}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredDepts.map((dept) => (
            <OrgNode
              key={dept.id} dept={dept}
              managers={managers} officers={officers} allTeams={allTeams}
              onAssignManager={handleAssignManager}
              onAssignOfficer={handleAssignOfficer}
              onMoveUser={handleMoveUser} onRemoveUser={handleRemoveUser}
            />
          ))}
        </div>
      )}

      {/* ── Dialogs ── */}

      <Dialog open={showCreateDept} onOpenChange={(o) => { if (!o) { setShowCreateDept(false); setDeptName(''); setDeptCode(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>สร้าง Department ใหม่</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">ชื่อ Department</Label><Input value={deptName} onChange={(e) => setDeptName(e.target.value)} className="mt-1.5" placeholder="เช่น Sales Division" autoFocus /></div>
            <div><Label className="text-xs">รหัส (Code)</Label><Input value={deptCode} onChange={(e) => setDeptCode(e.target.value.toUpperCase())} className="mt-1.5 font-mono" placeholder="เช่น SALES_DIV" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDept(false)} disabled={savingDept}>ยกเลิก</Button>
            <Button onClick={handleCreateDept} disabled={savingDept || !deptName.trim() || !deptCode.trim()}>
              {savingDept && <Loader2 className="h-4 w-4 animate-spin" />}สร้าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateTeam} onOpenChange={(o) => { if (!o) { setShowCreateTeam(false); setTeamName(''); setTeamCode(''); setTeamDeptId(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>สร้าง Team ใหม่</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Department</Label>
              <select value={teamDeptId} onChange={(e) => setTeamDeptId(e.target.value)}
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">— เลือก Department —</option>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div><Label className="text-xs">ชื่อ Team</Label><Input value={teamName} onChange={(e) => setTeamName(e.target.value)} className="mt-1.5" placeholder="เช่น Section A" autoFocus /></div>
            <div><Label className="text-xs">รหัส (Code) — optional</Label><Input value={teamCode} onChange={(e) => setTeamCode(e.target.value.toUpperCase())} className="mt-1.5 font-mono" placeholder="เช่น SEC_A" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTeam(false)} disabled={savingTeam}>ยกเลิก</Button>
            <Button onClick={handleCreateTeam} disabled={savingTeam || !teamName.trim() || !teamDeptId}>
              {savingTeam && <Loader2 className="h-4 w-4 animate-spin" />}สร้าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInviteMgr} onOpenChange={(o) => { if (!o) setShowInviteMgr(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>เชิญ Manager ใหม่</DialogTitle>
            <DialogDescription>Admin assign role + level + team</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label className="text-xs">Email <span className="text-destructive">*</span></Label><Input type="email" value={mgrEmail} onChange={(e) => setMgrEmail(e.target.value)} className="mt-1.5" placeholder="manager@example.com" autoFocus /></div>
              <div className="col-span-2"><Label className="text-xs">ชื่อ (optional)</Label><Input value={mgrName} onChange={(e) => setMgrName(e.target.value)} className="mt-1.5" /></div>
              <div className="col-span-2">
                <Label className="text-xs">ระดับ Manager</Label>
                <select value={mgrLevel} onChange={(e) => setMgrLevel(e.target.value as ManagerLevel)}
                  className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="DIVISION">Division Manager</option>
                  <option value="DEPARTMENT">Department Manager</option>
                  <option value="SECTION">Section Manager</option>
                </select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Team <span className="text-destructive">*</span></Label>
                <select value={mgrTeamId} onChange={(e) => setMgrTeamId(e.target.value)}
                  className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">— เลือก Team —</option>
                  {allTeams.map((t) => <option key={t.id} value={t.id}>{t.deptName} → {t.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteMgr(false)} disabled={savingMgr}>ยกเลิก</Button>
            <Button onClick={handleInviteManager} disabled={savingMgr || !mgrEmail.trim() || !mgrTeamId}>
              {savingMgr && <Loader2 className="h-4 w-4 animate-spin" />}ส่ง Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
