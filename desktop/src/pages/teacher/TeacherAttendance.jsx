import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, CheckCircle2, Clock3, Save, Sparkles, Users, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { fetchAnnouncements, fetchAttendance, fetchStudents, saveAttendance } from '../../lib/api/modules';

function normalizeText(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u');
}

function parseLiveLesson(announcement) {
  const lines = String(announcement.detail || '').split('\n');
  const map = Object.fromEntries(lines.slice(1).map((line) => {
    const [key, ...rest] = line.split('=');
    return [key, rest.join('=')];
  }));
  return {
    id: announcement.id,
    lesson: announcement.title,
    className: map.class || 'Tüm Sınıflar',
    teacher: map.teacher || '',
    date: (map.datetime || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
  };
}

const STATUS_OPTIONS = [
  { value: 'present', label: 'Geldi' },
  { value: 'late', label: 'Geç' },
  { value: 'absent', label: 'Gelmedi' },
  { value: 'excuse', label: 'İzinli' },
];

const statusMap = {
  katildi: 'present',
  geldi: 'present',
  gec: 'late',
  devamsiz: 'absent',
  gelmedi: 'absent',
  izinli: 'excuse',
};

export default function TeacherAttendance() {
  const { user } = useApp();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lessons, setLessons] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [statuses, setStatuses] = useState({});

  const loadAttendanceScreen = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [announcements, studentList, records] = await Promise.all([
        fetchAnnouncements('Ogrenci'),
        fetchStudents(),
        fetchAttendance().catch(() => []),
      ]);
      const teacherName = normalizeText(user?.name || '');
      const teacherLessons = announcements
        .filter((item) => String(item.detail || '').startsWith('LIVE_LESSON'))
        .map(parseLiveLesson)
        .filter((item) => normalizeText(item.teacher) === teacherName);
      setLessons(teacherLessons);
      setStudents(studentList);
      setAttendance(records);
      const firstLessonId = teacherLessons[0]?.id || '';
      setSelectedLessonId(firstLessonId);
      if (firstLessonId) {
        const lesson = teacherLessons[0];
        const lessonStudents = studentList.filter((item) => item.className === lesson.className);
        const initialStatuses = {};
        lessonStudents.forEach((student) => {
          const latest = records
            .filter((record) => normalizeText(record.studentName) === normalizeText(student.fullName) && normalizeText(record.lesson) === normalizeText(lesson.lesson))
            .sort((a, b) => `${b.lessonDate}`.localeCompare(`${a.lessonDate}`))[0];
          const normalized = statusMap[normalizeText(latest?.status || '')] || 'present';
          initialStatuses[student.fullName] = normalized;
        });
        setStatuses(initialStatuses);
      } else {
        setStatuses({});
      }
    } catch (err) {
      setError(err.message || 'Öğretmen yoklama görünümü alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user?.name]);

  useEffect(() => {
    loadAttendanceScreen();
  }, [loadAttendanceScreen]);

  const selectedLesson = lessons.find((item) => item.id === selectedLessonId) || null;
  const lessonStudents = useMemo(() => {
    if (!selectedLesson) return [];
    return students.filter((item) => item.className === selectedLesson.className);
  }, [selectedLesson, students]);

  useEffect(() => {
    if (!selectedLesson) return;
    const nextStatuses = {};
    lessonStudents.forEach((student) => {
      const latest = attendance
        .filter((record) => normalizeText(record.studentName) === normalizeText(student.fullName) && normalizeText(record.lesson) === normalizeText(selectedLesson.lesson))
        .sort((a, b) => `${b.lessonDate}`.localeCompare(`${a.lessonDate}`))[0];
      nextStatuses[student.fullName] = statusMap[normalizeText(latest?.status || '')] || 'present';
    });
    setStatuses(nextStatuses);
  }, [attendance, lessonStudents, selectedLesson]);

  const counts = useMemo(() => lessonStudents.reduce((acc, student) => {
    const status = statuses[student.fullName] || 'present';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, { present: 0, late: 0, absent: 0, excuse: 0 }), [lessonStudents, statuses]);

  const attendanceRate = lessonStudents.length
    ? Math.round(((counts.present + counts.late + counts.excuse) / lessonStudents.length) * 100)
    : 0;

  const selectedLessonSummary = selectedLesson
    ? `${selectedLesson.lesson} • ${selectedLesson.className}`
    : 'Ders secilmedi';

  const attendanceAlreadyTaken = useMemo(() => {
    if (!selectedLesson) return false;
    return attendance.some((record) => (
      normalizeText(record.className) === normalizeText(selectedLesson.className)
      && normalizeText(record.lesson) === normalizeText(selectedLesson.lesson)
      && String(record.lessonDate || '').slice(0, 10) === selectedLesson.date
    ));
  }, [attendance, selectedLesson]);

  const handleSave = async () => {
    if (!selectedLesson) return;
    try {
      setSaving(true);
      const payload = await saveAttendance({
        className: selectedLesson.className,
        lesson: selectedLesson.lesson,
        lessonDate: selectedLesson.date,
        students: lessonStudents.map((student) => ({
          name: student.fullName,
          status: statuses[student.fullName] || 'present',
        })),
      });
      setAttendance((prev) => {
        const filtered = prev.filter((record) => !(
          normalizeText(record.className) === normalizeText(selectedLesson.className)
          && normalizeText(record.lesson) === normalizeText(selectedLesson.lesson)
          && String(record.lessonDate || '').slice(0, 10) === selectedLesson.date
        ));
        return [...filtered, ...payload];
      });
      toast({ title: 'Yoklama kaydedildi', description: `${selectedLesson.lesson} için yoklama backend’e yazıldı.` });
    } catch (err) {
      toast({ title: 'Yoklama kaydedilemedi', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="teacher-attendance-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Yoklama</h1>
        <p className="text-muted-foreground mt-1">Öğretmene atanmış canlı derslerden yoklama alınır</p>
      </div>
      {error ? <ErrorBanner title="Yoklama verisi alınamadı" message={error} onRetry={loadAttendanceScreen} /> : null}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-950 via-slate-900 to-brand-accent text-white shadow-xl">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/90">
              <Sparkles className="h-3.5 w-3.5" />
              Yoklama merkezi
            </div>
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">{selectedLessonSummary}</h2>
              <p className="mt-2 max-w-2xl text-sm text-white/72 sm:text-base">
                Sinifin anlik yoklama durumunu tek ekrandan yonet, tum ogrencileri hizlica guncelle ve kaydi tek seferde backend'e islet.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">Secili ders</p>
                <p className="mt-1 font-semibold">{selectedLesson?.lesson || 'Ders secin'}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">Sinif</p>
                <p className="mt-1 font-semibold">{selectedLesson?.className || '-'}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">Yoklama orani</p>
                <p className="mt-1 font-semibold">%{attendanceRate}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-white/10 bg-white/10 text-white shadow-none"><CardContent className="p-4"><div className="flex items-center gap-3"><Users className="h-5 w-5 text-cyan-200" /><div><p className="text-xs text-white/70">Ogrenci</p><p className="text-2xl font-bold">{lessonStudents.length}</p></div></div></CardContent></Card>
            <Card className="border-white/10 bg-white/10 text-white shadow-none"><CardContent className="p-4"><div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-300" /><div><p className="text-xs text-white/70">Geldi</p><p className="text-2xl font-bold">{counts.present}</p></div></div></CardContent></Card>
            <Card className="border-white/10 bg-white/10 text-white shadow-none"><CardContent className="p-4"><div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-amber-200" /><div><p className="text-xs text-white/70">Gec</p><p className="text-2xl font-bold">{counts.late}</p></div></div></CardContent></Card>
            <Card className="border-white/10 bg-white/10 text-white shadow-none"><CardContent className="p-4"><div className="flex items-center gap-3"><XCircle className="h-5 w-5 text-rose-200" /><div><p className="text-xs text-white/70">Gelmedi</p><p className="text-2xl font-bold">{counts.absent}</p></div></div></CardContent></Card>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle>Ders Seçimi</CardTitle></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <Select value={selectedLessonId} onValueChange={setSelectedLessonId}>
              <SelectTrigger className="h-12 rounded-2xl"><SelectValue placeholder="Ders seçin" /></SelectTrigger>
              <SelectContent>
                {lessons.map((lesson) => <SelectItem key={lesson.id} value={lesson.id}>{lesson.lesson} • {lesson.className}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid gap-3 sm:grid-cols-2">
              {lessons.slice(0, 4).map((lesson) => (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => setSelectedLessonId(lesson.id)}
                  className={`rounded-2xl border p-4 text-left transition ${selectedLessonId === lesson.id ? 'border-brand-primary bg-brand-primary/5 shadow-sm' : 'border-border bg-background hover:border-brand-primary/40'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{lesson.lesson}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{lesson.className}</p>
                    </div>
                    <CalendarClock className={`h-4 w-4 ${selectedLessonId === lesson.id ? 'text-brand-primary' : 'text-muted-foreground'}`} />
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Hizli aksiyon</p>
            <h3 className="mt-2 text-xl font-semibold">{selectedLesson?.lesson || 'Bir ders secin'}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedLesson ? `${selectedLesson.className} • ${selectedLesson.date}` : 'Yoklama alabilmek için once ders secimi yap.'}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="outline" className="justify-start rounded-2xl" onClick={() => {
                const nextStatuses = {};
                lessonStudents.forEach((student) => {
                  nextStatuses[student.fullName] = 'present';
                });
                setStatuses(nextStatuses);
              }} disabled={!selectedLesson || lessonStudents.length === 0 || attendanceAlreadyTaken}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Tumunu geldi yap
              </Button>
              <Button className="justify-start rounded-2xl bg-brand-primary hover:bg-brand-primary/90" onClick={handleSave} disabled={saving || !selectedLesson || attendanceAlreadyTaken}>
                <Save className="mr-2 h-4 w-4" />
                {attendanceAlreadyTaken ? 'Yoklama Alindi' : saving ? 'Kaydediliyor...' : 'Yoklamayı Kaydet'}
              </Button>
              {attendanceAlreadyTaken ? (
                <p className="text-xs text-muted-foreground">
                  Bu dersin yoklamasi daha once kaydedildi. Ayni ders icin ikinci kez yoklama alinmaz.
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4">
        {lessonStudents.map((student) => (
          <Card key={student.username || student.fullName}>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary/10 font-semibold text-brand-primary">
                    {student.fullName?.slice(0, 2)?.toUpperCase() || 'OG'}
                  </div>
                  <div>
                    <p className="font-semibold">{student.fullName}</p>
                    <p className="text-sm text-muted-foreground">{student.className} • {student.schoolNumber || 'Kayıtlı öğrenci'}</p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap xl:justify-end">
                  {STATUS_OPTIONS.map((status) => {
                    const selected = (statuses[student.fullName] || 'present') === status.value;
                    return (
                      <button
                        key={status.value}
                        type="button"
                        disabled={attendanceAlreadyTaken}
                        onClick={() => setStatuses((prev) => ({ ...prev, [student.fullName]: status.value }))}
                        className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                          selected
                            ? 'border-brand-primary bg-brand-primary text-white shadow-sm'
                            : 'border-border bg-background text-foreground hover:border-brand-primary/40'
                        } ${attendanceAlreadyTaken ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        {status.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!selectedLesson ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Öğretmene atanmış canlı ders bulunmuyor.</CardContent></Card> : null}
      </div>
    </motion.div>
  );
}
