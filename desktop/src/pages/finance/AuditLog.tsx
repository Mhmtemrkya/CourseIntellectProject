import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { History, Search, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAccountingDashboard } from '../../lib/api/modules';
import { formatDateTime } from '../../lib/format';
import { errorMessage } from '../../lib/errors';
import type { AccountingAuditLogDto } from '../../types/api/generated';

const ALL = '__all__';

/**
 * Muhasebe kayıt geçmişi: sunucuda her finans işleminde yazılan kayıtlar (kim,
 * ne zaman, ne yaptı). Zaman sunucunun gerçek damgasıdır; işlemi yapan personel
 * oturumdan damgalanır. Bu alanlar eklenmeden önceki eski kayıtlarda yalnız
 * kayıt anındaki zaman metni bulunur ve kişi bilinmez.
 */
export default function AuditLog() {
  const [logs, setLogs] = useState<AccountingAuditLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actor, setActor] = useState(ALL);
  const [search, setSearch] = useState('');

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const dashboard = await fetchAccountingDashboard();
      setLogs(dashboard?.auditLogs || []);
    } catch (err) {
      setError(errorMessage(err, 'Kayıt geçmişi alınamadı.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadLogs(); }, [loadLogs]);

  const actors = useMemo(
    () => Array.from(new Set(logs.map((item) => item.actorName || '').filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr')),
    [logs],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('tr');
    return logs.filter((item) => {
      if (actor !== ALL && (item.actorName || '') !== actor) return false;
      if (!query) return true;
      return `${item.title} ${item.detail} ${item.actorName || ''}`.toLocaleLowerCase('tr').includes(query);
    });
  }, [actor, logs, search]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="finance-audit-log-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Kayıt Geçmişi</h1>
        <p className="text-muted-foreground mt-1">Finans işlemlerinin kim tarafından, ne zaman yapıldığı</p>
      </div>
      {error ? <ErrorBanner title="Kayıt geçmişi alınamadı" message={error} onRetry={loadLogs} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['Toplam kayıt', logs.length],
          ['Gösterilen', filtered.length],
          ['İşlem yapan personel', actors.length],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-10" placeholder="İşlem veya açıklama ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="h-10 min-w-[220px] rounded-md border bg-background px-3 text-sm" value={actor} onChange={(e) => setActor(e.target.value)} aria-label="İşlem yapan">
          <option value={ALL}>Tüm personel</option>
          {actors.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-brand-primary" />İşlem Zaman Çizgisi</CardTitle>
          <CardDescription>En yeni kayıt en üstte</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : filtered.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-2xl border p-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
              </div>
              <div className="flex shrink-0 flex-col items-start gap-1 text-xs text-muted-foreground lg:items-end">
                <span>{item.createdAtUtc ? formatDateTime(item.createdAtUtc) : item.time || '—'}</span>
                {item.actorName ? (
                  <Badge variant="outline" className="gap-1"><User className="h-3 w-3" />{item.actorName}</Badge>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
