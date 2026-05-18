'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Building2, Plus, ChevronDown, ChevronRight, Users,
  Shield, Edit2, Loader2, RefreshCw, Crown, X, Check,
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
import { formatMoney } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────
interface TeamMember {
  id: string; name: string; email: string;
  approvalLimit: string | null;
  managerLevel: 'DIVISION' | 'DEPARTMENT' | 'SECTION' | null;
  role: { code: string; nameTh: string };
  isActive: boolean;
}

interface TeamData {
  id: string; name: string; code?: string; description?: string;
  manager?: { id: string; name: string; managerLevel?: string } | null;
  _count?: { members: number };
}

interface DeptData {
  id: string; name: string; code: string; description?: string;
  teams: TeamData[];
}

type ManagerLevel = 'DIVISION' | 'DEPARTMENT' | 'SECTION';

const LEVEL_COLOR: Record<ManagerLevel, string> = {
  DIVISION:   'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300',
  DEPARTMENT: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300',
  SECTION:    'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300',
};

const LEVEL_LABEL: Record<ManagerLevel, string> = {
  DIVISION:   'Division Manager',
  DEPARTMENT: 'Department Manager',
  SECTION:    'Section Manager',
};

// ─── OrgNode — แสดง 1 department พร้อม teams ────────────────────────────────
function OrgNode({
  dept,
  managers,
  onAssignManager,
  onEditLimit,
}: {
  dept: DeptData;
  managers: TeamMember[];
  onAssignManager: (teamId: string, managerId: string) => void;
  onEditLimit: (user: TeamMember) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Department Header */}
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
                key={team.id} team={team} managers={managers}
                onAssignManager={onAssignManager} onEditLimit={onEditLimit}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TeamNode({
  team, managers, onAssignManager, onEditLimit,
}: {
  team: TeamData;
  managers: TeamMember[];
  onAssignManager: (teamId: string, managerId: string) => void;
  onEditLimit: (user: TeamMember) => void;
}) {
  const [selectedMgr, setSelectedMgr] = useState(team.manager?.id ?? '');
  const [saving, setSaving] = useState(false);

  const handleAssign = async () => {
    if (!selectedMgr || selectedMgr === team.manager?.id) return;
    setSaving(true);
    try {
      await onAssignManager(team.id, selectedMgr);
    } finally { setSaving(false); }
  };

  // หา manager user object
  const mgrUser = managers.find((m) => m.id === selectedMgr);

  return (
    <div className="rounded-lg border bg-muted/10 p-3">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">{team.name}</span>
            {team.code && <span className="text-[10px] text-muted-foreground font-mono">{team.code}</span>}
            {team._count && (
              <Badge variant="outline" className="text-[9px]">{team._count.members} คน</Badge>
            )}
          </div>
          {team.manager && (
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <Crown className="h-3 w-3 text-amber-500" />
              <span className="text-xs text-muted-foreground">หัวหน้าปัจจุบัน:</span>
              <span className="text-xs font-medium">{team.manager.name}</span>
              {team.manager.managerLevel && (
                <Badge variant="outline" className={`text-[9px] ${LEVEL_COLOR[team.manager.managerLevel as ManagerLevel] ?? ''}`}>
                  {LEVEL_LABEL[team.manager.managerLevel as ManagerLevel] ?? team.manager.managerLevel}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Assign Manager */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <select value={selectedMgr}
            onChange={(e) => setSelectedMgr(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs min-w-[180px]">
            <option value="">— เลือก Manager —</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.managerLevel ? LEVEL_LABEL[m.managerLevel] ?? m.managerLevel : 'Manager'})
              </option>
            ))}
          </select>
          <Button size="sm" className="h-8 text-xs"
            onClick={handleAssign}
            disabled={saving || !selectedMgr || selectedMgr === team.manager?.id}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Assign
          </Button>
        </div>
      </div>

      {/* Show selected manager limit */}
      {mgrUser && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground">วงเงินอนุมัติ:</span>
          <span className="text-[10px] font-semibold">
            {mgrUser.approvalLimit ? formatMoney(Number(mgrUser.approvalLimit)) : 'ไม่จำกัด'}
          </span>
          <button onClick={() => onEditLimit(mgrUser)}
            className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
            <Edit2 className="h-2.5 w-2.5" />แก้ไข
          </button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════════════════════
export default function AdminTeamsPage() {
  const [depts, setDepts] = useState<DeptData[]>([]);
  const [managers, setManagers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Department dialog
  const [showCreateDept, setShowCreateDept] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [savingDept, setSavingDept] = useState(false);

  // Create Team dialog
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [teamDeptId, setTeamDeptId] = useState('');
  const [savingTeam, setSavingTeam] = useState(false);

  // Create Manager (Invite) dialog
  const [showInviteMgr, setShowInviteMgr] = useState(false);
  const [mgrEmail, setMgrEmail] = useState('');
  const [mgrName, setMgrName] = useState('');
  const [mgrLevel, setMgrLevel] = useState<ManagerLevel>('SECTION');
  const [mgrLimit, setMgrLimit] = useState('');
  const [mgrTeamId, setMgrTeamId] = useState('');
  const [savingMgr, setSavingMgr] = useState(false);

  // Edit limit dialog
  const [editLimitUser, setEditLimitUser] = useState<TeamMember | null>(null);
  const [newLimit, setNewLimit] = useState('');
  const [savingLimit, setSavingLimit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, usersRes] = await Promise.all([
        api.get<any>('/admin/departments'),
        api.get<any>('/admin/users?roleCode=MANAGER&limit=100'),
      ]);
      setDepts(deptRes.data.data ?? []);
      // Filter เฉพาะ MANAGER role
      const allUsers: TeamMember[] = usersRes.data.data ?? [];
      setManagers(allUsers);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Assign team manager
  const handleAssignManager = async (teamId: string, managerId: string) => {
    try {
      await api.patch(`/admin/teams/${teamId}/manager`, { managerId });
      toast.success('Assign manager เรียบร้อย');
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };

  // Edit approval limit
  const handleSaveLimit = async () => {
    if (!editLimitUser) return;
    setSavingLimit(true);
    try {
      const limit = newLimit === '' ? null : Number(newLimit);
      await api.patch(`/admin/approval-authority/users/${editLimitUser.id}`, { limit });
      toast.success(`อัปเดตวงเงินของ ${editLimitUser.name} เรียบร้อย`);
      setEditLimitUser(null);
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setSavingLimit(false); }
  };

  // Create Department
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

  // Create Team
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

  // Invite Manager
  const handleInviteManager = async () => {
    if (!mgrEmail.trim() || !mgrTeamId) { toast.error('กรุณากรอก Email และเลือก Team'); return; }
    setSavingMgr(true);
    try {
      // หา role MANAGER id
      const roleRes = await api.get<any>('/admin/users/_roles');
      const roles: any[] = roleRes.data.data ?? [];
      const managerRole = roles.find((r: any) => r.code === 'MANAGER');
      if (!managerRole) throw new Error('ไม่พบ Role MANAGER ในระบบ');

      await api.post('/invitations', {
        email: mgrEmail.trim(),
        name: mgrName.trim() || undefined,
        roleId: managerRole.id,
        teamId: mgrTeamId,
        managerLevel: mgrLevel,
        approvalLimit: mgrLimit ? Number(mgrLimit) : undefined,
        channel: 'MANUAL',
      });
      toast.success(`ส่ง Invitation ให้ ${mgrEmail} (${LEVEL_LABEL[mgrLevel]}) เรียบร้อย`);
      setShowInviteMgr(false);
      setMgrEmail(''); setMgrName(''); setMgrLevel('SECTION'); setMgrLimit(''); setMgrTeamId('');
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setSavingMgr(false); }
  };

  // All teams flat
  const allTeams = depts.flatMap((d) => d.teams.map((t) => ({ ...t, deptName: d.name })));

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-emerald-500" />Teams & Departments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">จัดการโครงสร้างองค์กร Division → Department → Section → Officer</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setShowCreateDept(true)}><Plus className="h-4 w-4" />สร้าง Department</Button>
          <Button variant="outline" size="sm" onClick={() => setShowCreateTeam(true)}><Plus className="h-4 w-4" />สร้าง Team</Button>
          <Button size="sm" onClick={() => setShowInviteMgr(true)}><Plus className="h-4 w-4" />เชิญ Manager</Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 flex-wrap">
        {(Object.entries(LEVEL_LABEL) as [ManagerLevel, string][]).map(([level, label]) => (
          <Badge key={level} variant="outline" className={`text-[10px] ${LEVEL_COLOR[level]}`}>
            {label}
          </Badge>
        ))}
        <span className="text-xs text-muted-foreground self-center">— ระดับ Manager</span>
      </div>

      {/* Org Chart */}
      {loading ? (
        <div className="space-y-3">{[0,1,2].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : depts.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">ยังไม่มี Department — กด "สร้าง Department" เพื่อเริ่มต้น</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {depts.map((dept) => (
            <OrgNode
              key={dept.id} dept={dept} managers={managers}
              onAssignManager={handleAssignManager}
              onEditLimit={(user) => { setEditLimitUser(user); setNewLimit(user.approvalLimit ? String(Number(user.approvalLimit)) : ''); }}
            />
          ))}
        </div>
      )}

      {/* Managers List */}
      {managers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />Managers ทั้งหมด ({managers.length} คน)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {managers.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/10 flex-wrap">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {m.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{m.name}</span>
                      {m.managerLevel && (
                        <Badge variant="outline" className={`text-[9px] ${LEVEL_COLOR[m.managerLevel]}`}>
                          {LEVEL_LABEL[m.managerLevel]}
                        </Badge>
                      )}
                      {!m.isActive && <Badge variant="outline" className="text-[9px] bg-red-50 text-red-700 border-red-300">Inactive</Badge>}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{m.email}</div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">วงเงิน:</span>
                    <span className="text-xs font-semibold">
                      {m.approvalLimit ? formatMoney(Number(m.approvalLimit)) : 'ไม่จำกัด'}
                    </span>
                    <Button size="sm" variant="ghost" className="h-7 text-xs"
                      onClick={() => { setEditLimitUser(m); setNewLimit(m.approvalLimit ? String(Number(m.approvalLimit)) : ''); }}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Dialogs ── */}

      {/* Create Department */}
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

      {/* Create Team */}
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

      {/* Invite Manager */}
      <Dialog open={showInviteMgr} onOpenChange={(o) => { if (!o) setShowInviteMgr(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>เชิญ Manager ใหม่</DialogTitle>
            <DialogDescription>Admin assign role + level + วงเงิน</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label className="text-xs">Email <span className="text-destructive">*</span></Label><Input type="email" value={mgrEmail} onChange={(e) => setMgrEmail(e.target.value)} className="mt-1.5" placeholder="manager@example.com" autoFocus /></div>
              <div className="col-span-2"><Label className="text-xs">ชื่อ (optional)</Label><Input value={mgrName} onChange={(e) => setMgrName(e.target.value)} className="mt-1.5" placeholder="ชื่อ-นามสกุล" /></div>
              <div>
                <Label className="text-xs">ระดับ Manager <span className="text-destructive">*</span></Label>
                <select value={mgrLevel} onChange={(e) => setMgrLevel(e.target.value as ManagerLevel)}
                  className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="DIVISION">Division Manager</option>
                  <option value="DEPARTMENT">Department Manager</option>
                  <option value="SECTION">Section Manager</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">วงเงินอนุมัติ (฿)</Label>
                <Input type="number" min="0" step="1000" value={mgrLimit} onChange={(e) => setMgrLimit(e.target.value)} className="mt-1.5" placeholder="ว่าง = ไม่จำกัด" />
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
            <div className="p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
              <strong>Approval Flow:</strong> Section Manager → Department Manager → Division Manager → CEO<br />
              <span className="mt-1 block">ถ้ายอดเกินวงเงิน Manager คนนั้นจะต้อง "ส่งต่อ" ขึ้นไปยังระดับถัดไป</span>
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

      {/* Edit Approval Limit */}
      {editLimitUser && (
        <Dialog open onOpenChange={(o) => { if (!o) setEditLimitUser(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>แก้ไขวงเงินอนุมัติ</DialogTitle>
              <DialogDescription>{editLimitUser.name} — {editLimitUser.managerLevel ? LEVEL_LABEL[editLimitUser.managerLevel] : 'Manager'}</DialogDescription>
            </DialogHeader>
            <div>
              <Label className="text-xs">วงเงิน (฿) — ปล่อยว่าง = ไม่จำกัด</Label>
              <Input type="number" min="0" step="1000" value={newLimit} onChange={(e) => setNewLimit(e.target.value)} className="mt-1.5" autoFocus />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditLimitUser(null)} disabled={savingLimit}>ยกเลิก</Button>
              <Button onClick={handleSaveLimit} disabled={savingLimit}>
                {savingLimit && <Loader2 className="h-4 w-4 animate-spin" />}บันทึก
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}