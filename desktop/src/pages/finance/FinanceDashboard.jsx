import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Wallet, TrendingUp, TrendingDown, CreditCard,
  AlertCircle, Calendar, Users, ArrowUpRight, Receipt, Landmark,
  Banknote, Building2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAccountingDashboard, fetchFinanceDashboard } from '../../lib/api/modules';
import { normalizeFinanceText, parseFinanceMoney } from '../../lib/financeDocuments';
import { filterByPeriod, periodLabel as buildPeriodLabel, shiftAnchor, parseTrDateTime } from '../../lib/financePeriod';
import {
  MiniBarChart,
  MiniDonut,
  MiniLineChart,
  PremiumListRow,
  PremiumMetricCard,
  PremiumPanel,
} from '../../components/ui/premium-dashboard';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function parseMoney(value) {
  return parseFinanceMoney(value);
}

function normalizeStatus(value = '') {
  return normalizeFinanceText(value);
}

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

// Backend tahsilat "time" ("dd.MM.yyyy HH:mm") ve taksit "due" ("dd.MM.yyyy")
// alanlarini Date'e cevirir; ay/yil filtreleri bu tarihler uzerinden yapilir.
function parseTrDate(value) {
  const match = String(value || '').match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTry(amount) {
  return `₺${Math.round(amount).toLocaleString('tr-TR')}`;
}

function isPaidStatus(value) {
  const normalized = normalizeStatus(value);
  return normalized.includes('oden') || normalized.includes('paid') || normalized.includes('tahsil');
}

function createPeriodBuckets(period, anchor) {
  const reference = new Date(anchor);
  if (period === 'day') {
    return Array.from({ length: 8 }, (_, index) => {
      const start = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate(), index * 3);
      return { start, end: new Date(start.getTime() + (3 * 60 * 60 * 1000)) };
    });
  }
  if (period === 'week') {
    const day = reference.getDay() || 7;
    const monday = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() - day + 1);
    return Array.from({ length: 7 }, (_, index) => {
      const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
      return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1) };
    });
  }
  if (period === 'year') {
    return Array.from({ length: 12 }, (_, index) => ({
      start: new Date(reference.getFullYear(), index, 1),
      end: new Date(reference.getFullYear(), index + 1, 1),
    }));
  }
  const daysInMonth = new Date(reference.getFullYear(), reference.getMonth() + 1, 0).getDate();
  return Array.from({ length: 8 }, (_, index) => {
    const startDay = Math.floor((index * daysInMonth) / 8) + 1;
    const endDay = Math.floor(((index + 1) * daysInMonth) / 8) + 1;
    return {
      start: new Date(reference.getFullYear(), reference.getMonth(), startDay),
      end: new Date(reference.getFullYear(), reference.getMonth(), Math.min(endDay, daysInMonth + 1)),
    };
  });
}

function buildBucketSeries(items, dateSelector, valueSelector, period, anchor) {
  const buckets = createPeriodBuckets(period, anchor);
  return buckets.map(({ start, end }) => items.reduce((sum, item) => {
    const date = parseTrDateTime(dateSelector(item));
    if (!date || date < start || date >= end) return sum;
    return sum + valueSelector(item);
  }, 0));
}

function ensureMetricSeries(values, currentValue) {
  const safe = values.map((value) => Number(value) || 0);
  return safe.some((value) => value !== 0) ? safe : Array(Math.max(8, safe.length || 0)).fill(Number(currentValue) || 0);
}

