import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  GraduationCap,
  School,
  ClipboardCheck,
  HelpCircle,
  FileQuestion,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Progress } from '../components/ui/progress';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import {
  MiniBarChart,
  MiniDonut,
  MiniLineChart,
  PremiumListRow,
  PremiumMetricCard,
  PremiumPanel,
} from '../components/ui/premium-dashboard';
import { fetchScheduleEntries } from '../lib/api/modules';
import { fetchAdminDashboardData } from '../lib/api/dashboardData';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const todayKeyMap = {
  1: 'Pazartesi',
  2: 'Salı',
  3: 'Çarşamba',
  4: 'Perşembe',
  5: 'Cuma',
  6: 'Cumartesi',
  0: 'Pazar',
};

function StatCard({ title, value, icon: Icon, trend, tone, onClick }) {
  return (
    <motion.div variants={itemVariants}>
      <PremiumMetricCard title={title} value={value} icon={Icon} trend={trend} tone={tone} onClick={onClick} />
    </motion.div>
  );
}

function LessonCard({ lesson }) {
  const statusColors = {
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    ongoing: 'bg-brand-accent/10 text-brand-accent',
    upcoming: 'bg-muted text-muted-foreground',
  };

  const statusLabels = {
    completed: 'Tamamlandı',
    ongoing: 'Devam Ediyor',
    upcoming: 'Bekliyor',
  };

  return (
    <div className="group flex items-center gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 transition-all hover:border-[hsl(var(--brand-accent)/0.28)] hover:bg-[hsl(var(--brand-accent)/0.08)]">
      <div className="flex-shrink-0 w-16 text-center">
        <p className="text-lg font-bold text-[hsl(var(--brand-accent))]">{lesson.time}</p>
        <p className="text-xs text-muted-foreground">Program</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold truncate">{lesson.subject}</h4>
          <Badge variant="outline" className="text-xs">{lesson.class}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{lesson.teacher} • {lesson.room}</p>
      </div>
      <Badge className={statusColors[lesson.status] || statusColors.upcoming}>
        {statusLabels[lesson.status] || statusLabels.upcoming}
      </Badge>
    </div>
  );
}

