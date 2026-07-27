import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Banknote, BookOpen, Brain, CalendarClock, CarFront, GraduationCap,
  ShieldCheck, Users, Wrench, ChevronRight, Award, ClipboardCheck, FileWarning, UserCheck,
  TrendingDown, Wallet,
} from 'lucide-react';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { Input } from '../../components/ui/input';
import {
  PremiumAreaChart,
  PremiumPanel,
  PremiumStatusPill,
} from '../../components/ui/premium-dashboard';
import { fetchDrivingSchoolDashboard, fetchPendingDownPayments } from '../../lib/api/modules';
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
  ['activeStudents', 'Aktif Kursiyer', Users, 'brand', 'Eğitimi süren adaylar', '/driving/students'],
  ['graduatedStudents', 'Mezun Kursiyer', GraduationCap, 'emerald', 'Mezuniyeti tamamlanan', '/driving/graduation'],
  ['todayDrivingLessons', 'Direksiyon Dersi', CarFront, 'amber', null, '/driving/lessons'],
  ['todayTheoryLessons', 'Teorik Ders', GraduationCap, 'violet', null, '/driving/education'],
  ['activeInstructors', 'Aktif Eğitmen', Users, 'emerald', 'Derse çıkabilen eğitmen', '/driving/assignments'],
  ['activeVehicles', 'Aktif Araç', CarFront, 'cyan', 'Kullanıma hazır filo', '/driving/vehicles'],
  ['vehiclesInMaintenance', 'Bakımdaki Araç', Wrench, 'rose', 'Servisteki araç', '/driving/fleet-compliance'],
  ['studentsMissingDocuments', 'Eksik Evrak', AlertTriangle, 'amber', 'Dosyası tamamlanmamış kursiyer', '/driving/mebbis/documents'],
  ['missingDocuments', 'Araç Evrakı Eksik', AlertTriangle, 'rose', 'Muayene/sigorta yok veya süresi dolmuş', '/driving/fleet-compliance'],
  ['expiringDocuments', 'Araç Evrakı Doluyor', ShieldCheck, 'amber', '30 gün içinde geçersiz olacak', '/driving/fleet-compliance'],
  ['upcomingExams', 'Yaklaşan Sınav', CalendarClock, 'blue', 'Planlanmış sınav', '/driving/education'],
  ['termCriticalAlerts', 'Kritik Dönem Uyarısı', AlertTriangle, 'rose', 'Hemen müdahale edilmeli', '/driving/mebbis/term-opening'],
  ['mebbisReadyNotEntered', 'MEBBİS Girişi Bekleyen', ShieldCheck, 'amber', 'Hazır fakat girilmemiş', '/driving/mebbis'],
  ['todayCollections', 'Tahsilat', Banknote, 'emerald', null, '/driving/collection'],
  ['pendingInstallmentAmount', 'Bekleyen Taksitler', CalendarClock, 'amber', null, '/finance/installments'],
  ['todayExpenses', 'Gider', TrendingDown, 'rose', null, '/finance/expenses'],
  ['todayNet', 'Net (Tahsilat − Gider)', Wallet, 'brand', null, '/finance/expenses'],
];

