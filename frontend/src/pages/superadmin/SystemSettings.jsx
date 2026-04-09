import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, ToggleLeft, Shield, Server, Bell, 
  Save, RefreshCw, CheckCircle, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../hooks/use-toast';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockFeatureFlags = [
  { id: 'chat', name: 'Mesajlaşma Modülü', description: 'Öğretmen-öğrenci-veli mesajlaşması', enabled: true },
  { id: 'questions', name: 'Soru Kutusu', description: 'Öğrenci soru-cevap sistemi', enabled: true },
  { id: 'live-lessons', name: 'Canlı Dersler', description: 'Video konferans entegrasyonu', enabled: true },
  { id: 'mobile-app', name: 'Mobil Uygulama', description: 'iOS ve Android desteği', enabled: false },
  { id: 'ai-reports', name: 'AI Raporlama', description: 'Yapay zeka destekli analiz', enabled: false },
  { id: 'kiosk-mode', name: 'Kiosk Modu', description: 'QR yoklama sistemi', enabled: true },
];

const systemServices = [
  { name: 'API Gateway', status: 'healthy', uptime: '99.98%' },
  { name: 'Database Cluster', status: 'healthy', uptime: '99.99%' },
  { name: 'SignalR Hub', status: 'healthy', uptime: '99.95%' },
  { name: 'Storage Service', status: 'warning', uptime: '99.80%' },
  { name: 'Email Service', status: 'healthy', uptime: '99.90%' },
  { name: 'Background Jobs', status: 'healthy', uptime: '99.85%' },
];

export default function SystemSettings() {
  const { toast } = useToast();
  const [features, setFeatures] = useState(mockFeatureFlags);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');

  const toggleFeature = (featureId) => {
    setFeatures(prev => prev.map(f => 
      f.id === featureId ? { ...f, enabled: !f.enabled } : f
    ));
  };

  const saveSettings = () => {
    toast({
      title: "Ayarlar kaydedildi",
      description: "Sistem ayarları başarıyla güncellendi.",
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      healthy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    const labels = { healthy: 'Sağlıklı', warning: 'Uyarı', error: 'Hata' };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="sa-system-page"
    >
      <div>
        <h1 className="text-3xl font-bold font-heading">Sistem Ayarları</h1>
        <p className="text-muted-foreground mt-1">Platform yapılandırması ve modül yönetimi</p>
      </div>

      {/* System Status */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Servis Durumu
            </CardTitle>
            <CardDescription>Platform servislerinin anlık durumu</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {systemServices.map((service) => (
                <div key={service.name} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    {service.status === 'healthy' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{service.name}</p>
                      <p className="text-xs text-muted-foreground">Uptime: {service.uptime}</p>
                    </div>
                  </div>
                  {getStatusBadge(service.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Feature Flags */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ToggleLeft className="h-5 w-5" />
              Modül Yönetimi
            </CardTitle>
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
                  <Switch 
                    checked={feature.enabled}
                    onCheckedChange={() => toggleFeature(feature.id)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Maintenance Mode */}
      <motion.div variants={itemVariants}>
        <Card className={maintenanceMode ? 'border-yellow-300 bg-yellow-50/50 dark:bg-yellow-900/10' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Bakım Modu
            </CardTitle>
            <CardDescription>Platform bakım modunu yönetin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Bakım Modunu Aktifleştir</Label>
                <p className="text-sm text-muted-foreground">Kullanıcılar platforma erişemez</p>
              </div>
              <Switch 
                checked={maintenanceMode}
                onCheckedChange={setMaintenanceMode}
              />
            </div>
            {maintenanceMode && (
              <div className="space-y-2">
                <Label>Bakım Mesajı</Label>
                <Textarea
                  placeholder="Kullanıcılara gösterilecek mesaj..."
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Notifications */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Sistem Bildirimleri
            </CardTitle>
            <CardDescription>Otomatik bildirim ayarları</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Ödeme Hatırlatmaları</Label>
                <p className="text-sm text-muted-foreground">Geciken ödemeler için otomatik hatırlatma</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Limit Uyarıları</Label>
                <p className="text-sm text-muted-foreground">Kota limitine yaklaşan kurumlar için uyarı</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Sistem Durumu</Label>
                <p className="text-sm text-muted-foreground">Servis kesintilerinde e-posta bildirimi</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Save Button */}
      <motion.div variants={itemVariants} className="flex justify-end">
        <Button 
          className="bg-brand-primary hover:bg-brand-primary/90"
          onClick={saveSettings}
        >
          <Save className="h-4 w-4 mr-2" />
          Ayarları Kaydet
        </Button>
      </motion.div>
    </motion.div>
  );
}
