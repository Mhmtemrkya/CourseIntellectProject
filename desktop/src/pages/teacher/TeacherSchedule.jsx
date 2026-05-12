import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Clock3, MonitorPlay, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import WeeklyScheduleGrid from '../../components/schedule/WeeklyScheduleGrid';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchScheduleEntries, fetchStudents } from '../../lib/api/modules';
import { filterScheduleForTeacher } from '../../lib/userMatching';
import { deriveScheduleGrid } from '../../lib/scheduleGrid';

export default function TeacherSchedule() {
  const { user } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [lessons, setLessons] = useState([]);
  const [studentCounts, setStudentCounts] = useState({});
  const [viewMode, setViewMode] = useState('list');

  const loadSchedule = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      // Tek doğruluk kaynağı: /api/schedule (PlatformConfigurations
      // class-schedule-entry). LIVE_LESSON duyuruları artık burada değil;
      // canlı dersler /t/live-lessons sayfasından gösterilir.
      const [schedule, students] = await Promise.all([
        fetchScheduleEntries().catch(() => []),
        fetchStudents().catch(() => []),
      ]);
      const items = filterScheduleForTeacher(schedule, user)
        .map((entry) => ({
          id: entry.id,
          title: entry.subject || 'Ders',
          time: entry.time || '08:30',
          dateKey: entry.day || 'Pazartesi',
          dateLabel: entry.day || 'Pazartesi',
          className: entry.className || 'Sınıf belirtilmedi',
          platform: 'Yüz Yüze',
          subject: entry.subject || '',
        }))
        .sort((a, b) => `${a.dateKey}T${a.time}`.localeCompare(`${b.dateKey}T${b.time}`));
      const counts = students.reduce((acc, student) => {
        if (student.className) {
          acc[student.className] = (acc[student.className] || 0) + 1;
        }
        return acc;
      }, {});
      setLessons(items);
      setStudentCounts(counts);
      setSelectedDay(items[0]?.dateKey || '');
    } catch (err) {
      setError(err.message || 'Öğretmen ders programı alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const groupedDays = useMemo(() => {
    return lessons.reduce((acc, item) => {
      acc[item.dateKey] = acc[item.dateKey] || { label: item.dateLabel, lessons: [] };
      acc[item.dateKey].lessons.push(item);
      return acc;
    }, {});
  }, [lessons]);

  const currentLessons = selectedDay ? groupedDays[selectedDay]?.lessons || [] : [];
  const totalStudents = currentLessons.reduce((sum, item) => sum + (studentCounts[item.className] || 0), 0);
  const totalWeeklyStudents = lessons.reduce((sum, item) => sum + (studentCounts[item.className] || 0), 0);
  const dayEntries = Object.entries(groupedDays);
  const scheduleGrid = useMemo(() => deriveScheduleGrid(lessons), [lessons]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="teacher-schedule-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading">Ders Programım</h1>
          <p className="text-muted-foreground mt-1">Canlı backend planları, öğretmen adına filtrelenmiş program görünümü</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setViewMode((prev) => (prev === 'grid' ? 'list' : 'grid'))}>
          {viewMode === 'grid' ? 'Liste Görünümü' : 'Haftalık Çizelgeyi Göster'}
        </Button>
      </div>
      {error ? <ErrorBanner title="Program alınamadı" message={error} onRetry={loadSchedule} /> : null}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-950 via-slate-900 to-brand-accent text-white shadow-xl">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/90">
              Haftalık görünüm
            </div>
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">{groupedDays[selectedDay]?.label || 'Program Hazır'}</h2>
              <p className="mt-2 max-w-2xl text-sm text-white/72 sm:text-base">
                Haftalık planın, sınıf yoğunluğu ve günlük oturumların tek ekranda. Gün seçip ders kartlarını detaylı görebilirsin.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-white/10 bg-white/10 text-white shadow-none"><CardContent className="p-4"><div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-sky-200" /><div><p className="text-xs text-white/70">Haftalık ders</p><p className="text-2xl font-bold">{lessons.length}</p></div></div></CardContent></Card>
            <Card className="border-white/10 bg-white/10 text-white shadow-none"><CardContent className="p-4"><div className="flex items-center gap-3"><MonitorPlay className="h-5 w-5 text-violet-200" /><div><p className="text-xs text-white/70">Bugün</p><p className="text-2xl font-bold">{currentLessons.length}</p></div></div></CardContent></Card>
            <Card className="border-white/10 bg-white/10 text-white shadow-none"><CardContent className="p-4"><div className="flex items-center gap-3"><Users className="h-5 w-5 text-emerald-200" /><div><p className="text-xs text-white/70">Bugün öğrenci</p><p className="text-2xl font-bold">{totalStudents}</p></div></div></CardContent></Card>
            <Card className="border-white/10 bg-white/10 text-white shadow-none"><CardContent className="p-4"><div className="flex items-center gap-3"><Users className="h-5 w-5 text-amber-200" /><div><p className="text-xs text-white/70">Hafta toplamı</p><p className="text-2xl font-bold">{totalWeeklyStudents}</p></div></div></CardContent></Card>
          </div>
        </CardContent>
      </Card>
      {viewMode === 'grid' ? (
        <WeeklyScheduleGrid days={scheduleGrid.days} timeSlots={scheduleGrid.timeSlots} lessons={lessons} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {dayEntries.map(([key, value]) => {
          const isSelected = selectedDay === key;
          const dayLessons = value.lessons || [];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDay(key)}
              className={`rounded-3xl border p-4 text-left transition ${
                isSelected
                  ? 'border-brand-primary bg-brand-primary/5 shadow-sm'
                  : 'border-border bg-card hover:border-brand-primary/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{value.label}</p>
                  <p className="mt-1 font-semibold">{key}</p>
                </div>
                <Badge variant={isSelected ? 'default' : 'outline'}>{dayLessons.length} ders</Badge>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {dayLessons.length > 0
                  ? `${dayLessons[0].time} ile başlar`
                  : 'Planlı oturum yok'}
              </p>
            </button>
          );
        })}
      </div>
      <div className="grid gap-4">
        {currentLessons.length === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Bu gün için planlı ders yok.</CardContent></Card>
        ) : currentLessons.map((lesson) => (
          <Card key={lesson.id} className="overflow-hidden rounded-[22px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_14px_28px_-24px_rgba(15,23,42,0.24)]">
            <CardContent className="p-0">
              <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_220px]">
                <div className="relative px-4 py-3">
                  <div className="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-brand-primary via-sky-500 to-cyan-400" />
                  <div className="flex flex-col gap-3 pl-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="rounded-full bg-slate-950 px-2.5 py-0.5 text-[11px] text-white hover:bg-slate-950">
                            {lesson.platform}
                          </Badge>
                          <Badge variant="outline" className="rounded-full border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-600">
                            {lesson.className}
                          </Badge>
                          <Badge variant="outline" className="rounded-full border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-600">
                            {studentCounts[lesson.className] || 0} öğrenci
                          </Badge>
                        </div>
                        <div>
                          <h3 className="text-base font-semibold tracking-tight text-slate-950 sm:text-[1.1rem]">{lesson.title}</h3>
                          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-500">
                            {groupedDays[selectedDay]?.label} günü için planlanan ders akışı. Sınıf yoğunluğu ve oturum türü aynı kart içinde özetlenir.
                          </p>
                        </div>
                      </div>
                      <div className="flex min-w-[96px] flex-col items-start rounded-[18px] border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Başlangıç</p>
                        <p className="mt-1 text-xl font-bold leading-none text-slate-950">{lesson.time}</p>
                        <p className="mt-1 text-[11px] font-medium text-slate-500">{groupedDays[selectedDay]?.label}</p>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Oturum tipi</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900">{lesson.platform}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Sınıf</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900">{lesson.className}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Katılım</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900">{studentCounts[lesson.className] || 0} kişi</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border-t border-slate-200/70 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_35%),linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,1))] px-4 py-3 xl:border-l xl:border-t-0">
                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Program notu</p>
                      <p className="mt-1 text-[13px] leading-5 text-slate-600">
                        Ders başlamadan önce yoklama akışı ve içerik paylaşımı için kısa bir hazırlık tamponu bırakılması önerilir.
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-slate-200 bg-white/90 p-3 shadow-sm">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Gün özeti</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{groupedDays[selectedDay]?.label}</p>
                      <p className="mt-1 text-[13px] leading-5 text-slate-500">
                        Gün içinde {currentLessons.length} ders planı ve toplam {totalStudents} öğrenci yoğunluğu görünüyor.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
          </div>
        </>
      )}
    </motion.div>
  );
}
