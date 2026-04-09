import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, Settings, Zap, BarChart3, AlertTriangle, CheckCircle,
  Server, Cpu, Database, Activity, TrendingUp, Users, Clock,
  DollarSign, Sliders, RefreshCw, Power, Shield, Key, Globe
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useToast } from '../../hooks/use-toast';
import { GlowingOrb, FloatingParticles } from '../../components/animations/AnimatedBackground';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const aiModels = [
  { id: 'gpt-4', name: 'GPT-4 Turbo', provider: 'OpenAI', status: 'active', usage: 78, cost: 0.03 },
  { id: 'gpt-3.5', name: 'GPT-3.5 Turbo', provider: 'OpenAI', status: 'active', usage: 45, cost: 0.002 },
  { id: 'claude-3', name: 'Claude 3 Opus', provider: 'Anthropic', status: 'inactive', usage: 0, cost: 0.015 },
  { id: 'gemini', name: 'Gemini Pro', provider: 'Google', status: 'active', usage: 23, cost: 0.001 },
];

const usageStats = {
  totalRequests: 125840,
  successRate: 99.2,
  avgResponseTime: 1.8,
  totalCost: 3542.50,
  activeUsers: 8540,
};

export default function AIManagement() {
  const { toast } = useToast();
  const [selectedModel, setSelectedModel] = useState('gpt-4');
  const [aiSettings, setAiSettings] = useState({
    enabled: true,
    maxTokens: 2048,
    temperature: 0.7,
    rateLimitPerUser: 100,
    rateLimitPerTenant: 10000,
    contentFilter: true,
    logging: true,
  });

  const handleSave = () => {
    toast({
      title: "Ayarlar Kaydedildi",
      description: "AI yapılandırmaları başarıyla güncellendi.",
    });
  };

  const toggleModel = (modelId) => {
    toast({
      title: "Model Durumu Güncellendi",
      description: `Model durumu değiştirildi.`,
    });
  };

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
        <GlowingOrb color="#D9790B" size={300} className="top-20 right-20 opacity-20" />
        <GlowingOrb color="#8b5cf6" size={250} className="bottom-20 left-20 opacity-20" />
        <FloatingParticles count={10} colors={['#D9790B', '#8b5cf6', '#3b82f6']} />
      </div>

      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-4">
          <motion.div
            className="p-4 rounded-2xl bg-gradient-to-br from-[#D9790B] to-purple-500 shadow-lg shadow-orange-500/30"
            animate={{ 
              boxShadow: [
                '0 10px 30px rgba(217, 121, 11, 0.3)',
                '0 10px 40px rgba(217, 121, 11, 0.5)',
                '0 10px 30px rgba(217, 121, 11, 0.3)'
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Brain className="h-8 w-8 text-white" />
          </motion.div>
          <div>
            <h1 className="text-3xl font-bold font-heading">AI Yönetimi</h1>
            <p className="text-muted-foreground">Yapay zeka sistemlerini yapılandır ve izle</p>
          </div>
          <Badge className="ml-auto bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">
            <Activity className="h-3 w-3 mr-1" /> Sistem Aktif
          </Badge>
        </div>
      </motion.div>

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
                  <Cpu className="h-5 w-5 text-[#D9790B]" />
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
                              <Badge className={model.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'}>
                                {model.status === 'active' ? 'Aktif' : 'Pasif'}
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
                            checked={model.status === 'active'}
                            onCheckedChange={() => toggleModel(model.id)}
                          />
                          <Button variant="outline" size="sm">
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
                  <Sliders className="h-5 w-5 text-[#D9790B]" />
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
                  <Shield className="h-5 w-5 text-[#D9790B]" />
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
                      onChange={(e) => setAiSettings({...aiSettings, rateLimitPerUser: parseInt(e.target.value)})}
                    />
                    <p className="text-xs text-muted-foreground">Bir kullanıcının günlük maksimum istek sayısı</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Kurum Başına Günlük Limit</Label>
                    <Input
                      type="number"
                      value={aiSettings.rateLimitPerTenant}
                      onChange={(e) => setAiSettings({...aiSettings, rateLimitPerTenant: parseInt(e.target.value)})}
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
                  Limitleri Güncelle
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
                  <Database className="h-5 w-5 text-[#D9790B]" />
                  AI Kullanım Logları
                </CardTitle>
                <CardDescription>Son AI etkileşimleri</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { time: '14:32:05', user: 'Ahmet Y.', tenant: 'Yıldız Koleji', model: 'GPT-4', tokens: 1250, duration: '2.1s', status: 'success' },
                    { time: '14:31:42', user: 'Ayşe K.', tenant: 'ABC Akademi', model: 'GPT-3.5', tokens: 890, duration: '0.8s', status: 'success' },
                    { time: '14:31:18', user: 'Mehmet D.', tenant: 'Yıldız Koleji', model: 'GPT-4', tokens: 2048, duration: '3.2s', status: 'success' },
                    { time: '14:30:55', user: 'Zeynep A.', tenant: 'Modern Okul', model: 'Gemini', tokens: 650, duration: '1.1s', status: 'success' },
                    { time: '14:30:22', user: 'Ali V.', tenant: 'ABC Akademi', model: 'GPT-4', tokens: 0, duration: '-', status: 'error' },
                  ].map((log, index) => (
                    <motion.div
                      key={index}
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
                          {log.status === 'success' ? 'Başarılı' : 'Hata'}
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
