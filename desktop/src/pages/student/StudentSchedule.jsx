import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Printer, Download, CalendarDays } from 'lucide-react';
import { Button } from '../../components/ui/button';
import PremiumWeeklySchedule from '../../components/schedule/PremiumWeeklySchedule';
import { PremiumScheduleRow, PremiumPanel } from '../../components/ui/premium-dashboard';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchScheduleEntries, fetchStudents } from '../../lib/api/modules';
import { filterScheduleForStudent, resolveCurrentStudent } from '../../lib/userMatching';
import { deriveScheduleGrid, scheduleDayIndex, ALL_SCHEDULE_DAYS } from '../../lib/scheduleGrid';

const LEGEND = [
  ['Zorunlu Ders', 'bg-sky-400'],
  ['Seçmeli Ders', 'bg-emerald-400'],
  ['Canlı Ders', 'bg-[hsl(var(--brand-accent))]'],
  ['Laboratuvar', 'bg-cyan-400'],
  ['Etkinlik', 'bg-rose-400'],
];

const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function startOfWeek(date) {
  const d = new Date(date);
  const offset = (d.getDay() + 6) % 7; // Pazartesi = 0
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDay(date) {
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long' }).format(date);
}

export default function StudentSchedule() {
  const { user } = useApp();
  const [scheduleEntries, setScheduleEntries] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('weekly');
  const [weekOffset, setWeekOffset] = useState(0);

  const loadSchedule = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [schedule, studentList] = await Promise.all([
        fetchScheduleEntries().catch(() => []),
        fetchStudents().catch(() => []),
      ]);
      setScheduleEntries(Array.isArray(schedule) ? schedule : []);
      setStudents(Array.isArray(studentList) ? studentList : []);
    } catch (err) {
      setError(err.message || 'Ders programı alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const currentStudent = useMemo(() => resolveCurrentStudent(user, students), [user, students]);
  const className = currentStudent?.className || '';

  const lessons = useMemo(() => (
    filterScheduleForStudent(scheduleEntries, className)
      .map((entry) => ({
        id: entry.id,
        title: entry.subject || 'Ders',
        teacher: entry.teacher || '',
        className: entry.className || className,
        room: entry.room || entry.derslik || '',
        day: entry.day || '',
        time: entry.time || '',
      }))
      .sort((a, b) => {
        const dayDiff = scheduleDayIndex(a.day) - scheduleDayIndex(b.day);
        if (dayDiff !== 0) return dayDiff;
        return String(a.time).localeCompare(String(b.time));
      })
  ), [scheduleEntries, className]);

  const scheduleGrid = useMemo(() => deriveScheduleGrid(lessons), [lessons]);

  const week = useMemo(() => {
    const start = startOfWeek(new Date());
    start.setDate(start.getDate() + weekOffset * 7);
    const dates = {};
    ALL_SCHEDULE_DAYS.forEach((dayName, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      dates[dayName] = formatDay(date);
    });
    const end = new Date(start);
    end.setDate(start.getDate() + 5);
    const rangeLabel = `${formatDay(start)} - ${formatDay(end)} ${end.getFullYear()}`;
    const todayName = weekOffset === 0 ? DAY_NAMES[new Date().getDay()] : null;
    return { dates, rangeLabel, todayName };
  }, [weekOffset]);

  const groupedByDay = useMemo(() => {
    const map = new Map();
    lessons.forEach((lesson) => {
      const key = lesson.day || 'Belirsiz';
      map.set(key, [...(map.get(key) || []), lesson]);
    });
    return Array.from(map.entries()).sort((a, b) => scheduleDayIndex(a[0]) - scheduleDayIndex(b[0]));
  }, [lessons]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5" data-testid="student-schedule-page">
      {/* Üst kontrol çubuğu */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-black tracking-tight text-[hsl(var(--brand-accent))]">Ders Programı</h1>
          <div className="flex rounded-full border border-foreground/10 bg-foreground/[0.04] p-0.5">
            {[['weekly', 'Haftalık'], ['monthly', 'Aylık']].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setViewMode(value)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${viewMode === value ? 'bg-[hsl(var(--brand-accent))] text-white' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'weekly' ? (
            <div className="flex items-center gap-1 rounded-full border border-foreground/10 bg-foreground/[0.04] px-1 py-0.5">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setWeekOffset((v) => v - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="min-w-[150px] text-center text-xs font-semibold tabular-nums">{week.rangeLabel}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setWeekOffset((v) => v + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          ) : null}
          <Button size="sm" variant="outline" className="text-xs" onClick={() => setWeekOffset(0)}>Bugün</Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={() => window.print()}><Download className="mr-1.5 h-3.5 w-3.5" />Programı İndir</Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={() => window.print()}><Printer className="mr-1.5 h-3.5 w-3.5" />Yazdır</Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {className ? `${className} sınıfının haftalık programı.` : 'Sınıf bilgisi alınamadı; lütfen kurum yönetimine başvurun.'}
      </p>

      {error ? <ErrorBanner title="Ders programı alınamadı" message={error} onRetry={loadSchedule} /> : null}

      {lessons.length === 0 && !error ? (
        <div className="ci-card rounded-2xl p-8 text-center text-sm text-muted-foreground">
          {className
            ? 'Henüz program kaydı yok. Kurum yöneticiniz program oluşturduğunda burada görünecek.'
            : 'Öğrenci kaydı bulunamadı.'}
        </div>
      ) : viewMode === 'weekly' ? (
        <>
          <PremiumWeeklySchedule
            days={scheduleGrid.days}
            timeSlots={scheduleGrid.timeSlots}
            lessons={lessons}
            weekDates={week.dates}
            todayName={week.todayName}
          />
          {/* Lejant */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-foreground/10 bg-foreground/[0.025] px-4 py-3">
            {LEGEND.map(([label, dot]) => (
              <span key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                {label}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {groupedByDay.map(([day, items]) => (
            <PremiumPanel key={day} title={day} description={`${items.length} ders`} contentClassName="space-y-2.5">
              {items.map((lesson) => (
                <PremiumScheduleRow
                  key={lesson.id}
                  time={lesson.time}
                  icon={CalendarDays}
                  title={lesson.title}
                  subtitle={[lesson.className, lesson.teacher].filter(Boolean).join(' • ')}
                />
              ))}
            </PremiumPanel>
          ))}
        </div>
      )}
    </motion.div>
  );
}
