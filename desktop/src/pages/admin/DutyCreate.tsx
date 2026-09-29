import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  CalendarPlus, Search, ChevronRight, ChevronLeft, X, Save,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { PremiumPanel } from '../../components/ui/premium-dashboard';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { fetchStaff, createDuty } from '../../lib/api/modules';

const DUTY_TYPES = ['Sabah Nöbeti', 'Öğle Arası', 'İdari Nöbet', 'Diğer'];
const LOCATIONS = [
  'A Blok - Zemin Kat', 'A Blok - 1. Kat', 'A Blok - 2. Kat',
  'B Blok - Zemin Kat', 'B Blok - 1. Kat', 'B Blok - 2. Kat',
  'Bahçe Alanı', 'Yemekhane', 'Giriş Kapısı', 'Kütüphane',
];
const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function teacherId(t) {
  return String(t.id || t.userId || t.staffUserId || t.fullName || t.name || '');
}
function teacherName(t) {
  return t.fullName || t.name || t.staffName || '';
}
function teacherBranch(t) {
  return t.branch || t.subject || t.title || t.role || '';
}
function teacherUsername(t) {
  return t.username || t.userName || t.staffUsername || '';
}
const GUID_RE = /^[0-9a-fA-F-]{36}$/;
function initials(name) {
  return String(name || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
}

const emptyForm = {
  dutyType: 'Sabah Nöbeti',
  location: 'A Blok - Zemin Kat',
  date: new Date().toISOString().slice(0, 10),
  startTime: '07:30',
  endTime: '08:00',
  description: '',
};

export default function DutyCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState('4');
  const [staged, setStaged] = useState(() => new Set()); // sol listede işaretliler
  const [selected, setSelected] = useState([]); // seçilen öğretmenler

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await fetchStaff('Teacher').catch(() => []);
      setTeachers(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const day = useMemo(() => {
    const d = new Date(form.date);
    return Number.isNaN(d.getTime()) ? '' : DAYS[d.getDay()];
  }, [form.date]);

  const selectedIds = useMemo(() => new Set(selected.map((t) => teacherId(t))), [selected]);
  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers.filter((t) => !selectedIds.has(teacherId(t)) && (!q || teacherName(t).toLowerCase().includes(q) || teacherBranch(t).toLowerCase().includes(q)));
  }, [teachers, search, selectedIds]);

  const toggleStaged = (id) => {
    setStaged((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const moveSelected = () => {
    const toAdd = teachers.filter((t) => staged.has(teacherId(t)) && !selectedIds.has(teacherId(t)));
    if (toAdd.length === 0) return;
    setSelected((prev) => [...prev, ...toAdd]);
    setStaged(new Set());
  };

  const removeSelected = (id) => {
    setSelected((prev) => prev.filter((t) => teacherId(t) !== id));
  };

  const handleSave = async () => {
    if (!form.dutyType || !form.location || !form.date || !form.startTime || !form.endTime) {
      toast({ title: 'Eksik bilgi', description: 'Tür, yer, tarih ve saat zorunludur.', variant: 'destructive' });
      return;
    }
    if (form.endTime <= form.startTime) {
      toast({ title: 'Geçersiz saat', description: 'Bitiş saati başlangıçtan sonra olmalıdır.', variant: 'destructive' });
      return;
    }
    if (form.date < new Date().toISOString().slice(0, 10)) {
      toast({ title: 'Geçersiz tarih', description: 'Geçmiş bir tarihe nöbet oluşturulamaz.', variant: 'destructive' });
      return;
    }
    if (selected.length === 0) {
      toast({ title: 'Öğretmen seçilmedi', description: 'En az bir öğretmen seçin.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const result = await createDuty({
        dutyType: form.dutyType,
        location: form.location,
        dutyDate: new Date(`${form.date}T00:00:00Z`).toISOString(),
        day,
        startTime: form.startTime,
        endTime: form.endTime,
        description: form.description.trim(),
        repeatWeekly,
        repeatWeeks: repeatWeekly ? Math.max(1, Math.min(20, Number(repeatWeeks) || 1)) : 1,
        teachers: selected.map((t) => ({
          teacherUserId: GUID_RE.test(teacherId(t)) ? teacherId(t) : null,
          teacherName: teacherName(t),
          teacherUsername: teacherUsername(t),
          teacherBranch: teacherBranch(t),
        })),
      });
      const created = Array.isArray(result?.created) ? result.created.length : 0;
      const conflicts = Array.isArray(result?.conflicts) ? result.conflicts.length : 0;
      toast({
        title: 'Nöbet oluşturuldu',
        description: `${created} nöbet atandı${conflicts > 0 ? ` · ${conflicts} çakışma atlandı` : ''}.`,
        variant: conflicts > 0 ? 'default' : undefined,
      });
      setForm(emptyForm);
      setSelected([]);
      setStaged(new Set());
      setRepeatWeekly(false);
    } catch (err) {
      toast({ title: 'Nöbet oluşturulamadı', description: err?.response?.data?.message || err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4"><LoadingDots /><p className="text-muted-foreground">Yükleniyor...</p></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5" data-testid="duty-create-page">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[hsl(var(--brand-accent)/0.14)] text-[hsl(var(--brand-accent))]"><CalendarPlus className="h-6 w-6" /></div>
        <div>
          <h1 className="text-xl font-black tracking-tight text-[hsl(var(--brand-accent))]">Nöbet Oluştur</h1>
          <p className="text-sm text-muted-foreground">Yeni nöbet oluşturun ve öğretmenlere atayın.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Nöbet Bilgileri */}
        <PremiumPanel title="Nöbet Bilgileri" description="Nöbet zamanı ve yeri">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nöbet Türü *</Label>
              <Select value={form.dutyType} onValueChange={(v) => setForm((p) => ({ ...p, dutyType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DUTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nöbet Yeri *</Label>
              <Select value={form.location} onValueChange={(v) => setForm((p) => ({ ...p, location: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LOCATIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tarih *</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <Label>Gün</Label>
              <Input value={day} readOnly className="bg-muted/40 cursor-not-allowed" />
            </div>
            <div>
              <Label>Başlangıç Saati *</Label>
              <Input type="time" value={form.startTime} onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))} />
            </div>
            <div>
              <Label>Bitiş Saati *</Label>
              <Input type="time" value={form.endTime} onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>Açıklama</Label>
              <Textarea
                rows={4}
                maxLength={250}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Nöbet ile ilgili açıklama..."
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">{form.description.length} / 250</p>
            </div>
            <div className="col-span-2 rounded-xl border border-foreground/10 bg-foreground/[0.035] p-3">
              <label className="flex cursor-pointer items-center gap-2.5">
                <Checkbox checked={repeatWeekly} onCheckedChange={(v) => setRepeatWeekly(Boolean(v))} />
                <span className="text-sm font-medium">Haftalık tekrarla</span>
              </label>
              {repeatWeekly ? (
                <div className="mt-3 flex items-center gap-2">
                  <Label className="text-xs">Kaç hafta?</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={repeatWeeks}
                    onChange={(e) => setRepeatWeeks(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">Aynı gün ({day}) {repeatWeeks || 1} hafta boyunca atanır.</span>
                </div>
              ) : null}
            </div>
          </div>
        </PremiumPanel>

        {/* Öğretmen Seçimi */}
        <PremiumPanel title="Öğretmen Seçimi" description={`${selected.length} öğretmen seçildi`}>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
            {/* Sol: ekle */}
            <div className="min-w-0">
              <Label>Öğretmen Ekle</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Öğretmen ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-xl border border-foreground/10 p-1">
                {available.length === 0 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">Öğretmen bulunamadı.</p>
                ) : available.map((t) => {
                  const id = teacherId(t);
                  return (
                    <label key={id} className="flex cursor-pointer items-center gap-2.5 rounded-lg p-2 hover:bg-foreground/[0.05]">
                      <Checkbox checked={staged.has(id)} onCheckedChange={() => toggleStaged(id)} />
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-foreground/[0.06] text-[11px] font-bold">{initials(teacherName(t))}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{teacherName(t)}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{teacherBranch(t)}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Orta: oklar */}
            <div className="flex flex-col items-center justify-center gap-2">
              <button type="button" onClick={moveSelected} title="Ekle" className="grid h-9 w-9 place-items-center rounded-xl border border-foreground/10 text-muted-foreground hover:border-[hsl(var(--brand-accent)/0.4)] hover:text-[hsl(var(--brand-accent))]"><ChevronRight className="h-4 w-4" /></button>
              <button type="button" onClick={() => { setSelected([]); setStaged(new Set()); }} title="Tümünü kaldır" className="grid h-9 w-9 place-items-center rounded-xl border border-foreground/10 text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
            </div>

            {/* Sağ: seçilenler */}
            <div className="min-w-0">
              <Label>Seçilen Öğretmenler ({selected.length})</Label>
              <div className="mt-1 max-h-[336px] space-y-1.5 overflow-y-auto rounded-xl border border-foreground/10 p-1.5">
                {selected.length === 0 ? (
                  <p className="p-6 text-center text-xs text-muted-foreground">Henüz öğretmen seçilmedi.</p>
                ) : selected.map((t) => {
                  const id = teacherId(t);
                  return (
                    <div key={id} className="flex items-center gap-2.5 rounded-lg border border-foreground/10 bg-foreground/[0.035] p-2">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-[hsl(var(--brand-accent)/0.14)] text-[11px] font-bold text-[hsl(var(--brand-accent))]">{initials(teacherName(t))}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{teacherName(t)}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{teacherBranch(t)}</span>
                      </span>
                      <button type="button" onClick={() => removeSelected(id)} className="text-muted-foreground hover:text-rose-400"><X className="h-4 w-4" /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </PremiumPanel>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>İptal</Button>
        <Button onClick={handleSave} disabled={saving} className="bg-[hsl(var(--brand-accent))] font-bold text-white hover:bg-[hsl(var(--brand-accent-hover))]">
          <Save className="mr-1.5 h-4 w-4" /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </Button>
      </div>
    </motion.div>
  );
}
