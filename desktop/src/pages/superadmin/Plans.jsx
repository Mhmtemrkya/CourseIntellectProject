import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Edit, Check, Trash2, Users, Package, Star, X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../hooks/use-toast';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import {
  fetchPlatformTenants,
  fetchSiteContentSection,
  updateSiteContentSection,
} from '../../lib/api/modules';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };

const defaultPricingContent = {
  hero: {
    title: 'Şeffaf Fiyatlandırma',
    subtitle: 'İhtiyacınıza uygun planı seçin. Gizli maliyet yok.',
  },
  toggleLabels: {
    monthly: 'Aylık',
    yearly: 'Yıllık',
    discount: '2 ay ücretsiz',
  },
  plans: [
    {
      id: '1',
      name: 'Başlangıç',
      description: 'Bireysel öğretmenler için',
      priceMonthly: 0,
      priceYearly: 0,
      features: ['5 sınıfa kadar', 'Temel raporlar', 'E-posta desteği', 'Mobil uygulama erişimi'],
      isPopular: false,
      ctaText: 'Ücretsiz Başla',
    },
    {
      id: '2',
      name: 'Profesyonel',
      description: 'Okullar için ideal',
      priceMonthly: 299,
      priceYearly: 249,
      features: ['Sınırsız sınıf', 'Gelişmiş raporlar', '7/24 destek', 'Veli portalı', 'API erişimi'],
      isPopular: true,
      ctaText: 'Hemen Başla',
    },
    {
      id: '3',
      name: 'Kurumsal',
      description: 'Büyük kurumlar için',
      priceMonthly: 0,
      priceYearly: 0,
      features: ['Tüm Pro özellikleri', 'Özel sunucu', 'SLA garantisi', 'Dedicated hesap yöneticisi'],
      isPopular: false,
      ctaText: 'İletişime Geç',
    },
  ],
  comparisonTitle: 'Tüm Özellikleri Karşılaştır',
};

function normalizePlan(plan, index = 0) {
  return {
    id: String(plan?.id ?? `${Date.now()}-${index}`),
    name: plan?.name ?? 'Yeni Paket',
    description: plan?.description ?? '',
    priceMonthly: Number(plan?.priceMonthly ?? 0),
    priceYearly: Number(plan?.priceYearly ?? 0),
    features: Array.isArray(plan?.features) ? plan.features.filter((f) => typeof f === 'string') : [],
    isPopular: Boolean(plan?.isPopular),
    ctaText: plan?.ctaText ?? 'Başla',
  };
}

function normalizeContent(raw) {
  const base = defaultPricingContent;
  const content = raw || {};
  return {
    hero: {
      title: content.hero?.title ?? base.hero.title,
      subtitle: content.hero?.subtitle ?? base.hero.subtitle,
    },
    toggleLabels: {
      monthly: content.toggleLabels?.monthly ?? base.toggleLabels.monthly,
      yearly: content.toggleLabels?.yearly ?? base.toggleLabels.yearly,
      discount: content.toggleLabels?.discount ?? base.toggleLabels.discount,
    },
    plans: Array.isArray(content.plans) && content.plans.length > 0
      ? content.plans.map(normalizePlan)
      : base.plans.map(normalizePlan),
    comparisonTitle: content.comparisonTitle ?? base.comparisonTitle,
  };
}

