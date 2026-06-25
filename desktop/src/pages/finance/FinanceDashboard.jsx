import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CreditCard,
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
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAccountingDashboard, fetchFinanceDashboard } from '../../lib/api/modules';
import { normalizeFinanceText, parseFinanceMoney } from '../../lib/financeDocuments';
import { filterByPeriod, periodLabel as buildPeriodLabel, shiftAnchor, parseTrDateTime } from '../../lib/financePeriod';
import {
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

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const WEEKDAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function parseMoney(value) {
  return parseFinanceMoney(value);
}

function normalizeStatus(value = '') {
  return normalizeFinanceText(value);
}

// Backend tahsilat "time"/fatura "subtitle"/maaş "payDate" alanlarındaki
// "dd.MM.yyyy" tarihini Date'e çevirir.
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
  return Array.from({ length: daysInMonth }, (_, index) => ({
    start: new Date(reference.getFullYear(), reference.getMonth(), index + 1),
    end: new Date(reference.getFullYear(), reference.getMonth(), index + 2),
  }));
}

function bucketLabel(start, period) {
  if (period === 'day') return `${String(start.getHours()).padStart(2, '0')}:00`;
  if (period === 'week') return WEEKDAYS_TR[(start.getDay() + 6) % 7];
  if (period === 'year') return MONTHS_TR[start.getMonth()].slice(0, 3);
  return String(start.getDate());
}

