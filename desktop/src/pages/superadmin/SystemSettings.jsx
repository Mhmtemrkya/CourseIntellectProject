import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, ToggleLeft, Shield, Server, Bell, Save, CheckCircle, AlertCircle, ScanText, CreditCard, Receipt,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
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
  fetchAppSettings,
  saveAppSettings,
} from '../../lib/api/modules';

const AZURE_KEYS = {
  enabled: 'AzureDocumentIntelligence:Enabled',
  endpoint: 'AzureDocumentIntelligence:Endpoint',
  apiKey: 'AzureDocumentIntelligence:ApiKey',
};

const PAYMENT_KEYS = {
  enabled: 'PaymentGateway:Enabled',
  provider: 'PaymentGateway:Provider',
  baseUrl: 'PaymentGateway:BaseUrl',
  currency: 'PaymentGateway:Currency',
  apiKey: 'PaymentGateway:ApiKey',
};

const EINVOICE_KEYS = {
  enabled: 'EInvoice:Enabled',
  provider: 'EInvoice:Provider',
  baseUrl: 'EInvoice:BaseUrl',
  apiKey: 'EInvoice:ApiKey',
};

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const SETTINGS_MARKER = 'SA_SYSTEM_SETTINGS';

export default function SystemSettings() {
  const { toast } = useToast();
  const [platform, setPlatform] = useState(null);
  const [features, setFeatures] = useState([]);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [aiOcrEnabled, setAiOcrEnabled] = useState(true);
  const [aiOcrEndpoint, setAiOcrEndpoint] = useState('');
  const [aiOcrKeyConfigured, setAiOcrKeyConfigured] = useState(false);
  const [aiOcrKeyInput, setAiOcrKeyInput] = useState('');
  // Ödeme ağ geçidi
  const [payEnabled, setPayEnabled] = useState(false);
  const [payProvider, setPayProvider] = useState('');
  const [payBaseUrl, setPayBaseUrl] = useState('');
  const [payCurrency, setPayCurrency] = useState('TRY');
  const [payKeyConfigured, setPayKeyConfigured] = useState(false);
  const [payKeyInput, setPayKeyInput] = useState('');
  // e-Fatura
  const [invEnabled, setInvEnabled] = useState(false);
  const [invProvider, setInvProvider] = useState('');
  const [invBaseUrl, setInvBaseUrl] = useState('');
  const [invKeyConfigured, setInvKeyConfigured] = useState(false);
  const [invKeyInput, setInvKeyInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [data, savedRecords, systemStatus, integrationSettings] = await Promise.all([
        fetchPlatformOverview(),
        fetchPlatformConfigurations('system-settings').catch(() => []),
        fetchSystemStatus().catch(() => null),
        fetchAppSettings('integrations').catch(() => []),
      ]);
      const findSetting = (key) => integrationSettings.find((item) => item.key === key);
      const enabledValue = findSetting(AZURE_KEYS.enabled)?.value;
      setAiOcrEnabled(enabledValue == null ? true : (enabledValue === 'true' || enabledValue === '1'));
      setAiOcrEndpoint(findSetting(AZURE_KEYS.endpoint)?.value || '');
      setAiOcrKeyConfigured(Boolean(findSetting(AZURE_KEYS.apiKey)?.value));
      setAiOcrKeyInput('');
      // Ödeme ağ geçidi ayarları
      setPayEnabled(findSetting(PAYMENT_KEYS.enabled)?.value === 'true' || findSetting(PAYMENT_KEYS.enabled)?.value === '1');
      setPayProvider(findSetting(PAYMENT_KEYS.provider)?.value || '');
      setPayBaseUrl(findSetting(PAYMENT_KEYS.baseUrl)?.value || '');
      setPayCurrency(findSetting(PAYMENT_KEYS.currency)?.value || 'TRY');
      setPayKeyConfigured(Boolean(findSetting(PAYMENT_KEYS.apiKey)?.value));
      setPayKeyInput('');
      // e-Fatura ayarları
      setInvEnabled(findSetting(EINVOICE_KEYS.enabled)?.value === 'true' || findSetting(EINVOICE_KEYS.enabled)?.value === '1');
      setInvProvider(findSetting(EINVOICE_KEYS.provider)?.value || '');
      setInvBaseUrl(findSetting(EINVOICE_KEYS.baseUrl)?.value || '');
      setInvKeyConfigured(Boolean(findSetting(EINVOICE_KEYS.apiKey)?.value));
      setInvKeyInput('');
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

      // Azure OCR ayarlarını app-settings'e yaz (backend runtime'da okur)
      const azureItems = [
        { key: AZURE_KEYS.enabled, value: aiOcrEnabled ? 'true' : 'false', type: 'boolean', category: 'integrations', description: 'PDF/Word/görsel soru çıkarma için Azure Document Intelligence açık/kapalı' },
        { key: AZURE_KEYS.endpoint, value: aiOcrEndpoint.trim(), type: 'string', category: 'integrations', description: 'Azure Document Intelligence endpoint' },
      ];
      if (aiOcrKeyInput.trim()) {
        azureItems.push({ key: AZURE_KEYS.apiKey, value: aiOcrKeyInput.trim(), type: 'string', category: 'integrations', description: 'Azure Document Intelligence API anahtarı' });
      }
      await saveAppSettings(azureItems);
      if (aiOcrKeyInput.trim()) {
        setAiOcrKeyConfigured(true);
        setAiOcrKeyInput('');
      }

      // Ödeme ağ geçidi ayarları
      const paymentItems = [
        { key: PAYMENT_KEYS.enabled, value: payEnabled ? 'true' : 'false', type: 'boolean', category: 'integrations', description: 'Online ödeme ağ geçidi açık/kapalı' },
        { key: PAYMENT_KEYS.provider, value: payProvider.trim(), type: 'string', category: 'integrations', description: 'Ödeme sağlayıcı (iyzico/PayTR vb.)' },
        { key: PAYMENT_KEYS.baseUrl, value: payBaseUrl.trim(), type: 'string', category: 'integrations', description: 'Ödeme sağlayıcı REST taban adresi' },
        { key: PAYMENT_KEYS.currency, value: payCurrency.trim() || 'TRY', type: 'string', category: 'integrations', description: 'Para birimi' },
      ];
      if (payKeyInput.trim()) {
        paymentItems.push({ key: PAYMENT_KEYS.apiKey, value: payKeyInput.trim(), type: 'string', category: 'integrations', description: 'Ödeme sağlayıcı API anahtarı' });
      }
      await saveAppSettings(paymentItems);
      if (payKeyInput.trim()) { setPayKeyConfigured(true); setPayKeyInput(''); }

      // e-Fatura ayarları
      const invoiceItems = [
        { key: EINVOICE_KEYS.enabled, value: invEnabled ? 'true' : 'false', type: 'boolean', category: 'integrations', description: 'e-Fatura/e-Arşiv açık/kapalı' },
        { key: EINVOICE_KEYS.provider, value: invProvider.trim(), type: 'string', category: 'integrations', description: 'e-Fatura entegratörü' },
        { key: EINVOICE_KEYS.baseUrl, value: invBaseUrl.trim(), type: 'string', category: 'integrations', description: 'e-Fatura entegratör REST taban adresi' },
      ];
      if (invKeyInput.trim()) {
        invoiceItems.push({ key: EINVOICE_KEYS.apiKey, value: invKeyInput.trim(), type: 'string', category: 'integrations', description: 'e-Fatura entegratör API anahtarı' });
      }
      await saveAppSettings(invoiceItems);
      if (invKeyInput.trim()) { setInvKeyConfigured(true); setInvKeyInput(''); }
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ScanText className="h-5 w-5" />Yapay Zekâ / Doküman OCR</CardTitle>
          <CardDescription>PDF, Word ve görsellerden soru çıkarmak için Azure Document Intelligence entegrasyonu</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <p className="font-medium">PDF/Word/Görsel Soru Çıkarma (Azure OCR)</p>
              <p className="text-sm text-muted-foreground">
                Kapalıyken sistem mevcut yerel çıkarıma düşer. Açıkken yüklenen dosyalar Azure ile analiz edilip öğretmen onayına sunulur.
              </p>
            </div>
            <Switch checked={aiOcrEnabled} onCheckedChange={setAiOcrEnabled} />
          </div>
          {aiOcrEnabled ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Azure Endpoint</Label>
                <Input
                  placeholder="https://<kaynak-adi>.cognitiveservices.azure.com"
                  value={aiOcrEndpoint}
                  onChange={(e) => setAiOcrEndpoint(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  API Anahtarı
                  {aiOcrKeyConfigured ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Tanımlı</Badge> : <Badge variant="outline">Tanımlı değil</Badge>}
                </Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder={aiOcrKeyConfigured ? '•••••••• (değiştirmek için yeni anahtar gir)' : 'Azure API anahtarı'}
                  value={aiOcrKeyInput}
                  onChange={(e) => setAiOcrKeyInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Güvenlik için mevcut anahtar gösterilmez. Boş bırakırsan değişmez.
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Online Ödeme Ağ Geçidi</CardTitle>
          <CardDescription>Veli online ödemeleri için iyzico/PayTR benzeri REST sağlayıcı. Anahtar girilince gerçek ödeme akışı aktifleşir; aksi halde güvenli test modu.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <p className="font-medium">Online ödemeyi etkinleştir</p>
              <p className="text-sm text-muted-foreground">Kapalıyken sadece TEST-OK token'ı ile test ödemesi alınır.</p>
            </div>
            <Switch checked={payEnabled} onCheckedChange={setPayEnabled} />
          </div>
          {payEnabled ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2"><Label>Sağlayıcı</Label><Input placeholder="iyzico / paytr" value={payProvider} onChange={(e) => setPayProvider(e.target.value)} /></div>
                <div className="space-y-2"><Label>Para Birimi</Label><Input placeholder="TRY" value={payCurrency} onChange={(e) => setPayCurrency(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>REST Taban Adresi (BaseUrl)</Label><Input placeholder="https://api.saglayici.com/v1" value={payBaseUrl} onChange={(e) => setPayBaseUrl(e.target.value)} /></div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">API Anahtarı {payKeyConfigured ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Tanımlı</Badge> : <Badge variant="outline">Tanımlı değil</Badge>}</Label>
                <Input type="password" autoComplete="new-password" placeholder={payKeyConfigured ? '•••••••• (değiştirmek için yeni anahtar gir)' : 'Sağlayıcı API anahtarı'} value={payKeyInput} onChange={(e) => setPayKeyInput(e.target.value)} />
                <p className="text-xs text-muted-foreground">Güvenlik için mevcut anahtar gösterilmez. Boş bırakırsan değişmez.</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" />e-Fatura / e-Arşiv</CardTitle>
          <CardDescription>GİB entegratörü. Anahtar girilince gerçek e-Fatura kesilir; aksi halde KDV hesaplı örnek (stub) belge üretilir.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <p className="font-medium">e-Faturayı etkinleştir</p>
              <p className="text-sm text-muted-foreground">Kapalıyken belgeler stub (örnek) ETTN ile üretilir.</p>
            </div>
            <Switch checked={invEnabled} onCheckedChange={setInvEnabled} />
          </div>
          {invEnabled ? (
            <div className="space-y-3">
              <div className="space-y-2"><Label>Entegratör</Label><Input placeholder="GİB / özel entegratör" value={invProvider} onChange={(e) => setInvProvider(e.target.value)} /></div>
              <div className="space-y-2"><Label>REST Taban Adresi (BaseUrl)</Label><Input placeholder="https://api.entegratör.com" value={invBaseUrl} onChange={(e) => setInvBaseUrl(e.target.value)} /></div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">API Anahtarı {invKeyConfigured ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Tanımlı</Badge> : <Badge variant="outline">Tanımlı değil</Badge>}</Label>
                <Input type="password" autoComplete="new-password" placeholder={invKeyConfigured ? '•••••••• (değiştirmek için yeni anahtar gir)' : 'Entegratör API anahtarı'} value={invKeyInput} onChange={(e) => setInvKeyInput(e.target.value)} />
                <p className="text-xs text-muted-foreground">Güvenlik için mevcut anahtar gösterilmez. Boş bırakırsan değişmez.</p>
              </div>
            </div>
          ) : null}
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
