import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Palette, Upload, Eye, Save, Building2, Image, Type, RefreshCw,
  Check, Settings, Paintbrush, Trash2, FileImage,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { useToast } from '../../hooks/use-toast';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { GlowingOrb } from '../../components/animations/AnimatedBackground';
import { fetchPlatformConfigurations, fetchPlatformTenants, upsertPlatformConfiguration } from '../../lib/api/modules';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const presetThemes = [
  { id: 'default', name: 'Varsayılan', primary: '#00354F', accent: '#D9790B' },
  { id: 'blue', name: 'Mavi', primary: '#1e40af', accent: '#3b82f6' },
  { id: 'green', name: 'Yeşil', primary: '#166534', accent: '#22c55e' },
  { id: 'purple', name: 'Mor', primary: '#581c87', accent: '#a855f7' },
  { id: 'red', name: 'Kırmızı', primary: '#991b1b', accent: '#ef4444' },
  { id: 'teal', name: 'Turkuaz', primary: '#115e59', accent: '#14b8a6' },
];

function buildThemeId(tenant) {
  if (tenant.plan === 'Enterprise') return 'purple';
  if (tenant.plan === 'Business') return 'blue';
  return 'default';
}

function customizationMarker(tenantId) {
  return `SA_TENANT_CUSTOMIZATION::${tenantId}`;
}

function buildDefaultCustomization(tenant) {
  const themeId = buildThemeId(tenant);
  const preset = presetThemes.find((item) => item.id === themeId) || presetThemes[0];
  return {
    primaryColor: preset.primary,
    accentColor: preset.accent,
    logoUrl: '',
    faviconUrl: '',
    appName: tenant.name || tenant.displayName || tenant.schoolName || 'CourseIntellect',
    darkModeDefault: tenant.plan === 'Enterprise',
    customFonts: tenant.plan !== 'Starter',
    headerFont: tenant.plan === 'Enterprise' ? 'Montserrat' : 'Poppins',
    bodyFont: 'Inter',
    themeId,
  };
}

