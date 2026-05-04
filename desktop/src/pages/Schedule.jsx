import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Clock3,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import {
  createScheduleEntry,
  deleteScheduleEntry,
  fetchClasses,
  fetchScheduleEntries,
  fetchStaff,
} from '../lib/api/modules';
import { useToast } from '../hooks/use-toast';

const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
const timeSlots = [
  '08:30-09:15',
  '09:25-10:10',
  '10:20-11:05',
  '11:15-12:00',
  '13:00-13:45',
  '13:55-14:40',
  '14:50-15:35',
];
const subjects = ['Matematik', 'Fizik', 'Kimya', 'Biyoloji', 'Türkçe', 'İngilizce', 'Tarih', 'Coğrafya'];

const subjectColors = {
  Matematik: 'from-blue-500 to-cyan-500',
  Fizik: 'from-violet-500 to-purple-500',
  Kimya: 'from-emerald-500 to-lime-500',
  Biyoloji: 'from-green-500 to-emerald-600',
  Türkçe: 'from-orange-500 to-amber-500',
  İngilizce: 'from-pink-500 to-rose-500',
  Tarih: 'from-amber-500 to-yellow-500',
  Coğrafya: 'from-cyan-500 to-sky-500',
};

const emptyForm = {
  className: '',
  day: 'Pazartesi',
  time: timeSlots[0],
  subject: subjects[0],
  teacher: '',
  room: 'Derslik 1',
};

const classCollator = new Intl.Collator('tr-TR', { sensitivity: 'base', numeric: true });

function normalizeClassName(value) {
  const raw = typeof value === 'string'
    ? value
    : value?.name || value?.className || value?.displayName || '';

  return String(raw).trim();
}

function mergeClassNames(...groups) {
  const classMap = new Map();

  groups.flat().forEach((value) => {
    const normalized = normalizeClassName(value);
    if (!normalized) return;
    classMap.set(normalized.toLocaleLowerCase('tr-TR'), normalized);
  });

  return Array.from(classMap.values()).sort(classCollator.compare);
}

const subjectBranchAliases = {
  matematik: ['matematik'],
  fizik: ['fizik'],
  kimya: ['kimya'],
  biyoloji: ['biyoloji'],
  turkce: ['turkce', 'edebiyat'],
  ingilizce: ['ingilizce'],
  tarih: ['tarih'],
  cografya: ['cografya'],
};

