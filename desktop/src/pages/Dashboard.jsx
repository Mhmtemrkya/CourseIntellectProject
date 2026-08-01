import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  School,
  CalendarClock,
  Megaphone,
  MessageCircle,
  UserMinus,
  UserCog,
  Wallet,
  Receipt,
  UserPlus,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShieldCheck,
  ClipboardList,
  BookOpen,
  Bus,
  Banknote,
  Brain,
  Archive,
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import {
  PremiumListRow,
  PremiumPanel,
  PremiumStatusPill,
} from '../components/ui/premium-dashboard';
import RoleDashboardColumns from '../components/dashboard/RoleDashboardColumns';
import {
  fetchAdminAnalytics,
  fetchDrivingSchoolStatus,
  fetchSchoolDashboard,
} from '../lib/api/modules';
import { fetchAdminDashboardData } from '../lib/api/dashboardData';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
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

const PERIOD_CAPTION = {
  day: 'Bugün',
  week: 'Son 7 gün',
  month: 'Son 1 ay',
  year: 'Son 1 yıl',
  custom: 'Seçili aralık',
};

/**
 * Kurum sahibinin panosu — sürücü kursu operasyon merkezinin okul karşılığı.
 *
 * Her satır: [kpi anahtarı, etiket, ikon, ton, alt bilgi, gideceği sayfa, seçenekler]
 *  • Değer backend'den `null` gelirse kart HİÇ çizilmez: o modül kurumun
 *    paketinde veya kullanıcının rolünde yok demektir (sunucu zaten
 *    hesaplamamıştır — panoda yetkisiz veri görünmez).
 *  • `range: true` olan sayaçlar seçili döneme aittir; alt bilgiye dönem yazılır.
 *  • `money` yalnızca biçimlendirmedir.
 */
const KPI_GROUPS = [
  { key: 'student', title: 'Öğrenci ve Akademik', description: 'Öğrenci yaşam döngüsü ve eğitim kaynakları' },
  { key: 'staff', title: 'Personel', description: 'Aktif kadro, izin ve hesap durumu' },
  { key: 'finance', title: 'Finans ve Muhasebe', description: 'Tahsilat, gider ve ödeme takibi' },
  { key: 'operations', title: 'Kurum Operasyonları', description: 'İletişim, görevler ve günlük hizmetler' },
];

// Ana panoda yalnız kurum sahibinin düzenli takip edeceği üst seviye göstergeler
// tutulur. Günlük ders/devamsızlık, öğretmen, sınav, soru, izin/onay, belge ve
// şifre talepleri kendi çalışma ekranlarında yönetilir; burada tekrar edilmez.
const KPI_META = [
  ['activeStudents', 'Aktif Öğrenci', Users, 'brand', 'Kayıtlı ve aktif öğrenci', '/students', { group: 'student' }],
  ['activeClasses', 'Aktif Sınıf', School, 'violet', 'Öğrencisi olan sınıf', '/classes', { group: 'student' }],
  ['overdueLoans', 'Gecikmiş Kitap', BookOpen, 'amber', 'İade tarihi geçti', '/library', { group: 'student' }],
  ['pendingGuidance', 'Rehberlik Talebi', Brain, 'violet', 'Randevu onayı bekliyor', '/g/appointments', { group: 'student' }],

  ['activeStaff', 'Aktif Personel', UserCog, 'cyan', 'Rolüne göre görüntüle', '/admin/staff?role=all', { group: 'staff' }],
  ['todayOnLeave', 'Bugün İzinli', UserMinus, 'cyan', 'İzindeki personel', '/admin/staff-hr', { group: 'staff' }],
  ['passiveAccounts', 'Pasif Kayıt', Archive, 'rose', 'Arşivdeki hesap', '/admin/passive-records', { group: 'staff' }],

  ['collections', 'Tahsilat', Banknote, 'emerald', null, '/finance/collections', { group: 'finance', range: true, money: true }],
  ['expenses', 'Gider', TrendingDown, 'rose', null, '/finance/expenses', { group: 'finance', range: true, money: true }],
  ['net', 'Net (Tahsilat − Gider)', Wallet, 'brand', null, '/finance/dashboard', { group: 'finance', range: true, money: true }],
  ['overdueInstallmentAmount', 'Geciken Ödeme', ShieldCheck, 'rose', null, '/finance/late-payments', { group: 'finance', money: true }],
  ['pendingInstallmentAmount', 'Bekleyen Taksit', CalendarClock, 'amber', null, '/finance/installments', { group: 'finance', money: true }],

  ['unreadMessages', 'Okunmamış Mesaj', MessageCircle, 'violet', 'Size gelen yanıtsız mesaj', '/chat', { group: 'operations' }],
  ['pendingMeetings', 'Görüşme Talebi', Users, 'amber', 'Veli görüşmesi bekliyor', '/admin/meetings', { group: 'operations' }],
  ['overdueTasks', 'Geciken Görev', AlertTriangle, 'rose', 'Teslim tarihi geçti', '/admin/task-center', { group: 'operations' }],
  ['openTasks', 'Açık Görev', ClipboardList, 'blue', 'Devam eden görev', '/admin/task-center', { group: 'operations' }],
  ['activeServiceRoutes', 'Aktif Servis Rotası', Bus, 'cyan', 'Kullanımdaki rota', '/admin/service-tracking', { group: 'operations' }],
  ['activeAnnouncements', 'Duyuru', Megaphone, 'blue', 'Yayındaki duyuru', '/admin/announcements', { group: 'operations' }],
];

