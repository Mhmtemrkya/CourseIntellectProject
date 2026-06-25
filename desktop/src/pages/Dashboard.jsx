import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  GraduationCap,
  School,
  ClipboardCheck,
  HelpCircle,
  Calendar,
  Megaphone,
  MessageCircle,
  UserMinus,
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import {
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

function AnnouncementItem({ announcement }) {
  return (
    <PremiumListRow
      icon={Megaphone}
      title={announcement.title}
      subtitle={`${announcement.audience || 'Tüm kurum'}${announcement.date ? ` • ${announcement.date}` : ''}`}
      meta={announcement.detail ? announcement.detail.slice(0, 42) : ''}
      accent
    />
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [todayLessons, setTodayLessons] = useState([]);
  const [selectedInteraction, setSelectedInteraction] = useState(null);
  const [selectedClass, setSelectedClass] = useState('all');
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
  const announcements = data?.announcements || [];
  const quickStats = data?.quickStats || {};
  const classOptions = data?.classOptions || [];
  const attendanceSeries = data?.attendanceSeries || [];
  const attendanceValues = attendanceSeries.map((item) => item.value);
  const selectedLessons = selectedClass === 'all'
    ? lessons
    : lessons.filter((lesson) => lesson.class === selectedClass);
  const latestAttendance = attendanceSeries.at(-1) || { value: 0, present: 0, total: 0 };

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

      <motion.div variants={itemVariants}>
        <PremiumPanel title="Canlı Kurum Operasyonu" description="Son 7 günlük gerçek katılım ve bugünün yönetim özeti">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(330px,0.8fr)]">
            <div className="rounded-3xl border border-foreground/10 bg-[#020B1F]/40 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Öğrenci katılım eğrisi</p>
                  <div className="mt-2 flex items-end gap-3">
                    <p className="text-4xl font-black tracking-tight">%{latestAttendance.value}</p>
                    <p className="pb-1 text-sm text-muted-foreground">{latestAttendance.present}/{latestAttendance.total} öğrenci bugün kayıtlı</p>
                  </div>
                </div>
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">Canlı veri</Badge>
              </div>
              <MiniLineChart values={attendanceValues} tone="emerald" className="mt-6 h-56" />
              <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
                {attendanceSeries.map((item) => (
                  <div key={item.label}>
                    <p className="font-semibold">{item.label}</p>
                    <p className="mt-1 tabular-nums text-foreground">%{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Bugünkü ders', lessons.length, Calendar, 'Programlanan ders sayısı'],
                ['Bugün izinli', quickStats.todayLeaveCount || 0, UserMinus, 'Onaylı izin kaydı'],
                ['Yayınlanan duyuru', quickStats.publishedAnnouncements || 0, Megaphone, 'Toplam canlı duyuru'],
                ['Bekleyen mesaj', quickStats.unansweredMessages || 0, MessageCircle, 'Yanıt bekleyen ileti'],
              ].map(([label, value, Icon, detail]) => (
                <div key={label} className="rounded-3xl border border-foreground/10 bg-foreground/[0.035] p-4">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[hsl(var(--brand-accent)/0.14)] text-[hsl(var(--brand-accent))]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-3xl font-black tabular-nums">{value}</p>
                  <p className="mt-1 text-sm font-bold">{label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </PremiumPanel>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <PremiumPanel
            title="Bugünkü Dersler"
            description={selectedClass === 'all' ? 'Tüm sınıfların bugünkü ders akışı' : `${selectedClass} sınıfının bugünkü ders akışı`}
            action={(
              <div className="flex items-center gap-2">
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Sınıf seç" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Sınıflar</SelectItem>
                    {classOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => navigate('/schedule')}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Program
                </Button>
              </div>
            )}
            contentClassName="space-y-3"
          >
              {selectedLessons.length > 0 ? selectedLessons.map((lesson, index) => (
                <LessonCard key={`${lesson.subject}-${lesson.class}-${index}`} lesson={lesson} />
              )) : (
                <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
                  {selectedClass === 'all' ? 'Bugün için kayıtlı ders akışı bulunmuyor.' : `${selectedClass} için bugün kayıtlı ders bulunmuyor.`}
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
          <PremiumPanel title="Duyurular" description={`${announcements.length} güncel duyuru gösteriliyor`}>
              {announcements.length > 0 ? announcements.map((announcement) => (
                <AnnouncementItem key={announcement.id || announcement.title} announcement={announcement} />
              )) : (
                <p className="text-sm text-muted-foreground">Henüz yayınlanmış duyuru bulunmuyor.</p>
              )}
          </PremiumPanel>
        </motion.div>

        <motion.div variants={itemVariants}>
          <PremiumPanel title="Hızlı İstatistikler" description="Yönetim kararı için canlı ve anlamlı göstergeler" contentClassName="grid gap-3 sm:grid-cols-2">
              {[
                ['Bugün İzinli Personel', quickStats.todayLeaveCount || 0, UserMinus, data?.todayLeaves?.length ? data.todayLeaves.map((item) => item.staffName).join(', ') : 'Bugün izinli personel yok', null],
                ['Yayınlanan Duyuru', quickStats.publishedAnnouncements || 0, Megaphone, 'Yayındaki toplam duyuru sayısı', '/admin/announcements'],
                ['Yanıt Bekleyen Mesaj', quickStats.unansweredMessages || 0, MessageCircle, 'Geri dönüş bekleyen mesajlar', '/chat'],
              ].map(([label, value, Icon, detail, action]) => (
                <button
                  type="button"
                  key={label}
                  onClick={() => (action ? navigate(action) : undefined)}
                  className={`rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 text-left transition-all ${action ? 'hover:border-[hsl(var(--brand-accent)/0.35)] hover:bg-[hsl(var(--brand-accent)/0.07)]' : 'cursor-default'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--brand-accent)/0.12)] text-[hsl(var(--brand-accent))]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-2xl font-black tabular-nums">{value}</span>
                  </div>
                  <p className="mt-3 text-sm font-bold">{label}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{detail}</p>
                </button>
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
