'use client';

import { useEffect, useState } from 'react';
import { Hash, RefreshCw, Pencil, Check, X, Loader2, AlertTriangle, ChevronDown, RotateCcw, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '@/lib/api';

interface YearCounter {
  id: string; type: string; year: number; counter: number; updatedAt: string;
}
interface CounterEntry {
  type: string; prefix: string; activeYear: number;
  counters: YearCounter[]; updatedAt: string | null;
}

const TYPE_META: Record<string, { label: string; accent: string; dot: string }> = {
  QT: { label: 'Quotation',  accent: 'from-blue-500 to-indigo-600',   dot: 'bg-blue-500' },
  SO: { label: 'Sale Order', accent: 'from-emerald-500 to-teal-600',  dot: 'bg-emerald-500' },
};

function pad4(n: number) { return String(n).padStart(4, '0'); }

export default function AdminRunningNumbersPage() {
  const [entries, setEntries]   = useState<CounterEntry[]>([]);
  const [loading, setLoading]   = useState(true);

  // Config edit state
  const [editType, setEditType]     = useState<string | null>(null);
  const [cfgPrefix, setCfgPrefix]   = useState('');
  const [cfgYear, setCfgYear]       = useState('');
  const [cfgSaving, setCfgSaving]   = useState(false);

  // Counter reset state
  const [resetKey, setResetKey]     = useState<string | null>(null);
  const [resetVal, setResetVal]     = useState('');
  const [resetSaving, setResetSaving] = useState(false);

  // History expand
  const [histOpen, setHistOpen]     = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/admin/document-counters');
      setEntries(res.data.data ?? []);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // ── helpers ──────────────────────────────────────────────────────
  const livePrefix = (entry: CounterEntry) =>
    editType === entry.type ? (cfgPrefix.trim().toUpperCase() || entry.prefix) : entry.prefix;

  const liveYear = (entry: CounterEntry) => {
    if (editType !== entry.type) return entry.activeYear;
    const y = parseInt(cfgYear);
    return isNaN(y) ? entry.activeYear : y;
  };

  const liveNext = (entry: CounterEntry) => {
    const p = livePrefix(entry);
    const y = liveYear(entry);
    const cnt = entry.counters.find((c) => c.year === y)?.counter ?? 0;
    return `${p}-${y}-${pad4(cnt + 1)}`;
  };

  const yearHint = (entry: CounterEntry) => {
    const newY = parseInt(cfgYear);
    if (isNaN(newY) || newY === entry.activeYear) return null;
    const existing = entry.counters.find((c) => c.year === newY);
    if (existing) return { type: 'continue', text: `กลับไปปี ${newY} — รันต่อจากเลขที่ ${existing.counter} (ถัดไป: ${pad4(existing.counter + 1)})` };
    return { type: 'new', text: `ปีใหม่ ${newY} — เริ่มต้น 0001` };
  };

  // ── config save ───────────────────────────────────────────────────
  const openEdit = (entry: CounterEntry) => {
    setEditType(entry.type);
    setCfgPrefix(entry.prefix);
    setCfgYear(String(entry.activeYear));
    setResetKey(null);
  };

  const saveConfig = async (entry: CounterEntry) => {
    const p = cfgPrefix.trim().toUpperCase();
    const y = parseInt(cfgYear);
    if (!p) { toast.error('กรุณาระบุ Prefix'); return; }
    if (isNaN(y) || y < 2000 || y > 2100) { toast.error('ปีไม่ถูกต้อง'); return; }
    if (p === entry.prefix && y === entry.activeYear) { setEditType(null); return; }
    setCfgSaving(true);
    try {
      await api.patch(`/admin/document-counter-configs/${entry.type}`, { prefix: p, year: y });
      toast.success('บันทึกการตั้งค่าเรียบร้อย');
      setEditType(null);
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setCfgSaving(false); }
  };

  // ── counter reset ─────────────────────────────────────────────────
  const openReset = (c: YearCounter) => {
    setResetKey(`${c.type}-${c.year}`);
    setResetVal(String(c.counter));
    setEditType(null);
  };

  const saveReset = async (c: YearCounter, entry: CounterEntry) => {
    const n = parseInt(resetVal);
    if (isNaN(n) || n < 0) { toast.error('กรุณาระบุตัวเลขที่ถูกต้อง'); return; }
    const next = `${entry.prefix}-${c.year}-${pad4(n + 1)}`;
    if (!confirm(`รีเซ็ต counter ปี ${c.year} เป็น ${n}?\nเลขถัดไปจะเป็น: ${next}`)) return;
    setResetSaving(true);
    try {
      await api.patch('/admin/document-counters', { type: c.type, year: c.year, counter: n });
      toast.success(`รีเซ็ต counter เรียบร้อย`);
      setResetKey(null);
      await load();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setResetSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Hash className="h-6 w-6 text-cyan-500" />
            Running Numbers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">ตั้งค่ารูปแบบเลขเอกสาร Quotation และ Sale Order</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </div>

      {/* ── Info banner ── */}
      <div className="flex gap-3 p-3 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
          <p>เปลี่ยนปีเป็น<strong>ปีใหม่</strong> → เลข 4 หลักเริ่มต้นใหม่ที่ <strong>0001</strong></p>
          <p>เปลี่ยนกลับ<strong>ปีเดิม</strong> → เลขรันต่อจากที่เคยใช้ไปของปีนั้น</p>
        </div>
      </div>

      {/* ── Cards ── */}
      {loading ? (
        <div className="space-y-4">{[0, 1].map((i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}</div>
      ) : (
        entries.map((entry) => {
          const meta         = TYPE_META[entry.type] ?? { label: entry.type, accent: 'from-gray-500 to-gray-600', dot: 'bg-gray-400' };
          const isEdit       = editType === entry.type;
          const activeCtr    = entry.counters.find((c) => c.year === entry.activeYear);
          const histItems    = entry.counters.filter((c) => c.year !== entry.activeYear).sort((a, b) => b.year - a.year);
          const hint         = isEdit ? yearHint(entry) : null;

          return (
            <div key={entry.type} className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">

              {/* Card top gradient bar */}
              <div className={`h-1 w-full bg-gradient-to-r ${meta.accent}`} />

              <div className="p-5 space-y-5">

                {/* ── Title row ── */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                    <span className="font-bold text-base">{meta.label}</span>
                    <span className="text-xs text-muted-foreground">({entry.type})</span>
                  </div>
                  {!isEdit && (
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => openEdit(entry)}>
                      <Pencil className="h-3 w-3" />ตั้งค่า
                    </Button>
                  )}
                </div>

                {/* ── Number format display / edit ── */}
                {isEdit ? (
                  <div className="space-y-4">
                    {/* Segmented editor */}
                    <div className="flex items-end gap-2">
                      {/* Prefix */}
                      <div className="flex-1">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                          Prefix
                        </label>
                        <Input
                          value={cfgPrefix}
                          onChange={(e) => setCfgPrefix(e.target.value.toUpperCase())}
                          placeholder="QT"
                          className="h-11 font-mono font-bold text-base text-center tracking-widest"
                          maxLength={10}
                          autoFocus
                        />
                      </div>

                      <span className="text-2xl text-muted-foreground/50 pb-2 font-light">—</span>

                      {/* Year */}
                      <div className="flex-1">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                          ปี (Year)
                        </label>
                        <Input
                          type="number" min="2000" max="2100"
                          value={cfgYear}
                          onChange={(e) => setCfgYear(e.target.value)}
                          className="h-11 font-mono font-bold text-base text-center"
                        />
                      </div>

                      <span className="text-2xl text-muted-foreground/50 pb-2 font-light">—</span>

                      {/* Sequence (read-only display) */}
                      <div className="flex-1">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                          ลำดับ (Auto)
                        </label>
                        <div className="h-11 flex items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/30 font-mono font-bold text-base text-muted-foreground tracking-widest">
                          {pad4((entry.counters.find((c) => c.year === liveYear(entry))?.counter ?? 0) + 1)}
                        </div>
                      </div>
                    </div>

                    {/* Preview + hint */}
                    <div className={`rounded-xl p-3 border ${hint?.type === 'new' ? 'border-violet-200 bg-violet-50 dark:bg-violet-900/20' : hint?.type === 'continue' ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/20' : 'border-cyan-200 bg-cyan-50 dark:bg-cyan-900/20'}`}>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">เลขถัดไป (Preview)</div>
                      <div className="font-mono text-xl font-bold tracking-wider">{liveNext(entry)}</div>
                      {hint && (
                        <div className={`text-[11px] mt-1.5 font-medium ${hint.type === 'new' ? 'text-violet-600 dark:text-violet-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {hint.type === 'new' ? '✦' : '↩'} {hint.text}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="flex-1 gap-1.5" onClick={() => saveConfig(entry)} disabled={cfgSaving}>
                        {cfgSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        บันทึก
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditType(null)} disabled={cfgSaving}>
                        <X className="h-3.5 w-3.5" />ยกเลิก
                      </Button>
                    </div>
                  </div>

                ) : (
                  /* ── View mode ── */
                  <div className="space-y-3">
                    {/* Big number display */}
                    <div className="rounded-xl bg-muted/30 border border-border/40 px-5 py-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">เลขถัดไป</div>
                        <div className="font-mono text-2xl font-bold tracking-wider">{liveNext(entry)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">ใช้ไปแล้วปี {entry.activeYear}</div>
                        <div className="text-2xl font-bold tabular-nums">{activeCtr?.counter ?? 0}</div>
                        <div className="text-[10px] text-muted-foreground">เลข</div>
                      </div>
                    </div>

                    {/* Format breakdown */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                      <span className="font-mono font-semibold text-foreground bg-muted rounded px-1.5 py-0.5">{entry.prefix}</span>
                      <span className="opacity-50">—</span>
                      <span className="font-mono font-semibold text-foreground bg-muted rounded px-1.5 py-0.5">{entry.activeYear}</span>
                      <span className="opacity-50">—</span>
                      <span className="font-mono font-semibold text-foreground bg-muted rounded px-1.5 py-0.5">NNNN</span>
                      <span className="opacity-40 ml-1">รูปแบบเลขเอกสาร</span>
                    </div>

                    {/* Counter reset row (only if active counter exists) */}
                    {activeCtr && (
                      <div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5 flex items-center justify-between gap-3">
                        <div className="text-xs text-muted-foreground">
                          เลขล่าสุด:{' '}
                          <span className="font-mono font-semibold text-foreground">
                            {entry.prefix}-{entry.activeYear}-{pad4(activeCtr.counter)}
                          </span>
                        </div>

                        {resetKey === `${entry.type}-${entry.activeYear}` ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">ตั้ง counter =</span>
                            <Input
                              type="number" min="0" value={resetVal}
                              onChange={(e) => setResetVal(e.target.value)}
                              className="w-20 h-7 text-xs font-mono text-center" autoFocus
                            />
                            <Button size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => saveReset(activeCtr, entry)} disabled={resetSaving}>
                              {resetSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setResetKey(null)} disabled={resetSaving}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => openReset(activeCtr)}>
                            <RotateCcw className="h-3 w-3" />รีเซ็ต Counter
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── History ── */}
                {histItems.length > 0 && (
                  <div className="border-t border-border/40 pt-3">
                    <button
                      onClick={() => setHistOpen((p) => ({ ...p, [entry.type]: !p[entry.type] }))}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${histOpen[entry.type] ? 'rotate-180' : ''}`} />
                      ประวัติปีก่อน ({histItems.length} ปี)
                    </button>

                    {histOpen[entry.type] && (
                      <div className="mt-2 space-y-1">
                        {histItems.map((c) => {
                          const rKey = `${c.type}-${c.year}`;
                          return (
                            <div key={rKey} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-muted/20 border border-border/30">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="font-mono text-sm font-semibold tabular-nums shrink-0">{c.year}</span>
                                <span className="text-xs text-muted-foreground truncate">
                                  {c.counter} เลข — สุดท้าย{' '}
                                  <span className="font-mono text-foreground">{entry.prefix}-{c.year}-{pad4(c.counter)}</span>
                                </span>
                              </div>

                              {resetKey === rKey ? (
                                <div className="flex items-center gap-1 shrink-0">
                                  <Input type="number" min="0" value={resetVal}
                                    onChange={(e) => setResetVal(e.target.value)}
                                    className="w-16 h-6 text-xs font-mono text-center" autoFocus />
                                  <Button size="sm" className="h-6 w-6 p-0" onClick={() => saveReset(c, entry)} disabled={resetSaving}>
                                    {resetSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setResetKey(null)}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-muted-foreground shrink-0"
                                  onClick={() => openReset(c)}>
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* ── Danger note ── */}
      <div className="flex gap-2.5 p-3 rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-400">
          การรีเซ็ต Counter จะทำให้เลขถัดไปเปลี่ยนแปลง — ทำเฉพาะกรณีที่จำเป็น เช่น แก้ไขเลขที่ผิดพลาด
        </p>
      </div>
    </div>
  );
}
