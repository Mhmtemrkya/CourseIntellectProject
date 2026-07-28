import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  CreditCard,
  Download,
  Receipt,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Progress } from '../../components/ui/progress';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import StudentFinanceAccountDialog from '../../components/finance/StudentFinanceAccountDialog';
import { backfillDownPaymentMethod, backfillFinanceInstallments, fetchAccountingDashboard, fetchFinanceDashboard, sendFinanceReminders } from '../../lib/api/modules';
import { normalizeFinanceText, parseFinanceMoney } from '../../lib/financeDocuments';

function tl(value) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('tr-TR', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })} TL`;
}

function parseMoney(value) {
  return parseFinanceMoney(value);
}

function money(value) {
  return tl(parseMoney(value));
}

function localDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function periodDateRange(period, customFrom, customTo) {
  const now = new Date();
  let from = startOfLocalDay(now);
  let to = new Date(from);

  if (period === 'day') {
    to.setDate(to.getDate() + 1);
  } else if (period === 'week') {
    const mondayOffset = (from.getDay() + 6) % 7;
    from.setDate(from.getDate() - mondayOffset);
    to = new Date(from);
    to.setDate(to.getDate() + 7);
  } else if (period === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else if (period === 'year') {
    from = new Date(now.getFullYear(), 0, 1);
    to = new Date(now.getFullYear() + 1, 0, 1);
  } else {
    const parsedFrom = customFrom ? new Date(`${customFrom}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
    const parsedTo = customTo ? new Date(`${customTo}T00:00:00`) : now;
    from = startOfLocalDay(Number.isNaN(parsedFrom.getTime()) ? new Date(now.getFullYear(), now.getMonth(), 1) : parsedFrom);
    to = startOfLocalDay(Number.isNaN(parsedTo.getTime()) ? now : parsedTo);
    if (to < from) to = new Date(from);
    to.setDate(to.getDate() + 1);
  }

  return {
    fromUtc: from.toISOString(),
    toUtc: to.toISOString(),
    label: `${from.toLocaleDateString('tr-TR')} – ${new Date(to.getTime() - 1).toLocaleDateString('tr-TR')}`,
  };
}

function normalizeStatus(value = '') {
  return normalizeFinanceText(value);
}

function isPaidStatus(value = '') {
  const status = normalizeStatus(value);
  return status.includes('odendi') || status.includes('paid') || status.includes('completed');
}

