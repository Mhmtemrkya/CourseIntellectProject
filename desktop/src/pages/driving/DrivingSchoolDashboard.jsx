import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Banknote, BookOpen, Brain, CalendarClock, CarFront, GraduationCap,
  ShieldCheck, Users, Wrench, ChevronRight,
} from 'lucide-react';
import { ErrorBanner } from '../../components/ui/AlertBanner';
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

const KPI_META = [
  ['activeStudents', 'Aktif Kursiyer', Users, 'brand', 'Eğitimi süren adaylar'],
  ['todayDrivingLessons', 'Bugünkü Direksiyon', CarFront, 'amber', 'Planlanan direksiyon dersi'],
  ['todayTheoryLessons', 'Bugünkü Teorik', GraduationCap, 'violet', 'Planlanan teorik ders'],
  ['activeInstructors', 'Aktif Eğitmen', Users, 'emerald', 'Derse çıkabilen eğitmen'],
  ['activeVehicles', 'Aktif Araç', CarFront, 'cyan', 'Kullanıma hazır filo'],
  ['vehiclesInMaintenance', 'Bakımdaki Araç', Wrench, 'rose', 'Servisteki araç'],
  ['missingDocuments', 'Eksik Evrak', AlertTriangle, 'amber', 'Dosyası tamamlanmamış'],
  ['expiringDocuments', 'Süresi Dolan Evrak', ShieldCheck, 'amber', 'Yakında geçersiz olacak'],
  ['upcomingExams', 'Yaklaşan Sınav', CalendarClock, 'blue', 'Planlanmış sınav'],
  ['todayCollections', 'Bugünkü Tahsilat', Banknote, 'emerald', 'Kasaya giren tutar'],
];

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

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      setData(await fetchDrivingSchoolDashboard());
    } catch (err) {
      setError(err.message || 'Sürücü kursu paneli yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
              return <DrivingStatCard key={key} label={label} value={value} caption={caption} icon={Icon} tone={tone} />;
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
