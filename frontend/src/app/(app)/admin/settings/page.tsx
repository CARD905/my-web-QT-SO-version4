'use client';

import { useEffect, useState } from 'react';
import {
  Settings, Save, Loader2, RefreshCw, Shield, ChevronDown, ChevronUp,
  Users, UserCheck, Check, X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import type { ApiResponse } from '@/types/api';

// ── System settings types ────────────────────────────────────────────────────
interface SystemSetting {
  key: string; value: string; type: string;
  group: string; label: string; description?: string;
}

const GROUP_LABELS: Record<string, string> = {
  general:   '⚙️ General',
  vat:       '🧾 VAT',
  discount:  '💰 Discount',
  numbering: '🔢 Running Number',
  currency:  '💱 Currency',
};

// ── Role permission types ────────────────────────────────────────────────────
interface RoleInfo {
  id: string; code: string; nameTh: string; nameEn: string;
  level: number; _count: { users: number };
  permissions: Array<{ permission: { code: string } }>;
}

// All toggleable permissions — shared across Officer + Manager editors
const PERM_GROUPS = [
  {
    group: 'ใบเสนอราคา',
    items: [
      { code: 'quotation:create:own',    label: 'สร้างใบเสนอราคา',    desc: 'สร้าง draft ใหม่ได้' },
      { code: 'quotation:update:own',    label: 'แก้ไขใบเสนอราคา',    desc: 'แก้ไขข้อมูลใบเสนอราคาที่มีอยู่' },
      { code: 'quotation:cancel:own',    label: 'ลบใบเสนอราคา',        desc: 'ลบ/ยกเลิก draft ได้' },
      { code: 'quotation:exportPdf:own', label: 'ส่งออก PDF',           desc: 'ส่งออกใบเสนอราคาเป็น PDF' },
    ],
  },
  {
    group: 'ใบสั่งขาย',
    items: [
      { code: 'quotation:approve:team',  label: 'อนุมัติใบเสนอราคา',   desc: 'อนุมัติได้ไม่เกิน approval limit' },
      { code: 'saleOrder:create:own',    label: 'แปลงเป็นใบสั่งขาย',   desc: 'แปลงใบเสนอราคาเป็น SO' },
      { code: 'saleOrder:exportPdf:own', label: 'ส่งออก PDF ใบสั่งขาย', desc: 'ส่งออก SO เป็น PDF' },
    ],
  },
  {
    group: 'สินค้า',
    items: [
      { code: 'product:viewCost:all',    label: 'ดูต้นทุนสินค้า',       desc: 'ดูราคาทุนภายในได้' },
      { code: 'product:update:all',      label: 'แก้ไขราคามาตรฐาน',     desc: 'เปลี่ยนราคา standard ได้' },
    ],
  },
  {
    group: 'ลูกค้า',
    items: [
      { code: 'customer:create:all',     label: 'เพิ่มลูกค้า',          desc: 'ลงทะเบียนลูกค้าใหม่ได้' },
      { code: 'customer:update:all',     label: 'แก้ไขข้อมูลลูกค้า',    desc: 'แก้ไขข้อมูลติดต่อได้' },
      { code: 'customer:delete:all',     label: 'ลบข้อมูลลูกค้า',        desc: 'ลบรายการลูกค้าได้' },
    ],
  },
  {
    group: 'รายงาน',
    items: [
      { code: 'dashboard:view:own',      label: 'ดูรายงานส่วนตัว',       desc: 'ดูผลงานของตัวเองได้' },
      { code: 'dashboard:view:team',     label: 'ดูรายงานทีม',           desc: 'ดูผลงานสมาชิกในทีม' },
      { code: 'saleOrder:exportPdf:all', label: 'ส่งออกรายงาน',          desc: 'ดาวน์โหลดข้อมูลรายงาน' },
    ],
  },
];

const ALL_CODES = new Set(PERM_GROUPS.flatMap((g) => g.items.map((i) => i.code)));

// ── Role Permission Editor ────────────────────────────────────────────────────
function RolePermissionEditor({ role, onClose, onSaved }: {
  role: RoleInfo;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // initialise from role's current permissions
  useEffect(() => {
    const current = new Set(role.permissions.map((p) => p.permission.code));
    const init: Record<string, boolean> = {};
    PERM_GROUPS.flatMap((g) => g.items).forEach(({ code }) => {
      init[code] = current.has(code);
    });
    setEnabled(init);
    setDirty(false);
  }, [role]);

  const toggle = (code: string) => {
    setEnabled((prev) => ({ ...prev, [code]: !prev[code] }));
    setDirty(true);
  };

  const save = async () => {
    // keep codes NOT in our UI unchanged; only override ones we show
    const existingOther = role.permissions
      .map((p) => p.permission.code)
      .filter((c) => !ALL_CODES.has(c));
    const newCodes = [
      ...existingOther,
      ...Object.entries(enabled).filter(([, v]) => v).map(([c]) => c),
    ];
    setSaving(true);
    try {
      await api.put(`/admin/roles/${role.id}/permissions`, { permissionCodes: newCodes });
      toast.success(`บันทึกสิทธิ์ ${role.nameTh} เรียบร้อย`);
      setDirty(false);
      onSaved();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const enabledCount = Object.values(enabled).filter(Boolean).length;

  return (
    <div className="mt-4 border-t border-border/60 pt-4 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{role.nameTh}</span>
          <Badge variant="outline" className="text-[10px]">{enabledCount} สิทธิ์เปิดอยู่</Badge>
          {dirty && <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">มีการเปลี่ยนแปลง</Badge>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onClose} disabled={saving}>
            <X className="h-3 w-3" />ยกเลิก
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            บันทึก
          </Button>
        </div>
      </div>

      {/* Permission groups */}
      <div className="space-y-4">
        {PERM_GROUPS.map((g) => (
          <div key={g.group}>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 pb-1 border-b border-border/40">
              {g.group}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {g.items.map(({ code, label, desc }) => (
                <button
                  key={code}
                  onClick={() => toggle(code)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all ${
                    enabled[code]
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700'
                      : 'bg-muted/20 border-border/50 hover:bg-muted/40'
                  }`}
                >
                  <div className="min-w-0">
                    <div className={`text-[13px] font-medium leading-tight ${enabled[code] ? 'text-blue-700 dark:text-blue-300' : 'text-foreground'}`}>
                      {label}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{desc}</div>
                  </div>
                  <Switch
                    checked={!!enabled[code]}
                    onCheckedChange={() => toggle(code)}
                    className="ml-3 shrink-0 scale-90"
                    onClick={(e) => e.stopPropagation()}
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Role card (collapsed/expanded) ───────────────────────────────────────────
function RoleCard({ role, accentClass, icon }: {
  role: RoleInfo;
  accentClass: string;
  icon: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<RoleInfo | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const openEditor = async () => {
    if (open) { setOpen(false); return; }
    setLoadingDetail(true);
    try {
      const res = await api.get<ApiResponse<RoleInfo>>(`/admin/roles/${role.id}`);
      setDetail(res.data.data ?? null);
      setOpen(true);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setLoadingDetail(false); }
  };

  const currentGranted = (detail ?? role).permissions.filter((p) => ALL_CODES.has(p.permission.code)).length;

  return (
    <div className={`rounded-2xl border overflow-hidden ${open ? 'border-blue-300 dark:border-blue-700' : 'border-border/60'}`}>
      {/* Top accent bar */}
      <div className={`h-1 w-full ${accentClass}`} />

      {/* Card header — always visible */}
      <button
        onClick={openEditor}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${accentClass.replace('bg-gradient-to-r', 'bg-gradient-to-br')}`}>
            {icon}
          </div>
          <div>
            <div className="font-semibold text-sm">{role.nameTh}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {role._count.users} บัญชี · {currentGranted} สิทธิ์เปิดอยู่
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {loadingDetail && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <span className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-all ${open ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-muted text-muted-foreground border-border/60 hover:border-border'}`}>
            {open ? 'ปิด' : 'แก้ไขสิทธิ์'}
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded editor */}
      {open && detail && (
        <div className="px-4 pb-5">
          <RolePermissionEditor
            role={detail}
            onClose={() => setOpen(false)}
            onSaved={async () => {
              const res = await api.get<ApiResponse<RoleInfo>>(`/admin/roles/${role.id}`);
              setDetail(res.data.data ?? null);
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminSettingsPage() {
  const [settings, setSettings]   = useState<SystemSetting[]>([]);
  const [edited, setEdited]       = useState<Record<string, string>>({});
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [roles, setRoles]         = useState<RoleInfo[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<SystemSetting[]>>('/admin/settings');
      setSettings(res.data.data ?? []);
      setEdited({});
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  };

  const loadRoles = async () => {
    setRolesLoading(true);
    try {
      const res = await api.get<ApiResponse<RoleInfo[]>>('/admin/roles');
      setRoles(res.data.data ?? []);
    } catch { /* roles are optional UI */ }
    finally { setRolesLoading(false); }
  };

  useEffect(() => { load(); loadRoles(); }, []);

  const handleChange = (key: string, value: string) => {
    setEdited((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const updates = Object.entries(edited).map(([key, value]) => ({ key, value }));
    if (updates.length === 0) { toast.info('ไม่มีการเปลี่ยนแปลง'); return; }
    setSaving(true);
    try {
      await api.patch('/admin/settings', { updates });
      toast.success(`บันทึก ${updates.length} การตั้งค่าเรียบร้อย`);
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const HIDDEN_KEYS = new Set(['normal_discount_max', 'special_discount_max', 'vat_enabled', 'vat_rate', 'high_value_threshold']);
  const grouped = settings.reduce((acc, s) => {
    if (HIDDEN_KEYS.has(s.key)) return acc;
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group].push(s);
    return acc;
  }, {} as Record<string, SystemSetting[]>);

  const hasChanges = Object.keys(edited).length > 0;

  // Filter to only Officer and Manager roles
  const officerRole  = roles.find((r) => r.code === 'OFFICER');
  const managerRole  = roles.find((r) => r.code === 'MANAGER');

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6 text-violet-500" />System Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">ตั้งค่าระบบทั้งหมด</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4" />Reset
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            บันทึก {hasChanges && `(${Object.keys(edited).length})`}
          </Button>
        </div>
      </div>

      {/* ── System settings groups ── */}
      {loading ? (
        <div className="space-y-4">{[0,1,2].map((i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : (
        Object.entries(grouped).map(([group, items]) => (
          <Card key={group}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{GROUP_LABELS[group] ?? group}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((s) => {
                const currentValue = edited[s.key] ?? s.value;
                const isChanged = edited[s.key] !== undefined && edited[s.key] !== s.value;
                return (
                  <div key={s.key} className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-3 items-start">
                    <div>
                      <Label className="text-xs font-semibold flex items-center gap-2">
                        {s.label}
                        {isChanged && <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-300">แก้ไขแล้ว</Badge>}
                      </Label>
                      {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
                      <p className="text-[10px] text-muted-foreground font-mono mt-1 opacity-60">key: {s.key}</p>
                    </div>
                    <div>
                      {s.type === 'boolean' ? (
                        <select value={currentValue} onChange={(e) => handleChange(s.key, e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                          <option value="true">เปิด (true)</option>
                          <option value="false">ปิด (false)</option>
                        </select>
                      ) : (
                        <Input
                          type={s.type === 'number' ? 'number' : 'text'}
                          value={currentValue}
                          onChange={(e) => handleChange(s.key, e.target.value)}
                          className={isChanged ? 'border-amber-400' : ''}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}

      {/* ══ Default Role Permissions ══════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-blue-500" />
          <div>
            <h2 className="text-base font-bold">Default Role Permissions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              กำหนดสิทธิ์เริ่มต้นของแต่ละ Role — ผู้ใช้ทุกคนในกลุ่มนี้จะได้รับสิทธิ์ตามที่ตั้งค่า
              (สิทธิ์รายบุคคลยังสามารถปรับได้ในหน้าโปรไฟล์ผู้ใช้)
            </p>
          </div>
        </div>

        {rolesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {officerRole && (
              <RoleCard
                role={officerRole}
                accentClass="bg-gradient-to-r from-blue-500 to-indigo-600"
                icon={<Users className="h-5 w-5 text-white" />}
              />
            )}
            {managerRole && (
              <RoleCard
                role={managerRole}
                accentClass="bg-gradient-to-r from-violet-500 to-purple-600"
                icon={<UserCheck className="h-5 w-5 text-white" />}
              />
            )}
            {!officerRole && !managerRole && !rolesLoading && (
              <div className="col-span-2 text-center py-8 text-muted-foreground text-sm border border-dashed rounded-2xl">
                ไม่พบ Role Officer หรือ Manager ในระบบ
              </div>
            )}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground mt-3 px-1">
          ⚠️ การเปลี่ยนสิทธิ์ Role จะมีผลกับผู้ใช้ทุกคนในกลุ่มนี้ทันที
          ยกเว้นผู้ใช้ที่มีการตั้งค่าสิทธิ์รายบุคคลไว้
        </p>
      </div>
    </div>
  );
}
