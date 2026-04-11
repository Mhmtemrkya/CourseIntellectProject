import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Edit, Check, X, Users, Building2, HardDrive, Zap, Crown, Package,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { useToast } from '../../hooks/use-toast';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchPlatformConfigurations, fetchPlatformTenants, upsertPlatformConfiguration } from '../../lib/api/modules';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };

const featureLabels = {
  maxUsers: { label: 'Maksimum Kullanıcı', icon: Users },
  maxBranches: { label: 'Şube Sayısı', icon: Building2 },
  storage: { label: 'Depolama', icon: HardDrive },
  apiCalls: { label: 'API Çağrısı', icon: Zap },
};

const basePlanConfig = {
  Starter: {
    price: 10,
    description: 'Küçük kampüsler için başlangıç paketi',
    color: 'bg-blue-500',
    icon: Package,
    popular: false,
    customBranding: false,
    advancedReports: false,
    prioritySupport: false,
  },
  Business: {
    price: 8,
    description: 'Büyüyen kurumlar için dengeli operasyon paketi',
    color: 'bg-brand-accent',
    icon: Zap,
    popular: true,
    customBranding: true,
    advancedReports: true,
    prioritySupport: false,
  },
  Enterprise: {
    price: 6,
    description: 'Çok kampüslü yapılar için genişletilmiş platform paketi',
    color: 'bg-brand-primary',
    icon: Crown,
    popular: false,
    customBranding: true,
    advancedReports: true,
    prioritySupport: true,
  },
};

