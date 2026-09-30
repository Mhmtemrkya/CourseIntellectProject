import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarRange, Plus, Trash2, Save } from 'lucide-react';
import { PremiumPanel } from '../../components/ui/premium-dashboard';
import { FeatureGate } from '../../components/FeatureGate';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { fetchClasses, fetchStaff, fetchScheduleEntries, fetchTeacherTimetable, setTeacherTimetable } from '../../lib/api/modules';
import { errorMessage } from '../../lib/errors';
import type { StaffSummaryDto } from '../../types/api/generated';

interface EditableSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  className: string;
  lesson: string;
}

const DAYS = [
  { v: 1, label: 'Pazartesi' }, { v: 2, label: 'Salı' }, { v: 3, label: 'Çarşamba' },
  { v: 4, label: 'Perşembe' }, { v: 5, label: 'Cuma' }, { v: 6, label: 'Cumartesi' }, { v: 7, label: 'Pazar' },
];

// Sistemdeki ders programı saati olmadığında kullanılacak makul varsayılan periyotlar.
const DEFAULT_PERIODS = ['09:00-09:40', '09:50-10:30', '10:40-11:20', '11:30-12:10', '13:00-13:40', '13:50-14:30', '14:40-15:20', '15:30-16:10'];

// Ders programı kaydındaki teacherUserId kullanıcı kimliğidir (nöbet çakışma denetimi
// ve DutyCreate de bununla eşler); personel listesindeki `id` profil kimliğidir.
// Sunucu eşleşmeyi "kimlik ya da ad" ile yaptığından eski kayıtlar da okunur.
function teacherId(t: StaffSummaryDto): string { return String(t.userId || t.id || ''); }
function teacherName(t: StaffSummaryDto): string { return t.fullName || ''; }
const GUID_RE = /^[0-9a-fA-F-]{36}$/;

