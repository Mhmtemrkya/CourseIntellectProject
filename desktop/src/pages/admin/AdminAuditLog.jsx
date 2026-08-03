import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, ChevronLeft, ChevronRight, Globe, LogIn, Monitor, ScrollText, Search, ShieldAlert, ShieldCheck, Smartphone, UserCog, X,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAuditBranchSummary, fetchAuditLogsPaged, fetchOrgUnits } from '../../lib/api/modules';
import { formatDateTime } from '../../lib/format';

const CATEGORIES = ['', 'Login', 'Approval', 'HR', 'Document', 'Task', 'Admin', 'Account', 'Permission', 'Registration', 'Finance', 'OrgUnit', 'DrivingSchool'];
const CATEGORY_LABEL = {
  Login: 'Giriş',
  Approval: 'Onay',
  HR: 'Personel',
  Document: 'Evrak',
  Task: 'Görev',
  Admin: 'İdari',
  Account: 'Hesap',
  Permission: 'Yetki',
  Registration: 'Kayıt',
  Finance: 'Finans',
  OrgUnit: 'Birim/Şube',
  DrivingSchool: 'Sürücü Kursu',
};

// Kaynak filtresi: kayıt geçmişi iki tabloyu birleştirir.
const SOURCES = [
  { value: 'All', label: 'Tüm hareketler' },
  { value: 'Action', label: 'Yalnız işlemler' },
  { value: 'Login', label: 'Yalnız girişler' },
];

const ROLE_LABEL = {
  Admin: 'Kurum Yöneticisi',
  Developer: 'Geliştirici',
  BranchManager: 'Şube Müdürü',
  Administrative: 'İdari Personel',
  Accounting: 'Muhasebe',
  Teacher: 'Öğretmen',
  Student: 'Öğrenci',
  Parent: 'Veli',
};

const PAGE_SIZE = 50;

// Tarih ön ayarları. `days: null` = sınır yok. Gün sayısı bugünün başlangıcından
// geriye sayılır ki "son 7 gün" saat farkıyla kayan bir pencere olmasın.
const DATE_PRESETS = [
  { value: 'all', label: 'Tüm zamanlar', days: null },
  { value: 'today', label: 'Bugün', days: 0 },
  { value: '7', label: 'Son 7 gün', days: 7 },
  { value: '30', label: 'Son 30 gün', days: 30 },
  { value: '90', label: 'Son 90 gün', days: 90 },
  { value: 'custom', label: 'Özel aralık', days: null },
];

/** Ön ayardan ISO tarih sınırları üretir; özel aralıkta kullanıcının girdiği günler kullanılır. */
function resolveDateRange(preset, customFrom, customTo) {
  if (preset === 'custom') {
    return {
      fromUtc: customFrom ? new Date(`${customFrom}T00:00:00`).toISOString() : undefined,
      // Bitiş günü dahil olmalı: gün sonuna kadar al.
      toUtc: customTo ? new Date(`${customTo}T23:59:59.999`).toISOString() : undefined,
    };
  }
  const found = DATE_PRESETS.find((p) => p.value === preset);
  if (!found || found.days === null) return {};
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (found.days > 0) start.setDate(start.getDate() - found.days);
  return { fromUtc: start.toISOString() };
}

/**
 * User-Agent'tan okunabilir cihaz adı çıkarır. Tam bir tarayıcı veritabanı değil —
 * amaç "hangi cihazdan" sorusuna tek bakışta cevap vermek. Tanınmayan istemcide
 * ham metin kısaltılarak gösterilir ki bilgi kaybolmasın.
 */
export function describeDevice(userAgent) {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();

  // Masaüstü uygulaması (Tauri) tarayıcıdan önce yakalanmalı: WebView UA'sı
  // Chrome/Safari gibi görünür ve yanlış sınıflanır.
  const isDesktopApp = ua.includes('tauri') || ua.includes('courseintellect') || ua.includes('schoolasist');

  let platform = 'Bilinmeyen cihaz';
  if (ua.includes('android')) platform = 'Android';
  else if (/iphone|ipad|ipod/.test(ua)) platform = ua.includes('ipad') ? 'iPad' : 'iPhone';
  else if (ua.includes('windows')) platform = 'Windows';
  else if (ua.includes('mac os') || ua.includes('macintosh')) platform = 'macOS';
  else if (ua.includes('linux')) platform = 'Linux';

  let client = null;
  if (isDesktopApp) client = 'Masaüstü uygulaması';
  else if (ua.includes('edg/')) client = 'Edge';
  else if (ua.includes('opr/') || ua.includes('opera')) client = 'Opera';
  else if (ua.includes('chrome') && !ua.includes('chromium')) client = 'Chrome';
  else if (ua.includes('firefox')) client = 'Firefox';
  else if (ua.includes('safari')) client = 'Safari';
  else if (ua.includes('dart') || ua.includes('flutter')) client = 'Mobil uygulama';

  const mobile = /android|iphone|ipad|ipod/.test(ua);
  if (platform === 'Bilinmeyen cihaz' && !client) {
    return { label: userAgent.slice(0, 40), mobile: false };
  }
  return { label: client ? `${platform} · ${client}` : platform, mobile };
}

