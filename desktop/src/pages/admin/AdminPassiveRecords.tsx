import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { UserX, Search, RotateCcw, Users } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { fetchPassiveAccounts, updateUserStatus } from '../../lib/api/modules';

// Backend rol adı → Türkçe etiket. Pasif kayıtlar bu gruplara ayrılır.
const ROLE_LABELS = {
  Student: 'Öğrenci',
  Teacher: 'Öğretmen',
  Parent: 'Veli',
  Administrative: 'İdari Personel',
  Accounting: 'Muhasebe',
  Cafeteria: 'Yemekhane',
  BranchManager: 'Şube Müdürü',
  Admin: 'Yönetici',
  Developer: 'Geliştirici',
};

const roleLabel = (role) => ROLE_LABELS[role] || role || 'Diğer';

export default function AdminPassiveRecords() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [busyUser, setBusyUser] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setAccounts(await fetchPassiveAccounts());
    } catch (err) {
      setError(err.message || 'Pasif kayıtlar alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const roles = useMemo(() => {
    const set = new Set(accounts.map((a) => a.primaryRole));
    return ['all', ...Array.from(set)];
  }, [accounts]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (roleFilter !== 'all' && a.primaryRole !== roleFilter) return false;
      if (!term) return true;
      return `${a.fullName} ${a.username} ${a.detail}`.toLowerCase().includes(term);
    });
  }, [accounts, search, roleFilter]);

  const reactivate = async (account) => {
    setBusyUser(account.username);
    try {
      await updateUserStatus(account.username, 'Active');
      setAccounts((prev) => prev.filter((a) => a.userId !== account.userId));
      toast({ title: 'Yeniden aktifleştirildi', description: `${account.fullName} artık aktif; ilgili listelerde tekrar görünür.` });
    } catch (err) {
      toast({ title: 'Aktifleştirilemedi', description: err.message, variant: 'destructive' });
    } finally {
      setBusyUser(null);
    }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 p-2 text-white">
          <UserX className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Pasif Kayıtlar</h1>
          <p className="text-sm text-muted-foreground">
            Pasife alınan tüm öğrenci, öğretmen, personel ve veliler yalnız burada görünür. Aktifleştirilene kadar diğer hiçbir listede/seçimde çıkmazlar.
          </p>
        </div>
      </div>

      {error ? <ErrorBanner title="Pasif kayıtlar alınamadı" message={error} onRetry={load} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="İsim / kullanıcı adı ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {roles.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setRoleFilter(role)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              roleFilter === role ? 'border-brand-primary bg-brand-primary text-white' : 'border-foreground/15 text-muted-foreground hover:bg-foreground/5'
            }`}
          >
            {role === 'all' ? 'Tümü' : roleLabel(role)}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center text-muted-foreground">
              <Users className="h-8 w-8" />
              <p className="font-semibold">Pasif kayıt yok</p>
              <p className="text-sm">Bu filtrede pasife alınmış hesap bulunmuyor.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((account) => (
                <div key={account.userId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-500/15 text-sm font-black text-slate-600">
                      {account.fullName?.split(' ').map((n) => n[0]).slice(0, 2).join('') || '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="truncate">{account.fullName}</b>
                        <Badge variant="outline">{roleLabel(account.primaryRole)}</Badge>
                        {account.detail ? <span className="rounded bg-foreground/10 px-1.5 text-[11px] font-semibold text-muted-foreground">{account.detail}</span> : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{account.username}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => reactivate(account)} disabled={busyUser === account.username}>
                    <RotateCcw className="mr-1.5 h-4 w-4" />
                    {busyUser === account.username ? 'Aktifleştiriliyor…' : 'Aktifleştir'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
