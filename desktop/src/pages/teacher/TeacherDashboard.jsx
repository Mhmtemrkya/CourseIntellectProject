import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Users, CalendarDays, FileText, Award, ArrowRight, TrendingUp, TrendingDown,
  Activity, FilePlus2, ClipboardList, Upload, Megaphone, PlayCircle, ChevronRight,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchTeacherDashboardData } from '../../lib/api/dashboardData';
import {
  AnimatedValue,
  PremiumAreaChart,
  PremiumDonutChart,
  PremiumPanel,
  PremiumStatusPill,
} from '../../components/ui/premium-dashboard';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };

const LESSON_STATUS = {
  done: ['done', 'Tamamlandı'],
  live: ['live', 'Devam Ediyor'],
  next: ['soon', 'Sıradaki'],
  pending: ['default', 'Bekliyor'],
};

export default function TeacherDashboard() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setData(await fetchTeacherDashboardData(user));
    } catch (err) {
      setError(err.message || 'Öğretmen dashboard verisi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Öğretmen paneli hazırlanıyor...</p>
      </div>
    );
  }

  const stats = data?.stats || {};
  const classOverview = data?.classOverview || [];
  const todaySchedule = data?.todaySchedule || [];
  const recentActivities = data?.recentActivities || [];
  const examStats = data?.examStats || {};
  const hwDist = data?.homeworkDistribution || {};
  const pendingGrading = data?.pendingGrading || [];
  const upcomingExams = data?.upcomingExams || [];
  const recentContents = data?.recentContents || [];
  const announcementList = data?.announcementList || [];
  const todayLabel = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());

  const statCards = [
    [BookOpen, 'Toplam Ders', stats.totalCourses || 0, 'Aktif dersiniz', 'from-violet-400 to-fuchsia-600'],
    [Users, 'Toplam Öğrenci', stats.totalStudents || 0, 'Tüm sınıflarınız', 'from-sky-400 to-blue-600'],
    [CalendarDays, 'Bugünkü Ders', stats.todayLessons || 0, `${stats.completedToday || 0} tamamlandı`, 'from-emerald-400 to-teal-600'],
    [FileText, 'Bekleyen Ödev', stats.pendingGradingCount || 0, 'Değerlendirmeyi bekliyor', 'from-amber-400 to-orange-600'],
    [Award, 'Ortalama Başarı', `%${stats.avgSuccess || 0}`, 'Tüm sınıflarınız', 'from-rose-400 to-red-600'],
  ];

  const examTotal = (examStats.completed || 0) + (examStats.ongoing || 0) + (examStats.planned || 0);
  const hwTotal = data?.homeworkTotal || ((hwDist.delivered || 0) + (hwDist.pending || 0) + (hwDist.overdue || 0));

  const quickActions = [
    ['Sınav Oluştur', FilePlus2, 'from-violet-400 to-fuchsia-600', () => navigate('/t/exams')],
    ['Ödev Oluştur', ClipboardList, 'from-amber-400 to-orange-600', () => navigate('/t/assignments')],
    ['İçerik Yükle', Upload, 'from-emerald-400 to-teal-600', () => navigate('/t/content')],
    ['Duyuru Yayınla', Megaphone, 'from-sky-400 to-blue-600', () => navigate('/t/announcements')],
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5" data-testid="teacher-dashboard-page">
      {/* Karşılama */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">👋</span>
          <h1 className="text-xl font-black tracking-tight">Merhaba, {data?.teacherName || 'Öğretmenim'}!</h1>
        </div>
        <p className="mt-1 text-sm capitalize text-muted-foreground">Bugün {todayLabel}</p>
      </motion.div>

      {error ? <ErrorBanner title="Öğretmen paneli yüklenemedi" message={error} onRetry={loadDashboard} /> : null}

      {/* 5 stat kartı */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {statCards.map(([Icon, label, value, sub, gradient]) => (
          <motion.div key={label} variants={itemVariants} className="ci-metric-card flex flex-col gap-3 rounded-2xl border border-foreground/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
              <div className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br text-white ${gradient}`}><Icon className="h-4 w-4" /></div>
            </div>
            <div>
              <p className="text-3xl font-black tracking-tight"><AnimatedValue value={value} /></p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Sol 2/3 */}
        <div className="space-y-5 xl:col-span-2">
          {/* Sınıflarıma Genel Bakış + Son Aktiviteler */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <motion.div variants={itemVariants}>
              <PremiumPanel title="Sınıflarıma Genel Bakış" description="Sınıf ortalamaları" contentClassName="space-y-3">
                {classOverview.length ? classOverview.map((cls) => (
                  <div key={cls.className} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{cls.className}</span>
                      <span className="text-xs text-muted-foreground">{cls.studentCount} Öğrenci</span>
                      <span className="font-black tabular-nums">%{cls.average}</span>
                      <span className={`flex items-center gap-0.5 text-xs font-semibold ${cls.trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {cls.trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(cls.trend)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.07]"><div className="ci-bar-fill h-full rounded-full bg-gradient-to-r from-[hsl(var(--brand-accent))] to-[hsl(var(--brand-primary-text))]" style={{ width: `${cls.average}%` }} /></div>
                  </div>
                )) : <div className="rounded-2xl border border-dashed border-foreground/10 p-8 text-center text-sm text-muted-foreground">Sınıf verisi yok.</div>}
              </PremiumPanel>
            </motion.div>

            <motion.div variants={itemVariants}>
              <PremiumPanel title="Son Aktiviteler" description="Sınıf hareketleri" contentClassName="space-y-2.5">
                {recentActivities.length ? recentActivities.map((act, index) => (
                  <div key={index} className="flex items-start gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[hsl(var(--brand-accent)/0.12)] text-[hsl(var(--brand-accent))]"><Activity className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{act.title}</p>
                      {act.detail ? <p className="truncate text-xs text-muted-foreground">{act.detail}</p> : null}
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{act.time}</span>
                  </div>
                )) : <div className="rounded-2xl border border-dashed border-foreground/10 p-8 text-center text-sm text-muted-foreground">Aktivite yok.</div>}
              </PremiumPanel>
            </motion.div>
          </div>

          {/* Donutlar + İçerik Kullanımı */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <motion.div variants={itemVariants}>
              <PremiumPanel title="Sınav İstatistikleri" description="Bu dönem">
                <PremiumDonutChart
                  segments={[
                    { label: 'Tamamlanan', value: examStats.completed || 0, color: '#10B981' },
                    { label: 'Devam Eden', value: examStats.ongoing || 0, color: '#F59E0B' },
                    { label: 'Planlanan', value: examStats.planned || 0, color: '#64748B' },
                  ]}
                  centerValue={examTotal}
                  centerLabel="Toplam Sınav"
                />
              </PremiumPanel>
            </motion.div>
            <motion.div variants={itemVariants}>
              <PremiumPanel title="Ödev Dağılımı" description="Bu hafta">
                <PremiumDonutChart
                  segments={[
                    { label: 'Teslim Edilen', value: hwDist.delivered || 0, color: '#10B981' },
                    { label: 'Bekleyen', value: hwDist.pending || 0, color: '#F59E0B' },
                    { label: 'Geciken', value: hwDist.overdue || 0, color: '#F43F5E' },
                  ]}
                  centerValue={hwTotal}
                  centerLabel="Toplam Ödev"
                />
              </PremiumPanel>
            </motion.div>
            <motion.div variants={itemVariants}>
              <PremiumPanel title="İçerik Kullanımı" description="Toplam görüntülenme">
                <p className="text-3xl font-black tracking-tight"><AnimatedValue value={stats.contentViews ?? data?.contentViews ?? 0} /></p>
                <p className="text-xs text-muted-foreground">Toplam görüntülenme</p>
                <PremiumAreaChart values={data?.contentViewSeries || []} height={90} className="mt-3" />
              </PremiumPanel>
            </motion.div>
          </div>

          {/* Yaklaşan Sınavlar + Son İçerikler + Hızlı İşlemler */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <motion.div variants={itemVariants}>
              <PremiumPanel title="Yaklaşan Sınavlar" description="Planlanan sınavlar" contentClassName="space-y-2.5">
                {upcomingExams.length ? upcomingExams.map((exam, index) => (
                  <div key={index} className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3">
                    <div className="w-11 shrink-0 text-center">
                      <p className="text-sm font-black tabular-nums">{exam.date ? exam.date.getDate() : '-'}</p>
                      <p className="text-[10px] uppercase text-muted-foreground">{exam.date ? new Intl.DateTimeFormat('tr-TR', { month: 'short' }).format(exam.date) : ''}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{exam.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{exam.className}</p>
                    </div>
                    {exam.days != null ? <span className="shrink-0 text-xs font-semibold text-[hsl(var(--brand-accent))]">{exam.days} gün</span> : null}
                  </div>
                )) : <div className="rounded-2xl border border-dashed border-foreground/10 p-6 text-center text-sm text-muted-foreground">Yaklaşan sınav yok.</div>}
              </PremiumPanel>
            </motion.div>

            <motion.div variants={itemVariants}>
              <PremiumPanel title="Son Paylaşılan İçeriklerim" description="Yüklediğin materyaller" contentClassName="space-y-2.5">
                {recentContents.length ? recentContents.map((content, index) => (
                  <button key={index} onClick={() => navigate('/t/content')} className="flex w-full items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-left transition-colors hover:bg-[hsl(var(--brand-accent)/0.06)]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[hsl(var(--brand-accent)/0.12)] text-[hsl(var(--brand-accent))]"><PlayCircle className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{content.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{content.type}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{content.date}</span>
                  </button>
                )) : <div className="rounded-2xl border border-dashed border-foreground/10 p-6 text-center text-sm text-muted-foreground">İçerik yok.</div>}
              </PremiumPanel>
            </motion.div>

            <motion.div variants={itemVariants}>
              <PremiumPanel title="Hızlı İşlemler" description="Tek tıkla başla">
                <div className="grid grid-cols-2 gap-3">
                  {quickActions.map(([label, Icon, gradient, onClick]) => (
                    <button key={label} onClick={onClick} className="ci-rise flex flex-col items-center gap-2 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 text-center hover:border-[hsl(var(--brand-accent)/0.28)]">
                      <span className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br text-white ${gradient}`}><Icon className="h-5 w-5" /></span>
                      <span className="text-xs font-semibold">{label}</span>
                    </button>
                  ))}
                </div>
              </PremiumPanel>
            </motion.div>
          </div>
        </div>

        {/* Sağ ray 1/3 */}
        <div className="space-y-5">
          <motion.div variants={itemVariants}>
            <PremiumPanel
              title="Bugünkü Ders Programım"
              description="Bugünkü akış"
              action={<Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate('/t/schedule')}>Tüm Program <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>}
              contentClassName="space-y-2.5"
            >
              {todaySchedule.length ? todaySchedule.map((lesson, index) => {
                const [tone, label] = LESSON_STATUS[lesson.status] || LESSON_STATUS.pending;
                return (
                  <div key={index} className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3">
                    <div className="w-[64px] shrink-0 text-xs font-bold tabular-nums text-muted-foreground">{lesson.time}</div>
                    <span className="shrink-0 rounded-lg bg-[hsl(var(--brand-accent)/0.14)] px-2 py-0.5 text-[11px] font-bold text-[hsl(var(--brand-accent))]">{lesson.class}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{lesson.subject}</p>
                    </div>
                    <PremiumStatusPill tone={tone}>{label}</PremiumStatusPill>
                  </div>
                );
              }) : <div className="rounded-2xl border border-dashed border-foreground/10 p-8 text-center text-sm text-muted-foreground">Bugün ders yok.</div>}
            </PremiumPanel>
          </motion.div>

          <motion.div variants={itemVariants}>
            <PremiumPanel
              title="Bekleyen Değerlendirmeler"
              description={`${stats.pendingGradingCount || 0} ödev değerlendirme bekliyor`}
              action={<Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate('/t/submissions')}>Tümü <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>}
              contentClassName="space-y-2.5"
            >
              {pendingGrading.length ? pendingGrading.map((item, index) => (
                <button key={index} onClick={() => navigate('/t/submissions')} className="flex w-full items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-left transition-colors hover:bg-[hsl(var(--brand-accent)/0.06)]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.className} - {item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.count} öğrenci</p>
                  </div>
                  <span className="grid h-7 min-w-[28px] shrink-0 place-items-center rounded-lg bg-[hsl(var(--brand-accent)/0.16)] px-2 text-xs font-black text-[hsl(var(--brand-accent))]">{item.count}</span>
                </button>
              )) : <div className="rounded-2xl border border-dashed border-foreground/10 p-6 text-center text-sm text-muted-foreground">Bekleyen değerlendirme yok 🎉</div>}
            </PremiumPanel>
          </motion.div>

          <motion.div variants={itemVariants}>
            <PremiumPanel
              title="Son Duyurularım"
              description="Yayınladığın duyurular"
              action={<Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate('/t/announcements')}>Tümü <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>}
              contentClassName="space-y-2.5"
            >
              {announcementList.length ? announcementList.map((item, index) => (
                <button key={index} onClick={() => navigate('/t/announcements')} className="flex w-full items-start gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-left transition-colors hover:bg-[hsl(var(--brand-accent)/0.06)]">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[hsl(var(--brand-accent)/0.12)] text-[hsl(var(--brand-accent))]"><Megaphone className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    {item.detail ? <p className="truncate text-xs text-muted-foreground">{item.detail}</p> : null}
                  </div>
                  {item.date ? <span className="shrink-0 text-[11px] text-muted-foreground">{item.date}</span> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </button>
              )) : <div className="rounded-2xl border border-dashed border-foreground/10 p-6 text-center text-sm text-muted-foreground">Duyuru yok.</div>}
            </PremiumPanel>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
