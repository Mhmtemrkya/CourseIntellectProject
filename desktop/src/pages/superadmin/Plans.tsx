import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import {
  Plus, Edit, Check, Trash2, Users, Package, Star, X, Shield, ChevronDown, ChevronRight,
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
import { formatDateTime, formatMoney } from '../../lib/format';
import {
  fetchPlatformPackages,
  fetchPlatformTenants,
  fetchSiteContentSection,
  savePlatformPackage,
  updateSiteContentSection,
} from '../../lib/api/modules';
import {
  PACKAGE_ROLES,
  buildFullAccessRoles,
  buildMarketingFeatureList,
  getRoleModuleOptions,
} from '../../lib/packageCatalog';
import { errorMessage, isRecord } from '../../lib/errors';
import type { PlatformPackageRow } from '../../lib/api/platformOps';
import type { RoleEntitlement } from '../../lib/entitlements';
import type { TenantWorkspaceDto } from '../../types/api/generated';

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  isPopular: boolean;
  ctaText: string;
}

interface PricingContent {
  hero: { title: string; subtitle: string };
  toggleLabels: { monthly: string; yearly: string; discount: string };
  plans: PricingPlan[];
  comparisonTitle: string;
}

/** Rol anahtarı → modül yetkileri (packageCatalog.buildFullAccessRoles biçimi). */
type PackageRoles = Record<string, Required<RoleEntitlement>>;

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

const containerVariants: Variants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };

const defaultPricingContent: PricingContent = {
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

function normalizePlan(value: unknown, index = 0): PricingPlan {
  const plan = isRecord(value) ? value : {};
  return {
    id: String(plan.id ?? `${Date.now()}-${index}`),
    name: text(plan.name, 'Yeni Paket'),
    description: text(plan.description, ''),
    priceMonthly: Number(plan.priceMonthly ?? 0),
    priceYearly: Number(plan.priceYearly ?? 0),
    features: Array.isArray(plan.features) ? plan.features.filter((f): f is string => typeof f === 'string') : [],
    isPopular: Boolean(plan.isPopular),
    ctaText: text(plan.ctaText, 'Başla'),
  };
}

/** Site içeriğindeki fiyat bölümünü doğrular; eksik alanlar varsayılana düşer. */
function normalizeContent(raw: unknown): PricingContent {
  const base = defaultPricingContent;
  const content = isRecord(raw) ? raw : {};
  const hero = isRecord(content.hero) ? content.hero : {};
  const toggleLabels = isRecord(content.toggleLabels) ? content.toggleLabels : {};
  return {
    hero: {
      title: text(hero.title, base.hero.title),
      subtitle: text(hero.subtitle, base.hero.subtitle),
    },
    toggleLabels: {
      monthly: text(toggleLabels.monthly, base.toggleLabels.monthly),
      yearly: text(toggleLabels.yearly, base.toggleLabels.yearly),
      discount: text(toggleLabels.discount, base.toggleLabels.discount),
    },
    plans: Array.isArray(content.plans) && content.plans.length > 0
      ? content.plans.map(normalizePlan)
      : base.plans.map(normalizePlan),
    comparisonTitle: text(content.comparisonTitle, base.comparisonTitle),
  };
}

interface PlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PricingPlan | null;
  mode: 'edit' | 'create';
  onSave: (draft: PricingPlan) => void;
}

