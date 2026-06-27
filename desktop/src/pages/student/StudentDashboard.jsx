import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  GraduationCap,
  CalendarCheck,
  Target,
  Medal,
  ClipboardList,
  CalendarClock,
  ArrowRight,
  Flame,
  Trophy,
  ChevronRight,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import BadgeShield from '../../components/badges/BadgeShield';
import BadgeUnlockModal from '../../components/badges/BadgeUnlockModal';
import { useApp } from '../../context/AppContext';
import { fetchStudentDashboardData } from '../../lib/api/dashboardData';
import { BADGE_TOTAL, collectNewBadges, getAllBadges, unlockedBadgeCount } from '../../lib/badges';
import {
  PremiumAreaChart,
  PremiumListRow,
  PremiumMetricCard,
  PremiumPanel,
  PremiumProgressRow,
  PremiumScheduleRow,
  PremiumStatusPill,
} from '../../components/ui/premium-dashboard';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const tones = ['brand', 'blue', 'emerald', 'violet', 'amber', 'rose'];

function letterGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function scoreLabel(score) {
  if (score >= 85) return 'Çok İyi';
  if (score >= 70) return 'İyi';
  if (score >= 50) return 'Orta';
  return 'Gelişmeli';
}

function lessonStatus(status) {
  if (status === 'ongoing') return { label: 'Devam Ediyor', tone: 'live' };
  if (status === 'completed') return { label: 'Tamamlandı', tone: 'done' };
  return { label: 'Yaklaşan', tone: 'soon' };
}

function DayMeta({ days }) {
  if (days == null) return <ChevronRight className="h-4 w-4" />;
  return (
    <div className="text-right leading-none">
      <span className="text-base font-black text-[hsl(var(--brand-accent))]">{days}</span>
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Gün</span>
    </div>
  );
}

const STUDY_RANGES = [
  ['day', 'Gün'],
  ['week', 'Hafta'],
  ['month', 'Ay'],
  ['year', 'Yıl'],
];

