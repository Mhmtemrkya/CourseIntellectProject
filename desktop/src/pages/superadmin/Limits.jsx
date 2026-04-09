import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Save,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Progress } from '../../components/ui/progress';
import { Switch } from '../../components/ui/switch';
import { Separator } from '../../components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { useToast } from '../../hooks/use-toast';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchPlatformConfigurations, fetchPlatformOverview, fetchPlatformTenants, upsertPlatformConfiguration } from '../../lib/api/modules';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const LIMITS_MARKER = 'SA_LIMITS_CONFIG';

const defaultPlanLimits = {
  starter: { users: 100, storage: 5, api: 10000 },
  business: { users: 300, storage: 10, api: 50000 },
  enterprise: { users: 500, storage: 20, api: 100000 },
};

export default function Limits() {
  const { toast } = useToast();
  const [platform, setPlatform] = useState(null);
  const [planLimits, setPlanLimits] = useState(defaultPlanLimits);
  const [autoUpgrade, setAutoUpgrade] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState(80);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLimits = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [overview, tenants, savedConfigs] = await Promise.all([
        fetchPlatformOverview(),
        fetchPlatformTenants(),
        fetchPlatformConfigurations('platform-limits').catch(() => []),
      ]);
      setPlatform({ stats: overview.stats, tenants });
      const savedConfig = savedConfigs
        .filter((item) => item.scopeKey === 'global')
        .sort((a, b) => new Date(b.updatedAtUtc || 0).getTime() - new Date(a.updatedAtUtc || 0).getTime())[0];

      if (savedConfig?.payloadJson) {
        try {
          const parsed = JSON.parse(savedConfig.payloadJson);
          if (parsed.planLimits) setPlanLimits(parsed.planLimits);
          if (typeof parsed.autoUpgrade === 'boolean') setAutoUpgrade(parsed.autoUpgrade);
          if (typeof parsed.alertThreshold === 'number') setAlertThreshold(parsed.alertThreshold);
        } catch {
          // ignore invalid saved config
        }
      }
    } catch (err) {
      setError(err.message || 'Limit verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLimits();
  }, [loadLimits]);

  const tenantUsage = useMemo(() => platform?.tenants || [], [platform]);

  const getUsageStatus = (used, limit) => {
    const percentage = limit > 0 ? (used / limit) * 100 : 0;
    if (percentage >= 100) return <Badge className="bg-red-100 text-red-700">Aşıldı</Badge>;
    if (percentage >= alertThreshold) return <Badge className="bg-yellow-100 text-yellow-700">Kritik</Badge>;
    return <Badge className="bg-green-100 text-green-700">Normal</Badge>;
  };

  const handleSaveLimits = async () => {
    try {
      await upsertPlatformConfiguration({
        configurationType: 'platform-limits',
        scopeKey: 'global',
        displayName: LIMITS_MARKER,
        payloadJson: JSON.stringify({
          planLimits,
          autoUpgrade,
          alertThreshold,
        }),
      });
      toast({
        title: 'Limitler kaydedildi',
        description: 'Limit yapılandırması platform konfigürasyonuna yazıldı.',
      });
    } catch (err) {
      toast({
        title: 'Limitler kaydedilemedi',
        description: err.message || 'Lütfen tekrar deneyin.',
        variant: 'destructive',
      });
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="sa-limits-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Limitler & Kotalar</h1>
        <p className="text-muted-foreground mt-1">Platform ve kurum limitlerini yönetin</p>
      </div>

      {error ? <ErrorBanner title="Limitler alınamadı" message={error} onRetry={loadLimits} /> : null}

      {tenantUsage.some((tenant) => tenant.users > planLimits[tenant.plan.toLowerCase()]?.users) ? (
        <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-900/10">
          <CardContent className="p-4 flex items-center gap-4">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
            <div>
              <p className="font-medium">Dikkat: bazı kurumlar limit eşiğine ulaştı</p>
              <p className="text-sm text-muted-foreground">En az bir kurum tanımlı plan kullanıcı limitini aşıyor.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Plan Limitleri</CardTitle>
            <CardDescription>Bu ayarlar backend platform konfigürasyonuna yazılır</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(planLimits).map(([key, value]) => (
              <div key={key} className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase">{key}</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label className="text-xs">Kullanıcı</Label><Input type="number" value={value.users} onChange={(e) => setPlanLimits((prev) => ({ ...prev, [key]: { ...prev[key], users: Number(e.target.value) } }))} /></div>
                  <div className="space-y-2"><Label className="text-xs">Depolama</Label><Input type="number" value={value.storage} onChange={(e) => setPlanLimits((prev) => ({ ...prev, [key]: { ...prev[key], storage: Number(e.target.value) } }))} /></div>
                  <div className="space-y-2"><Label className="text-xs">API</Label><Input type="number" value={value.api} onChange={(e) => setPlanLimits((prev) => ({ ...prev, [key]: { ...prev[key], api: Number(e.target.value) } }))} /></div>
                </div>
                <Separator />
              </div>
            ))}
            <Button onClick={handleSaveLimits} className="w-full bg-brand-primary hover:bg-brand-primary/90">
              <Save className="h-4 w-4 mr-2" />
              Limitleri Kaydet
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Otomatik Ayarlar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between"><div><p className="font-medium">Otomatik Plan Yükseltme</p><p className="text-sm text-muted-foreground">Aşımda öneri üret</p></div><Switch checked={autoUpgrade} onCheckedChange={setAutoUpgrade} /></div>
            <Separator />
            <div className="space-y-2">
              <Label>Uyarı Eşiği (%)</Label>
              <Input type="number" value={alertThreshold} onChange={(e) => setAlertThreshold(Number(e.target.value))} className="w-24" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kurum Kullanımı</CardTitle>
          <CardDescription>Gerçek tenant verisi üstünden limit görünümü</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kurum</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Kullanıcı</TableHead>
                <TableHead>Depolama</TableHead>
                <TableHead>API</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenantUsage.map((tenant) => {
                const limits = planLimits[tenant.plan.toLowerCase()];
                return (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell><Badge variant="outline">{tenant.plan}</Badge></TableCell>
                    <TableCell><div className="space-y-1"><p>{tenant.users} / {limits?.users}</p><Progress value={Math.min(100, (tenant.users / limits.users) * 100)} className="h-2" /></div></TableCell>
                    <TableCell><div className="space-y-1"><p>{tenant.storage} GB / {limits?.storage} GB</p><Progress value={Math.min(100, (tenant.storage / limits.storage) * 100)} className="h-2" /></div></TableCell>
                    <TableCell><div className="space-y-1"><p>{tenant.api} / {limits?.api}</p><Progress value={Math.min(100, (tenant.api / limits.api) * 100)} className="h-2" /></div></TableCell>
                    <TableCell>{getUsageStatus(tenant.users, limits?.users || 1)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  );
}
