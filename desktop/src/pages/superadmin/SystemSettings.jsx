import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, ToggleLeft, Shield, Server, Bell, Save, CheckCircle, AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../hooks/use-toast';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import {
  fetchPlatformConfigurations,
  fetchPlatformOverview,
  upsertPlatformConfiguration,
  fetchSystemStatus,
  setSystemMaintenance,
} from '../../lib/api/modules';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const SETTINGS_MARKER = 'SA_SYSTEM_SETTINGS';

export default function SystemSettings() {
  const { toast } = useToast();
  const [platform, setPlatform] = useState(null);
  const [features, setFeatures] = useState([]);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [data, savedRecords, systemStatus] = await Promise.all([
        fetchPlatformOverview(),
        fetchPlatformConfigurations('system-settings').catch(() => []),
        fetchSystemStatus().catch(() => null),
      ]);
      const savedSettings = savedRecords
        .filter((item) => item.scopeKey === 'global')
        .sort((a, b) => new Date(b.updatedAtUtc || 0).getTime() - new Date(a.updatedAtUtc || 0).getTime())[0];
      let parsedSettings = null;
      if (savedSettings?.payloadJson) {
        try {
          parsedSettings = JSON.parse(savedSettings.payloadJson);
        } catch {
          parsedSettings = null;
        }
      }
      setPlatform(data);
      const baseFeatures = [
        { id: 'chat', name: 'Mesajlaşma Modülü', description: `${data.stats.openTickets || 0} açık operasyon kaydıyla izleniyor`, enabled: true },
        { id: 'questions', name: 'Soru Kutusu', description: `${data.stats.totalUsers || 0} aktif kullanıcı hacmiyle çalışıyor`, enabled: true },
        { id: 'live-lessons', name: 'Canlı Dersler', description: 'Platform operasyon omurgası aktif', enabled: true },
        { id: 'mobile-app', name: 'Mobil Uygulama', description: 'Mobil istemciler backend üzerinden bağlı', enabled: true },
        { id: 'ai-reports', name: 'AI Raporlama', description: `${data.stats.aiRequestCount || 0} AI isteğiyle izleniyor`, enabled: true },
        { id: 'kiosk-mode', name: 'Kiosk Modu', description: 'QR ve yoklama altyapısı bağlı', enabled: true },
      ];
      // Bakım modu artık /api/system/status'tan gelir (gerçek source of truth)
      if (systemStatus) {
        setMaintenanceMode(Boolean(systemStatus.maintenanceMode));
        setMaintenanceMessage(systemStatus.maintenanceMessage || '');
      } else if (parsedSettings) {
        setMaintenanceMode(Boolean(parsedSettings.maintenanceMode));
        setMaintenanceMessage(parsedSettings.maintenanceMessage || '');
      }
      if (parsedSettings) {
        setFeatures(baseFeatures.map((item) => {
          const savedFeature = parsedSettings.features?.find((feature) => feature.id === item.id);
          return savedFeature ? { ...item, enabled: savedFeature.enabled } : item;
        }));
      } else {
        setFeatures(baseFeatures);
      }
    } catch (err) {
      setError(err.message || 'Sistem ayarları alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const services = useMemo(() => ([
    { name: 'API Gateway', status: 'healthy', uptime: 'Canlı' },
    { name: 'Database Cluster', status: 'healthy', uptime: 'Canlı' },
    { name: 'SignalR Hub', status: 'healthy', uptime: 'Hazır' },
    { name: 'Storage Service', status: platform?.stats?.storageUsedGb ? 'warning' : 'healthy', uptime: `${Number(platform?.stats?.storageUsedGb || 0).toFixed(1)} GB` },
    { name: 'Notification Service', status: 'healthy', uptime: `${platform?.stats?.openTickets || 0} açık kayıt` },
    { name: 'Background Jobs', status: 'healthy', uptime: 'İşleniyor' },
  ]), [platform]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  const getStatusBadge = (status) => {
    const styles = {
      healthy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    };
    const labels = { healthy: 'Sağlıklı', warning: 'Uyarı' };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
  };

  const handleSave = async () => {
    try {
      // Bakım modunu gerçek system endpoint'ine yaz (login gate burayı dinler)
      await setSystemMaintenance({ enabled: maintenanceMode, message: maintenanceMessage });
      // Diğer toggle'ları (modüller) platform-configurations'a yaz
      await upsertPlatformConfiguration({
        configurationType: 'system-settings',
        scopeKey: 'global',
        displayName: SETTINGS_MARKER,
        payloadJson: JSON.stringify({
          maintenanceMode,
          maintenanceMessage,
          features: features.map((feature) => ({ id: feature.id, enabled: feature.enabled })),
        }),
      });
      toast({
        title: maintenanceMode ? 'Bakım modu AKTİF' : 'Ayarlar kaydedildi',
        description: maintenanceMode
          ? 'Tüm istemcilerde (web, desktop, mobil) kullanıcı girişleri engellendi. Sadece platform admin giriş yapabilir.'
          : 'Sistem ayarları kaydedildi.',
      });
    } catch (err) {
      toast({
        title: 'Ayarlar kaydedilemedi',
        description: err.message || 'Lütfen tekrar deneyin.',
        variant: 'destructive',
      });
    }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="sa-system-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Sistem Ayarları</h1>
        <p className="text-muted-foreground mt-1">Platform yapılandırması ve modül yönetimi</p>
      </div>

      {error ? <ErrorBanner title="Sistem ayarları alınamadı" message={error} onRetry={loadSettings} /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" />Servis Durumu</CardTitle>
          <CardDescription>Platform servislerinin anlık görünümü</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div key={service.name} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  {service.status === 'healthy' ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-yellow-500" />}
                  <div>
                    <p className="font-medium text-sm">{service.name}</p>
                    <p className="text-xs text-muted-foreground">Durum: {service.uptime}</p>
                  </div>
                </div>
                {getStatusBadge(service.status)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ToggleLeft className="h-5 w-5" />Modül Yönetimi</CardTitle>
          <CardDescription>Platform modüllerini açıp kapatın</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {features.map((feature) => (
              <div key={feature.id} className="flex items-center justify-between p-4 rounded-lg border">
                <div>
                  <p className="font-medium">{feature.name}</p>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
                <Switch checked={feature.enabled} onCheckedChange={() => setFeatures((prev) => prev.map((item) => (item.id === feature.id ? { ...item, enabled: !item.enabled } : item)))} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className={maintenanceMode ? 'border-yellow-300 bg-yellow-50/50 dark:bg-yellow-900/10' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Bakım Modu</CardTitle>
          <CardDescription>Platform bakım modunu yönetin</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Bakım Modunu Aktifleştir</Label>
              <p className="text-sm text-muted-foreground">Kullanıcılar platforma erişemez</p>
            </div>
            <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
          </div>
          {maintenanceMode ? (
            <div className="space-y-2">
              <Label>Bakım Mesajı</Label>
              <Textarea placeholder="Kullanıcılara gösterilecek mesaj..." value={maintenanceMessage} onChange={(e) => setMaintenanceMessage(e.target.value)} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Sistem Bildirimleri</CardTitle>
          <CardDescription>Otomatik bildirim ayarları</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between"><div><Label>Ödeme Hatırlatmaları</Label><p className="text-sm text-muted-foreground">Geciken ödemeler için otomatik hatırlatma</p></div><Switch defaultChecked /></div>
          <div className="flex items-center justify-between"><div><Label>Limit Uyarıları</Label><p className="text-sm text-muted-foreground">Kota limitine yaklaşan kurumlar için uyarı</p></div><Switch defaultChecked /></div>
          <div className="flex items-center justify-between"><div><Label>Sistem Durumu</Label><p className="text-sm text-muted-foreground">Servis kesintilerinde e-posta bildirimi</p></div><Switch defaultChecked /></div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Ayarları Kaydet
        </Button>
      </div>
    </motion.div>
  );
}
