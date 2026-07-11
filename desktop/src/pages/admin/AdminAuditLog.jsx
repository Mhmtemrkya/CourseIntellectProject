import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, ChevronLeft, ChevronRight, ScrollText, Search, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAuditBranchSummary, fetchAuditLogsPaged, fetchOrgUnits } from '../../lib/api/modules';

const CATEGORIES = ['', 'Approval', 'HR', 'Document', 'Task', 'Admin', 'Account', 'Permission', 'Registration', 'Finance', 'OrgUnit'];
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

export default function AdminAuditLog() {
  const [page, setPage] = useState({ items: [], totalCount: 0 });
  const [branchSummary, setBranchSummary] = useState([]);
  const [orgUnits, setOrgUnits] = useState([]);
  const [category, setCategory] = useState('');
  const [branchId, setBranchId] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = { skip: pageIndex * PAGE_SIZE, take: PAGE_SIZE };
      if (category) params.category = category;
      if (branchId) params.branchId = branchId;
      if (appliedSearch) params.search = appliedSearch;
      const [result, summary] = await Promise.all([
        fetchAuditLogsPaged(params),
        fetchAuditBranchSummary().catch(() => []),
      ]);
      setPage(result);
      setBranchSummary(summary);
    } catch (err) {
      setError(err.message || 'Denetim kayıtları alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [category, branchId, appliedSearch, pageIndex]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetchOrgUnits().then(setOrgUnits).catch(() => setOrgUnits([]));
  }, []);

  // Arama kutusu: yazma bittikten kısa süre sonra sunucu araması tetiklenir.
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search.trim());
      setPageIndex(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const branches = useMemo(() => orgUnits, [orgUnits]);

  const totalPages = Math.max(1, Math.ceil((page.totalCount || 0) / PAGE_SIZE));
  const showBranchBadge = branchSummary.length > 1 || Boolean(branchId);

  if (loading && page.items.length === 0) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-audit-log-page">
      <div data-tour="audit-header">
        <h1 className="text-3xl font-bold font-heading flex items-center gap-2"><ScrollText className="h-7 w-7 text-brand-primary" />Denetim Kayıtları</h1>
        <p className="text-muted-foreground mt-1">Kim, ne zaman, hangi işlemi yaptı — hesap, yetki, kayıt, finans ve idari işlemler şube şube izlenir (KVKK/uyum).</p>
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

      <div className="flex flex-wrap items-center gap-3" data-tour="audit-filters">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Kayıt ara (kişi, işlem, detay)..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
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
      </div>

      <Card data-tour="audit-list">
        <CardContent className="p-0 divide-y">
          {page.items.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Kayıt bulunamadı.</p>
            : page.items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-4">
                <div className="mt-0.5 rounded-lg bg-brand-primary/10 p-2 text-brand-primary"><ShieldCheck className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{item.action}</span>
                    <Badge variant="outline">{CATEGORY_LABEL[item.category] || item.category}</Badge>
                    {showBranchBadge && item.branchName ? (
                      <Badge variant="outline" className="text-brand-primary border-brand-primary/40">{item.branchName}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.actorName} • {new Date(item.createdAtUtc).toLocaleString('tr-TR')}</p>
                </div>
              </div>
            ))}
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
