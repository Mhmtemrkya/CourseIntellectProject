import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Activity, Bell, MessageSquare, Receipt, ExternalLink, ShieldCheck, Megaphone, CalendarDays,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAdminDashboardData } from '../../lib/api/dashboardData';
import { fetchAccountingDashboard } from '../../lib/api/modules';

export default function AdminOperations() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [finance, setFinance] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOperations = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [dashboardData, financeData] = await Promise.all([
        fetchAdminDashboardData(),
        fetchAccountingDashboard().catch(() => null),
      ]);
      setDashboard(dashboardData);
      setFinance(financeData);
    } catch (err) {
      setError(err.message || 'Operasyon görünümü alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOperations();
  }, [loadOperations]);

  const items = [
    { title: 'Bekleyen etkileşimler', count: dashboard?.pendingItems?.length || 0, icon: MessageSquare, detail: 'Öğrenci ve veli geri dönüşleri', onClick: () => navigate('/chat') },
    { title: 'Duyuru merkezi', count: dashboard?.activities?.length || 0, icon: Megaphone, detail: 'Kurum genelindeki tüm duyurular', onClick: () => navigate('/admin/announcements') },
    { title: 'Açık finans hareketi', count: finance?.approvals?.length || 0, icon: Receipt, detail: 'Onay ve işlem bekleyen kayıtlar', onClick: () => navigate('/admin/finance-approvals') },
    { title: 'Görüşme akışı', count: dashboard?.activities?.length || 0, icon: CalendarDays, detail: 'Veli talepleri ve öğretmen onayları', onClick: () => navigate('/admin/meetings') },
  ];

  const operationalFeed = useMemo(() => (
    [
      ...(dashboard?.pendingItems || []).map((item) => ({
        id: `pending-${item.id}`,
        title: item.studentName,
        detail: item.question,
        subject: item.subject,
        route: '/admin/task-center',
      })),
      ...((finance?.approvals || []).slice(0, 4).map((item) => ({
        id: `finance-${item.id}`,
        title: item.referenceNumber || 'Finans onayı',
        detail: `${item.status || 'Bekliyor'} • ${item.type || 'Islem'}`,
        subject: 'Finans',
        route: '/admin/finance-approvals',
      }))),
    ].slice(0, 8)
  ), [dashboard, finance]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-operations-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Operasyon Merkezi</h1>
        <p className="text-muted-foreground mt-1">Yönetici için birleşik operasyon görünümü</p>
      </div>
      {error ? <ErrorBanner title="Operasyon verisi alınamadı" message={error} onRetry={loadOperations} /> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          [items[0].count, 'Etkileşim'],
          [items[1].count, 'Duyuru'],
          [items[2].count, 'Finans'],
          [operationalFeed.length, 'Canlı Akış'],
        ].map(([value, label]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <Card key={item.title} className="cursor-pointer transition-colors hover:bg-muted/30" onClick={item.onClick}>
            <CardContent className="p-5 flex items-center gap-4">
              <item.icon className="h-8 w-8 text-brand-primary" />
              <div>
                <p className="text-2xl font-bold">{item.count}</p>
                <p className="text-sm">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-green-600" />Canlı görev akışı</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {operationalFeed.map((item) => (
            <div key={item.id} className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{item.subject}</Badge>
                  <Button variant="outline" size="sm" onClick={() => setSelectedItem(item)}>Detay</Button>
                  <Button variant="outline" size="sm" onClick={() => navigate(item.route)}>Aç</Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedItem?.title || 'Operasyon detayı'}</DialogTitle>
            <DialogDescription>Operasyon akışındaki seçili kaydın ayrıntısı.</DialogDescription>
          </DialogHeader>
          {selectedItem ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedItem.subject}</Badge>
                <ShieldCheck className="h-4 w-4 text-brand-primary" />
              </div>
              <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                {selectedItem.detail}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>Kapat</Button>
            {selectedItem ? (
              <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => navigate(selectedItem.route)}>
                <ExternalLink className="mr-2 h-4 w-4" />
                İlgili Akışı Aç
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
