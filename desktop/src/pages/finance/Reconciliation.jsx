import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowRightLeft, CircleDollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { Badge } from '../../components/ui/badge';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAccountingDashboard } from '../../lib/api/modules';
import { formatCurrency, parseFinanceMoney } from '../../lib/financeDocuments';

export default function Reconciliation() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setDashboard(await fetchAccountingDashboard());
    } catch (err) {
      setError(err.message || 'Mutabakat verisi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = useMemo(() => {
    const invoiceTotal = (dashboard?.invoices || []).reduce((sum, item) => sum + parseFinanceMoney(item.amount), 0);
    const collectionTotal = (dashboard?.collections || []).reduce((sum, item) => sum + parseFinanceMoney(item.amount), 0);
    const pendingTotal = Math.max(0, invoiceTotal - collectionTotal);
    const ratio = invoiceTotal > 0 ? Math.min(100, Math.round((collectionTotal / invoiceTotal) * 100)) : 0;
    const items = (dashboard?.invoices || []).slice(0, 8).map((invoice) => {
      const candidate = (dashboard?.collections || []).find((collection) => String(collection.name || '').toLowerCase().includes(String(invoice.title || '').split('-')[0].trim().toLowerCase()));
      return {
        id: invoice.id,
        title: invoice.title,
        invoiceAmount: parseFinanceMoney(invoice.amount),
        collectionAmount: candidate ? parseFinanceMoney(candidate.amount) : 0,
        status: candidate ? 'matched' : 'pending',
      };
    });
    return { invoiceTotal, collectionTotal, pendingTotal, ratio, items };
  }, [dashboard]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="finance-reconciliation-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Mutabakat Merkezi</h1>
        <p className="text-muted-foreground mt-1">Fatura ve tahsilat eşleşmelerini profesyonel görünümle takip edin</p>
      </div>
      {error ? <ErrorBanner title="Mutabakat verisi alınamadı" message={error} onRetry={loadData} /> : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-900 via-sky-900 to-cyan-900 text-white">
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Mutabakat Oranı</CardTitle>
            <CardDescription className="text-white/75">Tahsilatların faturaları karşılama oranı</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ['Fatura Toplamı', formatCurrency(summary.invoiceTotal), CircleDollarSign],
                ['Tahsilat Toplamı', formatCurrency(summary.collectionTotal), ShieldCheck],
                ['Açık Fark', formatCurrency(summary.pendingTotal), ArrowRightLeft],
              ].map(([label, value, Icon]) => (
                <div key={label} className="rounded-2xl border bg-muted/20 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-muted p-2"><Icon className="h-4 w-4 text-brand-primary" /></div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                      <p className="mt-1 text-xl font-semibold">{value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Tamamlanma</span>
                <span className="font-semibold">%{summary.ratio}</span>
              </div>
              <Progress value={summary.ratio} className="h-3" />
              <p className="text-sm text-muted-foreground">Bu oran, mevcut tahsilat kayıtlarının toplam fatura tutarını karşılama seviyesini gösterir.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Durum Özeti</CardTitle>
            <CardDescription>Mutabakat takibi için hızlı kontrol paneli</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-700">
              <p className="text-xs uppercase tracking-wide">Eşleşen Kayıtlar</p>
              <p className="mt-1 text-2xl font-semibold">{summary.items.filter((item) => item.status === 'matched').length}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-4 text-amber-700">
              <p className="text-xs uppercase tracking-wide">Bekleyen Kayıtlar</p>
              <p className="mt-1 text-2xl font-semibold">{summary.items.filter((item) => item.status === 'pending').length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eşleşme Listesi</CardTitle>
          <CardDescription>Fatura ve tahsilat arasındaki ilişki özeti</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {summary.items.map((item) => (
            <div key={item.id} className="flex flex-col gap-4 rounded-2xl border p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-muted-foreground">Belge No: {item.id}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">Fatura: {formatCurrency(item.invoiceAmount)}</div>
                <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">Tahsilat: {formatCurrency(item.collectionAmount)}</div>
                <Badge className={item.status === 'matched' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                  {item.status === 'matched' ? 'Eşleşti' : 'Bekliyor'}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
