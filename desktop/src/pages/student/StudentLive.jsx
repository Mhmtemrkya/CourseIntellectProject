import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Video, Play, ChevronLeft, ChevronRight, User, MapPin, Radio,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { StudentEmptyState } from '../../components/student/StudentEmptyState';
import { PremiumPanel, PremiumStatusPill } from '../../components/ui/premium-dashboard';
import { useApp } from '../../context/AppContext';
import { fetchLiveRoomSessions, fetchStudents } from '../../lib/api/modules';
import { resolveCurrentStudent } from '../../lib/userMatching';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function mapSessionToLesson(session) {
  const startedAt = session.startedAtUtc ? new Date(session.startedAtUtc) : null;
  const endedAt = session.endedAtUtc ? new Date(session.endedAtUtc) : null;
  const rawStatus = String(session.status || '').toLowerCase();
  const status = rawStatus === 'active' ? 'live' : rawStatus === 'completed' ? 'completed' : 'scheduled';
  const duration = startedAt && endedAt
    ? Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000))
    : 60;
  return {
    id: session.id,
    subject: session.lessonTitle || 'Canlı Ders',
    topic: session.topic || session.description || '',
    teacher: session.teacherName || 'Öğretmen',
    startTime: session.timeLabel || (startedAt ? startedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'),
    startAt: startedAt ? startedAt.toISOString() : null,
    duration,
    status,
    meetLink: session.meetingLink || '',
    className: session.className || 'Tüm Sınıflar',
    date: startedAt ? startedAt.toISOString().slice(0, 10) : '',
  };
}

function Countdown({ target }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000));
  const parts = [Math.floor(diff / 3600), Math.floor((diff % 3600) / 60), diff % 60];
  const labels = ['saat', 'dk', 'sn'];
  return (
    <div className="flex items-center gap-1">
      {parts.map((part, index) => (
        <div key={labels[index]} className="text-center">
          <div className="min-w-[34px] rounded-lg border border-foreground/10 bg-foreground/[0.05] px-1.5 py-1 text-sm font-black tabular-nums">{String(part).padStart(2, '0')}</div>
          <div className="mt-0.5 text-[9px] uppercase text-muted-foreground">{labels[index]}</div>
        </div>
      ))}
    </div>
  );
}

function MiniCalendar({ sessionDates }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthLabel = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(cursor);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="grid h-7 w-7 place-items-center rounded-lg border border-foreground/10 text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
        <span className="text-sm font-bold capitalize">{monthLabel}</span>
        <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="grid h-7 w-7 place-items-center rounded-lg border border-foreground/10 text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {WEEKDAYS.map((day) => <span key={day} className="py-1 font-semibold">{day}</span>)}
        {cells.map((day, index) => {
          if (!day) return <span key={`e${index}`} />;
          const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const hasSession = sessionDates.has(iso);
          return (
            <span
              key={iso}
              className={`grid h-8 place-items-center rounded-lg text-xs font-medium ${isToday ? 'bg-[hsl(var(--brand-accent))] text-white' : hasSession ? 'bg-[hsl(var(--brand-accent)/0.14)] text-[hsl(var(--brand-accent))]' : 'text-foreground'}`}
            >
              {day}
            </span>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--brand-accent))]" />Bugün</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--brand-accent)/0.4)]" />Canlı Ders</span>
      </div>
    </div>
  );
}