function PlanDialog({ open, onOpenChange, plan, mode, onSave }) {
  const [draft, setDraft] = useState(plan);

  useEffect(() => {
    setDraft(plan);
  }, [plan, open]);

  if (!draft) return null;

  const updateFeature = (idx, value) => {
    setDraft((prev) => {
      const next = [...prev.features];
      next[idx] = value;
      return { ...prev, features: next };
    });
  };

  const addFeature = () => {
    setDraft((prev) => ({ ...prev, features: [...prev.features, 'Yeni özellik'] }));
  };

  const removeFeature = (idx) => {
    setDraft((prev) => ({ ...prev, features: prev.features.filter((_, i) => i !== idx) }));
  };

  const isCreate = mode === 'create';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'Yeni Plan' : `Plan Düzenle: ${plan.name}`}</DialogTitle>
          <DialogDescription>
            Burada yaptığınız değişiklikler marketing sitesi fiyatlar sayfasında görünür.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Plan Adı</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Buton Metni</Label>
              <Input
                value={draft.ctaText}
                onChange={(e) => setDraft((prev) => ({ ...prev, ctaText: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Açıklama</Label>
            <Textarea
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Aylık Fiyat (₺)</Label>
              <Input
                type="number"
                min="0"
                value={draft.priceMonthly}
                onChange={(e) => setDraft((prev) => ({ ...prev, priceMonthly: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Yıllık Fiyat / ay (₺)</Label>
              <Input
                type="number"
                min="0"
                value={draft.priceYearly}
                onChange={(e) => setDraft((prev) => ({ ...prev, priceYearly: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="plan-popular"
              checked={draft.isPopular}
              onChange={(e) => setDraft((prev) => ({ ...prev, isPopular: e.target.checked }))}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="plan-popular" className="cursor-pointer">Popüler paket olarak işaretle</Label>
          </div>

          <div className="space-y-2">
            <Label>Özellikler</Label>
            <div className="space-y-2">
              {draft.features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={feature}
                    onChange={(e) => updateFeature(idx, e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFeature(idx)}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addFeature}>
                <Plus className="h-4 w-4 mr-2" />
                Özellik Ekle
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button
            onClick={() => onSave(draft)}
            disabled={!draft.name.trim()}
          >
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Plans() {
  const { toast } = useToast();
  const [content, setContent] = useState(defaultPricingContent);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('edit');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [pricingResponse, tenantData] = await Promise.all([
        fetchSiteContentSection('pricing', 'tr'),
        fetchPlatformTenants().catch(() => []),
      ]);
      setContent(normalizeContent(pricingResponse?.content));
      setTenants(tenantData);
      if (pricingResponse?.updatedAt) {
        setLastSavedAt(new Date(pricingResponse.updatedAt));
      }
    } catch (err) {
      setError(err.message || 'Paket görünümü alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tenantStats = useMemo(() => {
    const map = {};
    tenants.forEach((tenant) => {
      const key = (tenant.plan || '').trim().toLowerCase();
      if (!key) return;
      if (!map[key]) map[key] = { count: 0, users: 0 };
      map[key].count += 1;
      map[key].users += Number(tenant.users || 0);
    });
    return map;
  }, [tenants]);

  const persist = async (nextContent) => {
    setSaving(true);
    try {
      const response = await updateSiteContentSection('pricing', {
        language: 'tr',
        content: nextContent,
        publish: true,
      });
      const normalized = normalizeContent(response?.content ?? nextContent);
      setContent(normalized);
      if (response?.updatedAt) {
        setLastSavedAt(new Date(response.updatedAt));
      } else {
        setLastSavedAt(new Date());
      }
      return normalized;
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (plan) => {
    setSelectedPlan(plan);
    setDialogMode('edit');
    setDialogOpen(true);
  };

  const handleOpenCreate = () => {
    setSelectedPlan(normalizePlan({
      id: String(Date.now()),
      name: '',
      description: '',
      priceMonthly: 0,
      priceYearly: 0,
      features: [],
      isPopular: false,
      ctaText: 'Başla',
    }));
    setDialogMode('create');
    setDialogOpen(true);
  };

  const handleSavePlan = async (draft) => {
    const normalizedDraft = normalizePlan(draft);
    const exists = content.plans.some((p) => p.id === normalizedDraft.id);
    const nextPlans = exists
      ? content.plans.map((p) => (p.id === normalizedDraft.id ? normalizedDraft : p))
      : [...content.plans, normalizedDraft];
    const nextContent = { ...content, plans: nextPlans };

    try {
      await persist(nextContent);
      setDialogOpen(false);
      toast({
        title: exists ? 'Plan güncellendi' : 'Yeni plan eklendi',
        description: `${normalizedDraft.name} marketing sitesinde güncellendi.`,
      });
    } catch (err) {
      toast({
        title: 'Plan kaydedilemedi',
        description: err.message || 'Lütfen tekrar deneyin.',
        variant: 'destructive',
      });
    }
  };

  const handleDeletePlan = async (planId) => {
    const target = content.plans.find((p) => p.id === planId);
    if (!target) return;
    if (!window.confirm(`"${target.name}" planını silmek istediğinize emin misiniz?`)) return;

    const nextContent = { ...content, plans: content.plans.filter((p) => p.id !== planId) };
    try {
      await persist(nextContent);
      toast({
        title: 'Plan silindi',
        description: `${target.name} marketing sitesinden kaldırıldı.`,
      });
    } catch (err) {
      toast({
        title: 'Plan silinemedi',
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
          <p className="text-muted-foreground mt-1">
            Marketing sitesinin fiyatlar sayfasıyla senkron çalışır.
            {lastSavedAt ? ` Son güncelleme: ${lastSavedAt.toLocaleString('tr-TR')}` : ''}
          </p>
        </div>
        <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={handleOpenCreate} disabled={saving}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Plan
        </Button>
      </div>

      {error ? <ErrorBanner title="Paketler alınamadı" message={error} onRetry={load} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {content.plans.map((plan) => {
          const stats = tenantStats[plan.name.trim().toLowerCase()];
          return (
            <motion.div key={plan.id}>
              <Card className={`relative overflow-hidden hover:shadow-card-hover transition-all ${plan.isPopular ? 'ring-2 ring-brand-accent' : ''}`}>
                {plan.isPopular ? (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-brand-accent">
                      <Star className="h-3 w-3 mr-1" />
                      Popüler
                    </Badge>
                  </div>
                ) : null}
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-brand-primary flex items-center justify-center mb-4">
                    <Package className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>{plan.name || 'İsimsiz Paket'}</CardTitle>
                  <CardDescription>{plan.description || '—'}</CardDescription>
                  <div className="pt-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">₺{plan.priceMonthly}</span>
                      <span className="text-muted-foreground text-sm">/ay</span>
                    </div>
                    {plan.priceYearly > 0 && plan.priceYearly !== plan.priceMonthly ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        Yıllık ödemede ₺{plan.priceYearly}/ay
                      </p>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {plan.features.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Henüz özellik eklenmedi.</p>
                    ) : (
                      plan.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="pt-4 border-t flex items-center justify-between gap-2">
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" />
                      {stats ? `${stats.count} kurum • ${stats.users} kullanıcı` : '0 kurum'}
                    </Badge>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleOpenEdit(plan)} disabled={saving}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeletePlan(plan.id)}
                        disabled={saving}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <PlanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plan={selectedPlan}
        mode={dialogMode}
        onSave={handleSavePlan}
      />
    </motion.div>
  );
}
