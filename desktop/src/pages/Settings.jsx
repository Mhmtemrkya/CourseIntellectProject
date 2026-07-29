import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Building2,
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
  AlertCircle,
  FileSignature,
  Image,
  Trash2,
  Upload
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
import { removeTenantLogo, uploadTenantLogo } from '../lib/api/modules';

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
  const navigate = useNavigate();
  const { theme, setTheme, tenantLogo, tenantName, refreshBranding } = useTheme();
  const { toast } = useToast();
  const logoInputRef = useRef(null);
  const [baseUrl, setBaseUrl] = useState('https://maydanozasist.schoolasist.com');
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [logoBusy, setLogoBusy] = useState(false);
  const canManageInstitutionLogo = user?.role === 'admin'
    && String(user?.backendRole || '').toLowerCase() !== 'branchmanager';

  const handleLogoPicked = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast({
        title: 'Geçersiz logo dosyası',
        description: 'PNG, JPEG veya WebP formatında bir görsel seçin.',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Logo çok büyük',
        description: 'Logo dosyası en fazla 2 MB olabilir.',
        variant: 'destructive',
      });
      return;
    }

    setLogoBusy(true);
    try {
      await uploadTenantLogo(file);
      await refreshBranding();
      toast({
        title: 'Kurum logosu güncellendi',
        description: 'Logo kurumunuzdaki öğrenci ve personel ekranlarına uygulandı.',
      });
    } catch (error) {
      toast({
        title: 'Logo yüklenemedi',
        description: error?.message || 'Lütfen dosyayı kontrol edip tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setLogoBusy(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!window.confirm('Kurum logosunu kaldırmak istediğinize emin misiniz?')) return;
    setLogoBusy(true);
    try {
      await removeTenantLogo();
      await refreshBranding();
      toast({ title: 'Kurum logosu kaldırıldı' });
    } catch (error) {
      toast({
        title: 'Logo kaldırılamadı',
        description: error?.message || 'Lütfen tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setLogoBusy(false);
    }
  };

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
                  <Badge className="bg-brand-primary text-white">{user?.role === 'admin' ? 'Yönetici' : user?.role}</Badge>
                  <Badge variant="outline">{user?.tenant || 'Kurum'}</Badge>
                </div>
              </div>
              <Button variant="outline">Profili Düzenle</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {canManageInstitutionLogo && (
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border-brand-primary/15">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Kurum Logosu
              </CardTitle>
              <CardDescription>
                Okul ve sürücü kursu ekranlarında tüm öğrenci ve personelin göreceği kurumsal logo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid items-center gap-6 md:grid-cols-[220px_1fr]">
                <div className="flex min-h-[140px] items-center justify-center rounded-2xl border border-dashed border-foreground/20 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-5 shadow-inner">
                  {tenantLogo ? (
                    <img
                      src={tenantLogo}
                      alt={`${tenantName || user?.tenant || 'Kurum'} logosu`}
                      className="max-h-[105px] max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <Building2 className="mx-auto h-10 w-10" />
                      <p className="mt-2 text-sm font-medium">Henüz logo yüklenmedi</p>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold">{tenantName || user?.tenant || 'Kurumunuz'}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Kare, yatay, dikey veya yuvarlak logolar kırpılmadan ve oranı bozulmadan gösterilir.
                      PNG, JPEG veya WebP; en fazla 2 MB ve 4096×4096 piksel.
                    </p>
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleLogoPicked}
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoBusy}
                    >
                      {logoBusy ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      {tenantLogo ? 'Logoyu Değiştir' : 'Logo Yükle'}
                    </Button>
                    {tenantLogo && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRemoveLogo}
                        disabled={logoBusy}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Logoyu Kaldır
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Kurum künyesi — ekstre/makbuz başlığındaki bilgiler ayrı sayfada yönetilir. */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Kurum Künyesi
            </CardTitle>
            <CardDescription>Belgelerde görünen kurum bilgileri</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="font-medium">Ekstre ve makbuz başlığı</p>
                <p className="text-sm text-muted-foreground">
                  Kurum adı, adres, telefon, e-posta ve vergi bilgisi — belgelerin sağ üst köşesinde
                  otomatik görünür.
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate('/settings/institution')}>
                <Building2 className="h-4 w-4 mr-2" />
                Kurum Künyesini Düzenle
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Onam formları — tablette imzalanan izin/rıza metinleri. */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              Onam Formları
            </CardTitle>
            <CardDescription>Tablette imzalanan izin ve rıza metinleri</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="font-medium">Muvafakatname, KVKK ve izin belgeleri</p>
                <p className="text-sm text-muted-foreground">
                  Metni siz yazarsınız; personel tek dokunuşla tablete gönderir, öğrenci veya veli
                  parmağıyla imzalar, belge logolu PDF olarak dosyaya eklenir.
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate('/settings/consent-forms')}>
                <FileSignature className="h-4 w-4 mr-2" />
                Onam Formlarını Yönet
              </Button>
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