// Aralıkla değişen KPI'lar — açıklamalarına seçili dönem yazılır.
const RANGE_KPIS = new Set(['todayDrivingLessons', 'todayTheoryLessons', 'todayCollections', 'todayExpenses', 'todayNet']);
// Para birimi olarak biçimlendirilecek KPI'lar.
const CURRENCY_KPIS = new Set(['todayCollections', 'pendingInstallmentAmount', 'todayExpenses', 'todayNet']);

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
  ['Soru Bankası', 'Soru stüdyosu ve sınav altyapısı', Brain, 'blue', '/t/question-bank'],
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

  // Peşinatı beklenen sözleşmeler ayrı finans ucundan gelir (dashboard payload'ında yok).
  const [pendingPesinat, setPendingPesinat] = useState({ count: 0, total: 0 });
  useEffect(() => {
    let active = true;
    fetchPendingDownPayments()
      .then((rows) => {
        if (!active) return;
        setPendingPesinat({
          count: rows.length,
          total: rows.reduce((sum, item) => sum + Number(item.downPayment || 0), 0),
        });
      })
      .catch(() => { if (active) setPendingPesinat({ count: 0, total: 0 }); });
    return () => { active = false; };
  }, []);

  if (loading) return <DrivingLoading />;

  const series = data?.charts?.monthlyRegistrations || [];
  const alerts = data?.alerts || [];
  const termAlerts = data?.termAlerts || {};
  const managerSummary = data?.managerMebbisSummary || null;

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
            {KPI_META.map(([key, label, Icon, tone, caption, path]) => {
              const raw = data.kpis?.[key] ?? 0;
              const value = CURRENCY_KPIS.has(key)
                ? `₺${Number(raw).toLocaleString('tr-TR')}`
                : raw;
              // Mezun sayısı kümülatiftir; seçili dönemde mezun olan varsa alt bilgide belirtilir.
              const graduatedInPeriod = Number(data.kpis?.graduatedInPeriod || 0);
              const cardCaption = key === 'pendingInstallmentAmount'
                ? `${Number(data.kpis?.pendingInstallments || 0).toLocaleString('tr-TR')} ödenmemiş taksit`
                : key === 'graduatedStudents' && graduatedInPeriod > 0
                  ? `${graduatedInPeriod} kişi ${PERIOD_CAPTION[period].toLocaleLowerCase('tr-TR')}`
                  : RANGE_KPIS.has(key) ? PERIOD_CAPTION[period] : caption;
              return (
                <DrivingStatCard
                  key={key}
                  label={label}
                  value={value}
                  caption={cardCaption}
                  icon={Icon}
                  tone={tone}
                  onClick={() => navigate(path)}
                />
              );
            })}
          </div>

          {pendingPesinat.count > 0 ? (
            <button
              type="button"
              onClick={() => navigate('/driving/collection')}
              className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/[0.07] p-4 text-left transition hover:border-amber-500/60"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-amber-600"><AlertTriangle className="h-5 w-5" /></span>
                <div>
                  <p className="text-sm font-bold">Peşinat Bekleyenler · {pendingPesinat.count} kursiyer</p>
                  <p className="text-xs text-muted-foreground">Kayıtta peşinatı tahsil edilmemiş sözleşmeler — tıklayıp tahsil edin.</p>
                </div>
              </div>
              <span className="text-lg font-black text-amber-600">₺{Number(pendingPesinat.total).toLocaleString('tr-TR')}</span>
            </button>
          ) : null}

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
              <PremiumPanel title="Operasyon Uyarıları" description={`${termAlerts.criticalCount || 0} kritik · ${termAlerts.warningCount || 0} dönem uyarısı`} contentClassName="space-y-2.5">
                {alerts.length === 0 ? (
                  <div className="flex min-h-[200px] flex-col items-center justify-center text-center">
                    <ShieldCheck className="h-10 w-10 text-emerald-500" />
                    <p className="mt-3 font-bold">Kritik uyarı yok</p>
                    <p className="mt-1 text-sm text-muted-foreground">Tüm kontroller güncel.</p>
                  </div>
                ) : alerts.map((alert, index) => (
                  <div
                    key={`${alert.type}-${alert.title}-${index}`}
                    role={alert.actionPath ? 'button' : undefined}
                    tabIndex={alert.actionPath ? 0 : undefined}
                    onClick={() => alert.actionPath && navigate(alert.actionPath)}
                    onKeyDown={(event) => { if (alert.actionPath && (event.key === 'Enter' || event.key === ' ')) navigate(alert.actionPath); }}
                    className={`flex items-start justify-between gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3 ${alert.actionPath ? 'cursor-pointer transition hover:border-primary/40 hover:bg-primary/[0.04]' : ''}`}
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

          {managerSummary ? (
            <PremiumPanel title="Kurum Yöneticisi MEBBİS Özeti" description={`Günlük operasyon · Son güncelleme ${new Date(managerSummary.generatedAtUtc).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ManagerMetric label="Aktif dönem" value={managerSummary.activeTermCount} icon={CalendarClock} path="/driving/mebbis/term-opening" navigate={navigate} />
                <ManagerMetric label="MEBBİS’e hazır" value={managerSummary.mebbisReadyStudents} icon={ShieldCheck} path="/driving/mebbis" navigate={navigate} />
                <ManagerMetric label="Girişi bekleyen" value={managerSummary.entryPendingCount} icon={ClipboardCheck} path="/driving/mebbis" navigate={navigate} />
                <ManagerMetric label="Eksik evraklı" value={managerSummary.missingDocumentStudents} icon={FileWarning} path="/driving/mebbis/documents" navigate={navigate} danger={managerSummary.missingDocumentStudents > 0} />
                <ManagerMetric label="Son tarihi yaklaşan" value={managerSummary.approachingDeadlineTerms} icon={AlertTriangle} path="/driving/mebbis/term-opening" navigate={navigate} danger={managerSummary.approachingDeadlineTerms > 0} />
                <ManagerMetric label="Sınav sonucu bekleyen" value={managerSummary.pendingExamResults} icon={ClipboardCheck} path="/driving/mebbis/exam-results" navigate={navigate} />
                <ManagerMetric label="Sertifika no bekleyen" value={managerSummary.certificatesWaiting} icon={Award} path="/driving/mebbis/certificate-numbers" navigate={navigate} />
              </div>
              <div className="mt-5 rounded-2xl border bg-foreground/[0.025] p-4">
                <div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-emerald-600" /><b className="text-sm">Bugün personel bazlı tamamlanan işlemler</b></div>
                {(managerSummary.personnelCompletions || []).length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Bugün tamamlanmış MEBBİS girişi veya doğrulaması yok.</p> : <div className="mt-3 grid gap-2 md:grid-cols-2">{managerSummary.personnelCompletions.map((person) => <div key={person.userId || person.name} className="flex items-center justify-between rounded-xl border bg-background px-3 py-2"><span className="truncate text-sm font-semibold">{person.name || 'Personel'}</span><PremiumStatusPill tone="success">{person.completedCount} işlem</PremiumStatusPill></div>)}</div>}
              </div>
            </PremiumPanel>
          ) : null}

          <PremiumPanel title="Dönem ve MEBBİS Sağlığı" description="Aktif dönemlerin canlı kontenjan, evrak ve mutabakat özeti">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <TermMetric label="MEBBİS eksiği" value={termAlerts.missingMebbisCount || 0} tone="text-amber-600" />
              <TermMetric label="Sağlık raporu bekleyen" value={termAlerts.healthReportPendingCount || 0} tone="text-orange-600" />
              <TermMetric label="Hazır, girişi yapılmamış" value={termAlerts.readyNotEnteredCount || 0} tone="text-blue-600" />
              <TermMetric label="Mutabakat farkı" value={termAlerts.reconciliationMismatchCount || 0} tone="text-red-600" />
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">{(termAlerts.terms || []).map((term) => (
              <button key={term.groupId} type="button" onClick={() => navigate(`/driving/students?groupId=${term.groupId}`)} className="rounded-2xl border p-4 text-left transition hover:border-primary/40">
                <div className="flex items-center justify-between gap-3"><b>{term.name}</b><PremiumStatusPill tone={term.capacityExceeded ? 'danger' : term.remainingCapacity <= 5 ? 'warn' : 'success'}>{term.capacityExceeded ? 'Aşıldı' : `${term.studentCount}/${term.quota || '∞'}`}</PremiumStatusPill></div>
                <p className="mt-2 text-xs text-muted-foreground">{term.daysToDeadline == null ? 'Son kayıt tarihi yok' : term.daysToDeadline < 0 ? `Son kayıt ${Math.abs(term.daysToDeadline)} gün geçti` : `Son kayda ${term.daysToDeadline} gün`} · {term.missingMebbisCount} MEBBİS eksiği · {term.readyNotEnteredCount} giriş bekliyor</p>
              </button>
            ))}</div>
          </PremiumPanel>

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

function TermMetric({ label, value, tone }) {
  return <div className="rounded-2xl border bg-foreground/[0.025] p-4"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className={`mt-1 text-2xl font-black ${tone}`}>{value}</p></div>;
}

function ManagerMetric({ label, value, icon: Icon, path, navigate, danger = false }) {
  return <button type="button" onClick={() => navigate(path)} className="flex items-center gap-3 rounded-2xl border bg-foreground/[0.025] p-4 text-left transition hover:border-primary/40 hover:bg-primary/[0.04]"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${danger ? 'bg-red-500/10 text-red-600' : 'bg-primary/10 text-primary'}`}><Icon className="h-5 w-5" /></span><span className="min-w-0"><span className="block text-2xl font-black">{value || 0}</span><span className="block truncate text-xs font-semibold text-muted-foreground">{label}</span></span></button>;
}
