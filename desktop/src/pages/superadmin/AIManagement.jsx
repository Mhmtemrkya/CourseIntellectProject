import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, Settings, Zap, AlertTriangle, CheckCircle,
  Cpu, Database, Activity, Users, Clock,
  DollarSign, Sliders, Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Slider } from '../../components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useToast } from '../../hooks/use-toast';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { GlowingOrb, FloatingParticles } from '../../components/animations/AnimatedBackground';
import { fetchPlatformOverview, fetchPlatformConfigurations, upsertPlatformConfiguration } from '../../lib/api/modules';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

const AI_SETTINGS_MARKER = 'SA_AI_SETTINGS';

const defaultAiSettings = {
  enabled: true,
  maxTokens: 2048,
  temperature: 0.7,
  rateLimitPerUser: 100,
  rateLimitPerTenant: 10000,
  contentFilter: true,
  logging: true,
  disabledModels: [],
};

export default function AIManagement() {
  const { toast } = useToast();
  const [platform, setPlatform] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiSettings, setAiSettings] = useState(defaultAiSettings);

  const loadAiData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [overview, savedConfigs] = await Promise.all([
        fetchPlatformOverview(),
        fetchPlatformConfigurations('ai-settings').catch(() => []),
      ]);
      setPlatform(overview);

      const savedRecord = savedConfigs
        .filter((item) => item.scopeKey === 'global')
        .sort((a, b) => new Date(b.updatedAtUtc || 0).getTime() - new Date(a.updatedAtUtc || 0).getTime())[0];

      if (savedRecord?.payloadJson) {
        try {
          const parsed = JSON.parse(savedRecord.payloadJson);
          setAiSettings((prev) => ({ ...prev, ...parsed }));
        } catch {
          // ignore invalid saved config
        }
      }
    } catch (err) {
      setError(err.message || 'AI yönetim verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAiData();
  }, [loadAiData]);

  const usageStats = useMemo(() => ({
    totalRequests: platform?.stats?.aiRequestCount || 0,
    successRate: Number(platform?.stats?.aiSuccessRate || 0),
    avgResponseTime: Number(platform?.stats?.aiAverageResponseSeconds || 0),
    totalCost: Number(platform?.stats?.aiEstimatedCost || 0),
    activeUsers: platform?.stats?.totalUsers || 0,
  }), [platform]);

  const aiModels = useMemo(() => platform?.aiModels || [], [platform]);

  const logs = useMemo(() => platform?.aiLogs || [], [platform]);

  const persistSettings = async (settings) => {
    await upsertPlatformConfiguration({
      configurationType: 'ai-settings',
      scopeKey: 'global',
      displayName: AI_SETTINGS_MARKER,
      payloadJson: JSON.stringify(settings),
    });
  };

  const handleSave = async () => {
    try {
      await persistSettings(aiSettings);
      toast({
        title: "Ayarlar Kaydedildi",
        description: "AI yapılandırmaları veritabanına yazıldı.",
      });
    } catch (err) {
      toast({
        title: "Ayarlar kaydedilemedi",
        description: err.message || "Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    }
  };

  const toggleModel = async (modelId) => {
    const nextDisabled = aiSettings.disabledModels?.includes(modelId)
      ? aiSettings.disabledModels.filter((id) => id !== modelId)
      : [...(aiSettings.disabledModels || []), modelId];
    const nextSettings = { ...aiSettings, disabledModels: nextDisabled };
    setAiSettings(nextSettings);
    try {
      await persistSettings(nextSettings);
      toast({
        title: "Model Durumu Güncellendi",
        description: `${modelId} durumu veritabanına kaydedildi.`,
      });
    } catch (err) {
      toast({
        title: "Model durumu kaydedilemedi",
        description: err.message || "Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    }
  };

  const openModelSettings = (model) => {
    toast({
      title: 'Model ayarları',
      description: `${model.name} için ayrıntılı yapılandırma bir sonraki panel adımına hazır.`,
    });
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 relative"
      data-testid="ai-management-page"
    >
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <GlowingOrb color="var(--brand-accent-hex, #D9790B)" size={300} className="top-20 right-20 opacity-20" />
        <GlowingOrb color="var(--brand-p-700, #8b5cf6)" size={250} className="bottom-20 left-20 opacity-20" />
        <FloatingParticles count={10} colors={['var(--brand-accent-hex, #D9790B)', 'var(--brand-p-700, #8b5cf6)', 'var(--brand-p-400, #3b82f6)']} />
      </div>

      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-4">
          <motion.div
            className="p-4 rounded-2xl shadow-lg"
            style={{ background: 'linear-gradient(to bottom right, var(--brand-accent-hex, #D9790B), var(--brand-p-500, #6b21a8))' }}
            animate={{
              boxShadow: [
                '0 10px 30px var(--brand-a-500, rgba(217, 121, 11, 0.3))',
                '0 10px 40px var(--brand-a-500, rgba(217, 121, 11, 0.5))',
                '0 10px 30px var(--brand-a-500, rgba(217, 121, 11, 0.3))'
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Brain className="h-8 w-8 text-white" />
          </motion.div>
          <div>
            <h1 className="text-3xl font-bold font-heading">AI Yönetimi</h1>
            <p className="text-muted-foreground">Gerçek backend operasyon özetinden gelen AI görünümü</p>
          </div>
          <Badge className="ml-auto bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">
            <Activity className="h-3 w-3 mr-1" /> {aiSettings.enabled ? 'Sistem Aktif' : 'Beklemede'}
          </Badge>
        </div>
      </motion.div>

      {error ? <ErrorBanner title="AI yönetim verileri alınamadı" message={error} onRetry={loadAiData} /> : null}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: 'Toplam İstek', value: usageStats.totalRequests.toLocaleString(), icon: Zap, color: 'from-blue-500 to-cyan-500' },
          { label: 'Başarı Oranı', value: `%${usageStats.successRate}`, icon: CheckCircle, color: 'from-green-500 to-emerald-500' },
          { label: 'Ort. Yanıt', value: `${usageStats.avgResponseTime}s`, icon: Clock, color: 'from-purple-500 to-pink-500' },
          { label: 'Toplam Maliyet', value: `$${usageStats.totalCost}`, icon: DollarSign, color: 'from-yellow-500 to-orange-500' },
          { label: 'Aktif Kullanıcı', value: usageStats.activeUsers.toLocaleString(), icon: Users, color: 'from-teal-500 to-cyan-500' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -5 }}
          >
            <Card className="border-0 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.color}`}>
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="models" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="models" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800">AI Modelleri</TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800">Ayarlar</TabsTrigger>
          <TabsTrigger value="limits" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800">Limitler</TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800">Loglar</TabsTrigger>
        </TabsList>

        <TabsContent value="models">
          <motion.div variants={itemVariants}>
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-brand-accent" />
                  AI Model Yönetimi
                </CardTitle>
                <CardDescription>Platformda kullanılan AI modellerini yönetin</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {aiModels.map((model, index) => (
                    <motion.div
                      key={model.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-4 rounded-xl border hover:border-brand-primary/50 transition-all bg-card"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${
                            model.status === 'active' 
                              ? 'bg-gradient-to-br from-green-500 to-emerald-500' 
                              : 'bg-gray-200 dark:bg-gray-700'
                          }`}>
                            <Brain className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{model.name}</h3>
                              <Badge variant="outline">{model.provider}</Badge>
                              <Badge className={model.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : model.status === 'standby' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'}>
                                {model.status === 'active' ? 'Aktif' : model.status === 'standby' ? 'Hazır' : 'Pasif'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Kullanım: %{model.usage} • Maliyet: ${model.cost}/1K token
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-32">
                            <Progress value={model.usage} className="h-2" />
                          </div>
                          <Switch
                            checked={!aiSettings.disabledModels?.includes(model.id) && model.status !== 'inactive'}
                            onCheckedChange={() => toggleModel(model.id)}
                          />
                          <Button variant="outline" size="sm" onClick={() => openModelSettings(model)}>
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="settings">
          <motion.div variants={itemVariants}>
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-brand-accent" />
                  Genel Ayarlar
                </CardTitle>
                <CardDescription>AI sisteminin genel yapılandırması</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">AI Sistemi</Label>
                    <p className="text-sm text-muted-foreground">Tüm AI özelliklerini etkinleştir/devre dışı bırak</p>
                  </div>
                  <Switch 
                    checked={aiSettings.enabled}
                    onCheckedChange={(v) => setAiSettings({...aiSettings, enabled: v})}
                  />
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Maksimum Token</Label>
                      <span className="text-sm text-muted-foreground">{aiSettings.maxTokens}</span>
                    </div>
                    <Slider
                      value={[aiSettings.maxTokens]}
                      onValueChange={([v]) => setAiSettings({...aiSettings, maxTokens: v})}
                      max={4096}
                      min={256}
                      step={256}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Temperature (Yaratıcılık)</Label>
                      <span className="text-sm text-muted-foreground">{aiSettings.temperature}</span>
                    </div>
                    <Slider
                      value={[aiSettings.temperature * 100]}
                      onValueChange={([v]) => setAiSettings({...aiSettings, temperature: v / 100})}
                      max={100}
                      min={0}
                      step={10}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">İçerik Filtresi</Label>
                    <p className="text-sm text-muted-foreground">Uygunsuz içerikleri otomatik filtrele</p>
                  </div>
                  <Switch 
                    checked={aiSettings.contentFilter}
                    onCheckedChange={(v) => setAiSettings({...aiSettings, contentFilter: v})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Detaylı Loglama</Label>
                    <p className="text-sm text-muted-foreground">Tüm AI etkileşimlerini kaydet</p>
                  </div>
                  <Switch 
                    checked={aiSettings.logging}
                    onCheckedChange={(v) => setAiSettings({...aiSettings, logging: v})}
                  />
                </div>

                <Button onClick={handleSave} className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white">
                  Ayarları Kaydet
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="limits">
          <motion.div variants={itemVariants}>
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-brand-accent" />
                  Kullanım Limitleri
                </CardTitle>
                <CardDescription>Kullanıcı ve kurum bazlı limitler</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Kullanıcı Başına Günlük Limit</Label>
                   <Input
                      type="number"
                      value={aiSettings.rateLimitPerUser}
                      onChange={(e) => setAiSettings({...aiSettings, rateLimitPerUser: Number.parseInt(e.target.value, 10) || 0})}
                    />
                    <p className="text-xs text-muted-foreground">Bir kullanıcının günlük maksimum istek sayısı</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Kurum Başına Günlük Limit</Label>
                   <Input
                      type="number"
                      value={aiSettings.rateLimitPerTenant}
                      onChange={(e) => setAiSettings({...aiSettings, rateLimitPerTenant: Number.parseInt(e.target.value, 10) || 0})}
                    />
                    <p className="text-xs text-muted-foreground">Bir kurumun günlük maksimum istek sayısı</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span className="font-medium text-yellow-700 dark:text-yellow-400">Uyarı</span>
                  </div>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    Limitleri çok düşük ayarlamak kullanıcı deneyimini olumsuz etkileyebilir.
                  </p>
                </div>

                <Button onClick={handleSave} className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white">
                  Limitleri Kaydet
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="logs">
          <motion.div variants={itemVariants}>
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-brand-accent" />
                  AI Kullanım Logları
                </CardTitle>
                <CardDescription>Son AI etkileşimleri</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {logs.map((log, index) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-muted-foreground font-mono">{log.time}</span>
                        <Badge variant="outline">{log.model}</Badge>
                        <span className="text-sm font-medium">{log.user}</span>
                        <span className="text-sm text-muted-foreground">{log.tenant}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">{log.tokens} token</span>
                        <span className="text-sm text-muted-foreground">{log.duration}</span>
                        <Badge className={log.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {log.status === 'success' ? 'Başarılı' : log.status === 'queued' ? 'Sırada' : 'Hata'}
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
