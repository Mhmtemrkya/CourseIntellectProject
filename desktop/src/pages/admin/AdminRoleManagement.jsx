import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Search,
  Users,
  BriefcaseBusiness,
  GraduationCap,
  KeyRound,
  CheckCircle2,
  LayoutGrid,
  Sparkles,
  ShieldCheck,
  Workflow,
  Crown,
  UserRound,
  Wallet,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Checkbox } from '../../components/ui/checkbox';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  fetchPlatformConfigurations,
  fetchStaff,
  fetchStudents,
  upsertPlatformConfiguration,
} from '../../lib/api/modules';

const ROLE_OPTIONS = ['Admin', 'Administrative', 'Teacher', 'Student', 'Parent', 'Accounting'];

const MODULE_GROUPS = [
  {
    title: 'Akademik',
    items: [
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'students', label: 'Öğrenciler' },
      { key: 'teachers', label: 'Öğretmenler' },
      { key: 'classes', label: 'Sınıflar & Gruplar' },
      { key: 'schedule', label: 'Ders Programı' },
      { key: 'content', label: 'İçerikler' },
      { key: 'questions', label: 'Sorular' },
      { key: 'exams', label: 'Sınavlar' },
      { key: 'reports', label: 'Raporlar' },
    ],
  },
  {
    title: 'Operasyon',
    items: [
      { key: 'operations', label: 'Operasyon Merkezi' },
      { key: 'tasks', label: 'Görev Merkezi' },
      { key: 'approvals', label: 'Onaylar' },
      { key: 'records', label: 'İdari Kayıtlar' },
      { key: 'documents', label: 'Belge Merkezi' },
      { key: 'notifications', label: 'Duyurular' },
      { key: 'chat', label: 'Mesajlar' },
    ],
  },
  {
    title: 'Finans & Platform',
    items: [
      { key: 'finance', label: 'Finans Paneli' },
      { key: 'collections', label: 'Tahsilatlar' },
      { key: 'billing', label: 'Faturalama' },
      { key: 'platform', label: 'Platform Yönetimi' },
      { key: 'tenants', label: 'Kurum Yönetimi' },
      { key: 'system', label: 'Sistem Ayarları' },
    ],
  },
];

const ACTION_FLAGS = [
  { key: 'canCreate', label: 'Yeni kayıt oluşturabilir' },
  { key: 'canEdit', label: 'Kayıt düzenleyebilir' },
  { key: 'canDelete', label: 'Kayıt silebilir' },
  { key: 'canApprove', label: 'Onay verebilir' },
  { key: 'canExport', label: 'Rapor ve veri dışa aktarabilir' },
  { key: 'canAssignRoles', label: 'Rol ve yetki atayabilir' },
];

const ROLE_PRESETS = {
  Admin: {
    modules: {
      dashboard: true, students: true, teachers: true, classes: true, schedule: true, content: true, questions: true, exams: true, reports: true,
      operations: true, tasks: true, approvals: true, records: true, documents: true, notifications: true, chat: true,
      finance: true, collections: true, billing: true, platform: false, tenants: false, system: true,
    },
    actions: {
      canCreate: true, canEdit: true, canDelete: true, canApprove: true, canExport: true, canAssignRoles: true,
    },
  },
  Administrative: {
    modules: {
      dashboard: true, students: true, teachers: true, classes: true, schedule: true, content: false, questions: false, exams: false, reports: true,
      operations: true, tasks: true, approvals: true, records: true, documents: true, notifications: true, chat: true,
      finance: false, collections: false, billing: false, platform: false, tenants: false, system: false,
    },
    actions: {
      canCreate: true, canEdit: true, canDelete: false, canApprove: true, canExport: true, canAssignRoles: false,
    },
  },
  Teacher: {
    modules: {
      dashboard: true, students: false, teachers: false, classes: true, schedule: true, content: true, questions: true, exams: true, reports: true,
      operations: false, tasks: false, approvals: false, records: false, documents: false, notifications: true, chat: true,
      finance: false, collections: false, billing: false, platform: false, tenants: false, system: false,
    },
    actions: {
      canCreate: true, canEdit: true, canDelete: false, canApprove: false, canExport: true, canAssignRoles: false,
    },
  },
  Student: {
    modules: {
      dashboard: true, students: false, teachers: false, classes: false, schedule: true, content: true, questions: true, exams: true, reports: false,
      operations: false, tasks: false, approvals: false, records: false, documents: false, notifications: true, chat: true,
      finance: false, collections: false, billing: false, platform: false, tenants: false, system: false,
    },
    actions: {
      canCreate: false, canEdit: false, canDelete: false, canApprove: false, canExport: false, canAssignRoles: false,
    },
  },
  Parent: {
    modules: {
      dashboard: true, students: false, teachers: false, classes: false, schedule: false, content: false, questions: false, exams: true, reports: true,
      operations: false, tasks: false, approvals: false, records: false, documents: false, notifications: true, chat: true,
      finance: true, collections: false, billing: false, platform: false, tenants: false, system: false,
    },
    actions: {
      canCreate: false, canEdit: false, canDelete: false, canApprove: false, canExport: true, canAssignRoles: false,
    },
  },
  Accounting: {
    modules: {
      dashboard: true, students: true, teachers: false, classes: false, schedule: false, content: false, questions: false, exams: false, reports: true,
      operations: true, tasks: false, approvals: true, records: true, documents: true, notifications: true, chat: true,
      finance: true, collections: true, billing: true, platform: false, tenants: false, system: false,
    },
    actions: {
      canCreate: true, canEdit: true, canDelete: false, canApprove: true, canExport: true, canAssignRoles: false,
    },
  },
};

