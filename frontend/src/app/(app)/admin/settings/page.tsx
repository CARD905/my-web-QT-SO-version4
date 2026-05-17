'use client';

import { useEffect, useState } from 'react';
import { Settings, Save, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';
import type { ApiResponse } from '@/types/api';

interface SystemSetting {
  key: string; value: string; type: string;
  group: string; label: string; description?: string;
}

const GROUP_LABELS: Record<string, string> = {
  general: '⚙️ General',
  vat: '🧾 VAT',
  approval: '✅ Approval',
  numbering: '🔢 Running Number',
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<SystemSetting[]>>('/admin/settings');
      setSettings(res.data.data ?? []);
      setEdited({});
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

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

  // Group settings
  const grouped = settings.reduce((acc, s) => {
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group].push(s);
    return acc;
  }, {} as Record<string, SystemSetting[]>);

  const hasChanges = Object.keys(edited).length > 0;

  return (
    <div className="space-y-6 max-w-4xl">
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
    </div>
  );
}