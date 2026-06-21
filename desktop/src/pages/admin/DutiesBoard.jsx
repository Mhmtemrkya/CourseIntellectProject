import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck, CheckCircle2, XCircle, Trash2, Pencil, Layers,
} from 'lucide-react';
import { PremiumPanel } from '../../components/ui/premium-dashboard';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { useToast } from '../../hooks/use-toast';
import {
  fetchDuties, fetchDutyLoad, setDutyStatus, deleteDuty, cancelDutySeries, updateDuty,
} from '../../lib/api/modules';

const DUTY_TYPES = ['Tümü', 'Sabah Nöbeti', 'Öğle Arası', 'İdari Nöbet', 'Diğer'];
const TYPE_COLOR = { 'Sabah Nöbeti': '#f97316', 'Öğle Arası': '#3b82f6', 'İdari Nöbet': '#a855f7' };
const typeColor = (t) => TYPE_COLOR[t] || '#94a3b8';

function statusInfo(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('iptal')) return { label: 'İptal Edildi', cls: 'border-rose-500/30 bg-rose-500/12 text-rose-300' };
  if (s.includes('tamam')) return { label: 'Tamamlandı', cls: 'border-emerald-500/30 bg-emerald-500/12 text-emerald-300' };
  return { label: 'Planlandı', cls: 'border-sky-500/25 bg-sky-500/12 text-sky-300' };
}

function fmtDate(value) {
  const d = value ? new Date(value) : null;
  return d ? d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'short' }) : '—';
}
function isoDay(value) {
  const d = value ? new Date(value) : null;
  return d ? d.toISOString().slice(0, 10) : '';
}