function PlanDialog({ open, onOpenChange, plan, mode, onSave }: PlanDialogProps) {
  const [draft, setDraft] = useState<PricingPlan | null>(plan);

  useEffect(() => {
    setDraft(plan);
  }, [plan, open]);

  if (!draft) return null;

  // Taslak her zaman dolu olduğunda düzenlenir (yukarıdaki erken dönüş).
  const patchDraft = (patch: (prev: PricingPlan) => Partial<PricingPlan>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch(prev) } : prev));
  };

  const updateFeature = (idx: number, value: string) => {
    patchDraft((prev) => {
      const next = [...prev.features];
      next[idx] = value;
      return { features: next };
    });
  };

  const addFeature = () => {
    patchDraft((prev) => ({ features: [...prev.features, 'Yeni özellik'] }));
  };

  const removeFeature = (idx: number) => {
    patchDraft((prev) => ({ features: prev.features.filter((_, i) => i !== idx) }));
  };

  const isCreate = mode === 'create';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'Yeni Plan' : `Plan Düzenle: ${plan?.name ?? ''}`}</DialogTitle>
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
                onChange={(e) => patchDraft(() => ({ name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Buton Metni</Label>
              <Input
                value={draft.ctaText}
                onChange={(e) => patchDraft(() => ({ ctaText: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Açıklama</Label>
            <Textarea
              rows={2}
              value={draft.description}
              onChange={(e) => patchDraft(() => ({ description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Aylık Fiyat (TL)</Label>
              <Input
                type="number"
                min="0"
                value={draft.priceMonthly}
                onChange={(e) => patchDraft(() => ({ priceMonthly: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Yıllık Fiyat / ay (TL)</Label>
              <Input
                type="number"
                min="0"
                value={draft.priceYearly}
                onChange={(e) => patchDraft(() => ({ priceYearly: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="plan-popular"
              checked={draft.isPopular}
              onChange={(e) => patchDraft(() => ({ isPopular: e.target.checked }))}
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

// Var olan paket tanımını tam-erişim şablonuyla birleştirir; böylece editörde
// kataloğa yeni eklenen modül/aksiyonlar da (varsayılan açık) görünür.
function mergeRolesWithCatalog(existingRoles: unknown): PackageRoles {
  const full = buildFullAccessRoles();
  if (!isRecord(existingRoles)) return full;
  for (const [roleKey, role] of Object.entries(full)) {
    const saved = existingRoles[roleKey];
    const savedModules = isRecord(saved) && isRecord(saved.modules) ? saved.modules : null;
    if (!savedModules) continue;
    for (const [moduleKey, moduleEntry] of Object.entries(role.modules)) {
      const savedModule = savedModules[moduleKey];
      if (!isRecord(savedModule)) {
        // Kayıtlı pakette hiç geçmeyen modül: kayıt varken eklenen yeni katalog
        // girdisi olabilir — pakette kapalı kabul edip admin kararına bırakırız.
        moduleEntry.enabled = false;
        continue;
      }
      moduleEntry.enabled = Boolean(savedModule.enabled);
      const savedActions = isRecord(savedModule.actions) ? savedModule.actions : null;
      const actions = moduleEntry.actions ?? {};
      for (const actionKey of Object.keys(actions)) {
        if (savedActions && savedActions[actionKey] === false) {
          actions[actionKey] = false;
        }
      }
    }
  }
  return full;
}

const FIRST_ROLE_KEY = PACKAGE_ROLES[0]?.key ?? 'admin';

interface EntitlementsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PricingPlan | null;
  existingRoles: unknown;
  saving: boolean;
  onSave: (roles: PackageRoles, syncFeatures: boolean) => void;
}

function EntitlementsDialog({ open, onOpenChange, plan, existingRoles, saving, onSave }: EntitlementsDialogProps) {
  const [rolesDraft, setRolesDraft] = useState<PackageRoles | null>(null);
  const [activeRole, setActiveRole] = useState(FIRST_ROLE_KEY);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(() => new Set());
  const [syncFeatures, setSyncFeatures] = useState(true);

  useEffect(() => {
    if (!open) return;
    setRolesDraft(mergeRolesWithCatalog(existingRoles));
    setActiveRole(FIRST_ROLE_KEY);
    setExpandedModules(new Set());
    setSyncFeatures(true);
  }, [open, existingRoles]);

  if (!plan || !rolesDraft) return null;

  const moduleOptions = getRoleModuleOptions(activeRole);
  const roleDraft: Required<RoleEntitlement> = rolesDraft[activeRole] || { modules: {} };

  // Etkin rolün modül haritasını günceller; taslak ya da rol yoksa dokunmaz.
  const updateRoleModules = (update: (modules: Required<RoleEntitlement>['modules']) => Required<RoleEntitlement>['modules']) => {
    setRolesDraft((prev) => {
      const role = prev?.[activeRole];
      if (!prev || !role) return prev;
      return { ...prev, [activeRole]: { modules: update(role.modules) } };
    });
  };

  const setModuleEnabled = (moduleKey: string, enabled: boolean) => {
    updateRoleModules((modules) => ({ ...modules, [moduleKey]: { ...modules[moduleKey], enabled } }));
  };

  const setActionEnabled = (moduleKey: string, actionKey: string, enabled: boolean) => {
    updateRoleModules((modules) => {
      const moduleEntry = modules[moduleKey];
      return {
        ...modules,
        [moduleKey]: { ...moduleEntry, actions: { ...moduleEntry?.actions, [actionKey]: enabled } },
      };
    });
  };

  const setAllForRole = (enabled: boolean) => {
    updateRoleModules((modules) => {
      const nextModules: Required<RoleEntitlement>['modules'] = {};
      for (const [moduleKey, moduleEntry] of Object.entries(modules)) {
        const actions: Record<string, boolean> = {};
        for (const actionKey of Object.keys(moduleEntry.actions ?? {})) actions[actionKey] = enabled;
        nextModules[moduleKey] = { enabled, actions };
      }
      return nextModules;
    });
  };

  const toggleExpanded = (moduleKey: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleKey)) next.delete(moduleKey);
      else next.add(moduleKey);
      return next;
    });
  };

  const roleEnabledCount = (roleKey: string) =>
    Object.values(rolesDraft[roleKey]?.modules || {}).filter((m) => m.enabled).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand-accent" />
            Paket Yetkileri: {plan.name}
          </DialogTitle>
          <DialogDescription>
            Bu paketi kullanan kurumlarda hangi rol hangi sayfayı ve sayfa içindeki hangi işlemleri
            kullanabilir? Kapattığınız sayfalar menüden gizlenir, kapattığınız işlemler sayfa içinde görünmez.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 flex-1 min-h-0 py-2">
          {/* Rol listesi */}
          <div className="w-52 shrink-0 space-y-1 overflow-y-auto">
            {PACKAGE_ROLES.map((role) => (
              <button
                key={role.key}
                type="button"
                onClick={() => setActiveRole(role.key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between gap-2 ${
                  activeRole === role.key
                    ? 'bg-brand-primary text-white'
                    : 'hover:bg-muted text-foreground'
                }`}
              >
                <span>{role.label}</span>
                <Badge variant={activeRole === role.key ? 'secondary' : 'outline'} className="text-[10px] px-1.5">
                  {roleEnabledCount(role.key)}/{Object.keys(rolesDraft[role.key]?.modules || {}).length}
                </Badge>
              </button>
            ))}
          </div>

          {/* Modül + aksiyon listesi */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b mb-2">
              <p className="text-sm font-medium">
                {PACKAGE_ROLES.find((r) => r.key === activeRole)?.label} sayfaları
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setAllForRole(true)}>Tümünü Aç</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setAllForRole(false)}>Tümünü Kapat</Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-1">
              {moduleOptions.map((moduleOption) => {
                const moduleDraft = roleDraft.modules[moduleOption.key] || { enabled: false, actions: {} };
                const draftActions = moduleDraft.actions ?? {};
                const actionEntries = Object.entries(moduleOption.actions);
                const expanded = expandedModules.has(moduleOption.key);
                return (
                  <div key={moduleOption.key} className="rounded-lg border border-border/60">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <input
                        type="checkbox"
                        id={`mod-${activeRole}-${moduleOption.key}`}
                        checked={Boolean(moduleDraft.enabled)}
                        onChange={(e) => setModuleEnabled(moduleOption.key, e.target.checked)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <Label htmlFor={`mod-${activeRole}-${moduleOption.key}`} className="cursor-pointer flex-1 text-sm">
                        {moduleOption.label}
                      </Label>
                      {actionEntries.length > 0 && moduleDraft.enabled ? (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(moduleOption.key)}
                          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
                        >
                          {actionEntries.filter(([key]) => draftActions[key] !== false).length}/{actionEntries.length} işlem
                          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      ) : null}
                    </div>
                    {expanded && Boolean(moduleDraft.enabled) && actionEntries.length > 0 ? (
                      <div className="px-3 pb-2 pl-9 grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {actionEntries.map(([actionKey, actionLabel]) => (
                          <label key={actionKey} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                            <input
                              type="checkbox"
                              checked={draftActions[actionKey] !== false}
                              onChange={(e) => setActionEnabled(moduleOption.key, actionKey, e.target.checked)}
                              className="h-3.5 w-3.5 rounded border-border"
                            />
                            {actionLabel}
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-3 flex-col sm:flex-row gap-3 sm:items-center">
          <label className="flex items-center gap-2 text-sm text-muted-foreground mr-auto cursor-pointer">
            <input
              type="checkbox"
              checked={syncFeatures}
              onChange={(e) => setSyncFeatures(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Özellik listesini web sitesindeki pakete de yaz
          </label>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>İptal</Button>
          <Button onClick={() => onSave(rolesDraft, syncFeatures)} disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Yetkileri Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Plans() {
  const { toast } = useToast();
  const [content, setContent] = useState<PricingContent>(defaultPricingContent);
  const [tenants, setTenants] = useState<TenantWorkspaceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'edit' | 'create'>('edit');
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [packages, setPackages] = useState<PlatformPackageRow[]>([]);
  const [entDialogOpen, setEntDialogOpen] = useState(false);
  const [entPlan, setEntPlan] = useState<PricingPlan | null>(null);
  const [entSaving, setEntSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [pricingResponse, tenantData, packageData] = await Promise.all([
        fetchSiteContentSection('pricing', 'tr'),
        fetchPlatformTenants().catch(() => null),
        fetchPlatformPackages().catch(() => []),
      ]);
      setContent(normalizeContent(pricingResponse?.content));
      setTenants(tenantData ?? []);
      setPackages(Array.isArray(packageData) ? packageData : []);
      if (pricingResponse?.updatedAt) {
        setLastSavedAt(new Date(pricingResponse.updatedAt));
      }
    } catch (err) {
      setError(errorMessage(err, 'Paket görünümü alınamadı.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tenantStats = useMemo(() => {
    const map: Partial<Record<string, { count: number; users: number }>> = {};
    tenants.forEach((tenant) => {
      const key = (tenant.plan || '').trim().toLowerCase();
      if (!key) return;
      const entry = map[key] ?? { count: 0, users: 0 };
      entry.count += 1;
      entry.users += Number(tenant.users || 0);
      map[key] = entry;
    });
    return map;
  }, [tenants]);

  const persist = async (nextContent: PricingContent) => {
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

  const handleOpenEdit = (plan: PricingPlan) => {
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

  const handleSavePlan = async (draft: PricingPlan) => {
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
        description: errorMessage(err, 'Lütfen tekrar deneyin.'),
        variant: 'destructive',
      });
    }
  };

  const findPackageForPlan = (plan: PricingPlan | null): PlatformPackageRow | null => {
    if (!plan) return null;
    const nameLower = plan.name.trim().toLowerCase();
    return packages.find(
      (pkg) => pkg.packageId === plan.id || (pkg.name || '').trim().toLowerCase() === nameLower,
    ) || null;
  };

  const parsePackageRoles = (pkg: PlatformPackageRow | null): unknown => {
    if (!pkg?.payloadJson) return null;
    try {
      const parsed: unknown = JSON.parse(pkg.payloadJson);
      return (isRecord(parsed) ? parsed.roles : null) || null;
    } catch {
      return null;
    }
  };

  const handleOpenEntitlements = (plan: PricingPlan) => {
    setEntPlan(plan);
    setEntDialogOpen(true);
  };

  const handleSaveEntitlements = async (rolesDraft: PackageRoles, syncFeatures: boolean) => {
    if (!entPlan) return;
    setEntSaving(true);
    try {
      const saved = await savePlatformPackage(entPlan.id, { name: entPlan.name, roles: rolesDraft });
      if (saved) {
        setPackages((prev) => [...prev.filter((pkg) => pkg.packageId !== saved.packageId), saved]);
      }

      if (syncFeatures) {
        const features = buildMarketingFeatureList(rolesDraft);
        const nextPlans = content.plans.map((p) => (p.id === entPlan.id ? { ...p, features } : p));
        await persist({ ...content, plans: nextPlans });
      }

      setEntDialogOpen(false);
      toast({
        title: 'Paket yetkileri kaydedildi',
        description: `${entPlan.name} paketini kullanan kurumlar bir sonraki oturumda yeni yetkilerle çalışır.`,
      });
    } catch (err) {
      toast({
        title: 'Yetkiler kaydedilemedi',
        description: errorMessage(err, 'Lütfen tekrar deneyin.'),
        variant: 'destructive',
      });
    } finally {
      setEntSaving(false);
    }
  };

  const handleDeletePlan = async (planId: string) => {
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
        description: errorMessage(err, 'Lütfen tekrar deneyin.'),
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
            {lastSavedAt ? ` Son güncelleme: ${formatDateTime(lastSavedAt)}` : ''}
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
                    <Badge className="bg-brand-accent text-white">
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
                      <span className="text-4xl font-bold">{formatMoney(plan.priceMonthly)}</span>
                      <span className="text-muted-foreground text-sm">/ay</span>
                    </div>
                    {plan.priceYearly > 0 && plan.priceYearly !== plan.priceMonthly ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        Yıllık ödemede {formatMoney(plan.priceYearly)}/ay
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEntitlements(plan)}
                        disabled={saving}
                        title="Rol / sayfa / işlem yetkileri"
                        className={findPackageForPlan(plan) ? 'text-brand-accent border-brand-accent/40' : ''}
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
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

      <EntitlementsDialog
        open={entDialogOpen}
        onOpenChange={setEntDialogOpen}
        plan={entPlan}
        existingRoles={parsePackageRoles(findPackageForPlan(entPlan))}
        saving={entSaving}
        onSave={handleSaveEntitlements}
      />
    </motion.div>
  );
}
