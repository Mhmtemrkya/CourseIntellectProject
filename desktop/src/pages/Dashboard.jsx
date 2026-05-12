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

function StatCard({ title, value, icon: Icon, trend, color, onClick }) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="relative overflow-hidden border-l-4 cursor-pointer hover:shadow-lg transition-shadow" style={{ borderLeftColor: color }} onClick={onClick}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">{title}</p>
              <p className="text-3xl font-bold mt-2 font-heading">{value}</p>
              {trend ? <p className="text-sm text-green-600 mt-2">{trend}</p> : null}
            </div>
            <div className="p-3 rounded-xl" style={{ backgroundColor: `${color}15` }}>
              <Icon className="h-6 w-6" style={{ color }} />
            </div>
          </div>
        </CardContent>
      </Card>
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
    <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border">
      <div className="flex-shrink-0 w-16 text-center">
        <p className="text-lg font-bold text-brand-primary">{lesson.time}</p>
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
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="p-2 rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{activity.message}</p>
        <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
      </div>
    </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Toplam Öğrenci" value={stats.totalStudents || 0} icon={Users} trend="Backend canlı" color="#00354F" onClick={() => navigate(statRoutes['Toplam Öğrenci'])} />
        <StatCard title="Toplam Öğretmen" value={stats.totalTeachers || 0} icon={GraduationCap} color="#D9790B" onClick={() => navigate(statRoutes['Toplam Öğretmen'])} />
        <StatCard title="Aktif Sınıf" value={stats.totalClasses || 0} icon={School} color="#10B981" onClick={() => navigate(statRoutes['Aktif Sınıf'])} />
        <StatCard title="Bugünkü Devam" value={`${stats.todayAttendanceRate || 0}%`} icon={ClipboardCheck} color="#3B82F6" onClick={() => navigate(statRoutes['Bugünkü Devam'])} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-xl">Bugünkü Dersler</CardTitle>
                <CardDescription>Bugünün sınıf programındaki ders akışı</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/schedule')}>
                <Calendar className="h-4 w-4 mr-2" />
                Program Yönetimi
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {lessons.length > 0 ? lessons.map((lesson, index) => (
                <LessonCard key={`${lesson.subject}-${lesson.class}-${index}`} lesson={lesson} />
              )) : (
                <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
                  Bugün için kayıtlı ders akışı bulunmuyor.
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-xl">Bekleyen Etkileşimler</CardTitle>
                <CardDescription>{pendingItems.length} konuşma geri dönüş bekliyor</CardDescription>
              </div>
              <Badge variant="default" className="bg-brand-accent">
                {pendingItems.length}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingItems.length > 0 ? pendingItems.map((item) => (
                <button type="button" key={item.id} className="w-full text-left flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors" onClick={() => setSelectedInteraction(item)}>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-brand-primary text-white text-xs">
                      {item.studentName.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.studentName}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.question}</p>
                    <Badge variant="outline" className="mt-2 text-xs">{item.subject}</Badge>
                  </div>
                </button>
              )) : (
                <p className="text-sm text-muted-foreground">Bekleyen mesaj veya etkileşim bulunmuyor.</p>
              )}
              {pendingItems.length > 0 ? (
                <Button variant="outline" className="w-full" onClick={() => navigate('/chat')}>
                  Tüm Etkileşimleri Aç
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Son Aktiviteler</CardTitle>
              <CardDescription>Duyuru ve bildirim akışından derlendi</CardDescription>
            </CardHeader>
            <CardContent>
              {activities.length > 0 ? activities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              )) : (
                <p className="text-sm text-muted-foreground">Henüz aktivite kaydı yok.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Hızlı İstatistikler</CardTitle>
              <CardDescription>Canlı özet göstergeleri</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
            </CardContent>
          </Card>
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