function createPolicy(role = 'Student') {
  const preset = ROLE_PRESETS[role] || ROLE_PRESETS.Student;
  return {
    role,
    modules: { ...preset.modules },
    actions: { ...preset.actions },
  };
}

function roleTone(role) {
  const tones = {
    Admin: 'bg-blue-100 text-blue-700',
    Administrative: 'bg-teal-100 text-teal-700',
    Teacher: 'bg-emerald-100 text-emerald-700',
    Student: 'bg-amber-100 text-amber-700',
    Parent: 'bg-fuchsia-100 text-fuchsia-700',
    Accounting: 'bg-rose-100 text-rose-700',
  };
  return tones[role] || 'bg-muted text-muted-foreground';
}

function roleMeta(role) {
  const map = {
    Admin: {
      icon: Crown,
      accent: 'from-blue-500 via-cyan-500 to-sky-400',
      surface: 'from-blue-950/80 via-cyan-950/60 to-sky-950/80',
      ring: 'border-blue-800/50',
      copy: 'Platform ve kurum yönetiminde tam erişim',
    },
    Administrative: {
      icon: BriefcaseBusiness,
      accent: 'from-teal-500 via-emerald-500 to-green-400',
      surface: 'from-teal-950/80 via-emerald-950/60 to-green-950/80',
      ring: 'border-teal-800/50',
      copy: 'Operasyon, kayıt ve onay süreçleri',
    },
    Teacher: {
      icon: GraduationCap,
      accent: 'from-emerald-500 via-lime-500 to-yellow-400',
      surface: 'from-emerald-950/80 via-lime-950/60 to-yellow-950/80',
      ring: 'border-emerald-800/50',
      copy: 'Ders, sınav ve akademik akış yönetimi',
    },
    Student: {
      icon: UserRound,
      accent: 'from-amber-500 via-orange-500 to-rose-400',
      surface: 'from-amber-950/80 via-orange-950/60 to-rose-950/80',
      ring: 'border-amber-800/50',
      copy: 'Öğrenme, sınav ve içerik deneyimi',
    },
    Parent: {
      icon: Users,
      accent: 'from-fuchsia-500 via-pink-500 to-rose-400',
      surface: 'from-fuchsia-950/80 via-pink-950/60 to-rose-950/80',
      ring: 'border-fuchsia-800/50',
      copy: 'Takip, rapor ve iletişim görünümü',
    },
    Accounting: {
      icon: Wallet,
      accent: 'from-rose-500 via-red-500 to-orange-400',
      surface: 'from-rose-950/80 via-red-950/60 to-orange-950/80',
      ring: 'border-rose-800/50',
      copy: 'Tahsilat, mutabakat ve finans ekranları',
    },
  };

  return map[role] || {
    icon: Shield,
    accent: 'from-gray-500 via-gray-600 to-gray-700',
    surface: 'from-muted/50 via-muted to-muted',
    ring: 'border-border',
    copy: 'Genel erişim profili',
  };
}

