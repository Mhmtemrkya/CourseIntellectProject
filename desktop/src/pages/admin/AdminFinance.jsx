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
import { Progress } from '../../components/ui/progress';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAccountingDashboard } from '../../lib/api/modules';

function parseMoney(value) {
  const normalized = String(value ?? '0').replace(/[^\d,.-]/g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function money(value) {
  return `TL ${parseMoney(value).toLocaleString('tr-TR')}`;
}

function normalizeStatus(value = '') {
  return String(value).toLowerCase();
}

export default function AdminFinance() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setDashboard(await fetchAccountingDashboard());
    } catch (err) {
      setError(err.message || 'Finans verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const invoices = dashboard?.invoices || [];
    const installments = dashboard?.installments || [];
    const collections = dashboard?.collections || [];
    const approvals = dashboard?.approvals || [];
    const totalReceivable = invoices.reduce((sum, item) => sum + parseMoney(item.amount), 0);
    const totalCollected = collections.reduce((sum, item) => sum + parseMoney(item.amount), 0);
    const pending = installments
      .filter((item) => !normalizeStatus(item.status).includes('odendi'))
      .reduce((sum, item) => sum + parseMoney(item.amount), 0);
    const overdue = installments.filter((item) => {
      const status = normalizeStatus(item.status);
      return status.includes('gec') || status.includes('late');
    });
    const overdueTotal = overdue.reduce((sum, item) => sum + parseMoney(item.amount), 0);
    const rate = totalReceivable > 0 ? Math.min(100, Math.round((totalCollected / totalReceivable) * 100)) : 0;

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
  }, [dashboard]);

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
          <Button onClick={() => navigate('/finance/dashboard')}>
            Muhasebe Modülüne Geç
          </Button>
        </div>
      </section>

      {error ? <ErrorBanner title="Finans verisi yüklenemedi" message={error} onRetry={loadDashboard} /> : null}

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
    </motion.div>
  );
}
