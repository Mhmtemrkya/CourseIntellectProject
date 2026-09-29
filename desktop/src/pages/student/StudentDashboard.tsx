import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, GraduationCap, CalendarCheck, Target, Medal, ClipboardList, CalendarClock, ArrowRight, Trophy,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import BadgeUnlockModal from '../../components/badges/BadgeUnlockModal';
import RoleDashboardColumns from '../../components/dashboard/RoleDashboardColumns';
import { PremiumPanel, PremiumProgressRow, PremiumStatusPill } from '../../components/ui/premium-dashboard';
import { useApp } from '../../context/AppContext';
import { fetchStudentDashboardData } from '../../lib/api/dashboardData';
import { BADGE_TOTAL, collectNewBadges, unlockedBadgeCount } from '../../lib/badges';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } };
const tones = ['brand', 'blue', 'emerald', 'violet', 'amber', 'rose'];

function letterGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
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

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (loading) {
    return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4"><LoadingDots /><p className="text-muted-foreground">Öğrenci paneli hazırlanıyor...</p></div>;
  }

  const stats = data?.stats || {};
  const xp = Number(stats.xp || 0);
  const badges = unlockedBadgeCount(xp);
  const subjectPerformance = data?.subjectPerformance || [];
  const pendingList = data?.pendingList || [];
  const upcomingEvents = data?.upcomingEvents || [];
  const announcements = data?.announcementList || [];
  const todayLessons = data?.todayLessons || [];

  const groups = [
    {
      key: 'academic', title: 'Akademik Durum', description: 'Başarı ve devam durumunuzun özeti',
      cards: [
        { key: 'average', label: 'Not Ortalaması', value: stats.averageScore || 0, caption: 'Genel başarı ortalaması', icon: GraduationCap, tone: 'brand', path: '/s/exam-results' },
        { key: 'attendance', label: 'Devam Oranı', value: `%${stats.attendanceRate || 0}`, caption: 'Güncel yoklama oranı', icon: CalendarCheck, tone: 'emerald', path: '/s/attendance' },
        { key: 'rank', label: 'Sınıf Sıralaması', value: stats.rank ? `${stats.rank} / ${stats.totalStudents || '-'}` : '—', caption: data?.className || 'Sınıf bilgisi', icon: Target, tone: 'violet', path: '/s/exam-results' },
      ],
    },
    {
      key: 'tasks', title: 'Yapılacaklar', description: 'Bugün ve yakın tarihte aksiyon bekleyenler',
      cards: [
        { key: 'assignments', label: 'Bekleyen Ödev', value: stats.pendingAssignments || pendingList.length, caption: 'Teslim edilmesi gereken', icon: ClipboardList, tone: 'amber', path: '/s/assignments' },
        { key: 'events', label: 'Yaklaşan Etkinlik', value: upcomingEvents.length, caption: 'Sınav, ödev ve sunum', icon: CalendarClock, tone: 'blue', path: '/s/exams' },
        { key: 'lessons', label: 'Bugünkü Ders', value: todayLessons.length, caption: 'Günün ders programı', icon: BookOpen, tone: 'cyan', path: '/s/schedule' },
      ],
    },
    {
      key: 'development', title: 'Gelişim', description: 'Düzenli çalışma ve ilerleme göstergeleri',
      cards: [
        { key: 'completion', label: 'İçerik Tamamlama', value: `%${stats.completedContent || 0}`, caption: 'Genel içerik ilerlemesi', icon: Trophy, tone: 'emerald', path: '/s/content' },
        { key: 'badges', label: 'Kazanılan Rozet', value: badges, caption: `${BADGE_TOTAL} rozetten`, icon: Medal, tone: 'amber', path: '/s/badges' },
        { key: 'streak', label: 'Çalışma Serisi', value: `${stats.streak || 0} gün`, caption: `Seviye ${stats.level || 1} · ${xp} XP`, icon: Target, tone: 'rose', path: '/s/study-plan' },
      ],
    },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="student-dashboard-page">
      <motion.div variants={itemVariants}>
        <h1 className="text-3xl font-bold font-heading">Öğrenci Çalışma Merkezi</h1>
        <p className="mt-1 text-sm text-muted-foreground">{data?.greetingName || 'Öğrenci'} · bugün odaklanmanız gereken akademik bilgiler</p>
      </motion.div>

      {error ? <ErrorBanner title="Öğrenci paneli yüklenemedi" message={error} onRetry={loadDashboard} /> : null}
      <RoleDashboardColumns groups={groups} navigate={navigate} testId="student-dashboard-columns" />

      <div className="grid gap-5 xl:grid-cols-3">
        <motion.div variants={itemVariants}>
          <PremiumPanel title="Öncelikli Görevler" description="Teslim tarihi yaklaşan ödevler" action={<Button size="sm" variant="ghost" onClick={() => navigate('/s/assignments')}>Tümü <ArrowRight className="ml-1 h-4 w-4" /></Button>} contentClassName="space-y-2.5">
            {pendingList.length ? pendingList.slice(0, 5).map((item, index) => <button key={`${item.title}-${index}`} type="button" onClick={() => navigate('/s/assignments')} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-left"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.title}</span><span className="text-xs text-muted-foreground">{item.subject}</span></span><span className="text-xs font-bold text-amber-500">{item.deadline || item.status}</span></button>) : <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Bekleyen ödev yok.</p>}
          </PremiumPanel>
        </motion.div>

        <motion.div variants={itemVariants}>
          <PremiumPanel title="Yaklaşan Etkinlikler" description="Hazırlık gerektiren yakın tarihler" action={<Button size="sm" variant="ghost" onClick={() => navigate('/s/exams')}>Takvim <ArrowRight className="ml-1 h-4 w-4" /></Button>} contentClassName="space-y-2.5">
            {upcomingEvents.length ? upcomingEvents.slice(0, 5).map((event, index) => <button key={`${event.title}-${index}`} type="button" onClick={() => navigate('/s/exams')} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-left"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{event.title}</span><span className="text-xs text-muted-foreground">{event.detail}</span></span><PremiumStatusPill tone="soon">{event.days != null ? `${event.days} gün` : 'Yakında'}</PremiumStatusPill></button>) : <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Yaklaşan etkinlik yok.</p>}
          </PremiumPanel>
        </motion.div>

        <motion.div variants={itemVariants}>
          <PremiumPanel title="Ders Performansı" description="En güncel ders başarı oranları" action={<Button size="sm" variant="ghost" onClick={() => navigate('/s/exam-results')}>Sonuçlar <ArrowRight className="ml-1 h-4 w-4" /></Button>} contentClassName="space-y-3">
            {subjectPerformance.length ? subjectPerformance.slice(0, 5).map((item, index) => <PremiumProgressRow key={item.subject} icon={BookOpen} title={item.subject} subtitle={`${item.count} sınav`} value={item.average} valueLabel={letterGrade(item.average)} progress={item.average} tone={tones[index % tones.length]} />) : <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Henüz sınav sonucu bulunmuyor.</p>}
          </PremiumPanel>
        </motion.div>
      </div>

      {announcements.length ? <motion.div variants={itemVariants}><PremiumPanel title="Son Duyurular" description="Okul ve sınıfınızdan önemli bilgilendirmeler" contentClassName="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{announcements.slice(0, 3).map((item, index) => <button key={`${item.title}-${index}`} type="button" onClick={() => navigate('/s/announcements')} className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 text-left"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.detail || item.date}</p></button>)}</PremiumPanel></motion.div> : null}
      {newBadges.length > 0 ? <BadgeUnlockModal badges={newBadges} onClose={() => setNewBadges([])} /> : null}
    </motion.div>
  );
}