export default function AdminFinance() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dashboard, setDashboard] = useState(null);
  const [enrollmentFinance, setEnrollmentFinance] = useState(null);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [convertingDownPayments, setConvertingDownPayments] = useState(false);
  const [accountStudent, setAccountStudent] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState(() => localDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customTo, setCustomTo] = useState(() => localDateInput(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const selectedRange = useMemo(
    () => periodDateRange(period, customFrom, customTo),
    [period, customFrom, customTo],
  );

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [accounting, finance] = await Promise.all([
        fetchAccountingDashboard({ fromUtc: selectedRange.fromUtc, toUtc: selectedRange.toUtc }),
        fetchFinanceDashboard(null, { fromUtc: selectedRange.fromUtc, toUtc: selectedRange.toUtc }).catch(() => null),
      ]);
      setDashboard(accounting);
      setEnrollmentFinance(finance);
    } catch (err) {
      setError(err.message || 'Finans verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [selectedRange.fromUtc, selectedRange.toUtc]);

  const handleSendReminders = useCallback(async () => {
    try {
      setSendingReminders(true);
      const result = await sendFinanceReminders(7);
      toast({
        title: 'Hatırlatmalar gönderildi',
        description: `${result?.notified || 0} öğrenci/veli bilgilendirildi (${result?.overdueCount || 0} geciken, ${result?.upcomingCount || 0} yaklaşan taksit).`,
      });
    } catch (err) {
      toast({ title: 'Hatırlatma gönderilemedi', description: err.message, variant: 'destructive' });
    } finally {
      setSendingReminders(false);
    }
  }, [toast]);

  const handleBackfill = useCallback(async () => {
    try {
      setBackfilling(true);
      const result = await backfillFinanceInstallments();
      toast({
        title: 'Takibe alındı',
        description: `${result?.created || 0} eski/taksitsiz sözleşme vadeli takibe alındı.`,
      });
      await loadDashboard();
    } catch (err) {
      toast({ title: 'İşlem başarısız', description: err.message, variant: 'destructive' });
    } finally {
      setBackfilling(false);
    }
  }, [toast, loadDashboard]);

  const handleConvertDownPayments = useCallback(async () => {
    try {
      setConvertingDownPayments(true);
      const result = await backfillDownPaymentMethod();
      toast({
        title: 'Peşinatlar güncellendi',
        description: `${result?.updated || 0} geçmiş peşinat Nakit ödeme yöntemine çevrildi.`,
      });
      await loadDashboard();
    } catch (err) {
      toast({ title: 'İşlem başarısız', description: err.message, variant: 'destructive' });
    } finally {
      setConvertingDownPayments(false);
    }
  }, [toast, loadDashboard]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const invoices = dashboard?.invoices || [];
    const installments = dashboard?.installments || [];
    const collections = dashboard?.collections || [];
    const approvals = dashboard?.approvals || [];
    // Geciken taksit listesi (isim/tutar gösterimi için accounting kaynaklı).
    const overdue = installments.filter((item) => {
      const status = normalizeStatus(item.status);
      return status.includes('gec') || status.includes('late');
    });

    // Üst kart toplamları otoriter sözleşme bazlı kaynaktan (fetchFinanceDashboard)
    // gelir; böylece kayıt ücreti taksitsiz de olsa "Toplam Alacak"a yansır.
    // enrollmentFinance yoksa accounting verisinden hesaplanır (geriye dönük).
    const hasFinance = enrollmentFinance != null;
    const totalReceivable = hasFinance
      ? Number(enrollmentFinance.netTotal) || 0
      : invoices.reduce((sum, item) => sum + parseMoney(item.amount), 0);
    // Geriye dönük yolda da iadeler tahsilatı eksiye düşürmesin: brüt tahsilattan
    // en fazla brüt kadar iade mahsup edilir.
    const collectedFallback = (() => {
      const amounts = collections.map((item) => parseMoney(item.amount));
      const gross = amounts.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
      const refunded = amounts.filter((value) => value < 0).reduce((sum, value) => sum - value, 0);
      return gross - Math.min(gross, refunded);
    })();
    const totalCollected = hasFinance
      ? Number(enrollmentFinance.collectedTotal) || 0
      : collectedFallback;
    const pending = hasFinance
      ? Number(enrollmentFinance.outstandingTotal) || 0
      : installments.filter((item) => !isPaidStatus(item.status)).reduce((sum, item) => sum + parseMoney(item.amount), 0);
    const overdueTotal = hasFinance
      ? Number(enrollmentFinance.overdueTotal) || 0
      : overdue.reduce((sum, item) => sum + parseMoney(item.amount), 0);
    const rate = hasFinance
      ? Number(enrollmentFinance.collectionRatePercent) || 0
      : (totalReceivable > 0 ? Math.min(100, Math.round((totalCollected / totalReceivable) * 100)) : 0);

    return {
      totalReceivable,
      totalCollected,
      pending,
      overdue,
      overdueTotal,
      approvals,
      collections: collections.slice(0, 5),
      rate,
    };
  }, [dashboard, enrollmentFinance]);

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-finance-page">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Badge variant="outline">Finans kontrolü</Badge>
            <h1 className="mt-3 text-3xl font-bold font-heading">Finans Kontrolü</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Kurum yöneticisi için tahsilat, geciken ödeme ve onay akışlarını tek ekranda izle.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleBackfill} disabled={backfilling}>
              {backfilling ? 'İşleniyor...' : 'Eski Kayıtları Takibe Al'}
            </Button>
            <Button variant="outline" onClick={handleConvertDownPayments} disabled={convertingDownPayments}>
              {convertingDownPayments ? 'İşleniyor...' : 'Peşinatları Nakit\'e Çevir'}
            </Button>
            <Button onClick={() => navigate('/finance/dashboard')}>
              Muhasebe Modülüne Geç
            </Button>
          </div>
        </div>
      </section>

      {error ? <ErrorBanner title="Finans verisi yüklenemedi" message={error} onRetry={loadDashboard} /> : null}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="flex items-center gap-2 font-bold">
                <Calendar className="h-4 w-4 text-brand-primary" /> Raporlama Dönemi
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{selectedRange.label}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ['day', 'Günlük'],
                ['week', 'Haftalık'],
                ['month', 'Aylık'],
                ['year', 'Yıllık'],
                ['custom', 'Özel'],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={period === value ? 'default' : 'outline'}
                  onClick={() => setPeriod(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {period === 'custom' && (
            <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Başlangıç tarihi
                <Input
                  className="mt-1"
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(event) => setCustomFrom(event.target.value)}
                />
              </label>
              <label className="text-sm font-semibold">
                Bitiş tarihi
                <Input
                  className="mt-1"
                  type="date"
                  value={customTo}
                  min={customFrom}
                  onChange={(event) => setCustomTo(event.target.value)}
                />
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Toplam Alacak', money(stats.totalReceivable), Wallet, 'text-blue-600'],
          ['Tahsil Edilen', money(stats.totalCollected), CreditCard, 'text-emerald-600'],
          ['Bekleyen', money(stats.pending), Calendar, 'text-amber-600'],
          ['Geciken', money(stats.overdueTotal), AlertCircle, 'text-red-600'],
        ].map(([label, value, Icon, color]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-2 text-2xl font-bold">{value}</p>
                </div>
                <Icon className={`h-6 w-6 ${color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tahsilat Doluluk Oranı</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex justify-between text-sm">
            <span>Tahsil edilen</span>
            <span>%{stats.rate}</span>
          </div>
          <Progress value={stats.rate} />
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
          <CardTitle>Hızlı Aksiyonlar</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[
              ['Tahsilatlar', '/finance/collections', CreditCard],
              ['Onaylar', '/admin/finance-approvals', Receipt],
              ['Gecikenler', '/finance/late-payments', AlertCircle],
              ['Dışa Aktar', '/finance/export', Download],
            ].map(([label, path, Icon]) => (
              <Button key={label} variant="outline" className="justify-start" onClick={() => navigate(path)}>
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bekleyen Onaylar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.approvals.slice(0, 5).map((item) => (
              <div key={item.id || item.referenceNumber} className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.referenceNumber || item.type || 'Finans onayı'}</p>
                    <p className="text-sm text-muted-foreground">{item.type || 'İşlem'} - {money(item.amount)}</p>
                  </div>
                  <Badge variant="outline">{item.status || 'Bekliyor'}</Badge>
                </div>
              </div>
            ))}
            {stats.approvals.length === 0 ? <p className="text-sm text-muted-foreground">Bekleyen finans onayı yok.</p> : null}
          </CardContent>
        </Card>
      </div>

      {enrollmentFinance ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Kayıt Finansmanı (Öğrenci Cari)</CardTitle>
              <Button variant="outline" onClick={handleSendReminders} disabled={sendingReminders}>
                <AlertCircle className="mr-2 h-4 w-4" />
                {sendingReminders ? 'Gönderiliyor...' : 'Ödeme Hatırlatması Gönder'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Sözleşme Net', tl(enrollmentFinance.netTotal)],
                ['Tahsil Edilen', tl(enrollmentFinance.collectedTotal)],
                ['Kalan Alacak', tl(enrollmentFinance.outstandingTotal)],
                ['Geciken', `${tl(enrollmentFinance.overdueTotal)} (${enrollmentFinance.overdueStudentCount} öğr.)`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border bg-muted/20 p-4">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-1 text-xl font-bold">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <p className="text-sm text-muted-foreground">Tahsilat Oranı</p>
                <p className="text-2xl font-bold">%{enrollmentFinance.collectionRatePercent}</p>
                <Progress value={enrollmentFinance.collectionRatePercent} className="mt-2" />
                <p className="mt-2 text-xs text-muted-foreground">Ortalama tahsil süresi: {enrollmentFinance.averageCollectionDays} gün</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="mb-2 text-sm text-muted-foreground">Yaşlandırma (Aging)</p>
                <div className="space-y-1">
                  {(enrollmentFinance.aging || []).map((bucket) => (
                    <div key={bucket.label} className="flex items-center justify-between text-sm">
                      <span>{bucket.label} <span className="text-muted-foreground">({bucket.count})</span></span>
                      <span className="font-semibold">{tl(bucket.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {(enrollmentFinance.topDebtors || []).length > 0 ? (
              <div className="rounded-xl border p-4">
                <p className="mb-2 text-sm text-muted-foreground">En Yüksek Borçlular</p>
                <div className="space-y-2">
                  {enrollmentFinance.topDebtors.slice(0, 5).map((debtor) => (
                    <button
                      type="button"
                      key={debtor.studentName}
                      onClick={() => setAccountStudent(debtor.studentName)}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-sm transition hover:bg-brand-primary/10"
                    >
                      <span>{debtor.studentName} <span className="text-muted-foreground">{debtor.className}</span></span>
                      <span className="font-semibold text-red-600">{tl(debtor.balance)}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2 border-t pt-3">
                  <Input
                    placeholder="Öğrenci adıyla cari aç..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && studentSearch.trim()) setAccountStudent(studentSearch.trim()); }}
                  />
                  <Button variant="outline" onClick={() => studentSearch.trim() && setAccountStudent(studentSearch.trim())}>Aç</Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Son Tahsilatlar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.collections.map((item) => (
            <div key={item.id || `${item.name}-${item.amount}`} className="flex items-center justify-between rounded-xl border bg-muted/20 p-4">
              <div>
                <p className="font-semibold">{item.name || item.student || 'Tahsilat'}</p>
                <p className="text-sm text-muted-foreground">{item.method || 'Yöntem yok'} - {item.note || 'Açıklama yok'}</p>
              </div>
              <p className="font-bold text-emerald-600">{money(item.amount)}</p>
            </div>
          ))}
          {stats.collections.length === 0 ? <p className="text-sm text-muted-foreground">Tahsilat kaydı bulunamadı.</p> : null}
        </CardContent>
      </Card>

      {accountStudent ? (
        <StudentFinanceAccountDialog studentName={accountStudent} onClose={() => { setAccountStudent(null); loadDashboard(); }} />
      ) : null}
    </motion.div>
  );
}
