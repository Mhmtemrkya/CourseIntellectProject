import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CreditCard,
  AlertCircle, Calendar, Users, ArrowUpRight, Receipt, Landmark,
  Banknote, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Target,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
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
const PERIOD_NOUN = { day: 'gün', week: 'hafta', month: 'ay', year: 'yıl' };

function parseMoney(value) {
  return parseFinanceMoney(value);
}

function normalizeStatus(value = '') {
  return normalizeFinanceText(value);
}

// "Gider" toplamına dahil EDİLMEYEN faturalar:
//  - Öğrenci/kurs ücreti faturaları → gelir belgesidir.
//  - Maaş/bordro faturaları → maaş gideri zaten ayrı "Maaş" listesinden sayıldığı
//    için çift sayımı önlemek üzere hariç tutulur.
// Yani gidere yalnızca mekân/kira/fatura/diğer gider kalemleri girer.
function isExpenseInvoice(invoice) {
  const cat = normalizeStatus(invoice?.category || invoice?.type || '');
  const excludedMarkers = ['ogrenci', 'öğrenci', 'kurs', 'ucret', 'ücret', 'tahsil', 'gelir', 'maas', 'maaş', 'bordro', 'personel', 'payroll'];
  return !excludedMarkers.some((marker) => cat.includes(marker));
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

// Eksen etiketleri için kısaltılmış para biçimi (₺12B / ₺1,2M).
function formatTryShort(amount) {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `₺${(amount / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace('.', ',')}M`;
  if (abs >= 1_000) return `₺${(amount / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace('.', ',')}B`;
  return `₺${Math.round(amount)}`;
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

function bucketFullLabel(start, period) {
  if (period === 'day') return `${String(start.getHours()).padStart(2, '0')}:00 – ${String((start.getHours() + 3) % 24).padStart(2, '0')}:00`;
  if (period === 'week') return `${WEEKDAYS_TR[(start.getDay() + 6) % 7]} · ${start.getDate()} ${MONTHS_TR[start.getMonth()].slice(0, 3)}`;
  if (period === 'year') return `${MONTHS_TR[start.getMonth()]} ${start.getFullYear()}`;
  return `${start.getDate()} ${MONTHS_TR[start.getMonth()].slice(0, 3)}`;
}

// Profesyonel Gelir / Gider akış grafiği — SVG tabanlı, ızgaralı, çift alan +
// hover'da o dönemin "ne geldi / ne gitti / maaş / fatura / net" detay kartı.
function FlowChart({ buckets, period }) {
  const [hover, setHover] = useState(null);

  if (!buckets.length) {
    return <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-foreground/10 text-sm text-muted-foreground">Bu dönem için veri yok.</div>;
  }

  const W = 760;
  const H = 260;
  const padL = 56;
  const padR = 16;
  const padT = 18;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const rawMax = Math.max(1, ...buckets.map((b) => Math.max(b.income, b.expense)));
  // Izgara için "güzel" tavan değeri.
  const niceStep = (() => {
    const rough = rawMax / 4;
    const pow = Math.pow(10, Math.floor(Math.log10(rough)));
    const candidates = [1, 2, 2.5, 5, 10].map((m) => m * pow);
    return candidates.find((c) => c >= rough) || candidates[candidates.length - 1];
  })();
  const maxValue = niceStep * 4;
  const gridLines = Array.from({ length: 5 }, (_, i) => niceStep * i);

  const n = buckets.length;
  const x = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v) => padT + plotH - (v / maxValue) * plotH;

  const linePath = (key) => buckets.map((b, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)},${y(b[key]).toFixed(1)}`).join(' ');
  const areaPath = (key) => `${linePath(key)} L ${x(n - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L ${x(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;

  const activeIndex = hover != null ? hover : null;
  const active = activeIndex != null ? buckets[activeIndex] : null;
  // Tooltip yatay konumu (% — sağ kenara taşmasın diye kıstırılır).
  const tipLeft = active ? Math.min(82, Math.max(2, ((x(activeIndex) - padL) / plotW) * 100)) : 0;
  const labelEvery = Math.ceil(n / 12);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-emerald-400" /> Gelir (tahsilat)</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-rose-400" /> Gider (maaş + fatura)</span>
      </div>

      <div className="relative w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto' }} role="img" aria-label="Gelir gider grafiği">
          <defs>
            <linearGradient id="fin-income-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="fin-expense-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Izgara çizgileri + eksen değerleri */}
          {gridLines.map((value, i) => {
            const gy = y(value);
            return (
              <g key={value}>
                <line x1={padL} x2={W - padR} y1={gy} y2={gy} stroke="hsl(var(--ci-chart-grid) / 0.38)" strokeDasharray={i === 0 ? '0' : '4 6'} />
                <text x={padL - 8} y={gy + 3} textAnchor="end" className="fill-muted-foreground" style={{ fontSize: 10 }}>{formatTryShort(value)}</text>
              </g>
            );
          })}

          {/* Alan dolguları */}
          <path d={areaPath('expense')} fill="url(#fin-expense-fill)" />
          <path d={areaPath('income')} fill="url(#fin-income-fill)" />

          {/* Çizgiler */}
          <path d={linePath('expense')} fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d={linePath('income')} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Aktif dikey kılavuz */}
          {active ? <line x1={x(activeIndex)} x2={x(activeIndex)} y1={padT} y2={padT + plotH} stroke="hsl(var(--brand-accent))" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" /> : null}

          {/* Noktalar */}
          {buckets.map((b, i) => (
            <g key={`pt-${i}`}>
              <circle cx={x(i)} cy={y(b.income)} r={activeIndex === i ? 4.5 : 2.6} fill="#10b981" stroke="hsl(var(--ci-card))" strokeWidth={activeIndex === i ? 2 : 0} />
              <circle cx={x(i)} cy={y(b.expense)} r={activeIndex === i ? 4.5 : 2.6} fill="#f43f5e" stroke="hsl(var(--ci-card))" strokeWidth={activeIndex === i ? 2 : 0} />
            </g>
          ))}

          {/* X ekseni etiketleri */}
          {buckets.map((b, i) => (
            (i % labelEvery === 0 || i === n - 1) ? (
              <text key={`xl-${i}`} x={x(i)} y={H - 10} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10 }}>{b.label}</text>
            ) : null
          ))}

          {/* Hover yakalama bantları */}
          {buckets.map((b, i) => (
            <rect
              key={`hit-${i}`}
              x={n === 1 ? padL : x(i) - plotW / (2 * (n - 1))}
              y={padT}
              width={n === 1 ? plotW : plotW / (n - 1)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>

        {/* Detay kartı */}
        {active ? (
          <div
            className="pointer-events-none absolute top-1 z-10 w-60 rounded-2xl border border-foreground/10 bg-[hsl(var(--ci-surface-1)/0.97)] px-4 py-3 text-xs shadow-2xl backdrop-blur"
            style={{ left: `${tipLeft}%` }}
          >
            <p className="mb-2 flex items-center justify-between font-bold text-foreground">
              <span>{active.fullLabel}</span>
              <span className="text-[10px] font-medium text-muted-foreground">{PERIOD_NOUN[period]}</span>
            </p>
            <p className="flex items-center justify-between gap-4 text-emerald-400"><span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Ne geldi</span><span className="tabular-nums font-semibold">{formatTry(active.income)}</span></p>
            <p className="mt-1 flex items-center justify-between gap-4 text-rose-400"><span className="flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5" /> Ne gitti</span><span className="tabular-nums font-semibold">{formatTry(active.expense)}</span></p>
            <div className="mt-2 space-y-0.5 border-t border-foreground/10 pt-2 text-[11px] text-muted-foreground">
              <p className="flex justify-between"><span>• Maaş gideri</span><span className="tabular-nums">{formatTry(active.salaryExp)}</span></p>
              <p className="flex justify-between"><span>• Fatura gideri</span><span className="tabular-nums">{formatTry(active.invoiceExp)}</span></p>
              <p className="flex justify-between"><span>• Tahsilat adedi</span><span className="tabular-nums">{active.count} işlem</span></p>
            </div>
            <p className={`mt-2 flex items-center justify-between gap-4 border-t border-foreground/10 pt-2 font-bold ${active.net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}><span>Net</span><span className="tabular-nums">{active.net >= 0 ? '+' : ''}{formatTry(active.net)}</span></p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Dönem tahsilat oranı — yarım daire (gauge) göstergesi.
function RateGauge({ rate }) {
  const value = Math.max(0, Math.min(100, rate));
  const R = 70;
  const cx = 90;
  const cy = 90;
  const circumference = Math.PI * R; // yarım daire
  const dash = (value / 100) * circumference;
  const tone = value >= 80 ? '#10b981' : value >= 50 ? '#f59e0b' : '#f43f5e';

  return (
    <div className="relative mx-auto h-[108px] w-[180px]">
      <svg viewBox="0 0 180 100" className="w-full">
        <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none" stroke="hsl(var(--foreground) / 0.1)" strokeWidth="14" strokeLinecap="round" />
        <path
          d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
          fill="none"
          stroke={tone}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-1 text-center">
        <div className="text-3xl font-black tabular-nums" style={{ color: tone }}>%{Math.round(value)}</div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tahsilat Oranı</div>
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

  const isPaid = (status) => {
    const st = normalizeStatus(status);
    return st.includes('öden') || st.includes('oden') || st.includes('paid') || st.includes('tahsil');
  };

  // İade belgeleri negatif tutarlıdır; tahsilat/gelir metriklerine karışırsa dönem
  // tahsilatı ve net akış eksiye düşer. Ayrı metrik olarak gösterilir.
  const isRefundEntry = (item) => item?.entryType === 'Refund' || parseMoney(item?.amount) < 0;

  // Seçili döneme göre tahsilat akış metrikleri + geciken taksitler.
  const periodStats = useMemo(() => {
    const allCollections = dashboard?.collections || [];
    const collections = allCollections.filter((c) => !isRefundEntry(c));
    const refunds = allCollections.filter(isRefundEntry);
    const installments = dashboard?.installments || [];
    const salaries = dashboard?.salaries || [];
    const invoices = dashboard?.invoices || [];

    const periodCollections = filterByPeriod(collections, (c) => c.time || c.date, period, anchor);
    const periodSalaries = filterByPeriod(salaries, (s) => s.payDate || s.date, period, anchor);
    const periodInvoices = filterByPeriod(invoices, (i) => i.subtitle || i.date, period, anchor);
    const periodInstallments = filterByPeriod(installments, (i) => i.due || i.dueDate, period, anchor);

    const sum = (list) => list.reduce((s, c) => s + parseMoney(c.amount), 0);
    const byMethod = (list, ...keys) => list.filter((c) => {
      const m = normalizeStatus(c.method || c.paymentMethod || c.type);
      return keys.some((k) => m.includes(k));
    });

    const now = Date.now();
    // Geciken kayıtlar da seçili döneme göre (vadesi bu döneme düşen + gecikmiş).
    const overdueEntries = periodInstallments.filter((item) => {
      const due = parseTrDate(item.due || item.dueDate);
      const st = normalizeStatus(item.status);
      return st.includes('gec') || st.includes('late') || (due && due.getTime() < now && !isPaid(item.status));
    });

    const periodRefunds = filterByPeriod(refunds, (c) => c.time || c.date, period, anchor);
    const refundTotal = periodRefunds.reduce((s, c) => s + Math.abs(parseMoney(c.amount)), 0);
    const grossCollected = sum(periodCollections);
    const collected = Math.max(0, grossCollected - refundTotal);
    const expense = sum(periodSalaries) + sum(periodInvoices.filter(isExpenseInvoice));
    const unpaidDue = sum(periodInstallments.filter((i) => !isPaid(i.status)));
    const target = collected + unpaidDue; // bu dönemde beklenen toplam
    const rate = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : (collected > 0 ? 100 : 0);

    return {
      collected,
      grossCollected,
      refundTotal,
      count: periodCollections.length,
      cash: sum(byMethod(periodCollections, 'nakit')),
      cardBank: sum(byMethod(periodCollections, 'kart', 'card', 'pos', 'havale', 'eft', 'bank', 'banka', 'transfer')),
      expense,
      net: collected - expense,
      dueTotal: sum(periodInstallments),
      unpaidDue,
      target,
      remaining: Math.max(0, target - collected),
      rate,
      paidInstallments: periodInstallments.filter((i) => isPaid(i.status)).length,
      totalInstallments: periodInstallments.length,
      recent: [...periodCollections].sort((a, b) => (parseTrDateTime(b.time) || 0) - (parseTrDateTime(a.time) || 0)),
      overdueEntries,
    };
  }, [dashboard, period, anchor]);

  // Önceki dönem tahsilatı (hedef kartındaki trend için).
  const prevCollected = useMemo(() => {
    const collections = dashboard?.collections || [];
    const prevAnchor = shiftAnchor(period, anchor, -1);
    return filterByPeriod(collections.filter((c) => !isRefundEntry(c)), (c) => c.time || c.date, period, prevAnchor)
      .reduce((s, c) => s + parseMoney(c.amount), 0);
  }, [dashboard, period, anchor]);

  const trendPct = prevCollected > 0
    ? Math.round(((periodStats.collected - prevCollected) / prevCollected) * 100)
    : null;

  // Gelir-Gider akışı: dönem kovaları (gelir=tahsilat, gider=maaş+fatura).
  const flowBuckets = useMemo(() => {
    const collections = dashboard?.collections || [];
    const salaries = dashboard?.salaries || [];
    const invoices = dashboard?.invoices || [];
    return createPeriodBuckets(period, anchor).map(({ start, end }) => {
      const inBucket = (d) => d && d >= start && d < end;
      let count = 0;
      // Gelir yalnız gerçek tahsilattır; iadeler grafikte negatif gelir üretmesin.
      const income = collections.reduce((s, c) => {
        if (isRefundEntry(c)) return s;
        if (inBucket(parseTrDateTime(c.time || c.date))) { count += 1; return s + parseMoney(c.amount); }
        return s;
      }, 0);
      const salaryExp = salaries.reduce((s, x) => (inBucket(parseTrDate(x.payDate || x.date)) ? s + parseMoney(x.amount) : s), 0);
      const invoiceExp = invoices.reduce((s, x) => ((inBucket(parseTrDate(x.subtitle || x.date)) && isExpenseInvoice(x)) ? s + parseMoney(x.amount) : s), 0);
      const expense = salaryExp + invoiceExp;
      return { label: bucketLabel(start, period), fullLabel: bucketFullLabel(start, period), income, expense, salaryExp, invoiceExp, count, net: income - expense };
    });
  }, [dashboard, period, anchor]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <p className="text-muted-foreground">Finans paneli yükleniyor...</p>
      </div>
    );
  }

  const periodText = buildPeriodLabel(period, anchor);

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

      {/* Dönem seçici — tüm sayfa (kartlar, grafik, oran, hedef, listeler) bu döneme göre */}
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
          <span className="min-w-[150px] text-center text-sm font-bold">{periodText}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAnchor((a) => shiftAnchor(period, a, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </motion.div>

      {/* Finansal özet kartları — tümü seçili döneme göre */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <motion.div variants={itemVariants}>
          <PremiumMetricCard
            title="Dönem Tahsilatı"
            value={formatTry(periodStats.collected)}
            caption={periodStats.refundTotal > 0
              ? `${periodStats.count} işlem · brüt ${formatTry(periodStats.grossCollected)} − iade ${formatTry(periodStats.refundTotal)}`
              : `${periodStats.count} işlem · ${periodText}`}
            icon={CreditCard} tone="emerald" chart="bars" chartValues={flowBuckets.map((b) => b.income)} />
        </motion.div>
        <motion.div variants={itemVariants}>
          <PremiumMetricCard title="Dönem Gideri" value={formatTry(periodStats.expense)} caption="Maaş + fatura gideri" icon={Landmark} tone="rose" chart="bars" chartValues={flowBuckets.map((b) => b.expense)} />
        </motion.div>
        <motion.div variants={itemVariants}>
          <PremiumMetricCard title="Net Akış" value={`${periodStats.net >= 0 ? '+' : ''}${formatTry(periodStats.net)}`} caption={periodStats.net >= 0 ? 'Dönem pozitif' : 'Dönem negatif'} icon={periodStats.net >= 0 ? TrendingUp : TrendingDown} tone={periodStats.net >= 0 ? 'blue' : 'amber'} chart="line" chartValues={flowBuckets.map((b) => b.net)} />
        </motion.div>
        <motion.div variants={itemVariants}>
          <PremiumMetricCard title="Geciken" value={formatTry(periodStats.overdueEntries.reduce((s, e) => s + parseMoney(e.amount), 0))} caption={`${periodStats.overdueEntries.length} kayıt takipte`} icon={AlertCircle} tone="amber" chart="line" chartValues={flowBuckets.map((b) => b.expense)} />
        </motion.div>
      </div>

      {/* Gelir-Gider grafiği (profesyonel) */}
      <motion.div variants={itemVariants}>
        <PremiumPanel title="Gelir - Gider Grafiği" description={`${periodText} · bir noktanın üstüne gelince ne geldi / ne gitti detayı açılır`}>
          <div className="rounded-3xl border border-foreground/10 bg-[hsl(var(--ci-surface-1)/0.5)] p-5 sm:p-6">
            <div className="mb-5 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                <p className="text-xs text-muted-foreground">Toplam Gelir</p>
                <p className="mt-1 text-lg font-black text-emerald-400 tabular-nums">{formatTry(periodStats.collected)}</p>
              </div>
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3">
                <p className="text-xs text-muted-foreground">Toplam Gider</p>
                <p className="mt-1 text-lg font-black text-rose-400 tabular-nums">{formatTry(periodStats.expense)}</p>
              </div>
              <div className={`rounded-2xl border p-3 ${periodStats.net >= 0 ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-rose-500/20 bg-rose-500/10'}`}>
                <p className="text-xs text-muted-foreground">Net</p>
                <p className={`mt-1 text-lg font-black tabular-nums ${periodStats.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{periodStats.net >= 0 ? '+' : ''}{formatTry(periodStats.net)}</p>
              </div>
            </div>
            <FlowChart buckets={flowBuckets} period={period} />
          </div>
        </PremiumPanel>
      </motion.div>

      {/* Tahsilat oranı + Tahsilat hedefi (dönem bazlı) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <PremiumPanel title="Tahsilat Oranı" description={`${periodText} · bu dönemde beklenenin tahsil edilen oranı`}>
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
              <RateGauge rate={periodStats.rate} />
              <div className="w-full flex-1 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-foreground/10 bg-emerald-500/10 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm"><Banknote className="h-4 w-4 text-emerald-400" /> Tahsil edilen</span>
                  <span className="font-bold tabular-nums text-emerald-400">{formatTry(periodStats.collected)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-foreground/10 bg-amber-500/10 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 text-amber-400" /> Bekleyen (vade)</span>
                  <span className="font-bold tabular-nums text-amber-400">{formatTry(periodStats.unpaidDue)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="rounded-xl border border-foreground/10 bg-foreground/[0.04] px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Nakit</p>
                    <p className="mt-0.5 font-bold tabular-nums">{formatTry(periodStats.cash)}</p>
                  </div>
                  <div className="rounded-xl border border-foreground/10 bg-foreground/[0.04] px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Kart / Havale</p>
                    <p className="mt-0.5 font-bold tabular-nums">{formatTry(periodStats.cardBank)}</p>
                  </div>
                </div>
              </div>
            </div>
          </PremiumPanel>
        </motion.div>

        <motion.div variants={itemVariants}>
          <PremiumPanel title="Tahsilat Hedefi" description={`${periodText} · bu dönem için beklenen tahsilat hedefi`}>
            <div className="space-y-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Tahsil Edilen</p>
                  <p className="mt-1 text-3xl font-black tabular-nums text-[hsl(var(--brand-accent))]">{formatTry(periodStats.collected)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Hedef: {formatTry(periodStats.target)}</p>
                </div>
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[hsl(var(--brand-accent)/0.14)] text-[hsl(var(--brand-accent))]">
                  <Target className="h-6 w-6" />
                </div>
              </div>

              <div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-foreground/[0.08]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--brand-accent))] to-amber-400 transition-all" style={{ width: `${periodStats.rate}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">%{periodStats.rate} tamamlandı</span>
                  <span className="text-muted-foreground">Kalan: {formatTry(periodStats.remaining)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-foreground/10 pt-4">
                <div className="rounded-xl border border-foreground/10 bg-foreground/[0.04] px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Önceki {PERIOD_NOUN[period]}</p>
                  <p className="mt-0.5 font-bold tabular-nums">{formatTry(prevCollected)}</p>
                </div>
                <div className="rounded-xl border border-foreground/10 bg-foreground/[0.04] px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Değişim</p>
                  <p className={`mt-0.5 flex items-center gap-1 font-bold tabular-nums ${trendPct == null ? 'text-muted-foreground' : trendPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {trendPct == null ? '—' : (
                      <>
                        {trendPct >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        %{Math.abs(trendPct)}
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </PremiumPanel>
        </motion.div>
      </div>

      {/* Tahsilatlar + Geciken ödemeler (dönem bazlı) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <PremiumPanel
            title="Tahsilatlar"
            description={`${periodText} · ${periodStats.count} tahsilat`}
            action={(
              <Button asChild variant="outline" size="sm">
                <Link to="/finance/collections">
                  Tümünü Gör
                  <ArrowUpRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
          >
            <div className="space-y-3">
              {periodStats.recent.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-foreground/10 p-6 text-center text-sm text-muted-foreground">Bu dönemde tahsilat yok.</p>
              ) : periodStats.recent.slice(0, 6).map((collection) => (
                <PremiumListRow key={collection.id} icon={CreditCard} title={collection.name} subtitle={`${collection.method} • ${collection.time || collection.note || 'Tahsilat'}`} meta={`+₺${parseMoney(collection.amount).toLocaleString('tr-TR')}`} accent onClick={() => setSelectedCollection(collection)} />
              ))}
            </div>
          </PremiumPanel>
        </motion.div>

        {finance?.pendingDownPaymentCount > 0 ? (
          <motion.div variants={itemVariants}>
            <Card className="border-amber-300 dark:border-amber-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    Peşinat Bekleyenler
                  </CardTitle>
                  <CardDescription>Kayıtta peşinatı tahsil edilmemiş sözleşmeler</CardDescription>
                </div>
                <Badge className="bg-amber-100 text-amber-700">{finance.pendingDownPaymentCount} Kayıt</Badge>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Beklenen toplam peşinat</p>
                <div className="text-right">
                  <p className="text-xl font-bold text-amber-600">₺{parseMoney(finance.pendingDownPaymentTotal).toLocaleString('tr-TR')}</p>
                  <Button asChild variant="outline" size="sm" className="mt-1 h-7 text-xs">
                    <Link to="/finance/student-accounts">Peşinatları Tahsil Et</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : null}

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

      <Dialog open={Boolean(selectedCollection)} onOpenChange={(open) => { if (!open) setSelectedCollection(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tahsilat Detayı</DialogTitle>
            <DialogDescription>Seçilen tahsilatın profesyonel özet görünümü</DialogDescription>
          </DialogHeader>
          {selectedCollection ? (
            <div className="space-y-6">
              <div className="rounded-3xl border border-emerald-200/60 p-6 text-white shadow-lg ci-hero">
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