export default function FinanceDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [finance, setFinance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  // 'all' = yillik, 0-11 = secili ay
  const [selectedMonth, setSelectedMonth] = useState('all');
  // Dönem-bazlı dashboard: Günlük/Haftalık/Aylık/Yıllık + anchor (ileri/geri).
  const [period, setPeriod] = useState('month');
  const [anchor, setAnchor] = useState(() => new Date());

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      // Otoriter finans verisi sozlesmelerden hesaplanir (kayit ucreti taksitsiz
      // de olsa net alacaga yansir); accounting dashboard ise tahsilat/taksit
      // listeleri ve detay diyalogu icin kullanilir.
      const [fin, acc] = await Promise.all([
        fetchFinanceDashboard(),
        fetchAccountingDashboard().catch(() => null),
      ]);
      setFinance(fin || null);
      setDashboard(acc);
    } catch (err) {
      setError(err.message || 'Finans verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Aylik tahsilat (otoriter): student-finance dashboard'un monthlyIncome'undan.
  const availableYears = useMemo(() => {
    const years = new Set([new Date().getFullYear()]);
    (finance?.monthlyIncome || []).forEach((item) => {
      const year = Number(String(item.month).split('-')[0]);
      if (year) years.add(year);
    });
    return [...years].sort((a, b) => b - a);
  }, [finance]);

  // Secili yilin 12 aylik tahsilat dagilimi ("hangi ay ne kadar").
  const monthlyCollected = useMemo(() => {
    const buckets = Array(12).fill(0);
    (finance?.monthlyIncome || []).forEach((item) => {
      const [year, month] = String(item.month).split('-').map(Number);
      if (year === Number(selectedYear) && month >= 1 && month <= 12) buckets[month - 1] += Number(item.amount) || 0;
    });
    return buckets;
  }, [finance, selectedYear]);

  // 4 ust kart: sozlesme bazli otoriter toplamlar (her zaman kayit ucretlerini icerir).
  const stats = useMemo(() => {
    const installments = dashboard?.installments || [];
    const collections = dashboard?.collections || [];
    const now = Date.now();
    const overdueEntries = installments.filter((item) => {
      const status = normalizeStatus(item.status);
      const due = parseTrDate(item.due);
      return status.includes('gec') || status.includes('late') || (due && due.getTime() < now);
    });
    return {
      totalReceivable: Number(finance?.netTotal) || 0,
      totalCollected: Number(finance?.collectedTotal) || 0,
      pendingPayments: Number(finance?.outstandingTotal) || 0,
      overduePayments: Number(finance?.overdueTotal) || 0,
      overdueStudentCount: Number(finance?.overdueStudentCount) || 0,
      collectionRate: Number(finance?.collectionRatePercent) || 0,
      overdueEntries,
      recentCollections: [...collections].slice(0, 5),
    };
  }, [finance, dashboard]);

  // Seçili döneme (period + anchor) göre tahsilat/taksit akış metrikleri.
  const periodStats = useMemo(() => {
    const collections = dashboard?.collections || [];
    const installments = dashboard?.installments || [];
    const periodCollections = filterByPeriod(collections, (c) => c.time || c.date, period, anchor);
    const periodInstallments = filterByPeriod(installments, (i) => i.due || i.dueDate, period, anchor);
    const sum = (list) => list.reduce((s, c) => s + parseMoney(c.amount), 0);
    const byMethod = (list, ...keys) => list.filter((c) => {
      const m = normalizeStatus(c.method || c.paymentMethod || c.type);
      return keys.some((k) => m.includes(k));
    });
    const now = Date.now();
    const overdueDue = periodInstallments.filter((i) => {
      const due = parseTrDateTime(i.due || i.dueDate);
      const st = normalizeStatus(i.status);
      return (due && due.getTime() < now && !st.includes('öden') && !st.includes('paid')) || st.includes('gec');
    });
    const collectionSeries = buildBucketSeries(
      collections,
      (item) => item.time || item.date,
      (item) => parseMoney(item.amount),
      period,
      anchor,
    );
    const cashSeries = buildBucketSeries(
      collections.filter((item) => normalizeStatus(item.method || item.paymentMethod || item.type).includes('nakit')),
      (item) => item.time || item.date,
      (item) => parseMoney(item.amount),
      period,
      anchor,
    );
    const cardBankSeries = buildBucketSeries(
      collections.filter((item) => {
        const method = normalizeStatus(item.method || item.paymentMethod || item.type);
        return ['kart', 'card', 'pos', 'havale', 'eft', 'bank', 'banka', 'transfer'].some((key) => method.includes(key));
      }),
      (item) => item.time || item.date,
      (item) => parseMoney(item.amount),
      period,
      anchor,
    );
    const dueSeries = buildBucketSeries(
      installments,
      (item) => item.due || item.dueDate,
      (item) => parseMoney(item.amount),
      period,
      anchor,
    );
    return {
      collected: sum(periodCollections),
      count: periodCollections.length,
      cash: sum(byMethod(periodCollections, 'nakit')),
      cardBank: sum(byMethod(periodCollections, 'kart', 'card', 'pos', 'havale', 'eft', 'bank', 'banka', 'transfer')),
      dueTotal: sum(periodInstallments),
      overdueTotal: sum(overdueDue),
      recent: [...periodCollections].sort((a, b) => (parseTrDateTime(b.time) || 0) - (parseTrDateTime(a.time) || 0)).slice(0, 5),
      collectionSeries,
      cashSeries,
      cardBankSeries,
      dueSeries,
    };
  }, [dashboard, period, anchor]);

  const cumulativeChartSeries = useMemo(() => {
    const installments = dashboard?.installments || [];
    const due = Array(12).fill(0);
    const pending = Array(12).fill(0);
    const overdue = Array(12).fill(0);
    const now = Date.now();

    installments.forEach((item) => {
      const date = parseTrDate(item.due || item.dueDate);
      if (!date || date.getFullYear() !== Number(selectedYear)) return;
      const amount = parseMoney(item.amount);
      const month = date.getMonth();
      due[month] += amount;
      if (!isPaidStatus(item.status)) pending[month] += amount;
      if (!isPaidStatus(item.status) && (normalizeStatus(item.status).includes('gec') || date.getTime() < now)) {
        overdue[month] += amount;
      }
    });

    return {
      receivable: ensureMetricSeries(due, stats.totalReceivable),
      collected: ensureMetricSeries(monthlyCollected, stats.totalCollected),
      pending: ensureMetricSeries(pending, stats.pendingPayments),
      overdue: ensureMetricSeries(overdue, stats.overduePayments),
    };
  }, [dashboard, monthlyCollected, selectedYear, stats]);

  const yearlyCollected = useMemo(() => monthlyCollected.reduce((sum, value) => sum + value, 0), [monthlyCollected]);
  const maxMonthly = useMemo(() => Math.max(1, ...monthlyCollected), [monthlyCollected]);
  const selectedPeriodCollected = selectedMonth === 'all' ? yearlyCollected : monthlyCollected[selectedMonth] || 0;
  const periodLabel = selectedMonth === 'all' ? `${selectedYear} · Yıllık` : `${MONTHS_TR[selectedMonth]} ${selectedYear}`;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Finans paneli yükleniyor...</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
      data-testid="finance-dashboard-page"
    >
      <div>
        <h1 className="text-3xl font-bold font-heading">Muhasebe</h1>
        <p className="text-muted-foreground mt-1">Gerçek backend verileriyle finansal genel bakış</p>
      </div>

      {error ? <ErrorBanner title="Finans verileri alınamadı" message={error} onRetry={loadDashboard} /> : null}

      {/* Dönem seçici (Günlük/Haftalık/Aylık/Yıllık) + ileri-geri */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-foreground/10 bg-foreground/[0.04] p-1">
          {[['day', 'Günlük'], ['week', 'Haftalık'], ['month', 'Aylık'], ['year', 'Yıllık']].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => { setPeriod(val); setAnchor(new Date()); setSelectedMonth('all'); }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${period === val ? 'bg-[hsl(var(--brand-accent))] text-white' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-foreground/10 bg-foreground/[0.04] px-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAnchor((a) => shiftAnchor(period, a, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[150px] text-center text-sm font-bold">{buildPeriodLabel(period, anchor)}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAnchor((a) => shiftAnchor(period, a, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </motion.div>

      {/* Dönem kartları — seçili döneme göre akış */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <motion.div variants={itemVariants}>
          <PremiumMetricCard title="Dönem Tahsilatı" value={formatTry(periodStats.collected)} caption={buildPeriodLabel(period, anchor)} icon={CreditCard} tone="emerald" trend={`${periodStats.count} işlem`} chartValues={ensureMetricSeries(periodStats.collectionSeries, periodStats.collected)} chartClassName="h-14" />
        </motion.div>
        <motion.div variants={itemVariants}>
          <PremiumMetricCard title="Nakit" value={formatTry(periodStats.cash)} caption="Dönem içi nakit tahsilat" icon={Banknote} tone="blue" trend="Nakit" chartValues={ensureMetricSeries(periodStats.cashSeries, periodStats.cash)} chartClassName="h-14" />
        </motion.div>
        <motion.div variants={itemVariants}>
          <PremiumMetricCard title="Kart / Havale" value={formatTry(periodStats.cardBank)} caption="Kart, POS, havale/EFT" icon={Building2} tone="violet" trend="Banka" chartValues={ensureMetricSeries(periodStats.cardBankSeries, periodStats.cardBank)} chartClassName="h-14" />
        </motion.div>
        <motion.div variants={itemVariants}>
          <PremiumMetricCard title="Dönem Vadesi" value={formatTry(periodStats.dueTotal)} caption={`Vadesi geçen: ${formatTry(periodStats.overdueTotal)}`} icon={Calendar} tone="amber" trend="Vade" chartValues={ensureMetricSeries(periodStats.dueSeries, periodStats.dueTotal)} chartClassName="h-14" />
        </motion.div>
      </div>

      <motion.div variants={itemVariants}>
        <PremiumPanel
          title="Aylık Tahsilat"
          description={`${periodLabel}: ${formatTry(selectedPeriodCollected)} · aya tıkla → o ayın paneli açılır`}
          action={(
            <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(Number(value))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setSelectedMonth('all'); setPeriod('year'); setAnchor(new Date(Number(selectedYear), 0, 1)); }}
              className={`flex min-w-[96px] flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors ${selectedMonth === 'all' ? 'border-[hsl(var(--brand-accent))] bg-[hsl(var(--brand-accent)/0.14)]' : 'border-foreground/10 bg-foreground/[0.035] hover:border-foreground/20'}`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Yıllık</span>
              <span className="text-sm font-black tabular-nums">{formatTry(yearlyCollected)}</span>
            </button>
            {MONTHS_TR.map((month, index) => {
              const value = monthlyCollected[index];
              const active = selectedMonth === index;
              return (
                <button
                  key={month}
                  type="button"
                  onClick={() => { setSelectedMonth(index); setPeriod('month'); setAnchor(new Date(Number(selectedYear), index, 1)); }}
                  className={`flex min-w-[96px] flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors ${active ? 'border-[hsl(var(--brand-accent))] bg-[hsl(var(--brand-accent)/0.14)]' : 'border-foreground/10 bg-foreground/[0.035] hover:border-foreground/20'}`}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{month.slice(0, 3)}</span>
                  <span className="text-sm font-black tabular-nums">{formatTry(value)}</span>
                  <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                    <span className="block h-full rounded-full bg-[hsl(var(--brand-accent))]" style={{ width: `${Math.round((value / maxMonthly) * 100)}%` }} />
                  </span>
                </button>
              );
            })}
          </div>
        </PremiumPanel>
      </motion.div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Finansal Özet (Kümülatif)</h2>
        <span className="rounded-full border border-foreground/10 bg-foreground/[0.05] px-3 py-1 text-xs font-semibold text-[hsl(var(--brand-accent))]">Tüm Sözleşmeler · Dönemden bağımsız</span>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <motion.div variants={itemVariants}>
          <PremiumMetricCard title="Toplam Alacak" value={`₺${stats.totalReceivable.toLocaleString('tr-TR')}`} caption={`${selectedYear} aylık vade dağılımı`} icon={Wallet} tone="blue" trend="Alacak" chartValues={cumulativeChartSeries.receivable} chartClassName="h-16" />
        </motion.div>

        <motion.div variants={itemVariants}>
          <PremiumMetricCard title="Tahsil Edilen" value={`₺${stats.totalCollected.toLocaleString('tr-TR')}`} caption={`${selectedYear} aylık tahsilat akışı`} icon={CreditCard} tone="emerald" trend={`%${stats.collectionRate}`} chartValues={cumulativeChartSeries.collected} chartClassName="h-16" />
        </motion.div>

        <motion.div variants={itemVariants}>
          <PremiumMetricCard title="Bekleyen" value={`₺${stats.pendingPayments.toLocaleString('tr-TR')}`} caption={`${selectedYear} bekleyen taksit dağılımı`} icon={Calendar} tone="amber" trend="Bekleyen" chartValues={cumulativeChartSeries.pending} chartClassName="h-16" />
        </motion.div>

        <motion.div variants={itemVariants}>
          <PremiumMetricCard title="Gecikmiş" value={`₺${stats.overduePayments.toLocaleString('tr-TR')}`} caption={`${selectedYear} gecikme dağılımı`} icon={TrendingDown} tone="rose" trend={`${stats.overdueStudentCount} öğrenci`} chartValues={cumulativeChartSeries.overdue} chartClassName="h-16" />
        </motion.div>
      </div>

      <motion.div variants={itemVariants}>
        <PremiumPanel title="Gelir - Gider Grafiği" description="Tahsilat, bekleyen ödeme ve gecikme dağılımı">
          <div className="grid gap-5 xl:grid-cols-[1fr_180px_220px]">
            <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.035] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Finansal akış</p>
                  <p className="mt-1 text-2xl font-black">Muhasebe Paneli</p>
                </div>
                <Badge variant="outline">Canlı</Badge>
              </div>
              <MiniLineChart values={[stats.totalReceivable, stats.totalCollected, stats.pendingPayments, stats.overduePayments, stats.collectionRate]} className="h-40" />
            </div>
            <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.035] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tahsilat Oranı</p>
              <div className="mt-5 flex justify-center">
                <MiniDonut value={stats.collectionRate} label="Tahsilat" />
              </div>
            </div>
            <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.035] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Gelir Dağılımı</p>
              <MiniBarChart values={[stats.totalCollected, stats.pendingPayments, stats.overduePayments, stats.totalReceivable]} className="mt-5" />
            </div>
          </div>
        </PremiumPanel>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <PremiumPanel
            title="Son Tahsilatlar"
            description={`${buildPeriodLabel(period, anchor)} · dönem tahsilatları`}
            action={(
              <Button asChild variant="outline" size="sm">
                <Link to="/finance/collections">
                  Tümünü Gör
                  <ArrowUpRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
          >
              <div className="space-y-4">
                {periodStats.recent.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-foreground/10 p-6 text-center text-sm text-muted-foreground">Bu dönemde tahsilat yok.</p>
                ) : periodStats.recent.map((collection) => (
                  <PremiumListRow key={collection.id} icon={CreditCard} title={collection.name} subtitle={`${collection.method} • ${collection.note || 'Tahsilat'}`} meta={`+₺${parseMoney(collection.amount).toLocaleString('tr-TR')}`} accent onClick={() => setSelectedCollection(collection)} />
                ))}
              </div>
          </PremiumPanel>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Geciken Ödemeler
                </CardTitle>
                <CardDescription>Takip gerektiren backend taksitleri</CardDescription>
              </div>
              <Badge className="bg-red-100 text-red-700">{stats.overdueEntries.length} Kayıt</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.overdueEntries.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                        <Users className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="font-medium">{student.student}</p>
                        <p className="text-sm text-muted-foreground">{student.note || 'Gecikmiş taksit'} • {student.due}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">₺{parseMoney(student.amount).toLocaleString('tr-TR')}</p>
                      <Button asChild variant="outline" size="sm" className="mt-1 text-xs h-7">
                        <Link to="/finance/collections">Tahsilat Al</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Tahsilat Hedefi</CardTitle>
            <CardDescription>Fatura ve tahsilat kayıtlarına göre güncel durum</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Tahsil Edilen</span>
                <span className="font-bold">₺{stats.totalCollected.toLocaleString('tr-TR')} / ₺{stats.totalReceivable.toLocaleString('tr-TR')}</span>
              </div>
              <Progress value={stats.collectionRate} className="h-3" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>%{stats.collectionRate} tamamlandı</span>
                <span>Kalan: ₺{Math.max(0, stats.totalReceivable - stats.totalCollected).toLocaleString('tr-TR')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={Boolean(selectedCollection)} onOpenChange={(open) => { if (!open) setSelectedCollection(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Son Tahsilat Detayı</DialogTitle>
            <DialogDescription>Seçilen tahsilatın profesyonel özet görünümü</DialogDescription>
          </DialogHeader>
          {selectedCollection ? (
            <div className="space-y-6">
              <div className="rounded-3xl border border-emerald-200/60 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-6 text-white shadow-lg">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-foreground/70">Tahsilat Özeti</div>
                    <h3 className="mt-2 text-2xl font-semibold">{selectedCollection.name}</h3>
                    <p className="mt-2 text-sm text-foreground/80">{selectedCollection.className || 'Sınıf bilgisi yok'} • {selectedCollection.note || 'Standart tahsilat kaydı'}</p>
                  </div>
                  <div className="rounded-2xl bg-foreground/12 px-5 py-4 backdrop-blur">
                    <div className="text-xs text-foreground/70">Tahsilat Tutarı</div>
                    <div className="mt-2 text-3xl font-bold">₺{parseMoney(selectedCollection.amount).toLocaleString('tr-TR')}</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ['Ödeme Yöntemi', selectedCollection.method || 'Belirtilmedi', CreditCard],
                  ['Belge No', selectedCollection.id, Receipt],
                  ['İşlem Zamanı', selectedCollection.time || 'Belirtilmedi', Landmark],
                ].map(([label, value, Icon]) => (
                  <Card key={label}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-muted p-2">
                          <Icon className="h-4 w-4 text-brand-primary" />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                          <p className="mt-1 font-semibold">{value}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Muhasebe İşlem Notu</CardTitle>
                  <CardDescription>Bu kart ödeme kaydının operasyonel açıklamasını gösterir</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>Bu tahsilat, öğrenci cari hesabına işlenmiş gerçek bir backend kaydıdır. İlgili öğrenci hesabı, makbuz arşivi ve tahsilat listesinde aynı belge numarasıyla izlenebilir.</p>
                  <p><span className="font-medium text-foreground">Açıklama:</span> {selectedCollection.note || 'Ek açıklama yok.'}</p>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
