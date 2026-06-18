import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  Video,
  ClipboardCheck,
  HelpCircle,
  BookOpen,
  Bell,
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchTeacherDashboardData } from '../../lib/api/dashboardData';
import {
  MiniBarChart,
  MiniDonut,
  MiniLineChart,
  PremiumListRow,
  PremiumMetricCard,
  PremiumPanel,
} from '../../components/ui/premium-dashboard';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
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
      const payload = await fetchTeacherDashboardData(user);
      setData(payload);
    } catch (err) {
      setError(err.message || 'Öğretmen dashboard verisi alınamadı.');
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
        <p className="text-muted-foreground">Öğretmen paneli hazırlanıyor...</p>
      </div>
    );
  }

  const stats = data?.stats || {};
  const todaySchedule = data?.todaySchedule || [];
  const pendingQuestions = data?.pendingQuestions || [];
  const quickStats = data?.quickStats || {};
  const todayLabel = new Intl.DateTimeFormat('tr-TR', { weekday: 'long' }).format(new Date());
  const teacherQuickActions = [
    { label: 'Yoklama Al', icon: ClipboardCheck, onClick: () => navigate('/t/attendance') },
    { label: 'Canlı Ders', icon: Video, onClick: () => navigate('/t/live-lessons') },
    { label: 'İçerik Yükle', icon: BookOpen, onClick: () => navigate('/t/content') },
    { label: 'Duyurular', icon: Bell, onClick: () => navigate('/t/announcements') },
  ];
  const statRoutes = {
    'Bugünkü Ders': '/t/schedule',
    'Bekleyen Mesaj': '/t/questions',
    'Alınan Yoklama': '/t/attendance',
    'Toplam Öğrenci': '/t/attendance',
  };
  const teacherSignal = [
    stats.todayLessons || 0,
    stats.pendingQuestions || 0,
    stats.completedAttendance || 0,
    stats.totalStudents || 0,
    quickStats.activeHomework || 0,
    quickStats.visibleContent || 0,
    quickStats.notifications || 0,
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
      data-testid="teacher-dashboard-page"
    >
      <div>
        <h1 className="text-3xl font-bold font-heading">Hoş Geldiniz, {data?.teacherName || 'Öğretmenim'}</h1>
        <p className="text-muted-foreground mt-1">Program, mesaj ve ders operasyonları canlı backend verisinden geliyor.</p>
      </div>

      {error ? (
        <ErrorBanner title="Öğretmen paneli yüklenemedi" message={error} onRetry={loadDashboard} />
      ) : null}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Bugünkü Ders', stats.todayLessons || 0, Calendar, 'blue', 'Program'],
          ['Bekleyen Mesaj', stats.pendingQuestions || 0, HelpCircle, 'amber', 'Etkileşim'],
          ['Alınan Yoklama', `${stats.completedAttendance || 0}/${stats.todayLessons || 0}`, ClipboardCheck, 'emerald', 'Yoklama'],
          ['Toplam Öğrenci', stats.totalStudents || 0, Users, 'violet', 'Sınıflar'],
        ].map(([title, value, Icon, tone, trend]) => (
          <motion.div variants={itemVariants} key={title}>
            <PremiumMetricCard title={title} value={value} icon={Icon} tone={tone} trend={trend} onClick={() => navigate(statRoutes[title])} />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <motion.div variants={itemVariants} className="xl:col-span-8">
          <PremiumPanel title="Haftalık Ders Programı" description="Ders yoğunluğu ve sınıf operasyon sinyali">
            <div className="grid gap-5 lg:grid-cols-[1fr_180px]">
              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ders dağılımı</p>
                    <p className="mt-1 text-2xl font-black">Öğretmen paneli</p>
                  </div>
                  <Badge variant="outline">{todayLabel}</Badge>
                </div>
                <MiniLineChart values={teacherSignal} className="h-40" />
              </div>
              <div className="grid gap-4">
                <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Yoklama Tamam</p>
                  <div className="mt-4 flex justify-center">
                    <MiniDonut value={stats.todayLessons ? Math.round(((stats.completedAttendance || 0) / stats.todayLessons) * 100) : 0} label="Yoklama" />
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">İçerik / Ödev</p>
                  <MiniBarChart values={[quickStats.activeHomework || 0, quickStats.visibleContent || 0, quickStats.notifications || 0, stats.totalStudents || 0]} className="mt-4" />
                </div>
              </div>
            </div>
          </PremiumPanel>
        </motion.div>
        <motion.div variants={itemVariants} className="xl:col-span-4">
          <PremiumPanel title="Hızlı İşlemler" description={`Aktif ödev: ${quickStats.activeHomework || 0} • Yayındaki içerik: ${quickStats.visibleContent || 0}`}>
            <div className="grid gap-3">
              {teacherQuickActions.map((action) => (
                <PremiumListRow key={action.label} icon={action.icon} title={action.label} subtitle="Tek tıkla aç" accent onClick={action.onClick} />
              ))}
            </div>
          </PremiumPanel>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <PremiumPanel title="Bugünkü Program" description={`${todayLabel} gününe ait ders akışı`} action={<Button variant="outline" size="sm" onClick={() => navigate('/t/schedule')}>Tam Takvim</Button>} contentClassName="space-y-3">
            {todaySchedule.length > 0 ? todaySchedule.map((lesson, index) => (
              <div key={`${lesson.subject}-${lesson.class}-${index}`} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex-shrink-0 w-20 text-center">
                  <p className="text-sm font-bold text-[hsl(var(--brand-accent))]">{lesson.time}</p>
                  <p className="text-xs text-muted-foreground">{lesson.class}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{lesson.subject}</h4>
                    <Badge variant="outline" className="text-xs">{lesson.class}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{lesson.room}</p>
                </div>
                <Badge className="bg-brand-accent/10 text-brand-accent">Hazır</Badge>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">Bugün için ders kaydı bulunmuyor.</p>
            )}
          </PremiumPanel>
        </motion.div>

        <motion.div variants={itemVariants}>
          <PremiumPanel title="Bekleyen Etkileşimler" description={`${pendingQuestions.length} konuşma geri dönüş bekliyor`} action={<Badge className="bg-brand-accent">{pendingQuestions.length}</Badge>} contentClassName="space-y-3">
            {pendingQuestions.length > 0 ? pendingQuestions.map((question) => (
              <PremiumListRow key={question.id} icon={HelpCircle} title={question.student} subtitle={question.question} meta={question.time} accent />
            )) : (
              <p className="text-sm text-muted-foreground">Bekleyen mesaj bulunmuyor.</p>
            )}
          </PremiumPanel>
        </motion.div>
      </div>
    </motion.div>
  );
}
