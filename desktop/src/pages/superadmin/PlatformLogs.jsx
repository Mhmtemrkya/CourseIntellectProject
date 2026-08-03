import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, ChevronLeft, ChevronRight, GitBranch, ScrollText, Search, ShieldCheck,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { formatDate, formatDateTime } from '../../lib/format';
import {
  fetchPlatformAuditLogs,
  fetchPlatformAuditOverview,
  fetchPlatformAuditTenantBranches,
} from '../../lib/api/modules';

const CATEGORY_LABEL = {
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
};

const PAGE_SIZE = 50;

// Geliştirici denetim merkezi: tüm kurumların logları kurum kurum,
// kurum seçilince şube şube incelenir.
export default function PlatformLogs() {
  const [overview, setOverview] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [page, setPage] = useState({ items: [], totalCount: 0 });
  const [pageIndex, setPageIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState('');

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setOverview(await fetchPlatformAuditOverview());
    } catch (err) {
      setError(err.message || 'Platform denetim özeti alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search.trim());
      setPageIndex(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Seçili kurumun şube dağılımı.
  useEffect(() => {
    if (!selectedTenant?.tenantId) {
      setBranches([]);
      return;
    }
    fetchPlatformAuditTenantBranches(selectedTenant.tenantId)
      .then(setBranches)
      .catch(() => setBranches([]));
  }, [selectedTenant]);

  // Log listesi: kurum ve/veya şube seçimine göre.
  const loadLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      const params = { skip: pageIndex * PAGE_SIZE, take: PAGE_SIZE };
      if (selectedTenant?.tenantId) params.tenantId = selectedTenant.tenantId;
      if (selectedBranch?.branchId) params.branchId = selectedBranch.branchId;
      if (appliedSearch) params.search = appliedSearch;
      setPage(await fetchPlatformAuditLogs(params));
    } catch (err) {
      setError(err.message || 'Loglar alınamadı.');
    } finally {
      setLogsLoading(false);
    }
  }, [selectedTenant, selectedBranch, appliedSearch, pageIndex]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const totalPages = Math.max(1, Math.ceil((page.totalCount || 0) / PAGE_SIZE));

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="platform-logs-page">
      <div>
        <h1 className="text-3xl font-bold font-heading flex items-center gap-2">
          <ScrollText className="h-7 w-7 text-brand-primary" />Platform Log Merkezi
        </h1>
        <p className="text-muted-foreground mt-1">
          Tüm kurumların denetim kayıtları kurum kurum, şube şube izlenir. Bir kuruma tıklayın; şubeleri ve detaylı logları açılır.
        </p>
      </div>
      {error ? <ErrorBanner title="Hata" message={error} onRetry={loadOverview} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => { setSelectedTenant(null); setSelectedBranch(null); setPageIndex(0); }}
          className={`rounded-xl border p-4 text-left transition hover:border-brand-primary/60 ${!selectedTenant ? 'border-brand-primary bg-brand-primary/5' : ''}`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-brand-primary" /> Tüm Platform
          </div>
          <p className="mt-2 text-2xl font-bold">{overview.reduce((sum, item) => sum + (item.totalCount || 0), 0)}</p>
          <p className="text-xs text-muted-foreground">Toplam kayıt</p>
        </button>
        {overview.map((tenant) => (
          <button
            key={tenant.tenantId || 'platform'}
            type="button"
            onClick={() => {
              setSelectedTenant(tenant);
              setSelectedBranch(null);
              setPageIndex(0);
            }}
            className={`rounded-xl border p-4 text-left transition hover:border-brand-primary/60 ${selectedTenant?.tenantId === tenant.tenantId ? 'border-brand-primary bg-brand-primary/5' : ''}`}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="h-4 w-4 text-brand-primary" />
              <span className="truncate">{tenant.tenantName}</span>
            </div>
            <p className="mt-2 text-2xl font-bold">{tenant.totalCount}</p>
            <p className="text-xs text-muted-foreground">
              Son 7 gün: {tenant.last7DaysCount} • Son işlem: {tenant.lastActivityUtc ? formatDate(tenant.lastActivityUtc) : '—'}
            </p>
          </button>
        ))}
      </div>

      {selectedTenant && branches.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={!selectedBranch ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setSelectedBranch(null); setPageIndex(0); }}
          >
            <GitBranch className="h-4 w-4 mr-1" /> Tüm şubeler
          </Button>
          {branches.map((branch) => (
            <Button
              key={branch.branchId || 'general'}
              variant={selectedBranch?.branchId === branch.branchId ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setSelectedBranch(branch); setPageIndex(0); }}
            >
              {branch.branchName} ({branch.totalCount})
            </Button>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Log ara (kişi, işlem, detay)..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {logsLoading && page.items.length === 0 ? (
            <div className="p-8 flex justify-center"><LoadingDots /></div>
          ) : page.items.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : page.items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 p-4">
              <div className="mt-0.5 rounded-lg bg-brand-primary/10 p-2 text-brand-primary"><ShieldCheck className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{item.action}</span>
                  <Badge variant="outline">{CATEGORY_LABEL[item.category] || item.category}</Badge>
                  <Badge variant="outline" className="text-brand-primary border-brand-primary/40">{item.tenantName}</Badge>
                  {item.branchName ? <Badge variant="outline">{item.branchName}</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.actorName} • {formatDateTime(item.createdAtUtc)}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Toplam {page.totalCount} kayıt • Sayfa {pageIndex + 1}/{totalPages}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={pageIndex === 0 || logsLoading} onClick={() => setPageIndex((i) => Math.max(0, i - 1))}>
            <ChevronLeft className="h-4 w-4" /> Önceki
          </Button>
          <Button variant="outline" size="sm" disabled={pageIndex + 1 >= totalPages || logsLoading} onClick={() => setPageIndex((i) => i + 1)}>
            Sonraki <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