const isoDay = (date) => date.toISOString().slice(0, 10);

// Seçilen dönemi [from, to) aralığına çevirir. Bitiş HARİÇTİR (backend böyle bekler).
function rangeFor(period, customFrom, customTo) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);

  if (period === 'day') {
    end.setDate(end.getDate() + 1);
  } else if (period === 'week') {
    start.setDate(start.getDate() - 6);
    end.setDate(end.getDate() + 1);
  } else if (period === 'month') {
    start.setMonth(start.getMonth() - 1);
    end.setDate(end.getDate() + 1);
  } else if (period === 'year') {
    start.setFullYear(start.getFullYear() - 1);
    end.setDate(end.getDate() + 1);
  } else {
    const from = new Date(`${customFrom}T00:00:00`);
    const to = new Date(`${customTo}T00:00:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
    to.setDate(to.getDate() + 1);
    return { from: from.toISOString(), to: to.toISOString() };
  }

  return { from: start.toISOString(), to: end.toISOString() };
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
          <div className="ci-chart-tooltip pointer-events-none absolute -top-1 right-0 z-10 rounded-2xl border px-4 py-3 text-xs shadow-xl backdrop-blur">
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
                <div className={`flex w-full items-end justify-center gap-[3px] rounded-md px-0.5 pt-3 transition-colors ${isActive ? 'bg-foreground/[0.06]' : ''}`} style={{ height: '100%' }}>
                  <div className="ci-chart-fill w-1/2 max-w-[18px] rounded-t bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-[0_0_10px_hsl(152_76%_50%/0.35)] ring-1 ring-emerald-500/40 transition-all" style={{ height: `${revenueH}%` }} />
                  <div className="ci-chart-fill w-1/2 max-w-[18px] rounded-t bg-gradient-to-t from-rose-600 to-rose-400 shadow-[0_0_10px_hsl(350_89%_60%/0.35)] ring-1 ring-rose-500/40 transition-all" style={{ height: `${expenseH}%` }} />
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [period, setPeriod] = useState('week');
  const [customFrom, setCustomFrom] = useState(() => new Date(new Date().setDate(new Date().getDate() - 13)).toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState('');

  useEffect(() => {
    let active = true;
    fetchDrivingSchoolStatus()
      .then((status) => { if (active && status?.available) navigate('/driving/dashboard', { replace: true }); })
      .catch(() => {});
    return () => { active = false; };
  }, [navigate]);

  const range = useMemo(() => rangeFor(period, customFrom, customTo), [period, customFrom, customTo]);

  const loadOverview = useCallback(async () => {
    if (!range) return;
    try {
      setOverviewError('');
      setOverview(await fetchSchoolDashboard(range));
    } catch (err) {
      setOverviewError(err.message || 'Kurum özeti alınamadı.');
      setOverview(null);
    }
  }, [range]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await fetchAdminDashboardData();
      setData(payload);
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

  const announcements = data?.announcements || [];

  const buckets = analytics?.buckets || [];
  const totals = analytics?.totals || { revenue: 0, registrations: 0, expense: 0, net: 0 };
  const periodLabel = PERIOD_OPTIONS.find(([value]) => value === period)?.[1] || '';

  // Grafik her zaman ÇOK KOVALI bir eğridir (ör. haftalık kırılım = son 12 hafta);
  // üstteki KPI kartları ise yalnız seçili dönemi gösterir. İki blok farklı
  // aralıkları ölçtüğü için grafiğin kendi aralığı açıkça yazılır.
  const chartRangeLabel = (() => {
    if (!analytics?.rangeStart || !analytics?.rangeEnd) return periodLabel.toLocaleLowerCase('tr-TR');
    const fmt = (value) => {
      const date = new Date(`${value}T00:00:00`);
      return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: '2-digit' });
    };
    const last = new Date(`${analytics.rangeEnd}T00:00:00`);
    last.setDate(last.getDate() - 1);
    return `${fmt(analytics.rangeStart)} – ${fmt(isoDay(last))}`;
  })();

  const kpis = overview?.kpis || {};
  const overviewAlerts = overview?.alerts || [];
  // Karta yazılacak değeri ve alt bilgisini üretir. Sunucu null döndürdüyse
  // (modül kapalı / yetki yok) kart hiç render edilmez.
  const kpiCards = KPI_META
    .filter(([key]) => kpis[key] != null)
    .map(([key, label, Icon, tone, caption, path, options = {}]) => {
      const raw = kpis[key];
      const value = options.money
        ? formatMoney(raw)
        : raw;
      let cardCaption = options.range ? PERIOD_CAPTION[period] : caption;
      if (key === 'pendingInstallmentAmount') cardCaption = `${kpis.pendingInstallments || 0} ödenmemiş taksit`;
      if (key === 'overdueInstallmentAmount') cardCaption = `${kpis.overdueInstallments || 0} vadesi geçmiş taksit`;
      return { key, label, Icon, tone, caption: cardCaption, path, value, group: options.group };
    });

  const groupedKpis = KPI_GROUPS
    .map((group) => ({ ...group, cards: kpiCards.filter((card) => card.group === group.key) }))
    .filter((group) => group.cards.length > 0);

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
          <h1 className="text-3xl font-bold font-heading">Kurum Operasyon Merkezi</h1>
          <p className="text-muted-foreground mt-1">Öğrenci, personel, akademik ve finans göstergelerinin canlı özeti — her kart ilgili sayfaya gider.</p>
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

      {overviewError ? (
        <ErrorBanner
          title="Kurum özeti alınamadı"
          message={overviewError}
          onRetry={loadOverview}
        />
      ) : null}

      <RoleDashboardColumns groups={groupedKpis} navigate={navigate} testId="dashboard-kpi-grid" />

      <motion.div variants={itemVariants}>
        <PremiumPanel title="Kazanç & Gider Grafiği" description={`${periodLabel} kırılım · ${chartRangeLabel} — bir sütunun üstüne gelince o dönemin kazanç, gider ve kayıt detayı görünür`}>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
            <div className="rounded-3xl border border-foreground/10 bg-[hsl(var(--ci-surface-1)/0.5)] p-6">
              <FinancialChart buckets={buckets} loading={analyticsLoading} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                // NOT: Bu dört toplam GRAFİĞİN TAMAMINI kapsar (ör. haftalık kırılımda
                // son 12 hafta); üstteki kartlar ise yalnız seçili dönemi gösterir.
                // Alt bilgilere aralık yazılmazsa iki blok çelişiyor sanılıyor.
                ['Toplam Kazanç', formatMoney(totals.revenue), Wallet, 'emerald', `Tahsilat · ${chartRangeLabel}`],
                ['Toplam Gider', formatMoney(totals.expense), Receipt, 'rose', `Gider defteri + bordro + fatura · ${chartRangeLabel}`],
                ['Kayıt Olan Öğrenci', totals.registrations || 0, UserPlus, 'sky', `Kaydedilen · ${chartRangeLabel}`],
                ['Net', formatMoney(totals.net), TrendingUp, totals.net >= 0 ? 'emerald' : 'rose', `Kazanç − gider · ${chartRangeLabel}`],
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
          <PremiumPanel
            title="Operasyon Uyarıları"
            description={overviewAlerts.length > 0
              ? `${overviewAlerts.filter((item) => item.severity === 'Critical').length} kritik · ${overviewAlerts.filter((item) => item.severity !== 'Critical').length} uyarı`
              : 'Müdahale gerektiren bir durum yok'}
            contentClassName="space-y-2.5"
          >
              {overviewAlerts.length === 0 ? (
                <div className="flex min-h-[180px] flex-col items-center justify-center text-center">
                  <ShieldCheck className="h-10 w-10 text-emerald-500" />
                  <p className="mt-3 font-bold">Kritik uyarı yok</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data?.todayLeaves?.length
                      ? `Bugün izinli personel: ${data.todayLeaves.map((item) => item.staffName).join(', ')}`
                      : 'Tüm kontroller güncel.'}
                  </p>
                </div>
              ) : overviewAlerts.map((alert, index) => (
                <button
                  key={`${alert.type}-${alert.title}-${index}`}
                  type="button"
                  onClick={() => alert.actionPath && navigate(alert.actionPath)}
                  className="flex w-full items-start justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 text-left transition hover:border-[hsl(var(--brand-accent)/0.4)] hover:bg-[hsl(var(--brand-accent)/0.05)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{alert.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{alert.message}</span>
                  </span>
                  <PremiumStatusPill tone={alert.severity === 'Critical' ? 'danger' : 'warn'}>
                    {alert.severity === 'Critical' ? 'Kritik' : 'Uyarı'}
                  </PremiumStatusPill>
                </button>
              ))}
          </PremiumPanel>
        </motion.div>
      </div>

    </motion.div>
  );
}
