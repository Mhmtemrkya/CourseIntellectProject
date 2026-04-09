import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { History, Receipt, ShieldCheck, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAccountingDashboard } from '../../lib/api/modules';
import { formatCurrency, parseFinanceMoney } from '../../lib/financeDocuments';

export default function AuditLog() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setDashboard(await fetchAccountingDashboard());
    } catch (err) {
      setError(err.message || 'Audit log alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const logs = useMemo(() => ([
    ...(dashboard?.collections || []).slice(0, 5).map((item) => ({
      id: `collection-${item.id}`,
      title: 'Tahsilat işlendi',
      detail: `${item.name} için ${formatCurrency(item.amount)} tutarlı kayıt işlendi`,
      type: 'Tahsilat',
      icon: Wallet,
      tone: 'emerald',
      time: item.time || 'Zaman yok',
    })),
    ...(dashboard?.invoices || []).slice(0, 5).map((item) => ({
      id: `invoice-${item.id}`,
      title: 'Fatura üretildi',
      detail: `${item.title} belgesi ${formatCurrency(item.amount)} tutarla kaydedildi`,
      type: 'Fatura',
      icon: Receipt,
      tone: 'sky',
      time: item.date || item.subtitle || 'Zaman yok',
    })),
    ...(dashboard?.approvals || []).slice(0, 5).map((item) => ({
      id: `approval-${item.id}`,
      title: 'Onay kaydı güncellendi',
      detail: `${item.referenceNumber || item.id} numaralı kayıt ${item.status || 'bekliyor'} durumuna geçti`,
      type: 'Onay',
      icon: ShieldCheck,
      tone: 'amber',
      time: item.updatedAtUtc || item.createdAtUtc || 'Zaman yok',
    })),
  ].sort((a, b) => String(b.time).localeCompare(String(a.time)))), [dashboard]);

  const summary = useMemo(() => ({
    count: logs.length,
    collections: logs.filter((item) => item.type === 'Tahsilat').length,
    invoices: logs.filter((item) => item.type === 'Fatura').length,
  }), [logs]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="finance-audit-log-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Audit Log</h1>
        <p className="text-muted-foreground mt-1">Finans operasyonlarının zaman sıralı kayıt görünümü</p>
      </div>
      {error ? <ErrorBanner title="Audit log alınamadı" message={error} onRetry={loadLogs} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['Toplam Log', summary.count],
          ['Tahsilat Olayı', summary.collections],
          ['Fatura Olayı', summary.invoices],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-brand-primary" />İşlem Zaman Çizgisi</CardTitle>
          <CardDescription>Gerçek finans hareketlerinden türetilen audit listesi</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {logs.map((item) => {
            const Icon = item.icon;
            const toneClasses = item.tone === 'emerald'
              ? 'bg-emerald-50 text-emerald-700'
              : item.tone === 'sky'
                ? 'bg-sky-50 text-sky-700'
                : 'bg-amber-50 text-amber-700';
            return (
              <div key={item.id} className="flex flex-col gap-4 rounded-2xl border p-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-4">
                  <div className={`rounded-2xl p-3 ${toneClasses}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{item.type}</Badge>
                  <span className="text-xs text-muted-foreground">{item.time}</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </motion.div>
  );
}