const roleLabel = (role) => {
  if (!role) return null;
  // Birden çok rol virgülle gelir.
  return role.split(',').map((r) => ROLE_LABEL[r.trim()] || r.trim()).join(', ');
};

/// Bir kaydın alt satırındaki bağlam rozetleri: rol, IP, cihaz.
function ContextChips({ item }) {
  const device = describeDevice(item.userAgent);
  const role = roleLabel(item.actorRole);
  if (!role && !item.ipAddress && !device) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {role ? (
        <span className="inline-flex items-center gap-1">
          <UserCog className="h-3.5 w-3.5" />{role}
        </span>
      ) : null}
      {item.ipAddress ? (
        <span className="inline-flex items-center gap-1 font-mono">
          <Globe className="h-3.5 w-3.5" />{item.ipAddress}
        </span>
      ) : null}
      {device ? (
        <span className="inline-flex items-center gap-1" title={item.userAgent}>
          {device.mobile ? <Smartphone className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
          {device.label}
        </span>
      ) : null}
    </div>
  );
}

export default function AdminAuditLog() {
  const [page, setPage] = useState({ items: [], totalCount: 0 });
  const [branchSummary, setBranchSummary] = useState([]);
  const [orgUnits, setOrgUnits] = useState([]);
  const [category, setCategory] = useState('');
  const [branchId, setBranchId] = useState('');
  const [source, setSource] = useState('All');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [actor, setActor] = useState('');
  const [appliedActor, setAppliedActor] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [onlyFailedLogins, setOnlyFailedLogins] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = { skip: pageIndex * PAGE_SIZE, take: PAGE_SIZE, source };
      if (category) params.category = category;
      if (branchId) params.branchId = branchId;
      if (appliedSearch) params.search = appliedSearch;
      if (appliedActor) params.actor = appliedActor;
      if (onlyFailedLogins) params.onlyFailedLogins = true;
      const { fromUtc, toUtc } = resolveDateRange(datePreset, customFrom, customTo);
      if (fromUtc) params.fromUtc = fromUtc;
      if (toUtc) params.toUtc = toUtc;
      const [result, summary] = await Promise.all([
        fetchAuditLogsPaged(params),
        fetchAuditBranchSummary().catch(() => []),
      ]);
      setPage(result);
      setBranchSummary(summary);
    } catch (err) {
      setError(err.message || 'Kayıt geçmişi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [category, branchId, source, appliedSearch, appliedActor, onlyFailedLogins, datePreset, customFrom, customTo, pageIndex]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetchOrgUnits().then(setOrgUnits).catch(() => setOrgUnits([]));
  }, []);

  // Arama ve kişi kutuları: yazma bittikten kısa süre sonra sunucu sorgusu tetiklenir.
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search.trim());
      setPageIndex(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedActor(actor.trim());
      setPageIndex(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [actor]);

  // Filtre sayacı: kaç tanesinin açık olduğunu göstermek "neden az kayıt var?"
  // sorusunu peşinen cevaplıyor.
  const activeFilterCount = [
    category, branchId, appliedSearch, appliedActor,
    source !== 'All' ? source : '',
    datePreset !== 'all' ? datePreset : '',
    onlyFailedLogins ? 'failed' : '',
  ].filter(Boolean).length;

  const resetFilters = () => {
    setCategory('');
    setBranchId('');
    setSource('All');
    setSearch('');
    setAppliedSearch('');
    setActor('');
    setAppliedActor('');
    setDatePreset('all');
    setCustomFrom('');
    setCustomTo('');
    setOnlyFailedLogins(false);
    setPageIndex(0);
  };

  const branches = useMemo(() => orgUnits, [orgUnits]);

  const totalPages = Math.max(1, Math.ceil((page.totalCount || 0) / PAGE_SIZE));
  const showBranchBadge = branchSummary.length > 1 || Boolean(branchId);
  // Giriş kayıtlarında şube bilgisi yok; şube seçilince listeden çıkarlar.
  const branchHidesLogins = Boolean(branchId) && source !== 'Action';

  if (loading && page.items.length === 0) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-audit-log-page">
      <div data-tour="audit-header">
        <h1 className="text-3xl font-bold font-heading flex items-center gap-2"><ScrollText className="h-7 w-7 text-brand-primary" />Kayıt Geçmişi</h1>
        <p className="text-muted-foreground mt-1">Kim, ne zaman, hangi rolle, hangi cihaz ve IP adresinden ne yaptı — giriş denemeleri ve idari işlemler tek zaman çizelgesinde (KVKK/uyum).</p>
      </div>
      {error ? <ErrorBanner title="Kayıtlar alınamadı" message={error} onRetry={load} /> : null}

      {branchSummary.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-tour="audit-branch-summary">
          {branchSummary.map((item) => (
            <button
              key={item.branchId || 'all'}
              type="button"
              onClick={() => { setBranchId(item.branchId || ''); setPageIndex(0); }}
              className={`rounded-xl border p-4 text-left transition hover:border-brand-primary/60 ${branchId === (item.branchId || '') && item.branchId ? 'border-brand-primary bg-brand-primary/5' : ''}`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="h-4 w-4 text-brand-primary" />
                <span className="truncate">{item.branchName}</span>
              </div>
              <p className="mt-2 text-2xl font-bold">{item.totalCount}</p>
              <p className="text-xs text-muted-foreground">Son 7 gün: {item.last7DaysCount} kayıt</p>
            </button>
          ))}
        </div>
      ) : null}

      <div className="space-y-3 rounded-xl border p-3" data-tour="audit-filters">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Kayıt ara (işlem, IP, detay)..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="relative min-w-[190px]">
            <UserCog className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Kişi (ad veya e-posta)" value={actor} onChange={(e) => setActor(e.target.value)} />
          </div>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={source}
            onChange={(e) => { setSource(e.target.value); setPageIndex(0); }}
          >
            {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={datePreset}
            onChange={(e) => { setDatePreset(e.target.value); setPageIndex(0); }}
          >
            {DATE_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {datePreset === 'custom' ? (
            <>
              <Input
                type="date"
                className="h-10 w-[160px]"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => { setCustomFrom(e.target.value); setPageIndex(0); }}
              />
              <span className="text-sm text-muted-foreground">—</span>
              <Input
                type="date"
                className="h-10 w-[160px]"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => { setCustomTo(e.target.value); setPageIndex(0); }}
              />
            </>
          ) : null}
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPageIndex(0); }}
          >
            {CATEGORIES.map((c) => <option key={c || 'all'} value={c}>{c ? (CATEGORY_LABEL[c] || c) : 'Tüm kategoriler'}</option>)}
          </select>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={branchId}
            onChange={(e) => { setBranchId(e.target.value); setPageIndex(0); }}
          >
            <option value="">Tüm şubeler</option>
            {branches.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-red-600"
              checked={onlyFailedLogins}
              onChange={(e) => { setOnlyFailedLogins(e.target.checked); setPageIndex(0); }}
            />
            Yalnız başarısız girişler
          </label>
          {activeFilterCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="ml-auto">
              <X className="mr-1 h-4 w-4" />
              Filtreleri temizle ({activeFilterCount})
            </Button>
          ) : null}
        </div>
      </div>

      {branchHidesLogins ? (
        <p className="text-xs text-muted-foreground">
          Giriş kayıtları şubeye bağlı tutulmadığı için şube seçiliyken listelenmez.
        </p>
      ) : null}
      {onlyFailedLogins ? (
        <p className="text-xs text-muted-foreground">
          Başarısız giriş filtresi açıkken idari işlemler listelenmez — bir işlemin başarısızlık durumu tutulmaz.
        </p>
      ) : null}

      <Card data-tour="audit-list">
        <CardContent className="p-0 divide-y">
          {page.items.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Kayıt bulunamadı.</p>
            : page.items.map((item) => {
              const isLogin = item.source === 'Login';
              const failed = isLogin && item.success === false;
              return (
                <div key={`${item.source}-${item.id}`} className="flex items-start gap-3 p-4">
                  <div className={`mt-0.5 rounded-lg p-2 ${
                    failed ? 'bg-red-500/10 text-red-600'
                      : isLogin ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-brand-primary/10 text-brand-primary'
                  }`}
                  >
                    {failed ? <ShieldAlert className="h-4 w-4" /> : isLogin ? <LogIn className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{item.action}</span>
                      <Badge variant="outline">{CATEGORY_LABEL[item.category] || item.category}</Badge>
                      {failed ? <Badge variant="outline" className="border-red-500/40 text-red-600">Başarısız</Badge> : null}
                      {showBranchBadge && item.branchName ? (
                        <Badge variant="outline" className="text-brand-primary border-brand-primary/40">{item.branchName}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                    <ContextChips item={item} />
                    <p className="mt-1 text-xs text-muted-foreground">{item.actorName} • {formatDateTime(item.createdAtUtc)}</p>
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Toplam {page.totalCount} kayıt • Sayfa {pageIndex + 1}/{totalPages}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={pageIndex === 0 || loading} onClick={() => setPageIndex((i) => Math.max(0, i - 1))}>
            <ChevronLeft className="h-4 w-4" /> Önceki
          </Button>
          <Button variant="outline" size="sm" disabled={pageIndex + 1 >= totalPages || loading} onClick={() => setPageIndex((i) => i + 1)}>
            Sonraki <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