function ActivityItem({ activity }) {
  const iconMap = {
    check: CheckCircle2,
    file: FileQuestion,
  };
  const Icon = iconMap[activity.icon] || AlertCircle;

  return (
    <PremiumListRow icon={Icon} title={activity.message} subtitle={activity.time} accent={activity.icon === 'check'} />
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [todayLessons, setTodayLessons] = useState([]);
  const [selectedInteraction, setSelectedInteraction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const statRoutes = useMemo(() => ({
    'Toplam Öğrenci': '/students',
    'Toplam Öğretmen': '/teachers',
    'Aktif Sınıf': '/classes',
    'Bugünkü Devam': '/reports',
  }), []);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      // Tek doğruluk kaynağı: /api/schedule (class-schedule-entry kayıtları).
      // Eski 'class-schedule' platform-config tabanlı paralel okuma kaldırıldı.
      const [payload, scheduleEntries] = await Promise.all([
        fetchAdminDashboardData(),
        fetchScheduleEntries().catch(() => []),
      ]);
      const todayName = todayKeyMap[new Date().getDay()];
      const configuredLessons = (Array.isArray(scheduleEntries) ? scheduleEntries : [])
        .filter((lesson) => lesson.day === todayName)
        .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
        .map((lesson) => ({
          time: lesson.time || 'Saat yok',
          subject: lesson.subject || 'Ders',
          class: lesson.className || 'Sınıf',
          teacher: lesson.teacher || 'Öğretmen',
          room: lesson.room || 'Derslik',
          status: 'upcoming',
        }));
      setData(payload);
      setTodayLessons(configuredLessons.length > 0 ? configuredLessons : (payload.lessons || []));
    } catch (err) {
      setError(err.message || 'Dashboard verisi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Yönetici paneli hazırlanıyor...</p>
      </div>
    );
  }

  const stats = data?.stats || {};
  const lessons = todayLessons;
  const pendingItems = data?.pendingItems || [];
  const activities = data?.activities || [];
  const quickStats = data?.quickStats || {};
  const operationalChart = [
    stats.totalStudents || 0,
    stats.totalTeachers || 0,
    stats.totalClasses || 0,
    quickStats.attendanceRate || stats.todayAttendanceRate || 0,
    quickStats.answeredMessagesRate || 0,
    quickStats.examRate || 0,
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
      data-testid="dashboard-page"
    >
      <div>
        <h1 className="text-3xl font-bold font-heading">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Bugünkü operasyon özeti canlı backend verisiyle yükleniyor.</p>
      </div>

      {error ? (
        <ErrorBanner
          title="Dashboard verisi alınamadı"
          message={error}
          onRetry={loadDashboard}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Toplam Öğrenci" value={stats.totalStudents || 0} icon={Users} trend="Backend" tone="blue" onClick={() => navigate(statRoutes['Toplam Öğrenci'])} />
        <StatCard title="Toplam Öğretmen" value={stats.totalTeachers || 0} icon={GraduationCap} trend="Aktif" tone="amber" onClick={() => navigate(statRoutes['Toplam Öğretmen'])} />
        <StatCard title="Aktif Sınıf" value={stats.totalClasses || 0} icon={School} trend="Sınıf" tone="emerald" onClick={() => navigate(statRoutes['Aktif Sınıf'])} />
        <StatCard title="Bugünkü Devam" value={`${stats.todayAttendanceRate || 0}%`} icon={ClipboardCheck} trend="Oran" tone="violet" onClick={() => navigate(statRoutes['Bugünkü Devam'])} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <motion.div variants={itemVariants} className="xl:col-span-8">
          <PremiumPanel title="Finansal Performans" description="Operasyon sinyalleri ve canlı özet eğrisi">
            <div className="grid gap-5 lg:grid-cols-[1fr_210px]">
              <div className="rounded-3xl border border-foreground/10 bg-[#020B1F]/35 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Genel operasyon grafiği</p>
                    <p className="mt-1 text-2xl font-black tracking-tight">Canlı Dashboard</p>
                  </div>
                  <Badge variant="outline">Bugün</Badge>
                </div>
                <MiniLineChart values={operationalChart} className="h-40" />
                <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                  <span>1 May</span>
                  <span className="text-center">15 May</span>
                  <span className="text-right">Bugün</span>
                </div>
              </div>
              <div className="grid gap-4">
                <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.035] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Haftalık Devam</p>
                  <div className="mt-4 flex justify-center">
                    <MiniDonut value={quickStats.attendanceRate || stats.todayAttendanceRate || 0} label="Devam" />
                  </div>
                </div>
                <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.035] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Kanal Yoğunluğu</p>
                  <MiniBarChart values={[quickStats.answeredMessagesRate || 0, quickStats.contentRate || 0, quickStats.examRate || 0, stats.totalClasses || 0, stats.totalTeachers || 0]} className="mt-4" />
                </div>
              </div>
            </div>
          </PremiumPanel>
        </motion.div>
        <motion.div variants={itemVariants} className="xl:col-span-4">
          <PremiumPanel title="Sistem Özeti" description="Referans dashboard tarzı yoğun özet">
            <div className="space-y-3">
              {[
                ['Ders akışı', lessons.length, Calendar],
                ['Bekleyen etkileşim', pendingItems.length, HelpCircle],
                ['Aktivite', activities.length, TrendingUp],
                ['Performans', `${quickStats.examRate || 0}%`, FileQuestion],
              ].map(([label, value, Icon]) => (
                <PremiumListRow key={label} icon={Icon} title={label} subtitle="Canlı backend verisi" meta={value} accent />
              ))}
            </div>
          </PremiumPanel>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <PremiumPanel
            title="Bugünkü Dersler"
            description="Bugünün sınıf programındaki ders akışı"
            action={(
              <Button variant="outline" size="sm" onClick={() => navigate('/schedule')}>
                <Calendar className="h-4 w-4 mr-2" />
                Program Yönetimi
              </Button>
            )}
            contentClassName="space-y-3"
          >
              {lessons.length > 0 ? lessons.map((lesson, index) => (
                <LessonCard key={`${lesson.subject}-${lesson.class}-${index}`} lesson={lesson} />
              )) : (
                <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
                  Bugün için kayıtlı ders akışı bulunmuyor.
                </div>
              )}
          </PremiumPanel>
        </motion.div>

        <motion.div variants={itemVariants}>
          <PremiumPanel
            title="Bekleyen Etkileşimler"
            description={`${pendingItems.length} konuşma geri dönüş bekliyor`}
            action={(
              <Badge variant="default" className="bg-brand-accent">
                {pendingItems.length}
              </Badge>
            )}
            contentClassName="space-y-4"
          >
              {pendingItems.length > 0 ? pendingItems.map((item) => (
                <PremiumListRow key={item.id} icon={HelpCircle} title={item.studentName} subtitle={item.question} meta={item.subject} accent onClick={() => setSelectedInteraction(item)} />
              )) : (
                <p className="text-sm text-muted-foreground">Bekleyen mesaj veya etkileşim bulunmuyor.</p>
              )}
              {pendingItems.length > 0 ? (
                <Button variant="outline" className="w-full" onClick={() => navigate('/chat')}>
                  Tüm Etkileşimleri Aç
                </Button>
              ) : null}
          </PremiumPanel>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <PremiumPanel title="Son Aktiviteler" description="Duyuru ve bildirim akışından derlendi">
              {activities.length > 0 ? activities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              )) : (
                <p className="text-sm text-muted-foreground">Henüz aktivite kaydı yok.</p>
              )}
          </PremiumPanel>
        </motion.div>

        <motion.div variants={itemVariants}>
          <PremiumPanel title="Hızlı İstatistikler" description="Canlı özet göstergeleri" contentClassName="space-y-6">
              {[
                ['Haftalık Devam Oranı', quickStats.attendanceRate || 0],
                ['Yanıtlanan Mesajlar', quickStats.answeredMessagesRate || 0],
                ['Duyuru / İçerik Yoğunluğu', quickStats.contentRate || 0],
                ['Sınav Performansı', quickStats.examRate || 0],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">{label}</span>
                    <span className="text-sm font-bold">{value}%</span>
                  </div>
                  <Progress value={value} className="h-2" />
                </div>
              ))}
          </PremiumPanel>
        </motion.div>
      </div>

      <Dialog open={!!selectedInteraction} onOpenChange={(open) => !open && setSelectedInteraction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedInteraction?.studentName || 'Etkileşim detayı'}</DialogTitle>
            <DialogDescription>Bekleyen etkileşim için hızlı detay ve işlem görünümü.</DialogDescription>
          </DialogHeader>
          {selectedInteraction ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedInteraction.subject}</Badge>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                {selectedInteraction.question}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => navigate('/chat')}>Mesaj Merkezini Aç</Button>
            <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => setSelectedInteraction(null)}>Tamam</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
