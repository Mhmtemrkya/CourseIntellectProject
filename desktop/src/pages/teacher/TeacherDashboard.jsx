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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchTeacherDashboardData } from '../../lib/api/dashboardData';

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
    { label: 'Yoklama Al', icon: ClipboardCheck, color: 'text-brand-primary', onClick: () => navigate('/t/attendance') },
    { label: 'Canlı Ders', icon: Video, color: 'text-brand-accent', onClick: () => navigate('/t/live-lessons') },
    { label: 'İçerik Yükle', icon: BookOpen, color: 'text-green-600', onClick: () => navigate('/t/content') },
    { label: 'Duyurular', icon: Bell, color: 'text-brand-primary', onClick: () => navigate('/t/announcements') },
  ];

  const statRoutes = {
    'Bugünkü Ders': '/t/schedule',
    'Bekleyen Mesaj': '/t/questions',
    'Alınan Yoklama': '/t/attendance',
    'Toplam Öğrenci': '/t/attendance',
  };

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          ['Bugünkü Ders', stats.todayLessons || 0, Calendar, 'text-brand-primary', 'border-l-brand-primary'],
          ['Bekleyen Mesaj', stats.pendingQuestions || 0, HelpCircle, 'text-brand-accent', 'border-l-brand-accent'],
          ['Alınan Yoklama', `${stats.completedAttendance || 0}/${stats.todayLessons || 0}`, ClipboardCheck, 'text-green-600', 'border-l-green-500'],
          ['Toplam Öğrenci', stats.totalStudents || 0, Users, 'text-brand-primary', 'border-l-brand-primary'],
        ].map(([title, value, Icon, iconColor, borderClass]) => (
          <motion.div variants={itemVariants} key={title}>
            <Card className={`border-l-4 cursor-pointer hover:shadow-card-hover transition-all ${borderClass}`} onClick={() => navigate(statRoutes[title])}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{title}</p>
                    <p className="text-3xl font-bold mt-2">{value}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted">
                    <Icon className={`h-6 w-6 ${iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Bugünkü Program</CardTitle>
                <CardDescription>{todayLabel} gününe ait ders akışı</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/t/schedule')}>Tam Takvim</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {todaySchedule.length > 0 ? todaySchedule.map((lesson, index) => (
                <div key={`${lesson.subject}-${lesson.class}-${index}`} className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border">
                  <div className="flex-shrink-0 w-20 text-center">
                    <p className="text-sm font-bold text-brand-primary">{lesson.time}</p>
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
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-brand-accent" />
                  Bekleyen Etkileşimler
                </CardTitle>
                <CardDescription>{pendingQuestions.length} konuşma geri dönüş bekliyor</CardDescription>
              </div>
              <Badge className="bg-brand-accent">{pendingQuestions.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingQuestions.length > 0 ? pendingQuestions.map((question) => (
                <div key={question.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-brand-primary text-white text-sm">
                      {question.student.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{question.student}</p>
                      <span className="text-xs text-muted-foreground">{question.time}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{question.question}</p>
                    <Badge variant="outline" className="mt-2 text-xs">{question.class}</Badge>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">Bekleyen mesaj bulunmuyor.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Hızlı İşlemler</CardTitle>
            <CardDescription>
              Aktif ödev: {quickStats.activeHomework || 0} • Yayındaki içerik: {quickStats.visibleContent || 0} • Bildirim: {quickStats.notifications || 0}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {teacherQuickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button key={action.label} variant="outline" className="h-auto py-4 flex-col gap-2" onClick={action.onClick}>
                    <Icon className={`h-6 w-6 ${action.color}`} />
                    <span>{action.label}</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