function StudyStatsPanel({ studyStats }) {
  const [range, setRange] = useState('week');
  const active = (studyStats && studyStats[range]) || { labels: [], values: [], total: 0, summary: {} };
  const labels = Array.isArray(active.labels) ? active.labels : [];
  const values = Array.isArray(active.values) ? active.values : [];
  const summary = active.summary || {};
  const peak = values.length ? Math.max(...values) : 0;
  const total = Number(active.total || values.reduce((sum, value) => sum + Number(value || 0), 0));

  const metricTiles = [
    ['Çözülen Soru', summary.questions ?? 0, Target],
    ['İzlenen İçerik', summary.contents ?? 0, BookOpen],
    ['Sınav', summary.exams ?? 0, GraduationCap],
    ['Toplam Aktivite', total, Activity],
  ];

  return (
    <PremiumPanel
      title="Çalışma İstatistiklerim"
      description="Gerçek çalışma hareketlerin — gün, hafta, ay ve yıl bazında"
      action={(
        <div className="flex items-center gap-1 rounded-xl border border-foreground/10 bg-foreground/[0.04] p-1">
          {STUDY_RANGES.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${range === key ? 'bg-[hsl(var(--brand-accent))] text-white shadow' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metricTiles.map(([label, value, Icon]) => (
          <div key={label} className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
              <Icon className="h-4 w-4 text-[hsl(var(--brand-accent))]" />
            </div>
            <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-foreground/10 bg-foreground/[0.025] p-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-muted-foreground"><TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> Aktivite eğrisi</span>
          <span className="text-muted-foreground">En yüksek: <b className="text-foreground">{peak}</b></span>
        </div>
        {values.some((value) => Number(value) > 0) ? (
          <>
            <PremiumAreaChart values={values} height={170} />
            <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
              {labels.map((label, index) => <span key={`${label}-${index}`} className="flex-1 text-center">{label}</span>)}
            </div>
          </>
        ) : (
          <div className="flex h-[170px] items-center justify-center rounded-xl border border-dashed border-foreground/10 text-sm text-muted-foreground">
            Bu aralıkta çalışma hareketi bulunamadı.
          </div>
        )}
      </div>
    </PremiumPanel>
  );
}

export default function StudentDashboard() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newBadges, setNewBadges] = useState([]);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await fetchStudentDashboardData(user);
      setData(payload);
      const unlockedNow = collectNewBadges(payload?.stats?.xp, user);
      if (unlockedNow.length) setNewBadges(unlockedNow);
    } catch (err) {
      setError(err.message || 'Öğrenci paneli alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Öğrenci paneli hazırlanıyor...</p>
      </div>
    );
  }

  const stats = data?.stats || {};
  const xp = Number(stats.xp || 0);
  const unlockedBadges = unlockedBadgeCount(xp);
  const subjectPerformance = data?.subjectPerformance || [];
  const pendingList = data?.pendingList || [];
  const recentResults = data?.recentResults || [];
  const todayLessons = data?.todayLessons || [];
  const upcomingEvents = data?.upcomingEvents || [];
  const announcementList = data?.announcementList || [];
  const studyStats = data?.studyStats || {};
  const badges = getAllBadges();

  const performanceTrend = subjectPerformance.map((item) => item.average);
  const resultTrend = [...recentResults].reverse().map((item) => item.score);
  const summaryCards = [
    { title: 'Genel Not Ortalaması', value: stats.averageScore || 0, caption: scoreLabel(stats.averageScore || 0), icon: GraduationCap, tone: 'brand', chart: 'line', chartValues: performanceTrend },
    { title: 'Devam Durumu', value: `${stats.attendanceRate || 0}%`, caption: scoreLabel(stats.attendanceRate || 0), icon: CalendarCheck, tone: 'blue', chart: 'bars', chartValues: [stats.attendanceRate || 0] },
    { title: 'Başarı Sıralaması', value: stats.rank ? `${stats.rank} / ${stats.totalStudents || '-'}` : '—', caption: data?.className ? `${data.className} • not ortalaması` : 'Sınıf sıralaması', icon: Target, tone: 'violet', chart: 'line', chartValues: resultTrend },
    { title: 'Toplam Rozet', value: unlockedBadges, caption: `${BADGE_TOTAL} rozetten`, icon: Medal, tone: 'amber', chart: 'bars', chartValues: [unlockedBadges, Math.max(0, BADGE_TOTAL - unlockedBadges)] },
    { title: 'İçerik Tamamlama', value: `${stats.completedContent || 0}%`, caption: 'Genel ilerleme', icon: Trophy, tone: 'emerald', chart: 'donut', donutValue: stats.completedContent || 0 },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
      data-testid="student-dashboard-page"
    >
      {/* Karşılama */}
      <motion.div variants={itemVariants} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">👋</span>
            <h1 className="text-xl font-black tracking-tight">Merhaba, {data?.greetingName || 'Öğrenci'}!</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Bugün harika bir gün, kendini geliştirmeye devam et.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PremiumStatusPill tone="warn"><Flame className="mr-1 h-3.5 w-3.5" />{stats.streak || 0} gün seri</PremiumStatusPill>
          <PremiumStatusPill tone="live"><Trophy className="mr-1 h-3.5 w-3.5" />Seviye {stats.level || 1} · {xp} XP</PremiumStatusPill>
        </div>
      </motion.div>

      {error ? <ErrorBanner title="Öğrenci paneli yüklenemedi" message={error} onRetry={loadDashboard} /> : null}

      {/* Üst metrik kartları */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <motion.div key={card.title} variants={itemVariants}>
            <PremiumMetricCard {...card} />
          </motion.div>
        ))}
      </div>

      {/* Ana içerik + sağ ray */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Sol + orta */}
        <div className="space-y-5 xl:col-span-2">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <motion.div variants={itemVariants}>
              <PremiumPanel
                title="Ders Performansım"
                description="Derslerine göre başarı durumu"
                action={<Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate('/s/exam-results')}>Tüm Derslerim <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>}
                contentClassName="space-y-3"
              >
                {subjectPerformance.length ? subjectPerformance.slice(0, 6).map((item, index) => (
                  <PremiumProgressRow
                    key={item.subject}
                    icon={BookOpen}
                    title={item.subject}
                    subtitle={`${item.count} sınav`}
                    value={item.average}
                    valueLabel={letterGrade(item.average)}
                    progress={item.average}
                    tone={tones[index % tones.length]}
                  />
                )) : (
                  <div className="rounded-2xl border border-dashed border-foreground/10 p-8 text-center text-sm text-muted-foreground">
                    Henüz sınav sonucu girilmemiş.
                  </div>
                )}
              </PremiumPanel>
            </motion.div>

            <motion.div variants={itemVariants}>
              <PremiumPanel
                title="Yaklaşan Etkinlikler"
                description="Sınav, ödev ve sunum takvimi"
                action={<Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate('/s/exams')}>Tüm Etkinlikler <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>}
                contentClassName="space-y-2.5"
              >
                {upcomingEvents.length ? upcomingEvents.map((event, index) => (
                  <PremiumListRow
                    key={`${event.title}-${index}`}
                    icon={CalendarClock}
                    accent
                    title={event.title}
                    subtitle={event.detail}
                    meta={<DayMeta days={event.days} />}
                  />
                )) : (
                  <div className="rounded-2xl border border-dashed border-foreground/10 p-8 text-center text-sm text-muted-foreground">
                    Yaklaşan etkinlik yok.
                  </div>
                )}
              </PremiumPanel>
            </motion.div>
          </div>

          {/* Çalışma istatistikleri - geniş, belirgin grafik */}
          <motion.div variants={itemVariants}>
            <StudyStatsPanel studyStats={studyStats} />
          </motion.div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <motion.div variants={itemVariants}>
              <PremiumPanel
                title="Rozetlerim"
                description={`${unlockedBadges}/${BADGE_TOTAL} açıldı`}
                action={<Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate('/s/badges')}>Tüm Rozetler <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>}
              >
                <div className="grid grid-cols-3 gap-3">
                  {badges.slice(0, 6).map((badge, index) => (
                    <div key={badge.id} className="flex flex-col items-center gap-2 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-center">
                      <BadgeShield badge={badge} size={42} glow={index < unlockedBadges} locked={index >= unlockedBadges} />
                      <p className="line-clamp-1 text-[11px] font-semibold">{badge.name}</p>
                    </div>
                  ))}
                </div>
              </PremiumPanel>
            </motion.div>

            <motion.div variants={itemVariants}>
              <PremiumPanel
                title="Duyurular"
                description="Okul ve sınıf duyuruları"
                action={<Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate('/s/announcements')}>Tüm Duyurular <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>}
                contentClassName="space-y-2.5"
              >
                {announcementList.length ? announcementList.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{item.title}</p>
                      {item.date ? <span className="shrink-0 text-[11px] text-muted-foreground">{item.date}</span> : null}
                    </div>
                    {item.detail ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.detail}</p> : null}
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-foreground/10 p-8 text-center text-sm text-muted-foreground">
                    Yeni duyuru yok.
                  </div>
                )}
              </PremiumPanel>
            </motion.div>
          </div>
        </div>

        {/* Sağ ray */}
        <div className="space-y-5">
          <motion.div variants={itemVariants}>
            <PremiumPanel
              title="Bugünkü Ders Programı"
              description="Sınıfının bugünkü akışı"
              action={<Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate('/s/schedule')}>Tüm Program <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>}
              contentClassName="space-y-2.5"
            >
              {todayLessons.length ? todayLessons.map((lesson, index) => {
                const status = lessonStatus(lesson.status);
                return (
                  <PremiumScheduleRow
                    key={`${lesson.subject}-${index}`}
                    time={lesson.time}
                    icon={BookOpen}
                    title={lesson.subject}
                    subtitle={[lesson.class, lesson.teacher].filter(Boolean).join(' • ')}
                    status={status.label}
                    statusTone={status.tone}
                    active={lesson.status === 'ongoing'}
                  />
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-foreground/10 p-8 text-center text-sm text-muted-foreground">
                  Bugün için kayıtlı ders görünmüyor.
                </div>
              )}
            </PremiumPanel>
          </motion.div>

          <motion.div variants={itemVariants}>
            <PremiumPanel
              title="Görev & Ödevlerim"
              description={`${stats.pendingAssignments || 0} bekleyen görev`}
              action={<Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate('/s/assignments')}>Tümünü Gör <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>}
              contentClassName="space-y-2.5"
            >
              {pendingList.length ? pendingList.map((item, index) => (
                <PremiumListRow
                  key={`${item.title}-${index}`}
                  icon={ClipboardList}
                  title={item.title}
                  subtitle={item.subject}
                  meta={item.deadline || item.status}
                  onClick={() => navigate('/s/assignments')}
                />
              )) : (
                <div className="rounded-2xl border border-dashed border-foreground/10 p-8 text-center text-sm text-muted-foreground">
                  Bekleyen görev yok 🎉
                </div>
              )}
            </PremiumPanel>
          </motion.div>
        </div>
      </div>

      {newBadges.length > 0 && (
        <BadgeUnlockModal badges={newBadges} onClose={() => setNewBadges([])} />
      )}
    </motion.div>
  );
}