function toMinutes(time: string | null | undefined): number | null {
  const match = String(time || '').match(/(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

// "09:00-09:40" → { start: "09:00", end: "09:40" }
function splitRange(range: string | null | undefined): { start: string | undefined; end: string | undefined } {
  const [start, end] = String(range || '').split(/[-–]/).map((part) => part.trim());
  return { start, end };
}

export default function TeacherTimetable() {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<StaffSummaryDto[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [timeOptions, setTimeOptions] = useState(DEFAULT_PERIODS);
  const [selectedId, setSelectedId] = useState('');
  const [slots, setSlots] = useState<EditableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [list, classList, scheduleEntries] = await Promise.all([
          fetchStaff('Teacher').catch(() => []),
          fetchClasses().catch(() => []),
          fetchScheduleEntries().catch(() => []),
        ]);
        setTeachers(Array.isArray(list) ? list : []);
        setClasses(Array.isArray(classList) ? classList.filter(Boolean) : []);
        // Sistemdeki ders programında tanımlı saat aralıkları (tekilleştirilmiş, sıralı).
        const fromSchedule = [...new Set((Array.isArray(scheduleEntries) ? scheduleEntries : [])
          .map((entry) => String(entry.time || '').trim())
          .filter((value) => /\d{1,2}:\d{2}/.test(value)))]
          .sort((a, b) => (toMinutes(a) ?? 0) - (toMinutes(b) ?? 0));
        setTimeOptions(fromSchedule.length > 0 ? fromSchedule : DEFAULT_PERIODS);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedTeacher = useMemo(() => teachers.find((t) => teacherId(t) === selectedId), [teachers, selectedId]);
  const lessonOptions = useMemo(() => {
    const branch = selectedTeacher?.departmentOrBranch || '';
    const options = [branch, selectedTeacher?.homeroomClass ? 'Rehberlik' : ''].filter(Boolean);
    return [...new Set(options)];
  }, [selectedTeacher]);
  const classOptions = useMemo(() => [...new Set([...classes, ...slots.map((slot) => slot.className).filter(Boolean)])], [classes, slots]);
  const defaultLesson = lessonOptions[0] || '';

  const loadSlots = useCallback(async (teacher: StaffSummaryDto | undefined) => {
    if (!teacher) { setSlots([]); return; }
    try {
      setSlotsLoading(true);
      const id = teacherId(teacher);
      const params = GUID_RE.test(id) ? { teacherUserId: id } : { teacherName: teacherName(teacher) };
      const data = await fetchTeacherTimetable(params);
      setSlots((data || []).map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, className: s.className || '', lesson: s.lesson || '' })));
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => { if (selectedTeacher) void loadSlots(selectedTeacher); }, [selectedTeacher, loadSlots]);

  const addSlot = () => {
    const firstRange = splitRange(timeOptions[0] || '09:00-09:40');
    setSlots((prev) => [...prev, { dayOfWeek: 1, startTime: firstRange.start || '09:00', endTime: firstRange.end || '09:40', className: classOptions[0] || '', lesson: defaultLesson }]);
  };
  const removeSlot = (idx: number) => setSlots((prev) => prev.filter((_, i) => i !== idx));
  const updateSlot = (idx: number, patch: Partial<EditableSlot>) => setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  // Aynı gün içinde saat çakışan slot çiftini bul (varsa).
  const findConflict = (list: readonly EditableSlot[]) => {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        if (!a || !b || a.dayOfWeek !== b.dayOfWeek) continue;
        const startA = toMinutes(a.startTime);
        const endA = toMinutes(a.endTime);
        const startB = toMinutes(b.startTime);
        const endB = toMinutes(b.endTime);
        if (startA == null || endA == null || startB == null || endB == null) continue;
        if (startA < endB && startB < endA) {
          const dayLabel = DAYS.find((d) => d.v === a.dayOfWeek)?.label || '';
          return `${dayLabel} günü ${a.startTime}-${a.endTime} ile ${b.startTime}-${b.endTime} dersleri çakışıyor.`;
        }
      }
    }
    return null;
  };

  const handleSave = async () => {
    if (!selectedTeacher) { toast({ title: 'Öğretmen seçin', variant: 'destructive' }); return; }
    for (const s of slots) {
      if (s.endTime <= s.startTime) { toast({ title: 'Geçersiz saat', description: 'Bitiş başlangıçtan sonra olmalı.', variant: 'destructive' }); return; }
    }
    const conflict = findConflict(slots);
    if (conflict) {
      toast({ title: 'Çakışma var', description: `${conflict} Öğretmen aynı saatte birden fazla derse giremez.`, variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const id = teacherId(selectedTeacher);
      await setTeacherTimetable({
        teacherUserId: GUID_RE.test(id) ? id : null,
        teacherName: teacherName(selectedTeacher),
        slots: slots.map((s) => ({ dayOfWeek: Number(s.dayOfWeek), startTime: s.startTime, endTime: s.endTime, className: s.className, lesson: s.lesson })),
      });
      toast({ title: 'Ders programı kaydedildi', description: `${slots.length} slot · ${teacherName(selectedTeacher)}` });
    } catch (err) {
      toast({ title: 'Kaydedilemedi', description: errorMessage(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4"><LoadingDots /><p className="text-muted-foreground">Yükleniyor...</p></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5" data-testid="teacher-timetable-page">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[hsl(var(--brand-accent)/0.14)] text-[hsl(var(--brand-accent))]"><CalendarRange className="h-6 w-6" /></div>
        <div>
          <h1 className="text-xl font-black tracking-tight text-[hsl(var(--brand-accent))]">Öğretmen Ders Programı</h1>
          <p className="text-sm text-muted-foreground">Haftalık ders saatleri; nöbet atamasında ders-saati çakışması bunlarla denetlenir.</p>
        </div>
      </div>

      <PremiumPanel title="Öğretmen Seç" description="Programını düzenlemek için öğretmen seçin">
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-full sm:w-96"><SelectValue placeholder="Öğretmen seçin" /></SelectTrigger>
          <SelectContent>
            {teachers.map((t) => <SelectItem key={teacherId(t)} value={teacherId(t)}>{teacherName(t)}{t.departmentOrBranch ? ` · ${t.departmentOrBranch}` : ''}</SelectItem>)}
          </SelectContent>
        </Select>
      </PremiumPanel>

      {selectedTeacher ? (
        <PremiumPanel
          title="Haftalık Program"
          description={`${teacherName(selectedTeacher)} · ${slots.length} ders saati`}
          action={<FeatureGate module="duties" action="create"><Button variant="outline" size="sm" onClick={addSlot}><Plus className="h-4 w-4 mr-1" /> Ders Ekle</Button></FeatureGate>}
          contentClassName="space-y-3"
        >
          {slotsLoading ? (
            <div className="flex justify-center py-6"><LoadingDots /></div>
          ) : slots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-foreground/10 p-8 text-center text-sm text-muted-foreground">Ders saati yok. "Ders Ekle" ile başla.</div>
          ) : slots.map((s, idx) => (
            <div key={idx} className="grid grid-cols-2 items-end gap-2 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 sm:grid-cols-[1.4fr_1.4fr_1fr_1fr_auto]">
              <div>
                <Label className="text-xs">Gün</Label>
                <Select value={String(s.dayOfWeek)} onValueChange={(v) => updateSlot(idx, { dayOfWeek: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DAYS.map((d) => <SelectItem key={d.v} value={String(d.v)}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Ders Saati</Label>
                <Select
                  value={`${s.startTime}-${s.endTime}`}
                  onValueChange={(v) => { const r = splitRange(v); updateSlot(idx, { startTime: r.start, endTime: r.end }); }}
                >
                  <SelectTrigger><SelectValue placeholder="Saat seç" /></SelectTrigger>
                  <SelectContent>
                    {[...new Set([...timeOptions, `${s.startTime}-${s.endTime}`])].map((range) => (
                      <SelectItem key={range} value={range}>{range}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Sınıf</Label>
                {classOptions.length > 0 ? (
                  <Select value={s.className || classOptions[0]} onValueChange={(v) => updateSlot(idx, { className: v })}>
                    <SelectTrigger><SelectValue placeholder="Sınıf seç" /></SelectTrigger>
                    <SelectContent>{classOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input value={s.className} onChange={(e) => updateSlot(idx, { className: e.target.value })} placeholder="9/A" />
                )}
              </div>
              <div>
                <Label className="text-xs">Ders</Label>
                {lessonOptions.length > 0 ? (
                  <Select value={s.lesson || defaultLesson} onValueChange={(v) => updateSlot(idx, { lesson: v })}>
                    <SelectTrigger><SelectValue placeholder="Ders seç" /></SelectTrigger>
                    <SelectContent>{lessonOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input value={s.lesson} onChange={(e) => updateSlot(idx, { lesson: e.target.value })} placeholder="Matematik" />
                )}
              </div>
              <button onClick={() => removeSlot(idx)} className="grid h-10 w-10 place-items-center rounded-lg border border-foreground/10 text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving} className="bg-[hsl(var(--brand-accent))] font-bold text-white hover:bg-[hsl(var(--brand-accent-hover))]">
              <Save className="h-4 w-4 mr-1.5" /> {saving ? 'Kaydediliyor...' : 'Programı Kaydet'}
            </Button>
          </div>
        </PremiumPanel>
      ) : null}
    </motion.div>
  );
}
