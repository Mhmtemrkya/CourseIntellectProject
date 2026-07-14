import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Banknote, BookOpen, Brain, CalendarClock, CarFront, GraduationCap,
  ShieldCheck, Users, Wrench, ChevronRight,
} from 'lucide-react';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { Input } from '../../components/ui/input';
import {
  PremiumAreaChart,
  PremiumPanel,
  PremiumStatusPill,
} from '../../components/ui/premium-dashboard';
import { fetchDrivingSchoolDashboard } from '../../lib/api/modules';
import {
  DrivingLoading,
  DrivingPage,
  DrivingPageHeader,
  DrivingStatCard,
  TONES,
  itemVariants,
} from './_shared';

// Aralığa bağlı KPI'lar (ders, tahsilat) seçilen döneme göre değişir; yapısal
// olanlar (aktif kursiyer, filo) her zaman "şu an"ın fotoğrafıdır.
const KPI_META = [
  ['activeStudents', 'Aktif Kursiyer', Users, 'brand', 'Eğitimi süren adaylar'],
  ['todayDrivingLessons', 'Direksiyon Dersi', CarFront, 'amber', null],
  ['todayTheoryLessons', 'Teorik Ders', GraduationCap, 'violet', null],
  ['activeInstructors', 'Aktif Eğitmen', Users, 'emerald', 'Derse çıkabilen eğitmen'],
  ['activeVehicles', 'Aktif Araç', CarFront, 'cyan', 'Kullanıma hazır filo'],
  ['vehiclesInMaintenance', 'Bakımdaki Araç', Wrench, 'rose', 'Servisteki araç'],
  ['missingDocuments', 'Eksik Evrak', AlertTriangle, 'amber', 'Dosyası tamamlanmamış'],
  ['expiringDocuments', 'Süresi Dolan Evrak', ShieldCheck, 'amber', 'Yakında geçersiz olacak'],
  ['upcomingExams', 'Yaklaşan Sınav', CalendarClock, 'blue', 'Planlanmış sınav'],
  ['todayCollections', 'Tahsilat', Banknote, 'emerald', null],
];

// Aralıkla değişen KPI'lar — açıklamalarına seçili dönem yazılır.
const RANGE_KPIS = new Set(['todayDrivingLessons', 'todayTheoryLessons', 'todayCollections']);

const PERIODS = [
  ['day', 'Günlük'],
  ['week', 'Haftalık'],
  ['month', 'Aylık'],
  ['year', 'Yıllık'],
  ['custom', 'Özel'],
];

const isoDay = (date) => date.toISOString().slice(0, 10);

// Seçilen dönemi [from, to) aralığına çevirir. Bitiş HARİÇTİR (backend böyle bekler).
function rangeFor(period, custom) {
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
    const from = new Date(`${custom.from}T00:00:00`);
    const to = new Date(`${custom.to}T00:00:00`);
    to.setDate(to.getDate() + 1);
    return { from: from.toISOString(), to: to.toISOString() };
  }

  return { from: start.toISOString(), to: end.toISOString() };
}

const PERIOD_CAPTION = {
  day: 'Bugün',
  week: 'Son 7 gün',
  month: 'Son 1 ay',
  year: 'Son 1 yıl',
  custom: 'Seçili aralık',
};

const SHORTCUTS = [
  ['Konu Anlatımı', 'Video, PDF ve ders içeriklerini yönet', BookOpen, 'violet', '/content'],
  ['Soru Bankası', 'Soru stüdyosu ve sınav altyapısı', Brain, 'blue', '/questions'],
];

export default function DrivingSchoolDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('day');
  const today = new Date();
  const [custom, setCustom] = useState({
    from: isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)),
    to: isoDay(today),
  });

  const range = useMemo(() => rangeFor(period, custom), [period, custom]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      setData(await fetchDrivingSchoolDashboard(range));
    } catch (err) {
      setError(err.message || 'Sürücü kursu paneli yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <DrivingLoading />;

  const series = data?.charts?.monthlyRegistrations || [];
  const alerts = data?.alerts || [];

  return (
    <DrivingPage testId="driving-dashboard-page">
      <DrivingPageHeader
        title="Sürücü Kursu Operasyon Merkezi"
        description="Kursiyer, ders, eğitmen ve filo operasyonlarının canlı özeti"
        icon={CarFront}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        actions={(
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex rounded-xl border border-foreground/10 bg-foreground/[0.035] p-1">
              {PERIODS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPeriod(key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    period === key
                      ? 'bg-[hsl(var(--brand-accent))] text-white'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {period === 'custom' ? (
              <>
                <label className="space-y-1 text-xs font-bold">
                  <span>Başlangıç</span>
                  <Input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom((x) => ({ ...x, from: e.target.value }))} />
                </label>
                <label className="space-y-1 text-xs font-bold">
                  <span>Bitiş</span>
                  <Input type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom((x) => ({ ...x, to: e.target.value }))} />
                </label>
              </>
            ) : null}
          </div>
        )}
      />

      {error ? <ErrorBanner title="Panel açılamadı" message={error} onRetry={() => load(true)} /> : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {KPI_META.map(([key, label, Icon, tone, caption]) => {
              const raw = data.kpis?.[key] ?? 0;
              const value = key === 'todayCollections'
                ? `₺${Number(raw).toLocaleString('tr-TR')}`
                : raw;
              const cardCaption = RANGE_KPIS.has(key) ? PERIOD_CAPTION[period] : caption;
              return <DrivingStatCard key={key} label={label} value={value} caption={cardCaption} icon={Icon} tone={tone} />;
            })}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <motion.div variants={itemVariants} className="xl:col-span-2">
              <PremiumPanel title="Aylık Yeni Kayıtlar" description="Son dönem kursiyer kayıt eğilimi">
                <PremiumAreaChart values={series.map((item) => Number(item.value) || 0)} height={200} />
                <div className="mt-3 flex justify-between text-[11px] font-semibold text-muted-foreground">
                  {series.map((item) => <span key={item.label}>{item.label}</span>)}
                </div>
              </PremiumPanel>
            </motion.div>

            <motion.div variants={itemVariants}>
              <PremiumPanel title="Operasyon Uyarıları" description="Evrak, bakım ve çakışma kontrolleri" contentClassName="space-y-2.5">
                {alerts.length === 0 ? (
                  <div className="flex min-h-[200px] flex-col items-center justify-center text-center">
                    <ShieldCheck className="h-10 w-10 text-emerald-500" />
                    <p className="mt-3 font-bold">Kritik uyarı yok</p>
                    <p className="mt-1 text-sm text-muted-foreground">Tüm kontroller güncel.</p>
                  </div>
                ) : alerts.map((alert, index) => (
                  <div
                    key={`${alert.type}-${alert.title}-${index}`}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{alert.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{alert.message}</p>
                    </div>
                    <PremiumStatusPill tone={alert.severity === 'Critical' ? 'danger' : 'warn'}>
                      {alert.severity === 'Critical' ? 'Kritik' : 'Uyarı'}
                    </PremiumStatusPill>
                  </div>
                ))}
              </PremiumPanel>
            </motion.div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {SHORTCUTS.map(([title, subtitle, Icon, tone, path]) => (
              <motion.button
                key={path}
                variants={itemVariants}
                type="button"
                onClick={() => navigate(path)}
                className="group flex items-center gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--brand-accent)/0.28)] hover:bg-[hsl(var(--brand-accent)/0.06)]"
              >
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white ${TONES[tone]}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{subtitle}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </motion.button>
            ))}
          </div>
        </>
      ) : null}
    </DrivingPage>
  );
}
