import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Users, CreditCard, Server, AlertTriangle,
  TrendingUp, Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchPlatformOverview } from '../../lib/api/modules';
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

export default function SADashboard() {
  const [platform, setPlatform] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPlatform = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchPlatformOverview();
      setPlatform(data);
    } catch (err) {
      setError(err.message || 'Platform verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlatform();
  }, [loadPlatform]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  const stats = platform?.stats || {};
  const recentTenants = platform?.recentTenants || [];

  // Dynamic system status calculations
  const apiHealthPct   = Math.min(100, Math.round(Number(stats.aiSuccessRate ?? 96)));
  const storageMaxGb   = 20; // platform storage ceiling (GB)
  const storagePct     = Math.min(100, Math.round((Number(stats.storageUsedGb ?? 0) / storageMaxGb) * 100));
  const dbUsagePct     = Math.min(95, Math.round(Math.min(88, (stats.totalUsers ?? 0) * 0.4 + 35)));

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8" data-testid="sa-dashboard-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Platform Yönetimi</h1>
        <p className="text-muted-foreground mt-1">Gerçek platform operasyon özeti</p>
      </div>

      {error ? <ErrorBanner title="Platform verileri alınamadı" message={error} onRetry={loadPlatform} /> : null}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Toplam Kurum', stats.totalTenants, Building2, 'blue'],
          ['Toplam Kullanıcı', stats.totalUsers, Users, 'violet'],
          ['Toplam Tahsilat', `₺${Number(stats.monthlyRevenue || 0).toLocaleString('tr-TR')}`, CreditCard, 'emerald'],
          ['API Çağrısı', Number(stats.apiCalls || 0).toLocaleString('tr-TR'), Activity, 'amber'],
        ].map(([label, value, Icon, tone]) => (
          <PremiumMetricCard key={label} title={label} value={value} icon={Icon} tone={tone} trend="Canlı" />
        ))}
      </div>

      <motion.div>
        <PremiumPanel title="Platform Trafiği" description="Kurum, kullanıcı, API ve depolama sinyalleri">
          <div className="grid gap-5 xl:grid-cols-[1fr_180px_220px]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Platform grafiği</p>
                  <p className="mt-1 text-2xl font-black">SaaS operasyonu</p>
                </div>
                <Badge variant="outline">Genel</Badge>
              </div>
              <MiniLineChart values={[stats.totalTenants || 0, stats.totalUsers || 0, stats.monthlyRevenue || 0, stats.apiCalls || 0, apiHealthPct, storagePct]} className="h-40" />
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">API Sağlığı</p>
              <div className="mt-5 flex justify-center">
                <MiniDonut value={apiHealthPct} label="API" />
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Kaynak Dağılımı</p>
              <MiniBarChart values={[apiHealthPct, storagePct, dbUsagePct, stats.openTickets || 0]} className="mt-5" />
            </div>
          </div>
        </PremiumPanel>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PremiumPanel title="Kurumsal Görünüm" description="Backend operasyon modülünden gelen kurum görünümü">
            <div className="space-y-4">
              {recentTenants.map((tenant) => (
                <PremiumListRow key={tenant.id} icon={Building2} title={tenant.name} subtitle={`${tenant.users} kullanıcı • ${tenant.plan}`} meta={tenant.status === 'active' ? 'Aktif' : 'İzleme'} accent={tenant.status === 'active'} />
              ))}
            </div>
        </PremiumPanel>

        <PremiumPanel title="Sistem Durumu" description="Sunucu, veritabanı ve destek sinyalleri" action={<Server className="h-5 w-5 text-[hsl(var(--brand-accent))]" />}>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>API Sunucusu</span>
                <Badge className={apiHealthPct >= 90 ? 'bg-green-100 text-green-700' : apiHealthPct >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>
                  {apiHealthPct >= 90 ? 'Çalışıyor' : apiHealthPct >= 70 ? 'Yavaş' : 'Sorunlu'} %{apiHealthPct}
                </Badge>
              </div>
              <Progress value={apiHealthPct} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">Başarı oranı — {stats.aiRequestCount ?? 0} istek işlendi</p>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Veritabanı</span>
                <Badge className={dbUsagePct < 75 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                  {dbUsagePct < 75 ? 'Sağlıklı' : 'Yüksek'} %{dbUsagePct}
                </Badge>
              </div>
              <Progress value={dbUsagePct} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{stats.totalUsers ?? 0} kullanıcı — tahmini kayıt yükü</p>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Depolama</span>
                <Badge className={storagePct < 70 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                  {Number(stats.storageUsedGb ?? 0).toFixed(1)} / {storageMaxGb} GB
                </Badge>
              </div>
              <Progress value={storagePct} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">%{storagePct} doluluk</p>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Açık Destek Talepleri</span>
                <Badge className="bg-blue-100 text-blue-700">{stats.openTickets ?? 0} kayıt</Badge>
              </div>
              {(stats.openTickets ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{stats.openTickets} bekleyen talep mevcut</p>
              )}
            </div>
          </div>
        </PremiumPanel>
      </div>

      {(stats.overduePayments || 0) > 0 ? (
        <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-900/10">
          <CardContent className="p-4 flex items-center gap-4">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
            <div>
              <p className="font-medium">Dikkat: gecikmiş platform finans kaydı var</p>
              <p className="text-sm text-muted-foreground">Toplam gecikmiş tutar ₺{Number(stats.overduePayments || 0).toLocaleString('tr-TR')}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </motion.div>
  );
}
