import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock3,
  Copy,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  TimerReset,
  XCircle,
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  fetchPasswordResetRequests,
  reviewPasswordResetRequest,
} from '../../lib/api/modules';

const filters = [
  { value: 'Pending', label: 'Bekleyen' },
  { value: 'Approved', label: 'Onaylanan' },
  { value: 'Rejected', label: 'Reddedilen' },
  { value: 'Used', label: 'Tamamlanan' },
  { value: 'Expired', label: 'Süresi Dolan' },
  { value: 'All', label: 'Tümü' },
];

const statusLabels = {
  Pending: 'Bekliyor',
  Approved: 'Geçici Şifre Verildi',
  Rejected: 'Reddedildi',
  Used: 'Şifre Yenilendi',
  Expired: 'Süresi Doldu',
};

const statusStyles = {
  Pending: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  Approved: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300',
  Rejected: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300',
  Used: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  Expired: 'border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300',
};

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function PasswordResetRequests() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('Pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState('approve');
  const [note, setNote] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [approvalResult, setApprovalResult] = useState(null);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const records = await fetchPasswordResetRequests(status);
      setItems(records);
    } catch (err) {
      setError(err?.message || 'Şifre talepleri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const stats = useMemo(() => ({
    total: items.length,
    pending: items.filter((item) => item.status === 'Pending').length,
    approved: items.filter((item) => item.status === 'Approved').length,
    done: items.filter((item) => item.status === 'Used').length,
  }), [items]);

  const openDecision = (item, nextDecision) => {
    setSelected(item);
    setDecision(nextDecision);
    setNote('');
    setApprovalResult(null);
  };

  const submitDecision = async () => {
    if (!selected) return;
    try {
      setReviewing(true);
      const result = await reviewPasswordResetRequest(selected.id, {
        approved: decision === 'approve',
        note,
      });
      setApprovalResult(result);
      toast({
        title: decision === 'approve' ? 'Geçici şifre oluşturuldu' : 'Talep reddedildi',
        description: result?.message,
      });
      await loadRequests();
      if (decision !== 'approve') {
        setSelected(null);
      }
    } catch (err) {
      toast({
        title: 'İşlem yapılamadı',
        description: err?.message || 'Lütfen tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setReviewing(false);
    }
  };

  const copyTemporaryPassword = async () => {
    if (!approvalResult?.temporaryPassword) return;
    await navigator.clipboard?.writeText(approvalResult.temporaryPassword);
    toast({ title: 'Geçici şifre kopyalandı' });
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="password-reset-requests-page">
      <div className="overflow-hidden rounded-[28px] border border-border bg-slate-950 p-7 text-white shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Badge className="border-white/20 bg-white/10 text-white">
              <KeyRound className="mr-1 h-3.5 w-3.5" />
              Güvenli Şifre Akışı
            </Badge>
            <h1 className="mt-4 text-3xl font-bold font-heading">Şifre Sıfırlama Talepleri</h1>
            <p className="mt-2 text-sm text-white/75">
              Kullanıcı talep oluşturur, kurum yöneticisi veya idareci onaylar; sistem tek kullanımlık geçici şifre üretir.
            </p>
          </div>
          <Button variant="secondary" onClick={loadRequests}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Yenile
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner title="Talepler alınamadı" message={error} onRetry={loadRequests} /> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          [stats.total, 'Listelenen', KeyRound],
          [stats.pending, 'Bekleyen', Clock3],
          [stats.approved, 'Geçici Şifreli', TimerReset],
          [stats.done, 'Tamamlanan', ShieldCheck],
        ].map(([value, label, Icon]) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
              </div>
              <Icon className="h-5 w-5 text-[#D9790B]" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Button
            key={filter.value}
            type="button"
            variant={status === filter.value ? 'default' : 'outline'}
            onClick={() => setStatus(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4">
        {items.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              Bu filtrede şifre sıfırlama talebi yok.
            </CardContent>
          </Card>
        ) : null}

        {items.map((item) => (
          <Card key={item.id} className="overflow-hidden border-border">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{item.fullName}</h2>
                    <Badge variant="outline" className={statusStyles[item.status] || ''}>
                      {statusLabels[item.status] || item.status}
                    </Badge>
                    <Badge variant="secondary">{item.primaryRole}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.requestedEmail} • Kullanıcı adı: {item.username}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Talep: {formatDate(item.requestedAtUtc)}
                    {item.reviewedAtUtc ? ` • İnceleme: ${formatDate(item.reviewedAtUtc)}` : ''}
                    {item.expiresAtUtc ? ` • Geçici şifre son: ${formatDate(item.expiresAtUtc)}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.status === 'Pending' ? (
                    <>
                      <Button onClick={() => openDecision(item, 'approve')}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Onayla
                      </Button>
                      <Button variant="outline" onClick={() => openDecision(item, 'reject')}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Reddet
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" disabled>
                      İşlem Tamam
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision === 'approve' ? 'Geçici Şifre Üret' : 'Talebi Reddet'}
            </DialogTitle>
            <DialogDescription>
              {selected?.fullName} için şifre sıfırlama talebini sonuçlandırın.
            </DialogDescription>
          </DialogHeader>

          {approvalResult?.temporaryPassword ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="text-sm text-muted-foreground">Tek kullanımlık geçici şifre</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <code className="rounded-lg bg-background px-3 py-2 text-lg font-bold tracking-wider">
                    {approvalResult.temporaryPassword}
                  </code>
                  <Button type="button" variant="outline" onClick={copyTemporaryPassword}>
                    <Copy className="mr-2 h-4 w-4" />
                    Kopyala
                  </Button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Kullanıcı bu şifreyle giriş yapınca doğrudan yeni şifre belirleme ekranına gider.
                </p>
              </div>
            </div>
          ) : (
            <>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="İsteğe bağlı not..."
                rows={4}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)} disabled={reviewing}>
                  Vazgeç
                </Button>
                <Button onClick={submitDecision} disabled={reviewing}>
                  {reviewing
                    ? 'Kaydediliyor...'
                    : decision === 'approve'
                      ? 'Onayla ve Şifre Üret'
                      : 'Reddet'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