export default function AdminRoleManagement() {
  const { toast } = useToast();
  const [people, setPeople] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [search, setSearch] = useState('');
  const [policies, setPolicies] = useState({});
  const [draftPolicy, setDraftPolicy] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRoles = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [staff, students, configs] = await Promise.all([
        fetchStaff().catch(() => []),
        fetchStudents().catch(() => []),
        fetchPlatformConfigurations('role-management').catch(() => []),
      ]);

      const nextPeople = [
        ...staff.map((item) => ({
          id: item.id,
          fullName: item.fullName,
          role: item.role || 'Teacher',
          source: 'Personel',
          detail: `${item.departmentOrBranch || item.campus || 'Birim yok'} • ${item.email || item.username || 'Hesap yok'}`,
        })),
        ...students.map((item) => ({
          id: item.id,
          fullName: item.fullName,
          role: 'Student',
          source: 'Öğrenci',
          detail: `${item.className || 'Sınıf yok'} • ${item.programType || 'Program yok'}`,
        })),
      ];

      const nextPolicies = {};
      (configs || []).forEach((item) => {
        try {
          const parsed = JSON.parse(item.payloadJson || '{}');
          nextPolicies[item.scopeKey] = {
            role: parsed.role || 'Student',
            modules: { ...createPolicy(parsed.role || 'Student').modules, ...(parsed.modules || {}) },
            actions: { ...createPolicy(parsed.role || 'Student').actions, ...(parsed.actions || {}) },
          };
        } catch {
          nextPolicies[item.scopeKey] = createPolicy('Student');
        }
      });

      setPeople(nextPeople);
      setPolicies(nextPolicies);
    } catch (err) {
      setError(err.message || 'Rol yönetimi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const grouped = useMemo(() => {
    return people.reduce((acc, item) => {
      const key = policies[item.id]?.role || item.role || 'Unassigned';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [people, policies]);

  const filteredPeople = useMemo(() => people.filter((item) => {
    const currentRole = policies[item.id]?.role || item.role;
    const matchesRole = !selectedRole || currentRole === selectedRole;
    const matchesSearch = `${item.fullName} ${item.source} ${item.detail || ''}`.toLowerCase().includes(search.toLowerCase());
    return matchesRole && matchesSearch;
  }), [people, policies, search, selectedRole]);

  const openPerson = (person) => {
    const current = policies[person.id] || createPolicy(person.role);
    setSelectedPerson(person);
    setDraftPolicy({
      role: current.role,
      modules: { ...current.modules },
      actions: { ...current.actions },
    });
  };

  const applyPreset = (role) => {
    setDraftPolicy(createPolicy(role));
  };

  const toggleModule = (key, checked) => {
    setDraftPolicy((prev) => ({
      ...prev,
      modules: {
        ...prev.modules,
        [key]: checked,
      },
    }));
  };

  const toggleAction = (key, checked) => {
    setDraftPolicy((prev) => ({
      ...prev,
      actions: {
        ...prev.actions,
        [key]: checked,
      },
    }));
  };

  const handleRoleChange = (role) => {
    setDraftPolicy((prev) => {
      const next = createPolicy(role);
      return {
        role,
        modules: { ...next.modules, ...(prev?.modules || {}) },
        actions: { ...next.actions, ...(prev?.actions || {}) },
      };
    });
  };

  const savePolicy = async () => {
    if (!selectedPerson || !draftPolicy) return;
    try {
      setSaving(true);
      await upsertPlatformConfiguration({
        configurationType: 'role-management',
        scopeKey: selectedPerson.id,
        displayName: `ROLE_MANAGEMENT::${selectedPerson.fullName}`,
        payloadJson: JSON.stringify(draftPolicy),
      });
      setPolicies((prev) => ({
        ...prev,
        [selectedPerson.id]: draftPolicy,
      }));
      toast({
        title: 'Yetki profili güncellendi',
        description: `${selectedPerson.fullName} için rol ve modül yetkileri kaydedildi.`,
      });
      setSelectedPerson(null);
      setDraftPolicy(null);
    } catch (err) {
      toast({
        title: 'Yetki profili kaydedilemedi',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-role-management-page">
      <div className="rounded-[28px] border border-border p-7 text-white shadow-xl" style={{ background: 'radial-gradient(circle at top left, var(--brand-a-400, rgba(129,140,248,0.18)), transparent 30%), linear-gradient(135deg, var(--brand-p-900, #0f172a) 0%, var(--brand-p-800, #14213d) 50%, var(--brand-p-700, #312e81) 100%)' }}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Badge className="border-white/20 bg-white/10 text-white">Yetki Tasarımı</Badge>
            <h1 className="mt-4 text-3xl font-bold font-heading">Rol Yönetimi</h1>
            <p className="mt-2 text-sm text-white/80">Kişi bazlı erişimi, modül haklarını ve işlem izinlerini daha kurumsal bir panel üzerinden yönetin.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3"><p className="text-xl font-bold">{people.length}</p><p className="text-xs uppercase tracking-[0.18em] text-white/70">Kişi</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3"><p className="text-xl font-bold">{Object.keys(grouped).length}</p><p className="text-xs uppercase tracking-[0.18em] text-white/70">Rol</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3"><p className="text-xl font-bold">{filteredPeople.length}</p><p className="text-xs uppercase tracking-[0.18em] text-white/70">Filtre</p></div>
          </div>
        </div>
      </div>
      {error ? <ErrorBanner title="Rol yönetimi alınamadı" message={error} onRetry={loadRoles} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {Object.entries(grouped).map(([role, count]) => {
          const meta = roleMeta(role);
          const Icon = meta.icon;
          const isActive = selectedRole === role;
          return (
            <button
              type="button"
              key={role}
              onClick={() => setSelectedRole(role)}
              className="text-left"
            >
              <Card className={`group overflow-hidden border ${meta.ring} bg-gradient-to-br ${meta.surface} shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${isActive ? 'ring-2 ring-brand-primary/40' : ''}`}>
                <CardContent className="p-0">
                  <div className={`h-2 bg-gradient-to-r ${meta.accent}`} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className={`rounded-2xl bg-gradient-to-br ${meta.accent} p-3 text-white shadow-lg`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge className={roleTone(role)}>{role}</Badge>
                    </div>
                    <div className="mt-5">
                      <p className="text-3xl font-bold tracking-tight text-foreground">{count}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{role} Profili</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{meta.copy}</p>
                    </div>
                    <div className="mt-5 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      <span>{isActive ? 'Aktif filtre' : 'Filtrele'}</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setSelectedRole('')}
          className="text-left"
        >
          <Card className={`group overflow-hidden border border-border bg-gradient-to-br from-muted/50 via-card to-muted shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${selectedRole === '' ? 'ring-2 ring-brand-primary/40' : ''}`}>
            <CardContent className="p-0">
              <div className="h-2 bg-gradient-to-r from-gray-700 via-gray-500 to-gray-400" />
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-2xl bg-brand-primary p-3 text-white shadow-lg">
                    <Users className="h-5 w-5" />
                  </div>
                  <Badge variant="outline">Tümü</Badge>
                </div>
                <div className="mt-5">
                  <p className="text-3xl font-bold tracking-tight text-foreground">{people.length}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">Tüm Kişiler</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Tüm rolleri tek görünümde aç ve filtreyi temizle.</p>
                </div>
                <div className="mt-5 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <span>{selectedRole === '' ? 'Genel görünüm' : 'Filtreyi kaldır'}</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle>{selectedRole ? `${selectedRole} Rolündeki Kayıtlar` : 'Kişi Bazlı Yetki Yönetimi'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Kişi, sınıf, birim veya kaynak ara..." />
            </div>
            <div className="space-y-3">
              {filteredPeople.map((item) => {
                const currentRole = policies[item.id]?.role || item.role;
                const currentPolicy = policies[item.id] || createPolicy(item.role);
                const enabledModules = Object.values(currentPolicy.modules).filter(Boolean).length;
                return (
                  <button
                    type="button"
                    key={item.id}
                    className="w-full rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-muted/50 hover:shadow-md"
                    onClick={() => openPerson(item)}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-medium">{item.fullName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.source} • {item.detail}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge className={roleTone(currentRole)}>{currentRole}</Badge>
                          <Badge variant="outline">{enabledModules} modül açık</Badge>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground lg:text-right">
                        <p>{currentPolicy.actions.canApprove ? 'Onay yetkisi var' : 'Onay yetkisi yok'}</p>
                        <p className="mt-1">{currentPolicy.actions.canAssignRoles ? 'Rol atayabilir' : 'Rol atayamaz'}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-brand-primary" />
              Yetki Özeti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ROLE_OPTIONS.map((role) => {
              const preset = ROLE_PRESETS[role];
              const modules = Object.values(preset.modules).filter(Boolean).length;
              const actions = Object.values(preset.actions).filter(Boolean).length;
              return (
                <div key={role} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <Badge className={roleTone(role)}>{role}</Badge>
                    <Shield className="h-4 w-4 text-brand-primary" />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{modules} modül, {actions} işlem yetkisi</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedPerson} onOpenChange={(open) => !open && (setSelectedPerson(null), setDraftPolicy(null))}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-5xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{selectedPerson?.fullName || 'Yetki profili'}</DialogTitle>
            <DialogDescription>Kullanıcının hangi modülleri ve hangi işlemleri kullanabileceğini burada tanımlayın.</DialogDescription>
          </DialogHeader>
          {selectedPerson && draftPolicy ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Kaynak</p>
                    <p className="mt-1 font-semibold flex items-center gap-2">
                      {selectedPerson.source === 'Öğrenci' ? <GraduationCap className="h-4 w-4 text-brand-primary" /> : <BriefcaseBusiness className="h-4 w-4 text-brand-primary" />}
                      {selectedPerson.source}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Aktif Rol</p>
                    <p className="mt-1 font-semibold">{draftPolicy.role}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Modül Sayısı</p>
                    <p className="mt-1 font-semibold">{Object.values(draftPolicy.modules).filter(Boolean).length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">İşlem Yetkisi</p>
                    <p className="mt-1 font-semibold">{Object.values(draftPolicy.actions).filter(Boolean).length}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ['Rol Profili', draftPolicy.role, ShieldCheck],
                  ['Açık Modül', `${Object.values(draftPolicy.modules).filter(Boolean).length} adet`, Workflow],
                  ['Yetki Seviyesi', `${Object.values(draftPolicy.actions).filter(Boolean).length} işlem`, Sparkles],
                ].map(([label, value, Icon]) => (
                  <Card key={label}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-muted-foreground">{label}</p>
                          <p className="mt-1 font-semibold">{value}</p>
                        </div>
                        <Icon className="h-4 w-4 text-brand-primary" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-brand-primary" />
                      Rol ve Preset
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Select value={draftPolicy.role} onValueChange={handleRoleChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((role) => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2">
                      {ROLE_OPTIONS.map((role) => (
                        <Button key={role} type="button" variant="outline" size="sm" onClick={() => applyPreset(role)}>
                          {role} Preseti
                        </Button>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Preset seçimi modül ve işlem yetkilerini hızlıca doldurur. İstersen sonra tek tek özelleştirebilirsin.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">İşlem Yetkileri</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {ACTION_FLAGS.map((item) => (
                      <div key={item.key} className="flex items-center justify-between gap-4 rounded-xl border p-3">
                        <div>
                          <p className="text-sm font-medium sm:text-base">{item.label}</p>
                        </div>
                        <Switch checked={Boolean(draftPolicy.actions[item.key])} onCheckedChange={(checked) => toggleAction(item.key, checked)} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                {MODULE_GROUPS.map((group) => (
                  <Card key={group.title}>
                    <CardHeader>
                      <CardTitle className="text-base">{group.title} Modülleri</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                      {group.items.map((item) => (
                        <label key={item.key} className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer hover:bg-muted/20">
                          <Checkbox
                            checked={Boolean(draftPolicy.modules[item.key])}
                            onCheckedChange={(checked) => toggleModule(item.key, Boolean(checked))}
                          />
                          <span className="text-sm font-medium leading-5">{item.label}</span>
                        </label>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => selectedPerson && applyPreset(selectedPerson.role || 'Student')}>
              Varsayılan Role Dön
            </Button>
            <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={savePolicy} disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Yetkileri Kaydet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
