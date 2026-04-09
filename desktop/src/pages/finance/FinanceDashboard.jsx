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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 items-stretch">
        <motion.div variants={itemVariants}>
          <Card className="h-full border-l-4 border-l-brand-primary">
            <CardContent className="p-6 h-full">
              <div className="flex h-full items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Alacak</p>
                  <p className="text-3xl font-bold mt-2">₺{stats.totalReceivable.toLocaleString('tr-TR')}</p>
                  <p className="mt-3 text-xs text-muted-foreground">Fatura ve planlanan tahsilat toplamı</p>
                </div>
                <div className="p-3 rounded-xl bg-brand-primary/10">
                  <Wallet className="h-6 w-6 text-brand-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="h-full border-l-4 border-l-green-500">
            <CardContent className="p-6 h-full">
              <div className="flex h-full items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Tahsil Edilen</p>
                  <p className="text-3xl font-bold mt-2">₺{stats.totalCollected.toLocaleString('tr-TR')}</p>
                  <div className="flex items-center gap-1 mt-2 text-green-500">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">%{stats.collectionRate} oran</span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Gerçek tahsilat kayıtları üzerinden hesaplandı</p>
                </div>
                <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                  <CreditCard className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="h-full border-l-4 border-l-yellow-500">
            <CardContent className="p-6 h-full">
              <div className="flex h-full items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Bekleyen</p>
                  <p className="text-3xl font-bold mt-2">₺{stats.pendingPayments.toLocaleString('tr-TR')}</p>
                  <p className="mt-3 text-xs text-muted-foreground">Henüz tamamlanmamış taksit ve borç bakiyesi</p>
                </div>
                <div className="p-3 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
                  <Calendar className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="h-full border-l-4 border-l-red-500">
            <CardContent className="p-6 h-full">
              <div className="flex h-full items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Gecikmiş</p>
                  <p className="text-3xl font-bold mt-2">₺{stats.overduePayments.toLocaleString('tr-TR')}</p>
                  <div className="flex items-center gap-1 mt-2 text-red-500">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{stats.overdueEntries.length} kayıt</span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Yakın takip gerektiren tahsilat riski</p>
                </div>
                <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30">
                  <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Son Tahsilatlar</CardTitle>
                <CardDescription>Gerçek tahsilat kayıtları</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/finance/collections">
                  Tümünü Gör
                  <ArrowUpRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.recentCollections.map((collection) => (
                  <button
                    type="button"
                    key={collection.id}
                    className="w-full text-left flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    onClick={() => setSelectedCollection(collection)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                        <CreditCard className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium">{collection.name}</p>
                        <p className="text-sm text-muted-foreground">{collection.method} • {collection.note || 'Tahsilat'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">+₺{parseMoney(collection.amount).toLocaleString('tr-TR')}</p>
                      <p className="text-xs text-muted-foreground">{collection.time || 'Zaman yok'}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
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
