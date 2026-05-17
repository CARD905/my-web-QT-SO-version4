'use client';

import { useEffect, useState } from 'react';
import { FileText, RefreshCw, Edit2, Save, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';

interface DocumentCounter {
  id: string; type: string; year: number; counter: number; updatedAt: string;
}

export default function AdminRunningNumbersPage() {
  const [counters, setCounters] = useState<DocumentCounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null); // `${type}-${year}`
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/admin/document-counters');
      setCounters(res.data.data ?? []);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleEdit = (counter: DocumentCounter) => {
    setEditing(`${counter.type}-${counter.year}`);
    setEditValue(String(counter.counter));
  };

  const handleSave = async (counter: DocumentCounter) => {
    const newCounter = parseInt(editValue);
    if (isNaN(newCounter) || newCounter < 0) { toast.error('กรุณาระบุตัวเลขที่ถูกต้อง'); return; }
    if (!confirm(`ยืนยันรีเซ็ต ${counter.type}-${counter.year} เป็น ${newCounter}?\n\nเลขถัดไปจะเป็น ${counter.type}-${counter.year}-${String(newCounter + 1).padStart(4, '0')}`)) return;
    setSaving(true);
    try {
      await api.patch('/admin/document-counters', {
        type: counter.type, year: counter.year, counter: newCounter,
      });
      toast.success(`รีเซ็ต ${counter.type}-${counter.year} เป็น ${newCounter} เรียบร้อย`);
      setEditing(null);
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setSaving(false); }
  };

  // Group by type
  const grouped = counters.reduce((acc, c) => {
    if (!acc[c.type]) acc[c.type] = [];
    acc[c.type].push(c);
    return acc;
  }, {} as Record<string, DocumentCounter[]>);

  const TYPE_COLOR: Record<string, string> = {
    QT: 'bg-blue-100 text-blue-700 border-blue-300',
    SO: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-cyan-500" />Running Numbers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ดูและแก้ไข document counter สำหรับ Quotation และ Sale Order
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4" />Refresh
        </Button>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 dark:text-amber-300">
          การแก้ไข counter จะทำให้เลขเอกสารถัดไปเปลี่ยนแปลง
          ควรทำเฉพาะกรณีที่จำเป็น เช่น ต้องการรีเซ็ตต้นปี หรือแก้ไขเลขที่ผิดพลาด
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">{[0,1].map((i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground text-sm">
            ยังไม่มี document counter — จะถูกสร้างอัตโนมัติเมื่อสร้างเอกสารแรก
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([type, items]) => (
          <Card key={type}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Badge variant="outline" className={TYPE_COLOR[type] ?? 'bg-gray-100 text-gray-700 border-gray-300'}>
                  {type}
                </Badge>
                Document Counter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.sort((a, b) => b.year - a.year).map((counter) => {
                const key = `${counter.type}-${counter.year}`;
                const isEditing = editing === key;
                const nextNo = `${counter.type}-${counter.year}-${String(counter.counter + 1).padStart(4, '0')}`;
                return (
                  <div key={key} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{counter.year}</span>
                        <Badge variant="outline" className="text-[10px]">
                          ใช้ไปแล้ว {counter.counter} เลข
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        เลขถัดไป: <span className="font-mono font-semibold text-foreground">{nextNo}</span>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-xs text-muted-foreground">Counter =</div>
                        <Input
                          type="number" min="0" value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-24 h-8 text-sm font-mono"
                          autoFocus
                        />
                        <Button size="sm" className="h-8 text-xs" onClick={() => handleSave(counter)} disabled={saving}>
                          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          บันทึก
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditing(null)} disabled={saving}>
                          ยกเลิก
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={() => handleEdit(counter)}>
                        <Edit2 className="h-3 w-3" />แก้ไข
                      </Button>
                    )}
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