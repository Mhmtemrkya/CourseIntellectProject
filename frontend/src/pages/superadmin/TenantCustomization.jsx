import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Palette, Upload, Eye, Save, Building2, Image, Type, RefreshCw,
  Check, X, Settings, Globe, Moon, Sun, Paintbrush, Layers
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { useToast } from '../../hooks/use-toast';
import { GlowingOrb } from '../../components/animations/AnimatedBackground';

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

const mockTenants = [
  { id: 1, name: 'Özel Yıldız Koleji', logo: null, theme: 'default', customColors: false },
  { id: 2, name: 'ABC Eğitim Kurumları', logo: null, theme: 'blue', customColors: true },
  { id: 3, name: 'Modern Akademi', logo: null, theme: 'green', customColors: true },
  { id: 4, name: 'Gelecek Nesil Okulu', logo: null, theme: 'purple', customColors: false },
];

export default function TenantCustomization() {
  const { toast } = useToast();
  const [selectedTenant, setSelectedTenant] = useState(mockTenants[0]);
  const [customization, setCustomization] = useState({
    primaryColor: '#00354F',
    accentColor: '#D9790B',
    logoUrl: '',
    faviconUrl: '',
    appName: 'CourseIntellect',
    darkModeDefault: false,
    customFonts: false,
    headerFont: 'Poppins',
    bodyFont: 'Inter',
  });

  const handleColorChange = (type, color) => {
    setCustomization(prev => ({
      ...prev,
      [type]: color
    }));
  };

  const handlePresetSelect = (preset) => {
    setCustomization(prev => ({
      ...prev,
      primaryColor: preset.primary,
      accentColor: preset.accent
    }));
    toast({
      title: "Tema Uygulandı",
      description: `${preset.name} teması seçildi.`,
    });
  };

  const handleSave = () => {
    toast({
      title: "Özelleştirmeler Kaydedildi",
      description: `${selectedTenant.name} için ayarlar güncellendi.`,
    });
  };

  const handleLogoUpload = () => {
    toast({
      title: "Logo Yükleme",
      description: "Logo yükleme özelliği yakında aktif olacak.",
    });
  };

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
            <p className="text-muted-foreground">Kurumların görsel kimliklerini yönetin</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tenant Selection */}
        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-lg h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#D9790B]" />
                Kurum Seçimi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockTenants.map((tenant) => (
                <motion.div
                  key={tenant.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedTenant(tenant)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedTenant.id === tenant.id
                      ? 'border-[#D9790B] bg-[#D9790B]/10'
                      : 'border-border hover:border-[#D9790B]/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-primary flex items-center justify-center text-white font-bold">
                      {tenant.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{tenant.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{presetThemes.find(t => t.id === tenant.theme)?.name}</Badge>
                        {tenant.customColors && (
                          <Badge className="bg-purple-100 text-purple-700 text-xs">Özel Renkler</Badge>
                        )}
                      </div>
                    </div>
                    {selectedTenant.id === tenant.id && (
                      <Check className="h-5 w-5 text-[#D9790B]" />
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
                <Paintbrush className="h-5 w-5 text-[#D9790B]" />
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
                      {presetThemes.map((preset) => (
                        <motion.div
                          key={preset.id}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handlePresetSelect(preset)}
                          className="cursor-pointer text-center"
                        >
                          <div
                            className="w-full h-12 rounded-lg mb-2 shadow-md"
                            style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.accent})` }}
                          />
                          <span className="text-xs font-medium">{preset.name}</span>
                        </motion.div>
                      ))}
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
                    <div className="flex items-center gap-4">
                      <div
                        className="px-6 py-3 rounded-lg text-white font-medium shadow-lg"
                        style={{ backgroundColor: customization.primaryColor }}
                      >
                        Primary Button
                      </div>
                      <div
                        className="px-6 py-3 rounded-lg text-white font-medium shadow-lg"
                        style={{ backgroundColor: customization.accentColor }}
                      >
                        Accent Button
                      </div>
                      <div
                        className="px-6 py-3 rounded-lg font-medium border-2"
                        style={{ borderColor: customization.primaryColor, color: customization.primaryColor }}
                      >
                        Outline Button
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="logo" className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <Label>Logo (Tam Boyut)</Label>
                      <div className="border-2 border-dashed rounded-xl p-8 text-center hover:border-[#D9790B] transition-colors cursor-pointer" onClick={handleLogoUpload}>
                        <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Logo yüklemek için tıklayın</p>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG veya SVG (max 2MB)</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <Label>Favicon</Label>
                      <div className="border-2 border-dashed rounded-xl p-8 text-center hover:border-[#D9790B] transition-colors cursor-pointer" onClick={handleLogoUpload}>
                        <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Favicon yüklemek için tıklayın</p>
                        <p className="text-xs text-muted-foreground mt-1">ICO veya PNG (32x32px)</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Logo URL (Harici)</Label>
                    <Input
                      type="url"
                      placeholder="https://example.com/logo.png"
                      value={customization.logoUrl}
                      onChange={(e) => setCustomization({...customization, logoUrl: e.target.value})}
                    />
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
                      onCheckedChange={(v) => setCustomization({...customization, customFonts: v})}
                    />
                  </div>

                  {customization.customFonts && (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Başlık Yazı Tipi</Label>
                        <Select value={customization.headerFont} onValueChange={(v) => setCustomization({...customization, headerFont: v})}>
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
                        <Select value={customization.bodyFont} onValueChange={(v) => setCustomization({...customization, bodyFont: v})}>
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
                      onChange={(e) => setCustomization({...customization, appName: e.target.value})}
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
                      onCheckedChange={(v) => setCustomization({...customization, darkModeDefault: v})}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
                <Button variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sıfırla
                </Button>
                <Button variant="outline">
                  <Eye className="h-4 w-4 mr-2" />
                  Önizle
                </Button>
                <Button onClick={handleSave} className="bg-brand-primary hover:bg-brand-primary/90 text-white">
                  <Save className="h-4 w-4 mr-2" />
                  Kaydet
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