export default function TenantCustomization() {
  const { toast } = useToast();

  const [platform, setPlatform] = useState({ tenants: [] });
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customizations, setCustomizations] = useState({});
  const [assetDialog, setAssetDialog] = useState({ open: false, field: 'logoUrl', value: '' });
  const logoInputRef = useRef(null);
  const faviconInputRef = useRef(null);

  const MAX_LOGO_BYTES = 512 * 1024; // 512 KB
  const MAX_FAVICON_BYTES = 128 * 1024; // 128 KB

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleFilePicked = async (event, field) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedTenantId) return;

    const maxBytes = field === 'logoUrl' ? MAX_LOGO_BYTES : MAX_FAVICON_BYTES;
    if (file.size > maxBytes) {
      toast({
        title: 'Dosya çok büyük',
        description: `Maksimum ${Math.round(maxBytes / 1024)} KB dosya yükleyebilirsiniz.`,
        variant: 'destructive',
      });
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Geçersiz dosya türü', description: 'Lütfen bir görsel dosyası seçin.', variant: 'destructive' });
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setCustomizations((prev) => ({
        ...prev,
        [selectedTenantId]: {
          ...prev[selectedTenantId],
          [field]: dataUrl,
        },
      }));
      toast({
        title: field === 'logoUrl' ? 'Logo yüklendi' : 'Favicon yüklendi',
        description: 'Kaydet butonuna basarak kalıcı hale getirin.',
      });
    } catch {
      toast({ title: 'Dosya okunamadı', variant: 'destructive' });
    }
  };

  const handleClearAsset = (field) => {
    if (!selectedTenantId) return;
    setCustomizations((prev) => ({
      ...prev,
      [selectedTenantId]: {
        ...prev[selectedTenantId],
        [field]: '',
      },
    }));
  };

  const loadCustomizationData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [tenants, savedConfigurations] = await Promise.all([
        fetchPlatformTenants(),
        fetchPlatformConfigurations('tenant-customization').catch(() => []),
      ]);
      setPlatform({ tenants });
      const initialTenantId = tenants?.[0]?.id || '';
      setSelectedTenantId((prev) => prev || initialTenantId);
      setCustomizations((prev) => {
        const next = { ...prev };
        (tenants || []).forEach((tenant) => {
          const savedRecord = savedConfigurations
            .filter((item) => item.scopeKey === tenant.id)
            .sort((a, b) => new Date(b.updatedAtUtc || 0).getTime() - new Date(a.updatedAtUtc || 0).getTime())[0];
          let savedValues = null;
          if (savedRecord?.payloadJson) {
            try {
              savedValues = JSON.parse(savedRecord.payloadJson);
            } catch {
              savedValues = null;
            }
          }
          if (!next[tenant.id]) {
            next[tenant.id] = {
              ...buildDefaultCustomization(tenant),
              ...savedValues,
            };
          } else if (savedValues) {
            next[tenant.id] = {
              ...next[tenant.id],
              ...savedValues,
            };
          }
        });
        return next;
      });
    } catch (err) {
      setError(err.message || 'Kurum özelleştirme verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomizationData();
  }, [loadCustomizationData]);

  const tenants = useMemo(() => platform?.tenants || [], [platform]);
  const selectedTenant = useMemo(() => tenants.find((tenant) => tenant.id === selectedTenantId) || tenants[0] || null, [tenants, selectedTenantId]);
  const customization = selectedTenant ? customizations[selectedTenant.id] : null;

  // Live preview sadece önizleme box'ında gösterilir; global CSS değişkenlerine dokunmuyoruz

  const handleColorChange = (type, color) => {
    if (!selectedTenant) return;
    setCustomizations((prev) => ({
      ...prev,
      [selectedTenant.id]: {
        ...prev[selectedTenant.id],
        [type]: color,
      },
    }));
  };

  const handlePresetSelect = (preset) => {
    if (!selectedTenant) return;
    setCustomizations((prev) => ({
      ...prev,
      [selectedTenant.id]: {
        ...prev[selectedTenant.id],
        primaryColor: preset.primary,
        accentColor: preset.accent,
        themeId: preset.id,
      },
    }));
  };

  const handleSave = () => {
    if (!selectedTenant) return;
    const payload = customizations[selectedTenant.id];
    // Sadece kuruma özel olarak kaydet — global'i değiştirme
    upsertPlatformConfiguration({
      configurationType: 'tenant-customization',
      scopeKey: selectedTenant.id,
      displayName: customizationMarker(selectedTenant.id),
      payloadJson: JSON.stringify(payload),
    }).then(() => {
      toast({
        title: "Özelleştirmeler Kaydedildi",
        description: `${selectedTenant.name} için branding ayarları kaydedildi.`,
      });
    }).catch((err) => {
      const msg = err.message || '';
      const is403 = msg.includes('403') || msg.includes('Forbidden');
      toast({
        title: is403 ? "Yetki Hatası (403)" : "Özelleştirmeler kaydedilemedi",
        description: is403
          ? 'Bu işlem için geliştirici yetkisi gerekli. Lütfen admin@courseintlecct.com hesabıyla giriş yapın.'
          : msg || 'Lütfen tekrar deneyin.',
        variant: 'destructive',
      });
    });
  };

  const handleLogoUpload = (field) => {
    if (!selectedTenant) return;
    const currentValue = customizations[selectedTenant.id]?.[field] || '';
    setAssetDialog({ open: true, field, value: currentValue });
  };

  const handleAssetSave = () => {
    if (!selectedTenant) return;
    const { field, value } = assetDialog;
    const nextValue = value.trim();
    setCustomizations((prev) => ({
      ...prev,
      [selectedTenant.id]: {
        ...prev[selectedTenant.id],
        [field]: nextValue,
      },
    }));
    setAssetDialog((prev) => ({ ...prev, open: false }));
    const label = field === 'logoUrl' ? 'logo' : 'favicon';
    toast({
      title: field === 'logoUrl' ? 'Logo alanı güncellendi' : 'Favicon alanı güncellendi',
      description: `${selectedTenant.name} için ${label} bağlantısı kaydedildi.`,
    });
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  if (!selectedTenant || !customization) return null;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 relative"
      data-testid="tenant-customization-page"
    >
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <GlowingOrb color={customization.primaryColor} size={300} className="top-20 right-20 opacity-20" />
        <GlowingOrb color={customization.accentColor} size={250} className="bottom-20 left-20 opacity-20" />
      </div>

      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-4">
          <motion.div
            className="p-4 rounded-2xl shadow-lg"
            style={{ background: `linear-gradient(135deg, ${customization.primaryColor}, ${customization.accentColor})` }}
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Palette className="h-8 w-8 text-white" />
          </motion.div>
          <div>
            <h1 className="text-3xl font-bold font-heading">Kurum Özelleştirme</h1>
            <p className="text-muted-foreground">Canlı kurum verisi üstünde marka ve görünüm yönetimi</p>
          </div>
        </div>
      </motion.div>

      {error ? <ErrorBanner title="Kurum özelleştirme görünümü alınamadı" message={error} onRetry={loadCustomizationData} /> : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tenant Selection */}
        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-lg h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-brand-accent" />
                Kurum Seçimi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tenants.map((tenant) => (
                <motion.div
                  key={tenant.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedTenantId(tenant.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedTenant?.id === tenant.id
                      ? 'border-brand-accent bg-brand-accent/10'
                      : 'border-border hover:border-brand-accent/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-primary flex items-center justify-center text-white font-bold">
                      {tenant.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{tenant.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{presetThemes.find((t) => t.id === customization?.themeId || buildThemeId(tenant))?.name}</Badge>
                        {tenant.plan !== 'Starter' && (
                          <Badge className="bg-purple-100 text-purple-700 text-xs">Özel Renkler</Badge>
                        )}
                      </div>
                    </div>
                    {selectedTenant?.id === tenant.id && (
                      <Check className="h-5 w-5 text-brand-accent" />
                    )}
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Customization Panel */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paintbrush className="h-5 w-5 text-brand-accent" />
                {selectedTenant.name} - Özelleştirme
              </CardTitle>
              <CardDescription>Logo, renk ve görünüm ayarlarını düzenleyin</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="colors" className="space-y-6">
                <TabsList className="bg-muted/50 p-1">
                  <TabsTrigger value="colors" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800">
                    <Palette className="h-4 w-4 mr-2" /> Renkler
                  </TabsTrigger>
                  <TabsTrigger value="logo" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800">
                    <Image className="h-4 w-4 mr-2" /> Logo
                  </TabsTrigger>
                  <TabsTrigger value="typography" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800">
                    <Type className="h-4 w-4 mr-2" /> Yazı Tipi
                  </TabsTrigger>
                  <TabsTrigger value="general" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800">
                    <Settings className="h-4 w-4 mr-2" /> Genel
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="colors" className="space-y-6">
                  {/* Preset Themes */}
                  <div>
                    <Label className="mb-3 block">Hazır Temalar</Label>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                      {presetThemes.map((preset) => {
                        const isActive = customization.primaryColor === preset.primary && customization.accentColor === preset.accent;
                        return (
                          <motion.div
                            key={preset.id}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handlePresetSelect(preset)}
                            className="cursor-pointer text-center"
                          >
                            <div
                              className={`w-full h-12 rounded-lg mb-2 shadow-md relative ${isActive ? 'ring-2 ring-offset-2 ring-black dark:ring-white' : ''}`}
                              style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.accent})` }}
                            >
                              {isActive && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Check className="h-5 w-5 text-white drop-shadow-lg" />
                                </div>
                              )}
                            </div>
                            <span className={`text-xs font-medium ${isActive ? 'font-bold' : ''}`}>{preset.name}</span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Colors */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Ana Renk (Primary)</Label>
                      <div className="flex gap-3">
                      <div
                        className="w-12 h-10 rounded-lg border-2 cursor-pointer"
                        style={{ backgroundColor: customization.primaryColor }}
                        />
                        <Input
                          type="text"
                          value={customization.primaryColor}
                          onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                          className="flex-1"
                        />
                        <input
                          type="color"
                          value={customization.primaryColor}
                          onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                          className="w-10 h-10 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Vurgu Rengi (Accent)</Label>
                      <div className="flex gap-3">
                      <div
                        className="w-12 h-10 rounded-lg border-2 cursor-pointer"
                        style={{ backgroundColor: customization.accentColor }}
                        />
                        <Input
                          type="text"
                          value={customization.accentColor}
                          onChange={(e) => handleColorChange('accentColor', e.target.value)}
                          className="flex-1"
                        />
                        <input
                          type="color"
                          value={customization.accentColor}
                          onChange={(e) => handleColorChange('accentColor', e.target.value)}
                          className="w-10 h-10 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="p-4 rounded-xl border bg-muted/30">
                    <Label className="mb-3 block">Önizleme</Label>
                    <div className="flex items-center gap-6">
                      {/* Mini Sidebar Preview */}
                      <div
                        className="w-48 h-36 rounded-xl overflow-hidden shadow-lg flex-shrink-0"
                        style={{ background: `linear-gradient(to bottom, ${customization.primaryColor}, ${customization.primaryColor}dd)` }}
                      >
                        <div className="p-3 border-b border-white/10 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold"
                            style={{ background: `linear-gradient(135deg, ${customization.accentColor}, ${customization.accentColor}aa)` }}>
                            C
                          </div>
                          <span className="text-white text-xs font-medium truncate">{customization.appName || 'CourseIntellect'}</span>
                        </div>
                        <div className="p-2 space-y-1">
                          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-white/70">
                            <div className="w-3 h-3 rounded bg-white/20" />
                            <div className="h-2 w-16 rounded bg-white/20" />
                          </div>
                          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-white"
                            style={{ background: `linear-gradient(to right, ${customization.accentColor}, ${customization.accentColor}aa)` }}>
                            <div className="w-3 h-3 rounded bg-white/30" />
                            <div className="h-2 w-12 rounded bg-white/40" />
                          </div>
                          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-white/70">
                            <div className="w-3 h-3 rounded bg-white/20" />
                            <div className="h-2 w-20 rounded bg-white/20" />
                          </div>
                        </div>
                      </div>

                      {/* Buttons Preview */}
                      <div className="flex flex-col gap-3">
                        <div
                          className="px-5 py-2.5 rounded-lg text-white font-medium shadow-lg text-sm"
                          style={{ backgroundColor: customization.primaryColor }}
                        >
                          Primary
                        </div>
                        <div
                          className="px-5 py-2.5 rounded-lg text-white font-medium shadow-lg text-sm"
                          style={{ backgroundColor: customization.accentColor }}
                        >
                          Accent
                        </div>
                        <div
                          className="px-5 py-2.5 rounded-lg font-medium border-2 text-sm"
                          style={{ borderColor: customization.primaryColor, color: customization.primaryColor }}
                        >
                          Outline
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="logo" className="space-y-6">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={(e) => handleFilePicked(e, 'logoUrl')}
                  />
                  <input
                    ref={faviconInputRef}
                    type="file"
                    accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
                    className="hidden"
                    onChange={(e) => handleFilePicked(e, 'faviconUrl')}
                  />

                  <div className="grid grid-cols-2 gap-6">
                    {/* Logo */}
                    <div className="space-y-3">
                      <Label>Logo (Tam Boyut)</Label>
                      {customization.logoUrl ? (
                        <div className="border rounded-xl p-4 bg-muted/20 space-y-3">
                          <div className="flex items-center justify-center h-32 rounded-lg bg-white dark:bg-gray-900 border">
                            <img
                              src={customization.logoUrl}
                              alt="Logo önizleme"
                              className="max-h-24 max-w-full object-contain"
                              onError={(e) => { e.currentTarget.src = ''; }}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="flex-1"
                              onClick={() => logoInputRef.current?.click()}
                            >
                              <Upload className="h-4 w-4 mr-2" /> Değiştir
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleClearAsset('logoUrl')}
                              title="Logoyu kaldır"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground text-center">
                            Kaydet butonuna basmayı unutmayın.
                          </p>
                        </div>
                      ) : (
                        <div
                          className="border-2 border-dashed rounded-xl p-8 text-center hover:border-brand-accent transition-colors cursor-pointer"
                          onClick={() => logoInputRef.current?.click()}
                        >
                          <FileImage className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                          <p className="text-sm font-medium">PC'den logo seçin</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP veya SVG (max 512 KB)</p>
                        </div>
                      )}
                    </div>

                    {/* Favicon */}
                    <div className="space-y-3">
                      <Label>Favicon</Label>
                      {customization.faviconUrl ? (
                        <div className="border rounded-xl p-4 bg-muted/20 space-y-3">
                          <div className="flex items-center justify-center h-32 rounded-lg bg-white dark:bg-gray-900 border">
                            <img
                              src={customization.faviconUrl}
                              alt="Favicon önizleme"
                              className="h-16 w-16 object-contain"
                              onError={(e) => { e.currentTarget.src = ''; }}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="flex-1"
                              onClick={() => faviconInputRef.current?.click()}
                            >
                              <Upload className="h-4 w-4 mr-2" /> Değiştir
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleClearAsset('faviconUrl')}
                              title="Favicon'u kaldır"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground text-center">
                            Kaydet butonuna basmayı unutmayın.
                          </p>
                        </div>
                      ) : (
                        <div
                          className="border-2 border-dashed rounded-xl p-8 text-center hover:border-brand-accent transition-colors cursor-pointer"
                          onClick={() => faviconInputRef.current?.click()}
                        >
                          <FileImage className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                          <p className="text-sm font-medium">PC'den favicon seçin</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG veya ICO, 32×32 px (max 128 KB)</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Harici URL kullan</Label>
                        <p className="text-xs text-muted-foreground">Dosya yüklemek yerine mevcut bir bağlantı kullanabilirsiniz.</p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => handleLogoUpload('logoUrl')}>
                          <Image className="h-4 w-4 mr-1" /> Logo URL
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => handleLogoUpload('faviconUrl')}>
                          <Image className="h-4 w-4 mr-1" /> Favicon URL
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="typography" className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Özel Yazı Tipleri</Label>
                      <p className="text-sm text-muted-foreground">Kuruma özel yazı tipleri kullan</p>
                    </div>
                    <Switch
                      checked={customization.customFonts}
                      onCheckedChange={(v) => setCustomizations((prev) => ({ ...prev, [selectedTenant.id]: { ...prev[selectedTenant.id], customFonts: v } }))}
                    />
                  </div>

                  {customization.customFonts && (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Başlık Yazı Tipi</Label>
                        <Select value={customization.headerFont} onValueChange={(v) => setCustomizations((prev) => ({ ...prev, [selectedTenant.id]: { ...prev[selectedTenant.id], headerFont: v } }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Poppins">Poppins</SelectItem>
                            <SelectItem value="Montserrat">Montserrat</SelectItem>
                            <SelectItem value="Roboto">Roboto</SelectItem>
                            <SelectItem value="Open Sans">Open Sans</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Gövde Yazı Tipi</Label>
                        <Select value={customization.bodyFont} onValueChange={(v) => setCustomizations((prev) => ({ ...prev, [selectedTenant.id]: { ...prev[selectedTenant.id], bodyFont: v } }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Inter">Inter</SelectItem>
                            <SelectItem value="Roboto">Roboto</SelectItem>
                            <SelectItem value="Open Sans">Open Sans</SelectItem>
                            <SelectItem value="Lato">Lato</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="general" className="space-y-6">
                  <div className="space-y-2">
                    <Label>Uygulama Adı</Label>
                    <Input
                      value={customization.appName}
                      onChange={(e) => setCustomizations((prev) => ({ ...prev, [selectedTenant.id]: { ...prev[selectedTenant.id], appName: e.target.value } }))}
                      placeholder="Kurum adı veya özel isim"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Varsayılan Karanlık Mod</Label>
                      <p className="text-sm text-muted-foreground">Kullanıcılar varsayılan olarak karanlık temada başlasın</p>
                    </div>
                    <Switch
                      checked={customization.darkModeDefault}
                      onCheckedChange={(v) => setCustomizations((prev) => ({ ...prev, [selectedTenant.id]: { ...prev[selectedTenant.id], darkModeDefault: v } }))}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
                <Button variant="outline" onClick={() => {
                  setCustomizations((prev) => ({
                    ...prev,
                    [selectedTenant.id]: buildDefaultCustomization(selectedTenant),
                  }));
                  toast({
                    title: 'Tasarım sıfırlandı',
                    description: `${selectedTenant.name} için varsayılan görünüm geri yüklendi.`,
                  });
                }}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sıfırla
                </Button>
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 mr-2">
                  <Eye className="h-4 w-4" />
                  <span>Canlı Önizleme Aktif</span>
                </div>
                <Button onClick={handleSave} className="bg-brand-primary hover:bg-brand-primary/90 text-white">
                  <Save className="h-4 w-4 mr-2" />
                  Kaydet
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Dialog open={assetDialog.open} onOpenChange={(open) => setAssetDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{assetDialog.field === 'logoUrl' ? 'Logo bağlantısı' : 'Favicon bağlantısı'}</DialogTitle>
            <DialogDescription>{selectedTenant?.name || 'Kurum'} için dış URL tabanlı görsel alanını güncelleyin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{assetDialog.field === 'logoUrl' ? 'Logo URL' : 'Favicon URL'}</Label>
            <Input
              type="url"
              value={assetDialog.value}
              onChange={(e) => setAssetDialog((prev) => ({ ...prev, value: e.target.value }))}
              placeholder={assetDialog.field === 'logoUrl' ? 'https://example.com/logo.png' : 'https://example.com/favicon.ico'}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetDialog((prev) => ({ ...prev, open: false }))}>İptal</Button>
            <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={handleAssetSave}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
