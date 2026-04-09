import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Moon, 
  Sun, 
  Monitor,
  Globe,
  Bell,
  Shield,
  Database,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Separator } from '../components/ui/separator';
import { useToast } from '../hooks/use-toast';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function Settings() {
  const { user } = useApp();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [baseUrl, setBaseUrl] = useState('https://api.courseintellect.com');
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const testConnection = async () => {
    setTesting(true);
    setConnectionStatus(null);
    
    // Simulate connection test
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const success = Math.random() > 0.3;
    setConnectionStatus(success ? 'success' : 'error');
    setTesting(false);

    toast({
      title: success ? "Bağlantı başarılı" : "Bağlantı hatası",
      description: success ? "API sunucusuna bağlantı kuruldu." : "Sunucuya bağlanılamadı. URL'yi kontrol edin.",
      variant: success ? "default" : "destructive",
    });
  };

  const saveSettings = () => {
    toast({
      title: "Ayarlar kaydedildi",
      description: "Tüm değişiklikler başarıyla kaydedildi.",
    });
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-4xl"
      data-testid="settings-page"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-heading">Ayarlar</h1>
        <p className="text-muted-foreground mt-1">Uygulama tercihlerinizi yönetin</p>
      </div>

      {/* Profile */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profil
            </CardTitle>
            <CardDescription>Hesap bilgileriniz</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user?.avatar} alt={user?.name} />
                <AvatarFallback className="bg-brand-primary text-white text-2xl">
                  {user?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-xl font-semibold">{user?.name || 'Kullanıcı'}</h3>
                <p className="text-muted-foreground">{user?.email || 'email@example.com'}</p>
                <div className="flex gap-2 mt-2">
                  <Badge className="bg-brand-primary">{user?.role === 'admin' ? 'Yönetici' : user?.role}</Badge>
                  <Badge variant="outline">{user?.tenant || 'Kurum'}</Badge>
                </div>
              </div>
              <Button variant="outline">Profili Düzenle</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Theme */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              Görünüm
            </CardTitle>
            <CardDescription>Tema ve görüntüleme ayarları</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="mb-3 block">Tema</Label>
              <div className="flex gap-3">
                {[
                  { value: 'light', icon: Sun, label: 'Açık' },
                  { value: 'dark', icon: Moon, label: 'Koyu' },
                  { value: 'system', icon: Monitor, label: 'Sistem' },
                ].map((option) => {
                  const Icon = option.icon;
                  return (
                    <Button
                      key={option.value}
                      variant={theme === option.value ? 'default' : 'outline'}
                      onClick={() => setTheme(option.value)}
                      className={theme === option.value ? 'bg-brand-primary' : ''}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Azaltılmış Hareket</Label>
                <p className="text-sm text-muted-foreground">Animasyonları azaltır (erişilebilirlik)</p>
              </div>
              <Switch 
                checked={reducedMotion} 
                onCheckedChange={setReducedMotion}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Notifications */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Bildirimler
            </CardTitle>
            <CardDescription>Bildirim tercihleriniz</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Masaüstü Bildirimleri</Label>
                <p className="text-sm text-muted-foreground">Yeni soru ve önemli güncellemeler için bildirim al</p>
              </div>
              <Switch 
                checked={notifications} 
                onCheckedChange={setNotifications}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* API Connection */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              API Bağlantısı
            </CardTitle>
            <CardDescription>Backend sunucu ayarları</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Base URL</Label>
              <div className="flex gap-2">
                <Input
                  id="baseUrl"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com"
                />
                <Button 
                  variant="outline" 
                  onClick={testConnection}
                  disabled={testing}
                >
                  {testing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    'Test'
                  )}
                </Button>
              </div>
            </div>
            {connectionStatus && (
              <div className={`flex items-center gap-2 p-3 rounded-lg ${
                connectionStatus === 'success' 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {connectionStatus === 'success' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span className="text-sm">
                  {connectionStatus === 'success' ? 'Bağlantı başarılı' : 'Bağlantı hatası'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Package Limits */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Paket Limitleri
            </CardTitle>
            <CardDescription>Kullanım durumu</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Öğrenci Kapasitesi</span>
                <span>136 / 200</span>
              </div>
              <Progress value={68} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Depolama Alanı</span>
                <span>2.4 GB / 5 GB</span>
              </div>
              <Progress value={48} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Aylık API Çağrısı</span>
                <span>8,542 / 10,000</span>
              </div>
              <Progress value={85} className="h-2" />
            </div>
            <Button variant="outline" className="w-full mt-4">
              Paketi Yükselt
            </Button>
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
