import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, Printer } from 'lucide-react';
import { Button } from '../../components/ui/button';
import PremiumWeeklySchedule from '../../components/schedule/PremiumWeeklySchedule';
import { PremiumPanel } from '../../components/ui/premium-dashboard';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchScheduleEntries, fetchStudents } from '../../lib/api/modules';
import { filterScheduleForTeacher } from '../../lib/userMatching';
import { deriveScheduleGrid, scheduleDayIndex, ALL_SCHEDULE_DAYS } from '../../lib/scheduleGrid';

const LEGEND = [
  ['Zorunlu Ders', 'bg-sky-400'],
  ['Seçmeli Ders', 'bg-emerald-400'],
  ['Laboratuvar', 'bg-cyan-400'],
  ['Etüt', 'bg-amber-400'],
];

const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function startOfWeek(date) {
  const d = new Date(date);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDay(date) {
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long' }).format(date);
}

function lessonMinutes(time) {
  const match = String(time || '').match(/(\d{1,2}):(\d{2}).*?(\d{1,2}):(\d{2})/);
  if (match) {
    const minutes = (Number(match[3]) * 60 + Number(match[4])) - (Number(match[1]) * 60 + Number(match[2]));
    return minutes > 0 ? minutes : 45;
  }
  return 45;
}

export default function TeacherSchedule() {
  const { user } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lessons, setLessons] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [classFilter, setClassFilter] = useState('all');

  const loadSchedule = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [schedule, students] = await Promise.all([
        fetchScheduleEntries().catch(() => []),
        fetchStudents().catch(() => []),
      ]);
      const counts = students.reduce((acc, student) => {
        if (student.className) acc[student.className] = (acc[student.className] || 0) + 1;
        return acc;
      }, {});
      const items = filterScheduleForTeacher(schedule, user).map((entry) => ({
        id: entry.id,
        subject: entry.subject || 'Ders',
        title: `${entry.className || ''} ${entry.subject || 'Ders'}`.trim(),
        time: entry.time || '08:30',
        day: entry.day || 'Pazartesi',
        className: entry.className || '-',
        room: entry.room || entry.derslik || entry.className || '-',
        studentCount: counts[entry.className] || 0,
      }));
      setLessons(items);
    } catch (err) {
      setError(err.message || 'Öğretmen ders programı alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  const classes = useMemo(() => Array.from(new Set(lessons.map((item) => item.className).filter((c) => c && c !== '-'))), [lessons]);
  const scopedLessons = useMemo(() => (classFilter === 'all' ? lessons : lessons.filter((item) => item.className === classFilter)), [lessons, classFilter]);
  const scheduleGrid = useMemo(() => deriveScheduleGrid(scopedLessons), [scopedLessons]);

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
    end.setDate(start.getDate() + 4);
    const rangeLabel = `${formatDay(start)} - ${formatDay(end)} ${end.getFullYear()}`;
    const todayName = weekOffset === 0 ? DAY_NAMES[new Date().getDay()] : null;
    return { dates, rangeLabel, todayName };
  }, [weekOffset]);

  const info = useMemo(() => {
    const totalMinutes = scopedLessons.reduce((sum, item) => sum + lessonMinutes(item.time), 0);
    return {
      totalLessons: scopedLessons.length,
      totalHours: `${Math.floor(totalMinutes / 60)}s ${totalMinutes % 60}dk`,
      classCount: new Set(scopedLessons.map((item) => item.className).filter((c) => c && c !== '-')).size,
      subjectCount: new Set(scopedLessons.map((item) => item.subject).filter(Boolean)).size,
    };
  }, [scopedLessons]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5" data-testid="teacher-schedule-page">
      {/* Üst bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-[hsl(var(--brand-accent))]">Öğretmen Ders Programı</h1>
          <p className="mt-1 text-sm text-muted-foreground">Haftalık ders programınızı görüntüleyin.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="text-xs" onClick={() => window.print()}><Download className="mr-1.5 h-3.5 w-3.5" />Programı İndir</Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={() => window.print()}><Printer className="mr-1.5 h-3.5 w-3.5" />Yazdır</Button>
        </div>
      </div>

      {error ? <ErrorBanner title="Program alınamadı" message={error} onRetry={loadSchedule} /> : null}

      {/* Filtreler */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Hafta</span>
          <div className="flex items-center gap-1 rounded-full border border-foreground/10 bg-foreground/[0.04] px-1 py-0.5">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setWeekOffset((v) => v - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-[150px] text-center text-xs font-semibold tabular-nums">{week.rangeLabel}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setWeekOffset((v) => v + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Sınıf</span>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="rounded-xl border border-foreground/10 bg-foreground/[0.04] px-3 py-2 text-sm outline-none">
            <option value="all">Tümü</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button size="sm" variant="outline" className="text-xs" onClick={() => setWeekOffset(0)}>Bugüne Git</Button>
        </div>
      </div>

      {scopedLessons.length === 0 && !error ? (
        <div className="ci-card rounded-2xl p-8 text-center text-sm text-muted-foreground">Bu görünümde planlı ders yok.</div>
      ) : (
        <>
          <PremiumWeeklySchedule
            days={scheduleGrid.days}
            timeSlots={scheduleGrid.timeSlots}
            lessons={scopedLessons}
            weekDates={week.dates}
            todayName={week.todayName}
          />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-foreground/10 bg-foreground/[0.025] px-4 py-3">
            {LEGEND.map(([label, dot]) => (
              <span key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />{label}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Program Bilgileri + Notlar */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <PremiumPanel title="Program Bilgileri" description="Haftalık özet">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Toplam Ders', info.totalLessons],
              ['Toplam Saat', info.totalHours],
              ['Sınıf Sayısı', info.classCount],
              ['Ders Sayısı', info.subjectCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-center">
                <p className="text-xl font-black tracking-tight">{value}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </PremiumPanel>

        <PremiumPanel title="Notlar" description="Program hakkında">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--brand-accent))]" />Ders programı dönem içerisinde değişiklik gösterebilir.</li>
            <li className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--brand-accent))]" />Güncel program için idare ile iletişime geçiniz.</li>
          </ul>
        </PremiumPanel>
      </div>
    </motion.div>
  );
}
