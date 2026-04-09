import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Database, Users, HardDrive, Server, Activity,
  AlertTriangle, CheckCircle, Settings, Save
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const mockTenantUsage = [
  { id: 1, name: 'Özel Yıldız Koleji', plan: 'Enterprise', users: 450, usersLimit: 500, storage: '12.5', storageLimit: 20, api: 85000, apiLimit: 100000 },
  { id: 2, name: 'ABC Eğitim', plan: 'Business', users: 280, usersLimit: 300, storage: '8.2', storageLimit: 10, api: 45000, apiLimit: 50000 },
  { id: 3, name: 'Modern Akademi', plan: 'Starter', users: 85, usersLimit: 100, storage: '2.1', storageLimit: 5, api: 8500, apiLimit: 10000 },
  { id: 4, name: 'Gelecek Nesil Okulu', plan: 'Business', users: 320, usersLimit: 300, storage: '9.8', storageLimit: 10, api: 52000, apiLimit: 50000 },
];

const defaultPlanLimits = {
  starter: { users: 100, storage: 5, api: 10000, branches: 1 },
  business: { users: 300, storage: 10, api: 50000, branches: 3 },
  enterprise: { users: 500, storage: 20, api: 100000, branches: 10 },
};

export default function Limits() {
  const { toast } = useToast();
  const [planLimits, setPlanLimits] = useState(defaultPlanLimits);
  const [autoUpgrade, setAutoUpgrade] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState(80);

  const handleSave = () => {
    toast({
      title: 'Limitler Güncellendi',
      description: 'Plan limitleri başarıyla kaydedildi.',
    });
  };

  const getUsageColor = (used, limit) => {
    const percentage = (used / limit) * 100;
    if (percentage >= 100) return 'text-red-600';
    if (percentage >= 80) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getUsageStatus = (used, limit) => {
    const percentage = (used / limit) * 100;
    if (percentage >= 100) return <Badge className="bg-red-100 text-red-700">Aşıldı</Badge>;
    if (percentage >= 80) return <Badge className="bg-yellow-100 text-yellow-700">Kritik</Badge>;
    return <Badge className="bg-green-100 text-green-700">Normal</Badge>;
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
      data-testid="sa-limits-page"
    >
      <div>
        <h1 className="text-3xl font-bold font-heading">Limitler & Kotalar</h1>
        <p className="text-muted-foreground mt-1">Platform ve kurum limitlerini yönetin</p>
      </div>

      {/* Warnings */}
      {mockTenantUsage.some(t => t.users > t.usersLimit || parseFloat(t.storage) > t.storageLimit || t.api > t.apiLimit) && (
        <motion.div variants={itemVariants}>
          <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-900/10">
            <CardContent className="p-4 flex items-center gap-4">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
              <div>
                <p className="font-medium">Dikkat: Bazı kurumlar limit aşımı yaşıyor</p>
                <p className="text-sm text-muted-foreground">
                  {mockTenantUsage.filter(t => t.users > t.usersLimit || parseFloat(t.storage) > t.storageLimit || t.api > t.apiLimit).length} kurum limit üzerinde
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Limits Configuration */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Plan Limitleri
              </CardTitle>
              <CardDescription>Varsayılan plan limitlerini ayarlayın</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Starter */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground">STARTER PLAN</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Kullanıcı Limiti</Label>
                    <Input
                      type="number"
                      value={planLimits.starter.users}
                      onChange={(e) => setPlanLimits({
                        ...planLimits,
                        starter: { ...planLimits.starter, users: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Depolama (GB)</Label>
                    <Input
                      type="number"
                      value={planLimits.starter.storage}
                      onChange={(e) => setPlanLimits({
                        ...planLimits,
                        starter: { ...planLimits.starter, storage: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Business */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground">BUSINESS PLAN</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Kullanıcı Limiti</Label>
                    <Input
                      type="number"
                      value={planLimits.business.users}
                      onChange={(e) => setPlanLimits({
                        ...planLimits,
                        business: { ...planLimits.business, users: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Depolama (GB)</Label>
                    <Input
                      type="number"
                      value={planLimits.business.storage}
                      onChange={(e) => setPlanLimits({
                        ...planLimits,
                        business: { ...planLimits.business, storage: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Enterprise */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground">ENTERPRISE PLAN</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Kullanıcı Limiti</Label>
                    <Input
                      type="number"
                      value={planLimits.enterprise.users}
                      onChange={(e) => setPlanLimits({
                        ...planLimits,
                        enterprise: { ...planLimits.enterprise, users: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Depolama (GB)</Label>
                    <Input
                      type="number"
                      value={planLimits.enterprise.storage}
                      onChange={(e) => setPlanLimits({
                        ...planLimits,
                        enterprise: { ...planLimits.enterprise, storage: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handleSave} className="w-full bg-brand-primary hover:bg-brand-primary/90">
                <Save className="h-4 w-4 mr-2" />
                Limitleri Kaydet
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Auto Settings */}
        <motion.div variants={itemVariants} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Otomatik Ayarlar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Otomatik Plan Yükseltme</p>
                  <p className="text-sm text-muted-foreground">Limit aşımında otomatik yükselt</p>
                </div>
                <Switch checked={autoUpgrade} onCheckedChange={setAutoUpgrade} />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Uyarı Eşiği (%)</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(parseInt(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">
                    Kullanım bu oranı aştığında uyarı gönder
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Platform Kaynakları</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="flex items-center gap-2">
                    <Server className="h-4 w-4" /> API Kapasitesi
                  </span>
                  <span>2.4M / 5M</span>
                </div>
                <Progress value={48} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4" /> Toplam Depolama
                  </span>
                  <span>2.4 TB / 5 TB</span>
                </div>
                <Progress value={48} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="flex items-center gap-2">
                    <Database className="h-4 w-4" /> Veritabanı
                  </span>
                  <span>65%</span>
                </div>
                <Progress value={65} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tenant Usage Table */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Kurum Kullanımları</CardTitle>
            <CardDescription>Tüm kurumların kaynak kullanımı</CardDescription>
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
                {mockTenantUsage.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell><Badge variant="outline">{tenant.plan}</Badge></TableCell>
                    <TableCell>
                      <span className={getUsageColor(tenant.users, tenant.usersLimit)}>
                        {tenant.users} / {tenant.usersLimit}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={getUsageColor(parseFloat(tenant.storage), tenant.storageLimit)}>
                        {tenant.storage} GB / {tenant.storageLimit} GB
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={getUsageColor(tenant.api, tenant.apiLimit)}>
                        {(tenant.api / 1000).toFixed(0)}K / {(tenant.apiLimit / 1000).toFixed(0)}K
                      </span>
                    </TableCell>
                    <TableCell>
                      {getUsageStatus(
                        Math.max(
                          tenant.users / tenant.usersLimit,
                          parseFloat(tenant.storage) / tenant.storageLimit,
                          tenant.api / tenant.apiLimit
                        ) * 100,
                        100
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
