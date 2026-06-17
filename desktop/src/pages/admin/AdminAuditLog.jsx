import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, Search, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAuditLogs } from '../../lib/api/modules';

const CATEGORIES = ['', 'Approval', 'HR', 'Document', 'Task', 'Admin'];
const CATEGORY_LABEL = {
  Approval: 'Onay', HR: 'Personel', Document: 'Evrak', Task: 'Görev', Admin: 'İdari',
};

export default function AdminAuditLog() {
  const [logs, setLogs] = useState([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setLogs(await fetchAuditLogs(category ? { category } : undefined));
    } catch (err) {
      setError(err.message || 'Denetim kayıtları alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => [l.actorName, l.action, l.detail, l.entityType].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [logs, search]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-audit-log-page">
      <div>
        <h1 className="text-3xl font-bold font-heading flex items-center gap-2"><ScrollText className="h-7 w-7 text-brand-primary" />Denetim Kayıtları</h1>
        <p className="text-muted-foreground mt-1">Kim, ne zaman, hangi işlemi yaptı — onay, personel, evrak ve görev işlemleri merkezi olarak izlenir (KVKK/uyum).</p>
      </div>
      {error ? <ErrorBanner title="Kayıtlar alınamadı" message={error} onRetry={load} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Kayıt ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c || 'all'} value={c}>{c ? (CATEGORY_LABEL[c] || c) : 'Tüm kategoriler'}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {filtered.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Kayıt bulunamadı.</p>
            : filtered.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-4">
                <div className="mt-0.5 rounded-lg bg-brand-primary/10 p-2 text-brand-primary"><ShieldCheck className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{item.action}</span>
                    <Badge variant="outline">{CATEGORY_LABEL[item.category] || item.category}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.actorName} • {new Date(item.createdAtUtc).toLocaleString('tr-TR')}</p>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
