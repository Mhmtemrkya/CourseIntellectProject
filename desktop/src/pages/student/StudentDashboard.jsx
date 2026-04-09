import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  BookOpen,
  Clock,
  Video,
  ClipboardCheck,
  TrendingUp,
  Star,
  Flame,
  Trophy,
  Target,
  Zap,
  Brain,
  Sparkles,
  Play,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchStudentDashboardData } from '../../lib/api/dashboardData';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export default function StudentDashboard() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await fetchStudentDashboardData(user);
      setData(payload);
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
  const actionMap = [
    { icon: Video, label: 'Canlı Derse Katıl', onClick: () => navigate('/s/live') },
    { icon: BookOpen, label: 'Konu Anlatımı', onClick: () => navigate('/s/content') },
    { icon: ClipboardCheck, label: 'Devamsızlıklarım', onClick: () => navigate('/s/attendance') },
    { icon: Brain, label: 'Soru Bankası', onClick: () => navigate('/s/questions') },
    { icon: Sparkles, label: 'AI Asistan', onClick: () => navigate('/s/ai') },
  ];
  const summaryCards = [
    ['Bugünkü Ders', stats.todayLessons || 0, Calendar, 'from-blue-500 to-cyan-500', () => navigate('/s/schedule')],
    ['Yaklaşan Sınav', stats.upcomingExams || 0, Target, 'from-purple-500 to-pink-500', () => navigate('/s/exams')],
    ['Devamsızlıklarım', stats.absentDays || stats.absentCount || 0, ClipboardCheck, 'from-amber-500 to-orange-500', () => navigate('/s/attendance')],
    ['Sınav Sonuçlarım', data?.recentResults?.length || 0, Trophy, 'from-emerald-500 to-green-600', () => navigate('/s/exam-results')],
    ['Bekleyen Ödev', stats.pendingAssignments || 0, Clock, 'from-yellow-500 to-orange-500', () => navigate('/s/assignments')],
  ];
  const xp = Number(stats.xp || 0);
  const streak = Number(stats.streak || 0);
  const achievementCards = [
    {
      id: 'first_xp',
      title: 'İlk XP',
      subtitle: "25 XP'ye ulaştın ve ilk ilerlemeni kaydettin.",
      unlocked: xp >= 25,
    },
    {
      id: 'quiz_starter',
      title: 'Quiz Başlangıcı',
      subtitle: 'Yaklaşık 3 quizlik ilerleme yakaladın.',
      unlocked: xp >= 100,
    },
    {
      id: 'quiz_master',
      title: 'Quiz Ustası',
      subtitle: '5+ quiz seviyesinde XP topladın.',
      unlocked: xp >= 200,
    },
    {
      id: 'streak_3',
      title: 'Alev Serisi',
      subtitle: '3 gün üst üste plan tamamladın.',
      unlocked: streak >= 3,
    },
  ];
  const nextAchievement = achievementCards.find((item) => !item.unlocked);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 relative"
      data-testid="student-dashboard-page"
    >
      <motion.div variants={itemVariants}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">👋</span>
              <h1 className="text-3xl lg:text-4xl font-bold font-heading bg-gradient-to-r from-[#00354F] to-[#D9790B] bg-clip-text text-transparent dark:from-white dark:to-[#D9790B]">
                İyi Günler, {data?.greetingName || 'Öğrenci'}
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">Günün planı ve ilerleme özeti burada.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-800">
              <Flame className="h-5 w-5 text-orange-600" />
              <span className="font-bold text-orange-700 dark:text-orange-400">{stats.streak || 0} gün seri</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700">
              <Trophy className="h-5 w-5 text-yellow-600" />
              <span className="font-bold text-yellow-700 dark:text-yellow-400">#{stats.rank || 1}</span>
              <span className="text-sm text-yellow-600 dark:text-yellow-500">/ {stats.totalStudents || 1}</span>
            </div>
          </div>
        </div>
        <div className="mt-6 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-muted-foreground">Seviye {stats.level || 1}</p>
              <p className="text-xl font-bold">{stats.xp || 0} XP</p>
            </div>
            <Badge className="bg-brand-accent text-white">Sonraki seviye için {stats.xpToNext || 100} XP</Badge>
          </div>
          <Progress value={Math.max(5, 100 - (stats.xpToNext || 100))} className="h-3" />
        </div>
      </motion.div>

      {error ? <ErrorBanner title="Öğrenci paneli yüklenemedi" message={error} onRetry={loadDashboard} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {summaryCards.map(([label, value, Icon, gradient, onClick]) => (
          <motion.div key={label} variants={itemVariants}>
            <Card className="relative overflow-hidden border-0 shadow-lg cursor-pointer transition-transform hover:-translate-y-1" onClick={onClick}>
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5`} />
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{label}</p>
                    <p className="text-4xl font-bold mt-2">{value}</p>
                  </div>
                  <div className={`p-4 rounded-2xl bg-gradient-to-br ${gradient} shadow-lg`}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-[#00354F] to-[#003d5c] text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="h-6 w-6" />
                  <div>
                    <CardTitle className="text-white">Bugünkü Dersler</CardTitle>
                    <CardDescription className="text-white/70">Yoklama ve sınıf verisinden türetildi</CardDescription>
                  </div>
                </div>
                <Badge className="bg-white/20 text-white border-0">
                  {data?.todayLessons?.length || 0} ders
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {(data?.todayLessons || []).length > 0 ? data.todayLessons.map((lesson, index) => (
                <div key={`${lesson.subject}-${index}`} className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border">
                  <div className="flex-shrink-0 w-16 text-center">
                    <p className="text-lg font-bold text-brand-primary">{lesson.time}</p>
                  </div>
                  <div className="w-1 h-12 rounded-full bg-brand-accent" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{lesson.subject}</h4>
                    <p className="text-sm text-muted-foreground">{lesson.class} • {lesson.room}</p>
                  </div>
                  <Badge className="bg-brand-accent/10 text-brand-accent border-0">
                    {lesson.status === 'ongoing' ? 'Devam ediyor' : 'Kayıtlı'}
                  </Badge>
                  {lesson.status === 'ongoing' ? (
                    <Button size="sm" className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600" onClick={() => navigate('/s/live')}>
                      <Play className="h-4 w-4 mr-1" /> Katıl
                    </Button>
                  ) : null}
                </div>
              )) : (
                <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
                  Bugün için kayıtlı ders görünmüyor.
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <div className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#D9790B]" />
                  Genel İlerleme
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 py-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>İçerik tamamlanma oranı</span>
                    <span className="font-bold">{stats.completedContent || 0}%</span>
                  </div>
                  <Progress value={stats.completedContent || 0} className="h-3" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-xl bg-green-50 dark:bg-green-900/20">
                    <p className="text-2xl font-bold text-green-600">{data?.summary?.watchedVideos || 0}</p>
                    <p className="text-xs text-muted-foreground">Video / içerik</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                    <p className="text-2xl font-bold text-blue-600">{data?.summary?.solvedQuestions || 0}</p>
                    <p className="text-xs text-muted-foreground">Soru erişimi</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-600" />
                  Yaklaşan Sınavlar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data?.upcomingExams || []).map((exam, index) => (
                  <div key={`${exam.subject}-${index}`} className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800">
                    <div>
                      <p className="font-medium">{exam.subject}</p>
                      <p className="text-sm text-muted-foreground">{exam.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-purple-600">{new Date(exam.date).toLocaleDateString('tr-TR')}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Trophy className="h-6 w-6 text-white" />
                <CardTitle className="text-white">Başarılar</CardTitle>
              </div>
                <Badge className="bg-white/20 text-white border-0">
                  {achievementCards.filter((item) => item.unlocked).length}/{achievementCards.length} Açıldı
                </Badge>
              </div>
            </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {achievementCards.map((achievement) => (
                <div
                  key={achievement.id}
                  className={`relative p-4 rounded-xl text-center border-2 ${
                    achievement.unlocked
                      ? 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-300 dark:border-yellow-700'
                      : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60'
                  }`}
                >
                  <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-2 ${achievement.unlocked ? 'bg-gradient-to-br from-yellow-400 to-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <Star className={`h-6 w-6 ${achievement.unlocked ? 'text-white fill-white' : 'text-gray-500'}`} />
                  </div>
                  <p className="font-semibold text-sm">{achievement.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{achievement.subtitle}</p>
                </div>
              ))}
              <div className="relative p-4 rounded-xl text-center border-2 bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700">
                <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-2 bg-brand-primary/15">
                  <Star className="h-6 w-6 text-brand-primary" />
                </div>
                <p className="font-semibold text-sm">Sıradaki Rozet</p>
                <p className="text-xs text-muted-foreground mt-1">{nextAchievement?.title || 'Tüm rozetler açıldı'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-[#D9790B]" />
              Hızlı İşlemler
            </CardTitle>
            <CardDescription>
              Okunmamış mesaj: {data?.quickActionsCount?.unreadMessages || 0} • Duyuru: {data?.quickActionsCount?.announcements || 0}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {actionMap.map((action) => (
                <Button key={action.label} variant="outline" className="h-auto py-6 w-full flex-col gap-3 border-2" onClick={action.onClick}>
                  <action.icon className="h-6 w-6 text-brand-accent" />
                  <span className="font-medium">{action.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Son Sonuçlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(data?.recentResults || []).map((result, index) => (
                <div key={`${result.subject}-${index}`} className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900/50 border">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl ${
                      result.score >= 80
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                        : result.score >= 60
                          ? 'bg-gradient-to-br from-yellow-500 to-orange-600'
                          : 'bg-gradient-to-br from-red-500 to-pink-600'
                    }`}>
                      {result.score}
                    </div>
                    <div>
                      <p className="font-semibold">{result.subject}</p>
                      <p className="text-sm text-muted-foreground">{result.type}</p>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {new Date(result.date).toLocaleDateString('tr-TR')}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
