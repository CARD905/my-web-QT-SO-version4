'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Plus,
  Save,
  Shield,
  Trash2,
  Pencil,
  Lock,
  Sparkles,
  Search,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { api, getApiErrorMessage } from '@/lib/api';
import { formatMoney } from '@/lib/utils';
import type { ApiResponse } from '@/types/api';
import { usePermissions } from '@/hooks/use-permissions';

// ===========================
// Types
// ===========================
interface Role {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  description: string | null;
  level: number;
  isSystem: boolean;
  isActive: boolean;
  themeColor: string | null;
  defaultApprovalLimit: string | number | null;
  permissions: Array<{ permission: PermissionDef }>;
  _count: { users: number };
}

interface PermissionDef {
  id: string;
  code: string;
  resource: string;
  action: string;
  scope: 'OWN' | 'TEAM' | 'DEPARTMENT' | 'ALL';
  nameTh: string;
  nameEn: string;
  groupKey: string;
}

const SCOPE_BADGE: Record<string, string> = {
  OWN: 'bg-blue-500/10 text-blue-600',
  TEAM: 'bg-amber-500/10 text-amber-600',
  DEPARTMENT: 'bg-purple-500/10 text-purple-600',
  ALL: 'bg-rose-500/10 text-rose-600',
};

// ===========================
// Page Component
// ===========================
export default function ManagePermissionsPage() {
  const { can, loading: permLoading } = usePermissions();
  const canEditPermissions = can('role', 'assignPermission', 'ALL');
  const canCreate = can('role', 'create', 'ALL');
  const canUpdate = can('role', 'update', 'ALL');
  const canDelete = can('role', 'delete', 'ALL');

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [creatingRole, setCreatingRole] = useState(false);
  const [editingPerms, setEditingPerms] = useState<Role | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rRes, pRes] = await Promise.all([
        api.get<ApiResponse<Role[]>>('/admin/roles'),
        api.get<ApiResponse<PermissionDef[]>>('/admin/roles/_permissions'),
      ]);
      setRoles(rRes.data.data ?? []);
      setPermissions(pRes.data.data ?? []);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permLoading) fetchData();
  }, [permLoading]);

  const deleteRole = async (role: Role) => {
    if (!confirm(`ลบ role "${role.nameTh}" (${role.code}) ใช่หรือไม่?`)) return;
    try {
      await api.delete(`/admin/roles/${role.id}`);
      toast.success('Role deleted');
      fetchData();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  if (permLoading || loading) {
    return (
      <div className="space-y-3 max-w-7xl">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!can('role', 'view', 'ALL')) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-rose-500" />
            Roles & Permissions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            จัดการ role และสิทธิ์ของแต่ละ role · {roles.length} roles, {permissions.length} permissions
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreatingRole(true)}>
            <Plus className="h-4 w-4" />
            New Role
          </Button>
        )}
      </div>

      {/* Roles list */}
      <div className="space-y-3">
        {roles.map((role) => (
          <Card key={role.id} className={!role.isActive ? 'opacity-60' : ''}>
            <CardContent className="p-4 flex flex-wrap items-center gap-4">
              <div
                className="h-12 w-12 rounded-xl text-white flex items-center justify-center shrink-0 shadow-md"
                style={{
                  background: `linear-gradient(135deg, ${roleColor(role.themeColor)}, ${roleColor(role.themeColor)}cc)`,
                }}
              >
                <Sparkles className="h-5 w-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-lg">{role.nameTh}</span>
                  <span className="text-xs font-mono text-muted-foreground">({role.code})</span>
                  <Badge variant="outline" className="text-xs">
                    Level {role.level}
                  </Badge>
                  {role.isSystem && (
                    <Badge className="bg-blue-500/10 text-blue-600 text-xs" variant="outline">
                      <Lock className="h-2.5 w-2.5 mr-1" />
                      System
                    </Badge>
                  )}
                  {!role.isActive && (
                    <Badge variant="destructive" className="text-xs">
                      Inactive
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {role._count.users} user(s) · {role.permissions.length} permission(s)
                  {role.defaultApprovalLimit !== null && role.defaultApprovalLimit !== undefined && (
                    <span> · Default limit {formatMoney(role.defaultApprovalLimit)}</span>
                  )}
                </div>
                {role.description && (
                  <div className="text-xs text-muted-foreground mt-0.5 italic">
                    {role.description}
                  </div>
                )}
              </div>

              <div className="flex gap-2 shrink-0">
                {canEditPermissions && (
                  <Button variant="outline" size="sm" onClick={() => setEditingPerms(role)}>
                    <Shield className="h-3.5 w-3.5" />
                    Permissions
                  </Button>
                )}
                {canUpdate && (
                  <Button variant="outline" size="sm" onClick={() => setEditingRole(role)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
                {canDelete && !role.isSystem && (
                  <Button variant="destructive" size="sm" onClick={() => deleteRole(role)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create dialog */}
      {creatingRole && (
        <RoleFormDialog
          mode="create"
          onClose={() => setCreatingRole(false)}
          onSaved={() => {
            setCreatingRole(false);
            fetchData();
          }}
        />
      )}

      {/* Edit role dialog */}
      {editingRole && (
        <RoleFormDialog
          mode="edit"
          role={editingRole}
          onClose={() => setEditingRole(null)}
          onSaved={() => {
            setEditingRole(null);
            fetchData();
          }}
        />
      )}

      {/* Edit permissions dialog */}
      {editingPerms && (
        <PermissionsEditorDialog
          role={editingPerms}
          allPermissions={permissions}
          onClose={() => setEditingPerms(null)}
          onSaved={() => {
            setEditingPerms(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

// ===========================
// Role Form Dialog (create/edit)
// ===========================
function RoleFormDialog({
  mode,
  role,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  role?: Role;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(role?.code || '');
  const [nameTh, setNameTh] = useState(role?.nameTh || '');
  const [nameEn, setNameEn] = useState(role?.nameEn || '');
  const [description, setDescription] = useState(role?.description || '');
  const [level, setLevel] = useState<number>(role?.level || 1);
  const [themeColor, setThemeColor] = useState(role?.themeColor || 'gray');
  const [limitStr, setLimitStr] = useState(
    role?.defaultApprovalLimit !== null && role?.defaultApprovalLimit !== undefined
      ? String(role.defaultApprovalLimit)
      : '',
  );
  const [isActive, setIsActive] = useState(role?.isActive ?? true);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!nameTh.trim() || !nameEn.trim()) {
      toast.error('Please fill in name (TH & EN)');
      return;
    }
    if (mode === 'create' && !code.trim()) {
      toast.error('Code is required');
      return;
    }

    const payload = {
      ...(mode === 'create' ? { code: code.toUpperCase() } : {}),
      nameTh,
      nameEn,
      description: description || null,
      level,
      themeColor: themeColor || null,
      defaultApprovalLimit: limitStr ? Number(limitStr) : null,
      ...(mode === 'edit' ? { isActive } : {}),
    };

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await api.post('/admin/roles', payload);
        toast.success('Role created');
      } else {
        await api.patch(`/admin/roles/${role!.id}`, payload);
        toast.success('Role updated');
      }
      onSaved();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open: boolean) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New Role' : `Edit Role: ${role?.code}`}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Create a custom role with specific level and properties'
              : role?.isSystem
                ? '⚠️ System role — some properties cannot be changed'
                : 'Update role properties'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {mode === 'create' && (
            <div>
              <Label className="text-xs">Code (UPPERCASE) *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="SUPERVISOR"
                className="mt-1.5 font-mono"
                autoFocus
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Name (TH) *</Label>
              <Input
                value={nameTh}
                onChange={(e) => setNameTh(e.target.value)}
                placeholder="หัวหน้างาน"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs">Name (EN) *</Label>
              <Input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="Supervisor"
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="optional"
              className="mt-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Level (1-99) *</Label>
              <Input
                type="number"
                min={1}
                max={99}
                value={level}
                onChange={(e) => setLevel(parseInt(e.target.value) || 1)}
                disabled={role?.isSystem}
                className="mt-1.5"
              />
              {role?.isSystem && (
                <p className="text-[10px] text-muted-foreground mt-1">System role: locked</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Theme Color</Label>
              <select
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— None —</option>
                <option value="blue">Blue</option>
                <option value="cyan">Cyan</option>
                <option value="emerald">Emerald</option>
                <option value="amber">Amber</option>
                <option value="orange">Orange</option>
                <option value="rose">Rose</option>
                <option value="purple">Purple</option>
                <option value="pink">Pink</option>
                <option value="gray">Gray</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Default Approval Limit (THB)</Label>
            <Input
              type="number"
              min={0}
              value={limitStr}
              onChange={(e) => setLimitStr(e.target.value)}
              placeholder="leave empty for unlimited"
              className="mt-1.5"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              0 = no approval authority · empty = unlimited
            </p>
          </div>

          {mode === 'edit' && !role?.isSystem && (
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <Label htmlFor="isActive" className="text-sm cursor-pointer">
                Active
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" />
            {mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===========================
// Permissions Editor Dialog
// ===========================
function PermissionsEditorDialog({
  role,
  allPermissions,
  onClose,
  onSaved,
}: {
  role: Role;
  allPermissions: PermissionDef[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = useMemo(
    () => new Set(role.permissions.map((rp) => rp.permission.code)),
    [role.permissions],
  );
  const [selected, setSelected] = useState<Set<string>>(initial);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const grouped = useMemo(() => {
    const groups = new Map<string, PermissionDef[]>();
    for (const p of allPermissions) {
      const arr = groups.get(p.groupKey) ?? [];
      arr.push(p);
      groups.set(p.groupKey, arr);
    }
    return groups;
  }, [allPermissions]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return grouped;
    const term = search.toLowerCase();
    const result = new Map<string, PermissionDef[]>();
    for (const [g, perms] of grouped) {
      const matched = perms.filter(
        (p) =>
          p.code.toLowerCase().includes(term) ||
          p.nameTh.toLowerCase().includes(term) ||
          p.nameEn.toLowerCase().includes(term) ||
          g.toLowerCase().includes(term),
      );
      if (matched.length > 0) result.set(g, matched);
    }
    return result;
  }, [grouped, search]);

  const toggle = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelected(next);
  };

  const toggleGroup = (group: string, allSelected: boolean) => {
    const groupPerms = grouped.get(group) ?? [];
    const next = new Set(selected);
    for (const p of groupPerms) {
      if (allSelected) next.delete(p.code);
      else next.add(p.code);
    }
    setSelected(next);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.put(`/admin/roles/${role.id}/permissions`, {
        permissionCodes: Array.from(selected),
      });
      toast.success(`Updated permissions for ${role.code}`);
      onSaved();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const totalChanges =
    Array.from(selected).filter((c) => !initial.has(c)).length +
    Array.from(initial).filter((c) => !selected.has(c)).length;

  return (
    <Dialog open onOpenChange={(open: boolean) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            <span>Permissions: {role.nameTh}</span>
            <span className="text-xs font-mono text-muted-foreground ml-2">({role.code})</span>
          </DialogTitle>
          <DialogDescription>
            {selected.size} of {allPermissions.length} permissions selected
            {totalChanges > 0 && (
              <span className="ml-2 text-amber-600 font-medium">
                · {totalChanges} change(s) pending
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหา permission..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Permissions list — grouped */}
        <div className="overflow-y-auto flex-1 space-y-3 -mx-2 px-2">
          {Array.from(filteredGroups.entries()).map(([group, perms]) => {
            const allSelected = perms.every((p) => selected.has(p.code));
            const someSelected = perms.some((p) => selected.has(p.code));

            return (
              <div key={group} className="space-y-1">
                <div className="flex items-center justify-between sticky top-0 bg-background py-1 z-10">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleGroup(group, allSelected)}
                      className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                        allSelected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : someSelected
                            ? 'bg-primary/20 border-primary'
                            : 'border-muted-foreground/30'
                      }`}
                    >
                      {allSelected && <Check className="h-3 w-3" />}
                      {someSelected && !allSelected && (
                        <span className="h-1.5 w-1.5 bg-primary rounded-sm" />
                      )}
                    </button>
                    <span className="text-sm font-bold uppercase tracking-wider">{group}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {perms.filter((p) => selected.has(p.code)).length}/{perms.length}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 pl-6">
                  {perms.map((p) => {
                    const isSelected = selected.has(p.code);
                    return (
                      <button
                        key={p.code}
                        onClick={() => toggle(p.code)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                          isSelected
                            ? 'bg-primary/5 hover:bg-primary/10'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <span
                          className={`h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center ${
                            isSelected
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-muted-foreground/30'
                          }`}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-medium truncate">{p.nameTh}</span>
                            <span
                              className={`text-[9px] px-1 rounded font-mono ${SCOPE_BADGE[p.scope] || 'bg-gray-500/10 text-gray-600'}`}
                            >
                              {p.scope}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground truncate">
                            {p.code}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filteredGroups.size === 0 && (
            <p className="text-center text-muted-foreground py-8">
              ไม่พบ permission ที่ค้นหา
            </p>
          )}
        </div>

        <DialogFooter className="border-t pt-3 mt-3">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || totalChanges === 0}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" />
            Save {totalChanges > 0 && `(${totalChanges} change${totalChanges > 1 ? 's' : ''})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===========================
// Helpers
// ===========================
function roleColor(theme: string | null): string {
  const map: Record<string, string> = {
    blue: '#3b82f6',
    cyan: '#06b6d4',
    emerald: '#10b981',
    amber: '#f59e0b',
    orange: '#f97316',
    rose: '#f43f5e',
    purple: '#a855f7',
    pink: '#ec4899',
    gray: '#6b7280',
  };
  return map[theme || 'gray'] || '#6b7280';
}