function LiveLessonRow({ lesson, onJoin }) {
  const minutesUntil = lesson.startAt ? Math.round((new Date(lesson.startAt).getTime() - Date.now()) / 60000) : null;
  const future = minutesUntil != null && minutesUntil > 0;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 sm:flex-row sm:items-center">
      <div className="w-16 shrink-0 text-center">
        <p className="text-sm font-bold tabular-nums">{lesson.startTime}</p>
        {future ? <p className="text-[11px] text-[hsl(var(--brand-accent))]">{minutesUntil} dk sonra</p> : lesson.status === 'live' ? <p className="text-[11px] font-semibold text-emerald-400">Canlı</p> : null}
      </div>
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white ${lesson.status === 'live' ? 'bg-gradient-to-br from-emerald-400 to-teal-600' : 'bg-gradient-to-br from-amber-400 to-orange-600'}`}>
        <Video className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{lesson.subject}</p>
        {lesson.topic ? <p className="truncate text-xs text-muted-foreground">{lesson.topic}</p> : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><User className="h-3 w-3" />{lesson.teacher}</span>
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />Derslik: {lesson.className}</span>
        </div>
      </div>
      {future ? <Countdown target={lesson.startAt} /> : null}
      <Button className="shrink-0 bg-[hsl(var(--brand-accent))] font-bold text-white hover:bg-[hsl(var(--brand-accent-hover))]" onClick={() => onJoin(lesson)}>
        <Play className="mr-1.5 h-4 w-4" />Derse Katıl
      </Button>
    </div>
  );
}

export default function StudentLive() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('upcoming');

  const loadLessons = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      let studentClassName = user?.className || '';
      if (!studentClassName) {
        const students = await fetchStudents().catch(() => []);
        const currentStudent = resolveCurrentStudent(user, Array.isArray(students) ? students : []);
        studentClassName = currentStudent?.className || '';
      }
      const sessions = await fetchLiveRoomSessions(studentClassName ? { className: studentClassName } : {}).catch(() => []);
      const payload = (Array.isArray(sessions) ? sessions : [])
        .map(mapSessionToLesson)
        .filter((item) => !studentClassName || item.className === 'Tüm Sınıflar' || item.className === studentClassName);
      setLessons(payload);
    } catch (err) {
      setError(err.message || 'Canlı dersler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  const ongoingLessons = useMemo(() => lessons.filter((item) => item.status === 'live'), [lessons]);
  const upcomingLessons = useMemo(() => lessons.filter((item) => item.status === 'scheduled'), [lessons]);
  const pastLessons = useMemo(() => lessons.filter((item) => item.status === 'completed'), [lessons]);
  const sessionDates = useMemo(() => new Set(lessons.map((item) => item.date).filter(Boolean)), [lessons]);
  const joinable = ongoingLessons[0] || upcomingLessons[0] || null;

  const handleJoin = (lesson) => {
    if (lesson?.meetLink) window.open(lesson.meetLink, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Canlı dersler yükleniyor...</p>
      </div>
    );
  }

  const activeList = tab === 'upcoming' ? [...ongoingLessons, ...upcomingLessons] : pastLessons;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5" data-testid="student-live-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-black tracking-tight text-[hsl(var(--brand-accent))]">Canlı Derslerim</h1>
        <div className="flex rounded-full border border-foreground/10 bg-foreground/[0.04] p-0.5">
          {[['upcoming', 'Yaklaşan Dersler'], ['records', 'Ders Kayıtlarım']].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${tab === value ? 'bg-[hsl(var(--brand-accent))] text-white' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? <ErrorBanner title="Canlı dersler alınamadı" message={error} onRetry={loadLessons} /> : null}

      {lessons.length === 0 ? (
        <StudentEmptyState
          variant="live"
          accent="purple"
          title="Henüz canlı ders bulunmuyor"
          description="Programına eklenen canlı dersler burada listelenecek. Sakın kaçırma, bildirimlerini açık tut."
          primaryLabel="Ders Programını Görüntüle"
          onPrimary={() => navigate('/s/schedule')}
          secondaryLabel="Yenile"
          onSecondary={loadLessons}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* Sol: ders listesi */}
          <motion.div variants={itemVariants} className="xl:col-span-2">
            <PremiumPanel
              title={tab === 'upcoming' ? 'Yaklaşan Canlı Dersler' : 'Ders Kayıtlarım'}
              description={tab === 'upcoming' ? `${ongoingLessons.length} canlı · ${upcomingLessons.length} yaklaşan` : `${pastLessons.length} tamamlanan oturum`}
              contentClassName="space-y-3"
            >
              {activeList.length ? activeList.map((lesson) => (
                tab === 'upcoming' ? (
                  <LiveLessonRow key={lesson.id} lesson={lesson} onJoin={handleJoin} />
                ) : (
                  <div key={lesson.id} className="flex items-center gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white"><Video className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{lesson.subject}</p>
                      <p className="text-xs text-muted-foreground">{lesson.teacher} • {lesson.date ? new Date(lesson.date).toLocaleDateString('tr-TR') : ''}</p>
                    </div>
                    {lesson.meetLink ? (
                      <Button variant="outline" size="sm" onClick={() => handleJoin(lesson)}><Play className="mr-1 h-4 w-4" />İzle</Button>
                    ) : <PremiumStatusPill tone="default">Kayıt Yok</PremiumStatusPill>}
                  </div>
                )
              )) : (
                <div className="rounded-2xl border border-dashed border-foreground/10 p-8 text-center text-sm text-muted-foreground">
                  {tab === 'upcoming' ? 'Yaklaşan canlı ders yok.' : 'Henüz ders kaydı yok.'}
                </div>
              )}
              {activeList.length ? (
                <button onClick={() => setTab(tab === 'upcoming' ? 'records' : 'upcoming')} className="w-full pt-1 text-center text-xs font-semibold text-[hsl(var(--brand-accent))] hover:underline">
                  {tab === 'upcoming' ? 'Tüm Ders Kayıtlarını Görüntüle →' : 'Yaklaşan Dersleri Görüntüle →'}
                </button>
              ) : null}
            </PremiumPanel>
          </motion.div>

          {/* Sağ ray */}
          <div className="space-y-5">
            <motion.div variants={itemVariants}>
              <PremiumPanel title="Canlı Ders Takvimi" description="Aylık canlı ders dağılımı">
                <MiniCalendar sessionDates={sessionDates} />
              </PremiumPanel>
            </motion.div>

            <motion.div variants={itemVariants}>
              <PremiumPanel
                title="Son İzlediğim Kayıtlar"
                description="Tamamlanan oturumlar"
                contentClassName="space-y-2.5"
              >
                {pastLessons.length ? pastLessons.slice(0, 4).map((lesson) => (
                  <button
                    key={lesson.id}
                    onClick={() => handleJoin(lesson)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-left transition-colors hover:bg-[hsl(var(--brand-accent)/0.06)]"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white"><Video className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{lesson.subject}</p>
                      <p className="truncate text-xs text-muted-foreground">{lesson.teacher}</p>
                    </div>
                    <Play className="h-4 w-4 shrink-0 text-[hsl(var(--brand-accent))]" />
                  </button>
                )) : (
                  <div className="rounded-2xl border border-dashed border-foreground/10 p-6 text-center text-sm text-muted-foreground">
                    Henüz izlenen kayıt yok.
                  </div>
                )}
              </PremiumPanel>
            </motion.div>
          </div>
        </div>
      )}

      {/* Yüzen Derse Katıl butonu */}
      {joinable ? (
        <button
          onClick={() => handleJoin(joinable)}
          className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-2xl bg-[hsl(var(--brand-accent))] px-5 py-3 font-bold text-white shadow-[0_18px_40px_-12px_hsl(var(--brand-accent)/0.7)] transition-transform hover:-translate-y-0.5"
        >
          <Radio className="h-5 w-5" />Derse Katıl
        </button>
      ) : null}
    </motion.div>
  );
}
