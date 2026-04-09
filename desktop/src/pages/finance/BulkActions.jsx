import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BellRing, Layers3, Send, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useToast } from '../../hooks/use-toast';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAccountingDashboard, sendBulkAccountingReminders } from '../../lib/api/modules';
import { formatCurrency, parseFinanceMoney } from '../../lib/financeDocuments';

export default function BulkActions() {
  const { toast } = useToast();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const loadBulk = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setDashboard(await fetchAccountingDashboard());
    } catch (err) {
      setError(err.message || 'Toplu işlem verisi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBulk();
  }, [loadBulk]);

  const overdue = useMemo(() => (dashboard?.installments || []).filter((item) => {
    const normalized = String(item.status || '').toLowerCase();
    return normalized.includes('gec') || normalized.includes('overdue') || normalized.includes('late');
  }), [dashboard]);

  const summary = useMemo(() => ({
    totalAmount: overdue.reduce((sum, item) => sum + parseFinanceMoney(item.amount), 0),
    students: new Set(overdue.map((item) => item.student || item.name)).size,
  }), [overdue]);

  const handleNotify = async () => {
    try {
      setSending(true);
      const result = await sendBulkAccountingReminders();
      await loadBulk();
      toast({
        title: 'Canlı hatırlatma gönderildi',
        description: result?.message || 'Geciken kayıtlar için veli duyuruları yayınlandı.',
      });
    } catch (err) {
      toast({
        title: 'Toplu bildirim gönderilemedi',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="finance-bulk-actions-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Toplu İşlemler</h1>
        <p className="text-muted-foreground mt-1">Finans ekibinin tek seferde başlatabileceği operasyonlar</p>
      </div>
      {error ? <ErrorBanner title="Toplu işlem verisi alınamadı" message={error} onRetry={loadBulk} /> : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Layers3 className="h-5 w-5 text-brand-primary" />Geciken Kayıt Havuzu</CardTitle>
            <CardDescription>Toplu hatırlatma, liste tarama ve öncelik takibi</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {overdue.slice(0, 10).map((item) => (
              <div key={item.id} className="flex flex-col gap-4 rounded-2xl border p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold">{item.student || item.name || 'Kayıt'}</p>
                  <p className="text-sm text-muted-foreground">{item.dueDate || item.due || 'Vade yok'} • {item.note || 'Standart taksit kaydı'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">{formatCurrency(item.amount)}</div>
                  <div className="rounded-xl bg-muted px-3 py-2 text-sm">{item.status || 'Bekliyor'}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-amber-600" />Operasyon Özeti</CardTitle>
            <CardDescription>Toplu aksiyon öncesi hızlı görünüm</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-amber-50 p-4 text-amber-700">
              <p className="text-xs uppercase tracking-wide">Etkilenen Öğrenci</p>
              <p className="mt-1 text-2xl font-semibold">{summary.students}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-slate-700">
              <p className="text-xs uppercase tracking-wide">Toplam Risk Tutarı</p>
              <p className="mt-1 text-2xl font-semibold">{formatCurrency(summary.totalAmount)}</p>
            </div>
            <Button onClick={handleNotify} disabled={sending} className="w-full bg-brand-primary hover:bg-brand-primary/90">
              {sending ? <Send className="h-4 w-4 mr-2 animate-pulse" /> : <BellRing className="h-4 w-4 mr-2" />}
              {sending ? 'Gönderiliyor...' : 'Toplu Hatırlatma Gönder'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
