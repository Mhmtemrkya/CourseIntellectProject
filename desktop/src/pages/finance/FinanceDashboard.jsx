import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Wallet, TrendingUp, TrendingDown, CreditCard,
  AlertCircle, Calendar, Users, ArrowUpRight, Receipt, Landmark,
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
import { fetchAccountingDashboard } from '../../lib/api/modules';
import {
  MiniBarChart,
  MiniDonut,
  MiniLineChart,
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

function parseMoney(value) {
  const normalized = String(value ?? '0').replace(/[^\d,.-]/g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function normalizeStatus(value = '') {
  return String(value).toLowerCase();
}

export default function FinanceDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCollection, setSelectedCollection] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const payload = await fetchAccountingDashboard();
      setDashboard(payload);
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

    const totalReceivable = invoices.reduce((sum, item) => sum + parseMoney(item.amount), 0);
    const totalCollected = collections.reduce((sum, item) => sum + parseMoney(item.amount), 0);
    const pendingPayments = installments
      .filter((item) => !normalizeStatus(item.status).includes('odendi'))
      .reduce((sum, item) => sum + parseMoney(item.amount), 0);
    const overdueEntries = installments.filter((item) => {
      const status = normalizeStatus(item.status);
      return status.includes('gec') || status.includes('late');
    });
    const overduePayments = overdueEntries.reduce((sum, item) => sum + parseMoney(item.amount), 0);
    const collectionRate = totalReceivable > 0 ? Math.min(100, Math.round((totalCollected / totalReceivable) * 100)) : 0;

    return {
      totalReceivable,
      totalCollected,
      pendingPayments,
      overduePayments,
      collectionRate,
      overdueEntries,
      recentCollections: [...collections].slice(0, 5),
    };
  }, [dashboard]);

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
        <p className="text-muted-foreground mt-1">Gerçek backend verileriyle finansal genel bakış</p>
      </div>

      {error ? <ErrorBanner title="Finans verileri alınamadı" message={error} onRetry={loadDashboard} /> : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <motion.div variants={itemVariants}>
          <PremiumMetricCard title="Toplam Alacak" value={`₺${stats.totalReceivable.toLocaleString('tr-TR')}`} caption="Fatura ve planlanan tahsilat" icon={Wallet} tone="blue" trend="Alacak" />
        </motion.div>

        <motion.div variants={itemVariants}>
          <PremiumMetricCard title="Tahsil Edilen" value={`₺${stats.totalCollected.toLocaleString('tr-TR')}`} caption="Gerçek tahsilat kayıtları" icon={CreditCard} tone="emerald" trend={`%${stats.collectionRate}`} />
        </motion.div>

        <motion.div variants={itemVariants}>
          <PremiumMetricCard title="Bekleyen" value={`₺${stats.pendingPayments.toLocaleString('tr-TR')}`} caption="Taksit ve borç bakiyesi" icon={Calendar} tone="amber" trend="Bekleyen" />
        </motion.div>

        <motion.div variants={itemVariants}>
          <PremiumMetricCard title="Gecikmiş" value={`₺${stats.overduePayments.toLocaleString('tr-TR')}`} caption="Tahsilat riski" icon={TrendingDown} tone="rose" trend={`${stats.overdueEntries.length} kayıt`} />
        </motion.div>
      </div>

      <motion.div variants={itemVariants}>
        <PremiumPanel title="Gelir - Gider Grafiği" description="Tahsilat, bekleyen ödeme ve gecikme dağılımı">
          <div className="grid gap-5 xl:grid-cols-[1fr_180px_220px]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Finansal akış</p>
                  <p className="mt-1 text-2xl font-black">Muhasebe Paneli</p>
                </div>
                <Badge variant="outline">Canlı</Badge>
              </div>
              <MiniLineChart values={[stats.totalReceivable, stats.totalCollected, stats.pendingPayments, stats.overduePayments, stats.collectionRate]} className="h-40" />
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tahsilat Oranı</p>
              <div className="mt-5 flex justify-center">
                <MiniDonut value={stats.collectionRate} label="Tahsilat" />
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Gelir Dağılımı</p>
              <MiniBarChart values={[stats.totalCollected, stats.pendingPayments, stats.overduePayments, stats.totalReceivable]} className="mt-5" />
            </div>
          </div>
        </PremiumPanel>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <PremiumPanel
            title="Son Tahsilatlar"
            description="Gerçek tahsilat kayıtları"
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
                {stats.recentCollections.map((collection) => (
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
              <Badge className="bg-red-100 text-red-700">{stats.overdueEntries.length} Kayıt</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.overdueEntries.map((student) => (
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
            <CardTitle>Tahsilat Hedefi</CardTitle>
            <CardDescription>Fatura ve tahsilat kayıtlarına göre güncel durum</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Tahsil Edilen</span>
                <span className="font-bold">₺{stats.totalCollected.toLocaleString('tr-TR')} / ₺{stats.totalReceivable.toLocaleString('tr-TR')}</span>
              </div>
              <Progress value={stats.collectionRate} className="h-3" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>%{stats.collectionRate} tamamlandı</span>
                <span>Kalan: ₺{Math.max(0, stats.totalReceivable - stats.totalCollected).toLocaleString('tr-TR')}</span>
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
                    <div className="text-xs uppercase tracking-[0.22em] text-white/70">Tahsilat Özeti</div>
                    <h3 className="mt-2 text-2xl font-semibold">{selectedCollection.name}</h3>
                    <p className="mt-2 text-sm text-white/80">{selectedCollection.className || 'Sınıf bilgisi yok'} • {selectedCollection.note || 'Standart tahsilat kaydı'}</p>
                  </div>
                  <div className="rounded-2xl bg-white/12 px-5 py-4 backdrop-blur">
                    <div className="text-xs text-white/70">Tahsilat Tutarı</div>
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

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Muhasebe İşlem Notu</CardTitle>
                  <CardDescription>Bu kart ödeme kaydının operasyonel açıklamasını gösterir</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>Bu tahsilat, öğrenci cari hesabına işlenmiş gerçek bir backend kaydıdır. İlgili öğrenci hesabı, makbuz arşivi ve tahsilat listesinde aynı belge numarasıyla izlenebilir.</p>
                  <p><span className="font-medium text-foreground">Açıklama:</span> {selectedCollection.note || 'Ek açıklama yok.'}</p>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
