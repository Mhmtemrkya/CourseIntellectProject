import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CircleDollarSign, FileBadge2, ReceiptText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAccountingDashboard } from '../../lib/api/modules';

export default function FinanceDetailHub() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setDashboard(await fetchAccountingDashboard());
    } catch (err) {
      setError(err.message || 'Finans detay merkezi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDetails(); }, [loadDetails]);

  const sections = useMemo(() => ([
    { title: 'Fatura Detayları', icon: FileBadge2, route: '/finance/invoices-receipts', items: (dashboard?.invoices || []).slice(0, 4).map((item) => ({ id: item.id, name: item.studentName || item.title, value: item.amount, status: item.status })) },
    { title: 'Taksit Detayları', icon: ReceiptText, route: '/finance/installments', items: (dashboard?.installments || []).slice(0, 4).map((item) => ({ id: item.id, name: item.student || item.name, value: item.amount, status: item.status })) },
    { title: 'Tahsilat Detayları', icon: CircleDollarSign, route: '/finance/collections', items: (dashboard?.collections || []).slice(0, 4).map((item) => ({ id: item.id, name: item.name, value: item.amount, status: item.note || 'İşlendi' })) },
  ]), [dashboard]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="finance-detail-hub-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Finans Detay Merkezi</h1>
        <p className="text-muted-foreground mt-1">Detay ekranlarının birleşik masaüstü görünümü</p>
      </div>
      {error ? <ErrorBanner title="Finans detay merkezi alınamadı" message={error} onRetry={loadDetails} /> : null}
      <div className="grid gap-6">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><section.icon className="h-5 w-5 text-brand-primary" />{section.title}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate(section.route)}>Tümünü Aç</Button>
            </CardHeader>
            <CardContent className="grid gap-3">
              {section.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => navigate(section.route)}
                  className="w-full rounded-xl border p-4 flex items-center justify-between gap-4 text-left hover:bg-muted/40 transition-colors"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.status}</p>
                  </div>
                  <Badge variant="outline">₺{Number(item.value || 0).toLocaleString('tr-TR')}</Badge>
                </button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
