import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  GraduationCap,
  School,
  HelpCircle,
  Calendar,
  Megaphone,
  MessageCircle,
  UserMinus,
  Wallet,
  Receipt,
  UserPlus,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import {
  PremiumListRow,
  PremiumMetricCard,
  PremiumPanel,
} from '../components/ui/premium-dashboard';
import { fetchScheduleEntries, fetchAdminAnalytics } from '../lib/api/modules';
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

const PERIOD_OPTIONS = [
  ['day', 'Günlük'],
  ['week', 'Haftalık'],
  ['month', 'Aylık'],
  ['year', 'Yıllık'],
  ['custom', 'Özel'],
];

const moneyFormatter = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
function formatMoney(value) {
  return moneyFormatter.format(Number(value) || 0);
}

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

// Dönemsel kazanç/gider çubuk grafiği — bir kovanın üstüne gelince o günün/haftanın
// kazancı, kayıt olan öğrenci sayısı ve gideri tooltip ile gösterilir.
function FinancialChart({ buckets = [], loading = false }) {
  const [hover, setHover] = useState(null);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><LoadingDots /></div>;
  }
  if (!buckets.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-foreground/10 text-sm text-muted-foreground">
        Seçilen dönem için veri bulunmuyor.
      </div>
    );
  }

  const maxMoney = Math.max(...buckets.map((b) => Math.max(Number(b.revenue) || 0, Number(b.expense) || 0)), 1);
  const active = hover != null ? buckets[hover] : buckets[buckets.length - 1];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Kazanç</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Gider</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Kayıt olan öğrenci</span>
      </div>

      <div className="relative mt-5 h-64">
        {active ? (
          <div className="pointer-events-none absolute -top-1 right-0 z-10 rounded-2xl border border-foreground/10 bg-[#020B1F]/95 px-4 py-3 text-xs shadow-xl backdrop-blur">
            <p className="mb-1 font-bold text-foreground">{active.label}</p>
            <p className="flex items-center justify-between gap-4 text-emerald-400"><span>Kazanç</span><span className="tabular-nums font-semibold">{formatMoney(active.revenue)}</span></p>
            <p className="flex items-center justify-between gap-4 text-rose-400"><span>Gider</span><span className="tabular-nums font-semibold">{formatMoney(active.expense)}</span></p>
            <p className="flex items-center justify-between gap-4 text-sky-300"><span>Kayıt</span><span className="tabular-nums font-semibold">{active.registrations} öğrenci</span></p>
          </div>
        ) : null}

        <div className="flex h-full items-end gap-1">
          {buckets.map((bucket, index) => {
            const revenueH = Math.max(2, ((Number(bucket.revenue) || 0) / maxMoney) * 100);
            const expenseH = Math.max(2, ((Number(bucket.expense) || 0) / maxMoney) * 100);
            const isActive = (hover != null ? hover : buckets.length - 1) === index;
            return (
              <button
                type="button"
                key={`${bucket.start}-${index}`}
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(index)}
                className="group relative flex h-full flex-1 flex-col items-center justify-end"
              >
                {bucket.registrations > 0 ? (
                  <span className="absolute -top-1 z-[1] grid h-5 min-w-5 place-items-center rounded-full bg-sky-500/90 px-1 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">
                    {bucket.registrations}
                  </span>
                ) : null}
                <div className={`flex w-full items-end justify-center gap-[2px] rounded-md px-0.5 pt-3 transition-colors ${isActive ? 'bg-foreground/[0.06]' : ''}`} style={{ height: '100%' }}>
                  <div className="w-1/2 max-w-[14px] rounded-t bg-gradient-to-t from-emerald-600/70 to-emerald-400 transition-all" style={{ height: `${revenueH}%` }} />
                  <div className="w-1/2 max-w-[14px] rounded-t bg-gradient-to-t from-rose-600/70 to-rose-400 transition-all" style={{ height: `${expenseH}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-1 text-center text-[10px] text-muted-foreground">
        {buckets.map((bucket, index) => (
          <span key={`${bucket.start}-label-${index}`} className="flex-1 truncate">{bucket.label}</span>
        ))}
      </div>
    </div>
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

  const [period, setPeriod] = useState('week');
  const [customFrom, setCustomFrom] = useState(() => new Date(new Date().setDate(new Date().getDate() - 13)).toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const statRoutes = useMemo(() => ({
    'Toplam Öğrenci': '/students',
    'Toplam Öğretmen': '/teachers',
    'Aktif Sınıf': '/classes',
  }), []);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
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

  const loadAnalytics = useCallback(async () => {
    const params = period === 'custom'
      ? (customFrom && customTo ? { period: 'custom', from: customFrom, to: customTo } : null)
      : { period };
    if (!params) return;
    try {
      setAnalyticsLoading(true);
      const result = await fetchAdminAnalytics(params);
      setAnalytics(result);
    } catch {
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [period, customFrom, customTo]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

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
  const selectedLessons = selectedClass === 'all'
    ? lessons
    : lessons.filter((lesson) => lesson.class === selectedClass);

  const buckets = analytics?.buckets || [];
  const totals = analytics?.totals || { revenue: 0, registrations: 0, expense: 0, net: 0 };
  const periodLabel = PERIOD_OPTIONS.find(([value]) => value === period)?.[1] || '';

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
      data-testid="dashboard-page"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Kurum operasyon özeti — {periodLabel.toLowerCase()} kazanç, kayıt ve gider canlı backend verisiyle.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-1">
            {PERIOD_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${period === value ? 'bg-[hsl(var(--brand-accent))] text-white shadow' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {period === 'custom' ? (
            <div className="flex items-center gap-2">
              <Input type="date" value={customFrom} max={customTo} onChange={(event) => setCustomFrom(event.target.value)} className="h-9 w-40" />
              <span className="text-muted-foreground">–</span>
              <Input type="date" value={customTo} min={customFrom} onChange={(event) => setCustomTo(event.target.value)} className="h-9 w-40" />
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <ErrorBanner
          title="Dashboard verisi alınamadı"
          message={error}
          onRetry={loadDashboard}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <StatCard title="Toplam Öğrenci" value={stats.totalStudents || 0} icon={Users} trend="Backend" tone="blue" onClick={() => navigate(statRoutes['Toplam Öğrenci'])} />
        <StatCard title="Toplam Öğretmen" value={stats.totalTeachers || 0} icon={GraduationCap} trend="Aktif" tone="amber" onClick={() => navigate(statRoutes['Toplam Öğretmen'])} />
        <StatCard title="Aktif Sınıf" value={stats.totalClasses || 0} icon={School} trend="Sınıf" tone="emerald" onClick={() => navigate(statRoutes['Aktif Sınıf'])} />
      </div>

      <motion.div variants={itemVariants}>
        <PremiumPanel title="Kazanç & Gider Eğrisi" description={`${periodLabel} kırılım — bir sütunun üstüne gelince o dönemin kazanç, gider ve kayıt detayı görünür`}>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
            <div className="rounded-3xl border border-foreground/10 bg-[#020B1F]/40 p-6">
              <FinancialChart buckets={buckets} loading={analyticsLoading} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Toplam Kazanç', formatMoney(totals.revenue), Wallet, 'emerald', 'Dönem tahsilat toplamı'],
                ['Toplam Gider', formatMoney(totals.expense), Receipt, 'rose', 'Maaş + fatura gideri'],
                ['Kayıt Olan Öğrenci', totals.registrations || 0, UserPlus, 'sky', 'Dönemde kaydedilen'],
                ['Net', formatMoney(totals.net), TrendingUp, totals.net >= 0 ? 'emerald' : 'rose', 'Kazanç − gider'],
              ].map(([label, value, Icon, tone, detail]) => (
                <div key={label} className="rounded-3xl border border-foreground/10 bg-foreground/[0.035] p-4">
                  <div className={`grid h-10 w-10 place-items-center rounded-2xl ${tone === 'emerald' ? 'bg-emerald-500/15 text-emerald-400' : tone === 'rose' ? 'bg-rose-500/15 text-rose-400' : 'bg-sky-500/15 text-sky-400'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-2xl font-black tabular-nums">{value}</p>
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
