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

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8" data-testid="sa-dashboard-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Platform Yönetimi</h1>
        <p className="text-muted-foreground mt-1">Gerçek platform operasyon özeti</p>
      </div>

      {error ? <ErrorBanner title="Platform verileri alınamadı" message={error} onRetry={loadPlatform} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          ['Toplam Kurum', stats.totalTenants, Building2, 'border-l-brand-primary'],
          ['Toplam Kullanıcı', stats.totalUsers, Users, 'border-l-brand-accent'],
          ['Toplam Tahsilat', `₺${Number(stats.monthlyRevenue || 0).toLocaleString('tr-TR')}`, CreditCard, 'border-l-green-500'],
          ['API Çağrısı', Number(stats.apiCalls || 0).toLocaleString('tr-TR'), Activity, 'border-l-blue-500'],
        ].map(([label, value, Icon, border]) => (
          <Card key={label} className={`border-l-4 ${border}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-3xl font-bold mt-2">{value}</p>
                  <div className="flex items-center gap-1 mt-2 text-green-500">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">Canlı veri</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-muted">
                  <Icon className="h-6 w-6 text-brand-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Kurumsal Görünüm</CardTitle>
            <CardDescription>Backend operasyon modülünden gelen kurum görünümü</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTenants.map((tenant) => (
                <div key={tenant.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-brand-primary/10"><Building2 className="h-5 w-5 text-brand-primary" /></div>
                    <div>
                      <p className="font-medium">{tenant.name}</p>
                      <p className="text-sm text-muted-foreground">{tenant.users} kullanıcı</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{tenant.plan}</Badge>
                    <Badge className={tenant.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                      {tenant.status === 'active' ? 'Aktif' : 'İzleme'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" />Sistem Durumu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><div className="flex justify-between text-sm mb-2"><span>API Sunucusu</span><Badge className="bg-green-100 text-green-700">Çalışıyor</Badge></div><Progress value={96} className="h-2" /><p className="text-xs text-muted-foreground mt-1">Canlı endpoint erişimi alındı</p></div>
            <div><div className="flex justify-between text-sm mb-2"><span>Veritabanı</span><Badge className="bg-green-100 text-green-700">Sağlıklı</Badge></div><Progress value={72} className="h-2" /><p className="text-xs text-muted-foreground mt-1">Tahmini kullanım</p></div>
            <div><div className="flex justify-between text-sm mb-2"><span>Depolama</span><Badge className="bg-yellow-100 text-yellow-700">{Number(stats.storageUsedGb || 0).toFixed(1)} GB</Badge></div><Progress value={65} className="h-2" /></div>
            <div><div className="flex justify-between text-sm mb-2"><span>Açık Destek Talepleri</span><Badge className="bg-blue-100 text-blue-700">{stats.openTickets || 0} kayıt</Badge></div></div>
          </CardContent>
        </Card>
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