function EditPlanDialog({ open, onOpenChange, plan, onSave }) {
  const [draft, setDraft] = useState(plan || null);

  useEffect(() => {
    setDraft(plan || null);
  }, [plan]);

  if (!plan || !draft) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Plan Düzenle: {plan.name}</DialogTitle>
          <DialogDescription>Plan görünümünü güncelleyin</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Plan Adı</Label><Input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Fiyat (₺/kullanıcı)</Label><Input type="number" value={draft.price} onChange={(e) => setDraft((prev) => ({ ...prev, price: Number(e.target.value) || 0 }))} /></div>
          </div>
          <div className="space-y-2"><Label>Açıklama</Label><Input value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Maksimum Kullanıcı</Label><Input value={draft.features.maxUsers} onChange={(e) => setDraft((prev) => ({ ...prev, features: { ...prev.features, maxUsers: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>Şube Sayısı</Label><Input value={draft.features.maxBranches} onChange={(e) => setDraft((prev) => ({ ...prev, features: { ...prev.features, maxBranches: e.target.value } }))} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button onClick={() => onSave(draft)}>Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewPlanDialog({ open, onOpenChange, onSave }) {
  const [draft, setDraft] = useState({
    name: '',
    price: 12,
    description: '',
    maxUsers: 100,
    maxBranches: 1,
    storage: '5 GB',
    apiCalls: '10000/ay',
  });

  useEffect(() => {
    if (!open) {
      setDraft({
        name: '',
        price: 12,
        description: '',
        maxUsers: 100,
        maxBranches: 1,
        storage: '5 GB',
        apiCalls: '10000/ay',
      });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni Paket Tanımı</DialogTitle>
          <DialogDescription>Superadmin görünümünde yeni plan oluşturun</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2"><Label>Plan Adı</Label><Input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} /></div>
          <div className="space-y-2"><Label>Açıklama</Label><Input value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Fiyat</Label><Input type="number" value={draft.price} onChange={(e) => setDraft((prev) => ({ ...prev, price: Number(e.target.value) || 0 }))} /></div>
            <div className="space-y-2"><Label>Kullanıcı Limiti</Label><Input type="number" value={draft.maxUsers} onChange={(e) => setDraft((prev) => ({ ...prev, maxUsers: Number(e.target.value) || 0 }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Şube Limiti</Label><Input type="number" value={draft.maxBranches} onChange={(e) => setDraft((prev) => ({ ...prev, maxBranches: Number(e.target.value) || 0 }))} /></div>
            <div className="space-y-2"><Label>Depolama</Label><Input value={draft.storage} onChange={(e) => setDraft((prev) => ({ ...prev, storage: e.target.value }))} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button onClick={() => onSave(draft)} disabled={!draft.name.trim()}>Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PLAN_MARKER = 'SA_PLAN_CONFIG::';

export default function Plans() {
  const { toast } = useToast();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [planOverrides, setPlanOverrides] = useState({});

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [tenantData, savedConfigs] = await Promise.all([
        fetchPlatformTenants(),
        fetchPlatformConfigurations('plan-definition').catch(() => []),
      ]);
      setTenants(tenantData);
      const nextOverrides = {};
      savedConfigs.forEach((item) => {
        try {
          const parsed = JSON.parse(item.payloadJson);
          if (parsed?.id) {
            nextOverrides[parsed.id] = parsed;
          }
        } catch {
          // ignore invalid records
        }
      });
      setPlanOverrides(nextOverrides);
    } catch (err) {
      setError(err.message || 'Paket görünümü alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const derivedPlans = useMemo(() => {
    const grouped = tenants.reduce((acc, tenant) => {
      acc[tenant.plan] = acc[tenant.plan] || [];
      acc[tenant.plan].push(tenant);
      return acc;
    }, {});

    return Object.entries(grouped).map(([planName, planTenants]) => {
      const config = {
        ...basePlanConfig[planName],
        ...(planOverrides[planName] || {}),
      };
      const totalUsers = planTenants.reduce((sum, item) => sum + Number(item.users || 0), 0);
      const totalBranches = planTenants.reduce((sum, item) => sum + Number(item.branches || 0), 0);
      const totalStorage = planTenants.reduce((sum, item) => sum + Number(item.storage || 0), 0);
      const totalApi = planTenants.reduce((sum, item) => sum + Number(item.api || 0), 0);

      return {
        id: planName,
        name: planName,
        price: config.price,
        priceUnit: 'kullanıcı/ay',
        description: config.description,
        color: config.color,
        icon: config.icon,
        popular: config.popular,
        features: {
          maxUsers: Math.max(...planTenants.map((item) => Number(item.users || 0)), 0) || 'Özel',
          maxBranches: Math.max(...planTenants.map((item) => Number(item.branches || 0)), 0) || 'Özel',
          storage: `${Math.max(5, Math.ceil(totalStorage))} GB`,
          apiCalls: `${Math.max(10000, totalApi).toLocaleString('tr-TR')}/ay`,
          customBranding: config.customBranding,
          advancedReports: config.advancedReports,
          prioritySupport: config.prioritySupport,
        },
        activeCount: planTenants.length,
        totalUsers,
        totalBranches,
      };
    });

    const customOnlyPlans = Object.values(planOverrides)
      .filter((item) => !grouped[item.id])
      .map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        priceUnit: 'kullanıcı/ay',
        description: item.description,
        color: item.color || 'bg-muted-foreground',
        icon: Package,
        popular: false,
        features: {
          maxUsers: item.maxUsers || 'Özel',
          maxBranches: item.maxBranches || 'Özel',
          storage: item.storage || '5 GB',
          apiCalls: item.apiCalls || '10000/ay',
          customBranding: Boolean(item.customBranding),
          advancedReports: Boolean(item.advancedReports),
          prioritySupport: Boolean(item.prioritySupport),
        },
        activeCount: 0,
        totalUsers: 0,
        totalBranches: 0,
      }));

    return [...derived, ...customOnlyPlans].sort((a, b) => a.price - b.price);
  }, [tenants, planOverrides]);

  const handleEdit = (plan) => {
    setSelectedPlan(plan);
    setDialogOpen(true);
  };

  const persistPlan = async (payload) => {
    await upsertPlatformConfiguration({
      configurationType: 'plan-definition',
      scopeKey: payload.id,
      displayName: `${PLAN_MARKER}${payload.id}`,
      payloadJson: JSON.stringify(payload),
    });
  };

  const handleSavePlan = async (draft) => {
    const payload = {
      id: draft.id,
      name: draft.name,
      price: draft.price,
      description: draft.description,
      maxUsers: draft.features.maxUsers,
      maxBranches: draft.features.maxBranches,
      storage: draft.features.storage,
      apiCalls: draft.features.apiCalls,
      customBranding: draft.features.customBranding,
      advancedReports: draft.features.advancedReports,
      prioritySupport: draft.features.prioritySupport,
    };

    try {
      await persistPlan(payload);
      setPlanOverrides((prev) => ({
        ...prev,
        [draft.id]: payload,
      }));
      setDialogOpen(false);
      toast({
        title: 'Plan görünümü güncellendi',
        description: `${draft.name} backend üzerinde saklandı.`,
      });
    } catch (err) {
      toast({
        title: 'Plan kaydedilemedi',
        description: err.message || 'Lütfen tekrar deneyin.',
        variant: 'destructive',
      });
    }
  };

  const handleCreatePlan = async (draft) => {
    const payload = {
      id: draft.name.trim(),
      name: draft.name.trim(),
      price: draft.price,
      description: draft.description || 'Özel tanımlı paket',
      maxUsers: draft.maxUsers,
      maxBranches: draft.maxBranches,
      storage: draft.storage,
      apiCalls: draft.apiCalls,
      customBranding: true,
      advancedReports: true,
      prioritySupport: false,
      color: 'bg-muted-foreground',
    };

    try {
      await persistPlan(payload);
      setPlanOverrides((prev) => ({ ...prev, [payload.id]: payload }));
      setCreateOpen(false);
      toast({
        title: 'Yeni plan oluşturuldu',
        description: `${payload.name} satış görünümüne eklendi.`,
      });
    } catch (err) {
      toast({
        title: 'Plan oluşturulamadı',
        description: err.message || 'Lütfen tekrar deneyin.',
        variant: 'destructive',
      });
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="sa-plans-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Paketler</h1>
          <p className="text-muted-foreground mt-1">Gerçek tenant verisinden beslenen abonelik görünümü</p>
        </div>
        <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Plan
        </Button>
      </div>

      {error ? <ErrorBanner title="Paketler alınamadı" message={error} onRetry={loadPlans} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {derivedPlans.map((plan) => {
          const Icon = plan.icon;
          return (
            <motion.div key={plan.id}>
              <Card className={`relative overflow-hidden hover:shadow-card-hover transition-all ${plan.popular ? 'ring-2 ring-brand-accent' : ''}`}>
                {plan.popular ? <div className="absolute top-4 right-4"><Badge className="bg-brand-accent">Popüler</Badge></div> : null}
                <CardHeader>
                  <div className={`w-12 h-12 rounded-xl ${plan.color} flex items-center justify-center mb-4`}><Icon className="h-6 w-6 text-white" /></div>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="pt-4"><span className="text-4xl font-bold">₺{plan.price}</span><span className="text-muted-foreground">/{plan.priceUnit}</span></div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {Object.entries(featureLabels).map(([key, { label, icon: FeatureIcon }]) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground"><FeatureIcon className="h-4 w-4" /><span>{label}</span></div>
                        <span className="font-medium">{plan.features[key]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 border-t space-y-2">
                    {[
                      ['customBranding', 'Özel Markalama'],
                      ['advancedReports', 'Gelişmiş Raporlar'],
                      ['prioritySupport', 'Öncelikli Destek'],
                    ].map(([key, label]) => (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        {plan.features[key] ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-muted-foreground" />}
                        <span className={plan.features[key] ? '' : 'text-muted-foreground'}>{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4 border-t flex items-center justify-between">
                    <Badge variant="outline">{plan.activeCount} kurum • {plan.totalUsers} kullanıcı</Badge>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(plan)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Düzenle
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <EditPlanDialog open={dialogOpen} onOpenChange={setDialogOpen} plan={selectedPlan} onSave={handleSavePlan} />
      <NewPlanDialog open={createOpen} onOpenChange={setCreateOpen} onSave={handleCreatePlan} />
    </motion.div>
  );
}