export default function DutiesBoard() {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(in14);
  const [dutyType, setDutyType] = useState('Tümü');
  const [duties, setDuties] = useState([]);
  const [load, setLoad] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = { from, to };
      if (dutyType !== 'Tümü') params.dutyType = dutyType;
      const [list, loadList] = await Promise.all([
        fetchDuties(params),
        fetchDutyLoad().catch(() => []),
      ]);
      setDuties(Array.isArray(list) ? list : []);
      setLoad(Array.isArray(loadList) ? loadList : []);
    } catch (err) {
      setError(err.message || 'Nöbetler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [from, to, dutyType]);

  useEffect(() => { reload(); }, [reload]);

  const grouped = useMemo(() => {
    const map = new Map();
    duties.forEach((d) => {
      const key = isoDay(d.dutyDateUtc);
      const list = map.get(key) || [];
      list.push(d);
      map.set(key, list);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [duties]);

  // Aralıktaki nöbetçisiz (boş) günler.
  const emptyDays = useMemo(() => {
    const have = new Set(duties.filter((d) => !String(d.status).toLowerCase().includes('iptal')).map((d) => isoDay(d.dutyDateUtc)));
    const days = [];
    const start = new Date(from);
    const end = new Date(to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      if (!have.has(iso)) days.push(iso);
    }
    return days;
  }, [duties, from, to]);

  const act = async (fn, successMsg) => {
    try {
      setBusy(true);
      await fn();
      toast({ title: successMsg });
      await reload();
    } catch (err) {
      toast({ title: 'İşlem başarısız', description: err?.response?.data?.message || err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (editing.endTime <= editing.startTime) {
      toast({ title: 'Geçersiz saat', description: 'Bitiş başlangıçtan sonra olmalı.', variant: 'destructive' });
      return;
    }
    await act(() => updateDuty(editing.id, {
      dutyType: editing.dutyType,
      location: editing.location,
      dutyDate: new Date(`${editing.date}T00:00:00Z`).toISOString(),
      day: editing.day,
      startTime: editing.startTime,
      endTime: editing.endTime,
      description: editing.description || '',
    }), 'Nöbet güncellendi');
    setEditing(null);
  };

  if (loading) {
    return <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4"><LoadingDots /><p className="text-muted-foreground">Nöbetler yükleniyor...</p></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5" data-testid="duties-board-page">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[hsl(var(--brand-accent)/0.14)] text-[hsl(var(--brand-accent))]"><ShieldCheck className="h-6 w-6" /></div>
        <div>
          <h1 className="text-xl font-black tracking-tight text-[hsl(var(--brand-accent))]">Tüm Nöbetler</h1>
          <p className="text-sm text-muted-foreground">Nöbet çizelgesini yönet, denge ve boş günleri izle.</p>
        </div>
      </div>

      {error ? <ErrorBanner title="Nöbetler alınamadı" message={error} onRetry={reload} /> : null}

      <div className="flex flex-wrap items-end gap-3">
        <div><Label className="text-xs">Başlangıç</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" /></div>
        <div><Label className="text-xs">Bitiş</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" /></div>
        <div>
          <Label className="text-xs">Tür</Label>
          <Select value={dutyType} onValueChange={setDutyType}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{DUTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <PremiumPanel title="Nöbet Çizelgesi" description={`${duties.length} nöbet · ${grouped.length} gün`} contentClassName="space-y-4">
            {grouped.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-foreground/10 p-8 text-center text-sm text-muted-foreground">Bu aralıkta nöbet yok.</div>
            ) : grouped.map(([day, items]) => (
              <div key={day}>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{fmtDate(items[0].dutyDateUtc)}</p>
                <div className="space-y-2">
                  {items.map((d) => {
                    const st = statusInfo(d.status);
                    return (
                      <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: typeColor(d.dutyType) }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{d.teacherName} <span className="font-normal text-muted-foreground">· {d.dutyType}</span></p>
                          <p className="truncate text-xs text-muted-foreground">{d.location} · {d.startTime}-{d.endTime}</p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                        <div className="flex shrink-0 items-center gap-1">
                          <button title="Düzenle" disabled={busy} onClick={() => setEditing({ ...d, date: isoDay(d.dutyDateUtc) })} className="grid h-8 w-8 place-items-center rounded-lg border border-foreground/10 text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                          <button title="Tamamlandı" disabled={busy} onClick={() => act(() => setDutyStatus(d.id, 'Tamamlandı'), 'Tamamlandı olarak işaretlendi')} className="grid h-8 w-8 place-items-center rounded-lg border border-foreground/10 text-emerald-400 hover:bg-emerald-500/10"><CheckCircle2 className="h-4 w-4" /></button>
                          <button title="İptal et" disabled={busy} onClick={() => act(() => setDutyStatus(d.id, 'İptal Edildi'), 'Nöbet iptal edildi')} className="grid h-8 w-8 place-items-center rounded-lg border border-foreground/10 text-amber-400 hover:bg-amber-500/10"><XCircle className="h-4 w-4" /></button>
                          <button title="Seriyi iptal et" disabled={busy} onClick={() => act(() => cancelDutySeries(d.groupId), 'Seri iptal edildi')} className="grid h-8 w-8 place-items-center rounded-lg border border-foreground/10 text-muted-foreground hover:text-foreground"><Layers className="h-4 w-4" /></button>
                          <button title="Sil" disabled={busy} onClick={() => act(() => deleteDuty(d.id), 'Nöbet silindi')} className="grid h-8 w-8 place-items-center rounded-lg border border-foreground/10 text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </PremiumPanel>
        </div>

        <div className="space-y-5">
          <PremiumPanel title="Öğretmen Yükü" description="Bu ay nöbet sayıları (denge)">
            {load.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Kayıt yok.</p>
            ) : (
              <div className="space-y-2">
                {load.map((row) => (
                  <div key={row.teacherName} className="flex items-center justify-between rounded-xl border border-foreground/10 bg-foreground/[0.035] px-3 py-2">
                    <span className="truncate text-sm">{row.teacherName}</span>
                    <span className="rounded-full bg-[hsl(var(--brand-accent)/0.14)] px-2.5 py-0.5 text-xs font-bold text-[hsl(var(--brand-accent))]">{row.count}</span>
                  </div>
                ))}
              </div>
            )}
          </PremiumPanel>

          <PremiumPanel title="Boş Günler" description="Seçili aralıkta nöbetçisiz günler">
            {emptyDays.length === 0 ? (
              <p className="py-4 text-center text-sm text-emerald-400">Tüm günler kapsanmış.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {emptyDays.map((iso) => (
                  <span key={iso} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
                    {new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                  </span>
                ))}
              </div>
            )}
          </PremiumPanel>
        </div>
      </div>

      {/* Düzenle dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nöbet Düzenle</DialogTitle></DialogHeader>
          {editing ? (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tür</Label>
                <Select value={editing.dutyType} onValueChange={(v) => setEditing((p) => ({ ...p, dutyType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DUTY_TYPES.filter((t) => t !== 'Tümü').map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Yer</Label><Input value={editing.location} onChange={(e) => setEditing((p) => ({ ...p, location: e.target.value }))} /></div>
              <div><Label>Tarih</Label><Input type="date" value={editing.date} onChange={(e) => setEditing((p) => ({ ...p, date: e.target.value }))} /></div>
              <div><Label>Gün</Label><Input value={editing.day} onChange={(e) => setEditing((p) => ({ ...p, day: e.target.value }))} /></div>
              <div><Label>Başlangıç</Label><Input type="time" value={editing.startTime} onChange={(e) => setEditing((p) => ({ ...p, startTime: e.target.value }))} /></div>
              <div><Label>Bitiş</Label><Input type="time" value={editing.endTime} onChange={(e) => setEditing((p) => ({ ...p, endTime: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Açıklama</Label><Textarea rows={2} value={editing.description || ''} onChange={(e) => setEditing((p) => ({ ...p, description: e.target.value }))} /></div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>İptal</Button>
            <Button onClick={saveEdit} disabled={busy}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
