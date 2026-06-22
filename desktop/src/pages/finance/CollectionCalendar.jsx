import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CalendarDays, CalendarRange, ChevronRight, ChevronLeft, Landmark, Wallet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAccountingDashboard } from '../../lib/api/modules';
import { formatCurrency, normalizeFinanceText, parseFinanceMoney } from '../../lib/financeDocuments';
import { filterByPeriod, periodLabel, shiftAnchor } from '../../lib/financePeriod';

function normalizeDate(value) {
  if (!value) return null;
  const trMatch = String(value).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (trMatch) {
    const [, day, month, year, hour = '0', minute = '0'] = trMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getPeriodKey(date, view) {
  if (!date) return 'Belirsiz';
  if (view === 'day') return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  if (view === 'week') {
    const start = new Date(date);
    start.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })} - ${end.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}`;
  }
  return date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

export default function CollectionCalendar() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('month');
  const [anchor, setAnchor] = useState(() => new Date());

  const loadCalendar = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setDashboard(await fetchAccountingDashboard());
    } catch (err) {
      setError(err.message || 'Tahsilat takvimi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const calendarEntries = useMemo(() => {
    const collectionItems = (dashboard?.collections || []).map((item) => {
      const date = normalizeDate(String(item.time || '').replace(' • ', ' '));
      return {
        ...item,
        label: item.name || 'Tahsilat',
        detail: `${item.className || 'Sınıf yok'} • ${item.method || 'Ödeme'}`,
        amountValue: parseFinanceMoney(item.amount),
        entryDate: date,
        status: 'İşlendi',
      };
    });
    const installmentItems = (dashboard?.installments || []).map((item) => {
      const date = normalizeDate(item.dueDate || item.due);
      return {
        ...item,
        label: item.student || item.name || 'Öğrenci',
        detail: item.note || 'Planlı tahsilat',
        amountValue: parseFinanceMoney(item.amount),
        entryDate: date,
        status: item.status || 'Beklemede',
      };
    });
    return [...collectionItems, ...installmentItems].sort((a, b) => (a.entryDate?.getTime() || 0) - (b.entryDate?.getTime() || 0));
  }, [dashboard]);

  // Seçili döneme (view + anchor) göre süz: takvim ve özet aynı dönemi gösterir.
  const periodEntries = useMemo(
    () => filterByPeriod(calendarEntries, (item) => item.entryDate, view, anchor),
    [calendarEntries, view, anchor],
  );

  const grouped = useMemo(() => periodEntries.reduce((acc, item) => {
    const key = getPeriodKey(item.entryDate, view);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {}), [periodEntries, view]);

  const summary = useMemo(() => ({
    total: periodEntries.reduce((sum, item) => sum + item.amountValue, 0),
    count: periodEntries.length,
    overdue: periodEntries.filter((item) => normalizeFinanceText(item.status).includes('gec')).length,
  }), [periodEntries]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="finance-collection-calendar-page">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading">Tahsilat Takvimi</h1>
          <p className="text-muted-foreground mt-1">Gün, hafta ve ay görünümünde planlanan tahsilatlar</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
          {[
            ['Toplam Plan', formatCurrency(summary.total), Wallet],
            ['Kayıt', String(summary.count), CalendarRange],
            ['Geciken', String(summary.overdue), Landmark],
          ].map(([label, value, Icon]) => (
            <Card key={label} className="min-w-[170px]">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-xl bg-muted p-2"><Icon className="h-4 w-4 text-brand-primary" /></div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-semibold">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {error ? <ErrorBanner title="Tahsilat takvimi alınamadı" message={error} onRetry={loadCalendar} /> : null}

      <Tabs value={view} onValueChange={(v) => { setView(v); setAnchor(new Date()); }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="day">Günlük</TabsTrigger>
            <TabsTrigger value="week">Haftalık</TabsTrigger>
            <TabsTrigger value="month">Aylık</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1 rounded-lg border border-foreground/10 bg-foreground/[0.04] px-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAnchor((a) => shiftAnchor(view, a, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-[140px] text-center text-sm font-semibold">{periodLabel(view, anchor)}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAnchor((a) => shiftAnchor(view, a, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        {['day', 'week', 'month'].map((mode) => (
          <TabsContent key={mode} value={mode} className="mt-6 space-y-4">
            {Object.entries(grouped).map(([period, items]) => (
              <Card key={`${mode}-${period}`} className="overflow-hidden">
                <CardHeader className="border-b bg-muted/20">
                  <CardTitle className="flex items-center justify-between gap-3">
                    <span>{period}</span>
                    <Badge variant="outline">{items.length} kayıt</Badge>
                  </CardTitle>
                  <CardDescription>{formatCurrency(items.reduce((sum, item) => sum + item.amountValue, 0))} planlı tahsilat</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {items.map((item) => (
                      <div key={item.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold">{item.label}</p>
                          <p className="text-sm text-muted-foreground">{item.detail} • {item.time || item.dueDate || item.due || 'Tarih yok'}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge variant="outline">{item.status || 'Beklemede'}</Badge>
                          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{formatCurrency(item.amountValue)}</div>
                          <Button asChild variant="ghost" size="sm" className="gap-2">
                            <Link to="/finance/collections">
                            Detaya Git
                            <ChevronRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </motion.div>
  );
}
