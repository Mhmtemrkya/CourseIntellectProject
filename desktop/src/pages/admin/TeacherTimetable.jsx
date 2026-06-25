import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarRange, Plus, Trash2, Save } from 'lucide-react';
import { PremiumPanel } from '../../components/ui/premium-dashboard';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { fetchClasses, fetchStaff, fetchTeacherTimetable, setTeacherTimetable } from '../../lib/api/modules';

const DAYS = [
  { v: 1, label: 'Pazartesi' }, { v: 2, label: 'Salı' }, { v: 3, label: 'Çarşamba' },
  { v: 4, label: 'Perşembe' }, { v: 5, label: 'Cuma' }, { v: 6, label: 'Cumartesi' }, { v: 7, label: 'Pazar' },
];

function teacherId(t) { return String(t.id || t.userId || ''); }
function teacherName(t) { return t.fullName || t.name || ''; }
function className(item) { return typeof item === 'string' ? item : (item.name || item.className || item.title || ''); }
const GUID_RE = /^[0-9a-fA-F-]{36}$/;

export default function TeacherTimetable() {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [list, classList] = await Promise.all([
          fetchStaff('Teacher').catch(() => []),
          fetchClasses().catch(() => []),
        ]);
        setTeachers(Array.isArray(list) ? list : []);
        setClasses(Array.isArray(classList) ? classList.map(className).filter(Boolean) : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedTeacher = useMemo(() => teachers.find((t) => teacherId(t) === selectedId), [teachers, selectedId]);
  const lessonOptions = useMemo(() => {
    const branch = selectedTeacher?.departmentOrBranch || selectedTeacher?.branch || '';
    const options = [branch, selectedTeacher?.homeroomClass ? 'Rehberlik' : ''].filter(Boolean);
    return [...new Set(options)];
  }, [selectedTeacher]);
  const classOptions = useMemo(() => [...new Set([...classes, ...slots.map((slot) => slot.className).filter(Boolean)])], [classes, slots]);
  const defaultLesson = lessonOptions[0] || '';

  const loadSlots = useCallback(async (teacher) => {
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

  useEffect(() => { if (selectedTeacher) loadSlots(selectedTeacher); }, [selectedTeacher, loadSlots]);

  const addSlot = () => setSlots((prev) => [...prev, { dayOfWeek: 1, startTime: '09:00', endTime: '09:40', className: classOptions[0] || '', lesson: defaultLesson }]);
  const removeSlot = (idx) => setSlots((prev) => prev.filter((_, i) => i !== idx));
  const updateSlot = (idx, patch) => setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const handleSave = async () => {
    if (!selectedTeacher) { toast({ title: 'Öğretmen seçin', variant: 'destructive' }); return; }
    for (const s of slots) {
      if (s.endTime <= s.startTime) { toast({ title: 'Geçersiz saat', description: 'Bitiş başlangıçtan sonra olmalı.', variant: 'destructive' }); return; }
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
      toast({ title: 'Kaydedilemedi', description: err?.response?.data?.message || err.message, variant: 'destructive' });
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
            {teachers.map((t) => <SelectItem key={teacherId(t)} value={teacherId(t)}>{teacherName(t)}{t.departmentOrBranch || t.branch ? ` · ${t.departmentOrBranch || t.branch}` : ''}</SelectItem>)}
          </SelectContent>
        </Select>
      </PremiumPanel>

      {selectedTeacher ? (
        <PremiumPanel
          title="Haftalık Program"
          description={`${teacherName(selectedTeacher)} · ${slots.length} ders saati`}
          action={<Button variant="outline" size="sm" onClick={addSlot}><Plus className="h-4 w-4 mr-1" /> Ders Ekle</Button>}
          contentClassName="space-y-3"
        >
          {slotsLoading ? (
            <div className="flex justify-center py-6"><LoadingDots /></div>
          ) : slots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-foreground/10 p-8 text-center text-sm text-muted-foreground">Ders saati yok. "Ders Ekle" ile başla.</div>
          ) : slots.map((s, idx) => (
            <div key={idx} className="grid grid-cols-2 items-end gap-2 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
              <div>
                <Label className="text-xs">Gün</Label>
                <Select value={String(s.dayOfWeek)} onValueChange={(v) => updateSlot(idx, { dayOfWeek: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DAYS.map((d) => <SelectItem key={d.v} value={String(d.v)}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Başlangıç</Label><Input type="time" value={s.startTime} onChange={(e) => updateSlot(idx, { startTime: e.target.value })} /></div>
              <div><Label className="text-xs">Bitiş</Label><Input type="time" value={s.endTime} onChange={(e) => updateSlot(idx, { endTime: e.target.value })} /></div>
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
