import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Users, CalendarDays, ClipboardList, GraduationCap, Megaphone, ArrowRight, Upload,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import RoleDashboardColumns from '../../components/dashboard/RoleDashboardColumns';
import { PremiumPanel, PremiumStatusPill } from '../../components/ui/premium-dashboard';
import { useApp } from '../../context/AppContext';
import { fetchTeacherDashboardData } from '../../lib/api/dashboardData';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } };

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
    return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4"><LoadingDots /><p className="text-muted-foreground">Öğretmen paneli hazırlanıyor...</p></div>;
  }

  const stats = data?.stats || {};
  const examStats = data?.examStats || {};
  const homework = data?.homeworkDistribution || {};
  const todaySchedule = data?.todaySchedule || [];
  const pendingGrading = data?.pendingGrading || [];
  const upcomingExams = data?.upcomingExams || [];
  const announcements = data?.announcementList || [];
  const todayLabel = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date());

  const groups = [
    {
      key: 'classes', title: 'Ders ve Sınıflar', description: 'Bugünkü öğretim yükünüz ve sorumlu olduğunuz öğrenciler',
      cards: [
        { key: 'courses', label: 'Aktif Ders', value: stats.totalCourses || 0, caption: 'Sorumlu olduğunuz ders', icon: BookOpen, tone: 'violet', path: '/t/schedule' },
        { key: 'students', label: 'Öğrenci', value: stats.totalStudents || 0, caption: 'Ders verdiğiniz öğrenci', icon: Users, tone: 'blue', path: '/t/reports' },
        { key: 'today', label: 'Bugünkü Ders', value: stats.todayLessons || 0, caption: `${stats.completedToday || 0} tamamlandı`, icon: CalendarDays, tone: 'emerald', path: '/t/schedule' },
      ],
    },
    {
      key: 'assessment', title: 'Değerlendirme', description: 'Aksiyon bekleyen ödev ve sınav işlemleri',
      cards: [
        { key: 'grading', label: 'Bekleyen Değerlendirme', value: stats.pendingGradingCount || 0, caption: 'Notlandırılacak teslim', icon: ClipboardList, tone: 'amber', path: '/t/submissions' },
        { key: 'plannedExams', label: 'Planlanan Sınav', value: examStats.planned || 0, caption: 'Yaklaşan sınav planı', icon: GraduationCap, tone: 'brand', path: '/t/exams' },
        { key: 'overdueHomework', label: 'Geciken Ödev', value: homework.overdue || 0, caption: 'Teslim süresi geçen', icon: ClipboardList, tone: 'rose', path: '/t/assignments' },
      ],
    },
    {
      key: 'communication', title: 'İçerik ve İletişim', description: 'Paylaşım ve duyuru durumunuz',
      cards: [
        { key: 'announcements', label: 'Duyuru', value: announcements.length, caption: 'Son yayınlanan duyurular', icon: Megaphone, tone: 'blue', path: '/t/announcements' },
        { key: 'contents', label: 'Paylaşılan İçerik', value: (data?.recentContents || []).length, caption: 'Son içerikleriniz', icon: Upload, tone: 'emerald', path: '/t/content' },
        { key: 'views', label: 'İçerik Görüntülenme', value: stats.contentViews ?? data?.contentViews ?? 0, caption: 'Öğrenci etkileşimi', icon: BookOpen, tone: 'cyan', path: '/t/content' },
      ],
    },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="teacher-dashboard-page">
      <motion.div variants={itemVariants}>
        <h1 className="text-3xl font-bold font-heading">Öğretmen Çalışma Merkezi</h1>
        <p className="mt-1 text-sm capitalize text-muted-foreground">{data?.teacherName || 'Öğretmen'} · {todayLabel} · yalnız öncelikli işlemleriniz</p>
      </motion.div>

      {error ? <ErrorBanner title="Öğretmen paneli yüklenemedi" message={error} onRetry={loadDashboard} /> : null}
      <RoleDashboardColumns groups={groups} navigate={navigate} testId="teacher-dashboard-columns" />

      <div className="grid gap-5 xl:grid-cols-3">
        <motion.div variants={itemVariants}>
          <PremiumPanel title="Bugünkü Program" description="Sıradaki derslerinizi takip edin" action={<Button size="sm" variant="ghost" onClick={() => navigate('/t/schedule')}>Program <ArrowRight className="ml-1 h-4 w-4" /></Button>} contentClassName="space-y-2.5">
            {todaySchedule.length ? todaySchedule.slice(0, 5).map((lesson, index) => {
              const [tone, label] = LESSON_STATUS[lesson.status] || LESSON_STATUS.pending;
              return <div key={`${lesson.time}-${index}`} className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3"><span className="w-14 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">{lesson.time}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{lesson.subject}</p><p className="truncate text-xs text-muted-foreground">{lesson.class}</p></div><PremiumStatusPill tone={tone}>{label}</PremiumStatusPill></div>;
            }) : <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Bugün dersiniz bulunmuyor.</p>}
          </PremiumPanel>
        </motion.div>

        <motion.div variants={itemVariants}>
          <PremiumPanel title="Öncelikli Değerlendirmeler" description="İlk ele alınması gereken teslimler" action={<Button size="sm" variant="ghost" onClick={() => navigate('/t/submissions')}>Tümü <ArrowRight className="ml-1 h-4 w-4" /></Button>} contentClassName="space-y-2.5">
            {pendingGrading.length ? pendingGrading.slice(0, 5).map((item, index) => <button key={`${item.title}-${index}`} type="button" onClick={() => navigate('/t/submissions')} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-left"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.className} · {item.title}</span><span className="text-xs text-muted-foreground">Değerlendirme bekliyor</span></span><span className="rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-black text-amber-500">{item.count}</span></button>) : <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Bekleyen değerlendirme yok.</p>}
          </PremiumPanel>
        </motion.div>

        <motion.div variants={itemVariants}>
          <PremiumPanel title="Yaklaşan Sınavlar" description="Hazırlık gerektiren sınav planları" action={<Button size="sm" variant="ghost" onClick={() => navigate('/t/exams')}>Sınavlar <ArrowRight className="ml-1 h-4 w-4" /></Button>} contentClassName="space-y-2.5">
            {upcomingExams.length ? upcomingExams.slice(0, 5).map((exam, index) => <button key={`${exam.title}-${index}`} type="button" onClick={() => navigate('/t/exams')} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-left"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{exam.title}</span><span className="text-xs text-muted-foreground">{exam.className}</span></span><span className="text-xs font-bold text-[hsl(var(--brand-accent))]">{exam.days != null ? `${exam.days} gün` : 'Planlı'}</span></button>) : <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Yaklaşan sınav yok.</p>}
          </PremiumPanel>
        </motion.div>
      </div>
    </motion.div>
  );
}