// Gelir (tahsilat) vs gider (maaş + fatura) detaylı dönem grafiği — hover'da
// o dönemin ne geldi / ne gitti / net kartı açılır.
function FlowChart({ buckets }) {
  const [hover, setHover] = useState(null);
  if (!buckets.length) {
    return <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-foreground/10 text-sm text-muted-foreground">Bu dönem için veri yok.</div>;
  }
  const maxValue = Math.max(1, ...buckets.map((b) => Math.max(b.income, b.expense)));
  const active = hover != null ? buckets[hover] : buckets[buckets.length - 1];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Gelir (tahsilat)</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Gider (maaş + fatura)</span>
      </div>

      <div className="relative mt-5 h-64">
        {active ? (
          <div className="pointer-events-none absolute -top-1 right-0 z-10 w-56 rounded-2xl border border-foreground/10 bg-[#020B1F]/95 px-4 py-3 text-xs shadow-xl backdrop-blur">
            <p className="mb-1.5 font-bold text-foreground">{active.label}</p>
            <p className="flex items-center justify-between gap-4 text-emerald-400"><span>Ne geldi</span><span className="tabular-nums font-semibold">{formatTry(active.income)}</span></p>
            <p className="flex items-center justify-between gap-4 text-rose-400"><span>Ne gitti</span><span className="tabular-nums font-semibold">{formatTry(active.expense)}</span></p>
            <div className="mt-1.5 space-y-0.5 border-t border-foreground/10 pt-1.5 text-[11px] text-muted-foreground">
              <p className="flex justify-between"><span>• Maaş gideri</span><span className="tabular-nums">{formatTry(active.salaryExp)}</span></p>
              <p className="flex justify-between"><span>• Fatura gideri</span><span className="tabular-nums">{formatTry(active.invoiceExp)}</span></p>
            </div>
            <p className={`mt-1.5 flex items-center justify-between gap-4 border-t border-foreground/10 pt-1.5 font-bold ${active.net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}><span>Net</span><span className="tabular-nums">{formatTry(active.net)}</span></p>
          </div>
        ) : null}

        <div className="flex h-full items-end gap-1">
          {buckets.map((bucket, index) => {
            const incomeH = Math.max(2, (bucket.income / maxValue) * 100);
            const expenseH = Math.max(2, (bucket.expense / maxValue) * 100);
            const isActive = (hover != null ? hover : buckets.length - 1) === index;
            return (
              <button
                type="button"
                key={`${bucket.label}-${index}`}
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(index)}
                className="group relative flex h-full flex-1 items-end justify-center"
              >
                <div className={`flex h-full w-full items-end justify-center gap-[2px] rounded-md px-0.5 pt-3 transition-colors ${isActive ? 'bg-foreground/[0.06]' : ''}`}>
                  <div className="w-1/2 max-w-[16px] rounded-t bg-gradient-to-t from-emerald-600/70 to-emerald-400" style={{ height: `${incomeH}%` }} />
                  <div className="w-1/2 max-w-[16px] rounded-t bg-gradient-to-t from-rose-600/70 to-rose-400" style={{ height: `${expenseH}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-1 text-center text-[10px] text-muted-foreground">
        {buckets.map((bucket, index) => (
          <span key={`${bucket.label}-label-${index}`} className="flex-1 truncate">{bucket.label}</span>
        ))}
      </div>
    </div>
  );
}

const DIST_COLORS = {
  'Nakit': '#10b981',
  'Kart / POS': '#6366f1',
  'Havale / EFT': '#f59e0b',
  'Diğer': '#94a3b8',
};

// Gelir dağılımı — ödeme yöntemine göre donut + lejant + yüzde.
function IncomeDistribution({ groups, total }) {
  const entries = Object.entries(groups).filter(([, value]) => value > 0);
  if (total <= 0 || entries.length === 0) {
    return <div className="flex h-full min-h-[160px] items-center justify-center text-center text-sm text-muted-foreground">Bu dönemde tahsilat yok.</div>;
  }
  let acc = 0;
  const gradientStops = entries.map(([key, value]) => {
    const from = (acc / total) * 360;
    acc += value;
    const to = (acc / total) * 360;
    return `${DIST_COLORS[key]} ${from}deg ${to}deg`;
  }).join(', ');

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative grid h-36 w-36 place-items-center rounded-full" style={{ background: `conic-gradient(${gradientStops})` }}>
        <div className="grid h-24 w-24 place-items-center rounded-full bg-card text-center">
          <div>
            <p className="text-base font-black tabular-nums">{formatTry(total)}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Toplam Gelir</p>
          </div>
        </div>
      </div>
      <div className="w-full space-y-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: DIST_COLORS[key] }} />
              {key}
            </span>
            <span className="flex items-center gap-2 tabular-nums">
              <span className="font-semibold">{formatTry(value)}</span>
              <span className="w-10 text-right text-xs text-muted-foreground">%{Math.round((value / total) * 100)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FinanceDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [finance, setFinance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [period, setPeriod] = useState('month');
  const [anchor, setAnchor] = useState(() => new Date());

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
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

  // Genel (dönemden bağımsız) sözleşme-bazlı durum — sadece hedef çubuğu için.
  const overall = useMemo(() => ({
    totalReceivable: Number(finance?.netTotal) || 0,
    totalCollected: Number(finance?.collectedTotal) || 0,
    collectionRate: Number(finance?.collectionRatePercent) || 0,
  }), [finance]);

  // Seçili döneme göre tahsilat akış metrikleri + geciken taksitler.
  const periodStats = useMemo(() => {
    const collections = dashboard?.collections || [];
    const installments = dashboard?.installments || [];
    const periodCollections = filterByPeriod(collections, (c) => c.time || c.date, period, anchor);
    const sum = (list) => list.reduce((s, c) => s + parseMoney(c.amount), 0);
    const byMethod = (list, ...keys) => list.filter((c) => {
      const m = normalizeStatus(c.method || c.paymentMethod || c.type);
      return keys.some((k) => m.includes(k));
    });
    const now = Date.now();
    const overdueEntries = installments.filter((item) => {
      const due = parseTrDate(item.due || item.dueDate);
      const st = normalizeStatus(item.status);
      return st.includes('gec') || st.includes('late') || (due && due.getTime() < now && !st.includes('öden') && !st.includes('paid'));
    });
    const periodInstallments = filterByPeriod(installments, (i) => i.due || i.dueDate, period, anchor);
    return {
      collected: sum(periodCollections),
      count: periodCollections.length,
      cash: sum(byMethod(periodCollections, 'nakit')),
      cardBank: sum(byMethod(periodCollections, 'kart', 'card', 'pos', 'havale', 'eft', 'bank', 'banka', 'transfer')),
      dueTotal: sum(periodInstallments),
      recent: [...periodCollections].sort((a, b) => (parseTrDateTime(b.time) || 0) - (parseTrDateTime(a.time) || 0)).slice(0, 5),
      overdueEntries,
    };
  }, [dashboard, period, anchor]);

  // Gelir-Gider akışı: dönem kovaları (gelir=tahsilat, gider=maaş+fatura).
  const flowBuckets = useMemo(() => {
    const collections = dashboard?.collections || [];
    const salaries = dashboard?.salaries || [];
    const invoices = dashboard?.invoices || [];
    return createPeriodBuckets(period, anchor).map(({ start, end }) => {
      const inBucket = (d) => d && d >= start && d < end;
      const income = collections.reduce((s, c) => (inBucket(parseTrDateTime(c.time || c.date)) ? s + parseMoney(c.amount) : s), 0);
      const salaryExp = salaries.reduce((s, x) => (inBucket(parseTrDate(x.payDate || x.date)) ? s + parseMoney(x.amount) : s), 0);
      const invoiceExp = invoices.reduce((s, x) => (inBucket(parseTrDate(x.subtitle || x.date)) ? s + parseMoney(x.amount) : s), 0);
      const expense = salaryExp + invoiceExp;
      return { label: bucketLabel(start, period), income, expense, salaryExp, invoiceExp, net: income - expense };
    });
  }, [dashboard, period, anchor]);

  const flowTotals = useMemo(() => {
    const income = flowBuckets.reduce((s, b) => s + b.income, 0);
    const expense = flowBuckets.reduce((s, b) => s + b.expense, 0);
    return { income, expense, net: income - expense };
  }, [flowBuckets]);

  // Gelir dağılımı: ödeme yöntemine göre (dönem içi).
  const methodDist = useMemo(() => {
    const periodCollections = filterByPeriod(dashboard?.collections || [], (c) => c.time || c.date, period, anchor);
    const groups = { 'Nakit': 0, 'Kart / POS': 0, 'Havale / EFT': 0, 'Diğer': 0 };
    periodCollections.forEach((c) => {
      const m = normalizeStatus(c.method || c.paymentMethod || c.type);
      const amount = parseMoney(c.amount);
      if (m.includes('nakit')) groups['Nakit'] += amount;
      else if (['kart', 'card', 'pos'].some((k) => m.includes(k))) groups['Kart / POS'] += amount;
      else if (['havale', 'eft', 'bank', 'banka', 'transfer'].some((k) => m.includes(k))) groups['Havale / EFT'] += amount;
      else groups['Diğer'] += amount;
    });
    const total = Object.values(groups).reduce((a, b) => a + b, 0);
    return { groups, total };
  }, [dashboard, period, anchor]);

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
        <p className="text-muted-foreground mt-1">Seçilen döneme göre canlı finansal genel bakış</p>
      </div>

      {error ? <ErrorBanner title="Finans verileri alınamadı" message={error} onRetry={loadDashboard} /> : null}

      {/* Dönem seçici — tüm sayfa bu döneme göre */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-foreground/10 bg-foreground/[0.04] p-1">
          {[['day', 'Günlük'], ['week', 'Haftalık'], ['month', 'Aylık'], ['year', 'Yıllık']].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => { setPeriod(val); setAnchor(new Date()); }}
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

      {/* Dönem kartları */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <motion.div variants={itemVariants}>
          <PremiumMetricCard title="Dönem Tahsilatı" value={formatTry(periodStats.collected)} caption={buildPeriodLabel(period, anchor)} icon={CreditCard} tone="emerald" trend={`${periodStats.count} işlem`} />
        </motion.div>
        <motion.div variants={itemVariants}>
          <PremiumMetricCard title="Nakit" value={formatTry(periodStats.cash)} caption="Dönem içi nakit tahsilat" icon={Banknote} tone="blue" trend="Nakit" />
        </motion.div>
        <motion.div variants={itemVariants}>
          <PremiumMetricCard title="Kart / Havale" value={formatTry(periodStats.cardBank)} caption="Kart, POS, havale/EFT" icon={Building2} tone="violet" trend="Banka" />
        </motion.div>
        <motion.div variants={itemVariants}>
          <PremiumMetricCard title="Dönem Vadesi" value={formatTry(periodStats.dueTotal)} caption="Bu dönemde vadesi gelen taksit" icon={Calendar} tone="amber" trend="Vade" />
        </motion.div>
      </div>

      {/* Gelir-Gider grafiği + Gelir dağılımı */}
      <motion.div variants={itemVariants}>
        <PremiumPanel title="Gelir - Gider Grafiği" description={`${buildPeriodLabel(period, anchor)} · bir sütunun üstüne gelince ne geldi / ne gitti detayı açılır`}>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.9fr)]">
            <div className="rounded-3xl border border-foreground/10 bg-[#020B1F]/40 p-6">
              <div className="mb-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-foreground/10 bg-emerald-500/10 p-3">
                  <p className="text-xs text-muted-foreground">Toplam Gelir</p>
                  <p className="mt-1 text-lg font-black text-emerald-400 tabular-nums">{formatTry(flowTotals.income)}</p>
                </div>
                <div className="rounded-2xl border border-foreground/10 bg-rose-500/10 p-3">
                  <p className="text-xs text-muted-foreground">Toplam Gider</p>
                  <p className="mt-1 text-lg font-black text-rose-400 tabular-nums">{formatTry(flowTotals.expense)}</p>
                </div>
                <div className={`rounded-2xl border border-foreground/10 p-3 ${flowTotals.net >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                  <p className="text-xs text-muted-foreground">Net</p>
                  <p className={`mt-1 text-lg font-black tabular-nums ${flowTotals.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatTry(flowTotals.net)}</p>
                </div>
              </div>
              <FlowChart buckets={flowBuckets} />
            </div>
            <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.035] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Gelir Dağılımı (Ödeme Yöntemi)</p>
              <div className="mt-5">
                <IncomeDistribution groups={methodDist.groups} total={methodDist.total} />
              </div>
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
              <Badge className="bg-red-100 text-red-700">{periodStats.overdueEntries.length} Kayıt</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {periodStats.overdueEntries.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Geciken ödeme yok.</p>
                ) : periodStats.overdueEntries.slice(0, 8).map((student) => (
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
            <CardTitle>Tahsilat Hedefi (Genel)</CardTitle>
            <CardDescription>Tüm sözleşmelere göre güncel tahsilat durumu</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Tahsil Edilen</span>
                <span className="font-bold">₺{overall.totalCollected.toLocaleString('tr-TR')} / ₺{overall.totalReceivable.toLocaleString('tr-TR')}</span>
              </div>
              <Progress value={overall.collectionRate} className="h-3" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>%{overall.collectionRate} tamamlandı</span>
                <span>Kalan: ₺{Math.max(0, overall.totalReceivable - overall.totalCollected).toLocaleString('tr-TR')}</span>
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
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