function normalizeBranchText(value) {
  return String(value || '')
    .replace(/\u0130/g, 'I')
    .replace(/\u0131/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function teacherMatchesSubject(teacher, subject) {
  const branch = normalizeBranchText(teacher?.departmentOrBranch);
  const subjectKey = normalizeBranchText(subject);
  if (!branch || !subjectKey) return false;

  const aliases = subjectBranchAliases[subjectKey] || [subjectKey];
  return aliases.some((alias) => branch.includes(alias));
}

function firstEligibleTeacher(teacherItems, subject) {
  return teacherItems.find((item) => teacherMatchesSubject(item, subject))?.fullName || '';
}

function roleTitle(pathname = '') {
  return pathname.startsWith('/admin/') ? 'İdari Program Merkezi' : 'Yönetim Program Merkezi';
}

function LessonBlock({ lesson, onSelect }) {
  const gradient = subjectColors[lesson.subject] || 'from-slate-500 to-slate-700';
  return (
    <button
      type="button"
      onClick={() => onSelect(lesson)}
      className="w-full text-left"
    >
      <motion.div
        whileHover={{ y: -2, scale: 1.01 }}
        className={`min-h-[92px] rounded-2xl border border-white/50 bg-gradient-to-br ${gradient} p-3 text-white shadow-sm transition`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{lesson.subject}</p>
            <p className="mt-1 truncate text-[11px] text-white/80">{lesson.teacher}</p>
          </div>
          <Badge className="border-white/20 bg-white/12 text-white">{lesson.className}</Badge>
        </div>
        <div className="mt-4 flex items-center justify-between text-[11px] text-white/80">
          <span>{lesson.time}</span>
          <span>{lesson.room}</span>
        </div>
      </motion.div>
    </button>
  );
}

export default function Schedule() {
  const { toast } = useToast();
  const [selectedClass, setSelectedClass] = useState('');
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSchedule = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      // Tek tek try/catch yerine settled — hangi kaynak başarısız olursa onun hatasını biliyoruz
      const [classesResult, teachersResult, scheduleResult] = await Promise.allSettled([
        fetchClasses(),
        fetchStaff('Teacher'),
        fetchScheduleEntries(),
      ]);

      const classItems = classesResult.status === 'fulfilled' ? (classesResult.value || []) : [];
      const teacherItems = teachersResult.status === 'fulfilled' ? (teachersResult.value || []) : [];
      const scheduleItems = scheduleResult.status === 'fulfilled' ? (scheduleResult.value || []) : [];

      if (teachersResult.status === 'rejected') {
        console.warn('Öğretmen listesi alınamadı:', teachersResult.reason);
      }

      if (scheduleResult.status === 'rejected') {
        console.warn('Ders programı alınamadı:', scheduleResult.reason);
        setError(scheduleResult.reason?.message || 'Ders programı kayıtları yüklenemedi.');
      }

      const nextClasses = mergeClassNames(classItems);

      if (classesResult.status === 'rejected') {
        console.warn('Sınıf listesi alınamadı:', classesResult.reason);
        setError(classesResult.reason?.message || 'Sınıf listesi yüklenemedi.');
      }

      setClasses(nextClasses);
      setTeachers(teacherItems);
      setEntries(scheduleItems);
      setSelectedClass((prev) => (nextClasses.includes(prev) ? prev : nextClasses[0] || ''));
      setForm((prev) => ({
        ...prev,
        className: nextClasses.includes(prev.className) ? prev.className : nextClasses[0] || '',
        teacher: prev.teacher && teacherItems.some((item) => item.fullName === prev.teacher && teacherMatchesSubject(item, prev.subject))
          ? prev.teacher
          : firstEligibleTeacher(teacherItems, prev.subject || emptyForm.subject),
      }));
    } catch (err) {
      setError(err.message || 'Ders programı alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const eligibleTeachers = useMemo(
    () => teachers.filter((item) => teacherMatchesSubject(item, form.subject)),
    [teachers, form.subject],
  );

  const subjectTeacherMismatch = useMemo(() => (
    Boolean(form.teacher?.trim()) &&
    !eligibleTeachers.some((item) => item.fullName === form.teacher)
  ), [eligibleTeachers, form.teacher]);

  useEffect(() => {
    setForm((prev) => {
      if (prev.teacher && teachers.some((item) => item.fullName === prev.teacher && teacherMatchesSubject(item, prev.subject))) {
        return prev;
      }

      const nextTeacher = firstEligibleTeacher(teachers, prev.subject);
      return prev.teacher === nextTeacher ? prev : { ...prev, teacher: nextTeacher };
    });
  }, [teachers, form.subject]);

  const currentLessons = useMemo(
    () => entries.filter((item) => item.className === selectedClass),
    [entries, selectedClass],
  );

  const stats = useMemo(() => {
    const teacherSet = new Set(currentLessons.map((item) => item.teacher));
    return {
      lessons: currentLessons.length,
      teachers: teacherSet.size,
      weeklySlots: days.length * timeSlots.length,
      occupancy: Math.round((currentLessons.length / (days.length * timeSlots.length || 1)) * 100),
    };
  }, [currentLessons]);

  const lessonMap = useMemo(() => {
    const map = new Map();
    currentLessons.forEach((item) => {
      map.set(`${item.day}-${item.time}`, item);
    });
    return map;
  }, [currentLessons]);

  const teacherConflict = useMemo(() => (
    entries.find((item) => (
      item.day === form.day &&
      item.time === form.time &&
      item.teacher === form.teacher &&
      item.className !== form.className
    ))
  ), [entries, form]);

  const classConflict = useMemo(() => (
    entries.find((item) => (
      item.day === form.day &&
      item.time === form.time &&
      item.className === form.className
    ))
  ), [entries, form]);

  const handleCreate = async () => {
    try {
      setSaving(true);
      const created = await createScheduleEntry(form);
      setEntries((prev) => [...prev, created]);
      setCreateOpen(false);
      setForm((prev) => ({ ...emptyForm, className: prev.className, teacher: prev.teacher }));
      toast({
        title: 'Ders programı kaydedildi',
        description: `${created.className} için ${created.day} ${created.time} slotu oluşturuldu.`,
      });
    } catch (err) {
      toast({
        title: 'Program kaydedilemedi',
        description: err.message || 'Aynı öğretmen veya sınıf çakışıyor olabilir.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedLesson || selectedLesson.isReadOnly) return;
    try {
      setDeleting(true);
      await deleteScheduleEntry(selectedLesson.id);
      setEntries((prev) => prev.filter((item) => item.id !== selectedLesson.id));
      setSelectedLesson(null);
      toast({
        title: 'Ders programı güncellendi',
        description: 'Seçilen slot programdan kaldırıldı.',
      });
    } catch (err) {
      toast({
        title: 'Slot silinemedi',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="schedule-page">
      <div className="rounded-[30px] border border-border p-7 text-white shadow-xl" style={{ background: `radial-gradient(circle at top left, var(--brand-a-400, #D9790B33) 0%, transparent 34%), linear-gradient(135deg, var(--brand-p-900, #0f172a) 0%, var(--brand-p-800, #12324a) 52%, var(--brand-p-700, #0f766e) 100%)` }}>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <Badge className="border-white/20 bg-white/10 text-white">{roleTitle(window.location.pathname)}</Badge>
            <h1 className="mt-4 text-3xl font-bold font-heading">Ders Programı Oluşturma</h1>
            <p className="mt-2 text-sm text-white/80">
              Sınıf bazlı programı canlı backend verisiyle oluştur. Aynı öğretmen aynı gün ve saatte iki farklı sınıfa atanamaz; çakışma backend tarafından da engellenir.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [stats.lessons, 'Ders'],
              [stats.teachers, 'Öğretmen'],
              [stats.weeklySlots, 'Slot'],
              [`%${stats.occupancy}`, 'Doluluk'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-white/70">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error ? <ErrorBanner title="Ders programı alınamadı" message={error} onRetry={loadSchedule} /> : null}

      <Card className="border-border shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl bg-muted p-3 text-muted-foreground">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Program Görünümü</p>
              <p className="font-semibold text-foreground">{selectedClass || 'Sınıf seçin'}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={selectedClass} onValueChange={(value) => { setSelectedClass(value); setForm((prev) => ({ ...prev, className: value })); }}>
              <SelectTrigger className="w-[210px]"><SelectValue placeholder="Sınıf seçin" /></SelectTrigger>
              <SelectContent>
                {classes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Yeni Slot
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border shadow-sm">
        <CardContent className="overflow-x-auto p-0">
          <div className="min-w-[920px]">
            <div className="grid grid-cols-6 border-b bg-muted/50">
              <div className="border-r p-4 text-sm font-semibold text-muted-foreground">Saat</div>
              {days.map((day) => (
                <div key={day} className="border-r p-4 text-center font-semibold text-foreground last:border-r-0">
                  {day}
                </div>
              ))}
            </div>
            {timeSlots.map((time) => (
              <div key={time} className="grid grid-cols-6 border-b last:border-b-0">
                <div className="border-r bg-muted/40 p-4 text-sm">
                  <p className="font-semibold text-foreground">{time.split('-')[0]}</p>
                  <p className="text-muted-foreground">{time.split('-')[1]}</p>
                </div>
                {days.map((day) => {
                  const lesson = lessonMap.get(`${day}-${time}`);
                  return (
                    <div key={`${day}-${time}`} className="border-r p-2 last:border-r-0">
                      {lesson ? <LessonBlock lesson={lesson} onSelect={setSelectedLesson} /> : <div className="flex h-full min-h-[92px] items-center justify-center rounded-2xl border border-dashed border-border text-xs text-muted-foreground/60">Boş slot</div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-border shadow-sm xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-brand-primary" />Planlama Kuralları</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {[
              ['Sınıf bazlı atama', 'Önce sınıf seçilir, sonra programa slot eklenir.', Users],
              ['Öğretmen çakışması yok', 'Aynı öğretmen aynı gün-saatte iki farklı sınıfa atanamaz.', User],
              ['Gerçek kayıt', 'Program doğrudan backend üstünde saklanır, sayfa türetmesi yapılmaz.', BookOpen],
            ].map(([title, copy, Icon]) => (
              <div key={title} className="rounded-2xl border border-border bg-muted/50 p-4">
                <Icon className="h-5 w-5 text-brand-primary" />
                <p className="mt-3 font-semibold text-foreground">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-brand-primary" />Öğretmen Dağılımı</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from(new Set(currentLessons.map((item) => item.teacher))).slice(0, 6).map((teacher) => {
              const lessonCount = currentLessons.filter((item) => item.teacher === teacher).length;
              return (
                <div key={teacher} className="flex items-center justify-between rounded-2xl border border-border p-3">
                  <div>
                    <p className="font-medium text-foreground">{teacher}</p>
                    <p className="text-xs text-muted-foreground">Bu sınıfta {lessonCount} slot</p>
                  </div>
                  <Badge variant="outline">{lessonCount}</Badge>
                </div>
              );
            })}
            {currentLessons.length === 0 ? <p className="text-sm text-muted-foreground">Seçili sınıf için henüz program kaydı yok.</p> : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Ders Programı Slotu Oluştur</DialogTitle>
            <DialogDescription>Sınıf, gün, saat ve öğretmen seçilerek program doğrudan canlı kayda yazılır.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Sınıf</Label>
                <Select value={form.className} onValueChange={(value) => setForm((prev) => ({ ...prev, className: value }))}>
                  <SelectTrigger><SelectValue placeholder="Sınıf seçin" /></SelectTrigger>
                  <SelectContent>{classes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ders</Label>
                <Select
                  value={form.subject}
                  onValueChange={(value) => setForm((prev) => ({
                    ...prev,
                    subject: value,
                    teacher: prev.teacher && teachers.some((item) => item.fullName === prev.teacher && teacherMatchesSubject(item, value))
                      ? prev.teacher
                      : firstEligibleTeacher(teachers, value),
                  }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{subjects.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Gün</Label>
                <Select value={form.day} onValueChange={(value) => setForm((prev) => ({ ...prev, day: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{days.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Saat</Label>
                <Select value={form.time} onValueChange={(value) => setForm((prev) => ({ ...prev, time: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{timeSlots.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Derslik</Label>
                <Input value={form.room} onChange={(e) => setForm((prev) => ({ ...prev, room: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Öğretmen</Label>
              <Select
                value={form.teacher}
                onValueChange={(value) => setForm((prev) => ({ ...prev, teacher: value }))}
                disabled={eligibleTeachers.length === 0}
              >
                <SelectTrigger><SelectValue placeholder="Öğretmen seçin" /></SelectTrigger>
                <SelectContent>
                  {eligibleTeachers.map((item) => (
                    <SelectItem key={item.id} value={item.fullName}>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{item.fullName}</span>
                        {item.departmentOrBranch ? <span className="truncate text-xs text-muted-foreground">{item.departmentOrBranch}</span> : null}
                      </div>
                    </SelectItem>
                  ))}
                  {eligibleTeachers.length === 0 ? <SelectItem value="__no_teacher" disabled>Uygun branşta öğretmen yok</SelectItem> : null}
                </SelectContent>
              </Select>
            </div>

            {eligibleTeachers.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
                {form.subject} dersi için branşı uygun öğretmen bulunamadı. Bu ders seçiliyken sadece aynı branştaki öğretmenler atanabilir.
              </div>
            ) : null}

            {subjectTeacherMismatch ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800/50 dark:bg-rose-900/20 dark:text-rose-300">
                Seçili öğretmenin branşı {form.subject} dersiyle uyumlu değil.
              </div>
            ) : null}

            {teacherConflict ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5" />
                  <div>
                    <p className="font-semibold">Öğretmen çakışması</p>
                    <p className="mt-1 text-sm">{teacherConflict.teacher}, {teacherConflict.day} günü {teacherConflict.time} saatinde {teacherConflict.className} sınıfına atanmış.</p>
                  </div>
                </div>
              </div>
            ) : null}

            {classConflict ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5" />
                  <div>
                    <p className="font-semibold">Sınıf slotu dolu</p>
                    <p className="mt-1 text-sm">{classConflict.className} sınıfında bu gün ve saat için zaten {classConflict.subject} dersi var.</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          {(!form.className?.trim() || !form.teacher?.trim()) ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-800/50 dark:text-amber-300">
              Sınıf ve öğretmen seçimi zorunludur.
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>İptal</Button>
            <Button
              className="bg-brand-primary hover:bg-brand-primary/90"
              onClick={handleCreate}
              disabled={
                saving ||
                !form.className?.trim() ||
                !form.teacher?.trim() ||
                eligibleTeachers.length === 0 ||
                subjectTeacherMismatch ||
                Boolean(teacherConflict) ||
                Boolean(classConflict)
              }
            >
              {saving ? 'Kaydediliyor...' : 'Programı Kaydet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedLesson} onOpenChange={(open) => !open && setSelectedLesson(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedLesson?.subject || 'Ders detayı'}</DialogTitle>
            <DialogDescription>Seçilen program slotunun tüm bilgileri.</DialogDescription>
          </DialogHeader>
          {selectedLesson ? (
            <div className="space-y-4">
              <div className={`rounded-[26px] bg-gradient-to-br ${subjectColors[selectedLesson.subject] || 'from-slate-600 to-slate-800'} p-6 text-white`}>
                <Badge className="border-white/20 bg-white/12 text-white">{selectedLesson.className}</Badge>
                <h3 className="mt-4 text-2xl font-semibold">{selectedLesson.subject}</h3>
                <p className="mt-2 text-sm text-white/80">{selectedLesson.day} • {selectedLesson.time}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Öğretmen</p><p className="mt-1 font-semibold">{selectedLesson.teacher}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Derslik</p><p className="mt-1 font-semibold">{selectedLesson.room}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Kayıt Türü</p><p className="mt-1 font-semibold">{selectedLesson.isReadOnly ? 'Eski kayıt' : 'Canlı kayıt'}</p></CardContent></Card>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLesson(null)}>Kapat</Button>
            {selectedLesson && !selectedLesson.isReadOnly ? (
              <Button variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="mr-2 h-4 w-4" />
                {deleting ? 'Siliniyor...' : 'Slotu Sil'}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
