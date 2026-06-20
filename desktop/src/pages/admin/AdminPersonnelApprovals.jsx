import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, Eye, ShieldCheck, XCircle, Clock3, Sparkles, Building2, User2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import { fetchApprovals, decideApproval } from '../../lib/api/modules';

const STATUS_LABEL = {
  Pending: 'İncelemede',
  Approved: 'Onaylandı',
  Rejected: 'Reddedildi',
  Cancelled: 'İptal',
};

function statusLabel(status) {
  return STATUS_LABEL[status] || status || 'İncelemede';
}

function money(amount, currency = '₺') {
  if (amount == null) return null;
  return `${Number(amount).toLocaleString('tr-TR')} ${currency}`;
}

export default function AdminPersonnelApprovals() {
  const { user } = useApp();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const canManageApprovals = ['admin', 'administrative'].includes(String(user?.backendRole || user?.role || '').toLowerCase());

  const loadApprovals = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchApprovals();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Onaylar alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApprovals(); }, [loadApprovals]);

  const stats = useMemo(() => ({
    total: items.length,
    pending: items.filter((item) => item.status === 'Pending').length,
    approved: items.filter((item) => item.status === 'Approved').length,
    rejected: items.filter((item) => item.status === 'Rejected').length,
  }), [items]);

  const decide = async (item, status) => {
    try {
      setBusyId(item.id);
      const updated = await decideApproval(item.id, { status });
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, ...updated } : row)));
      if (selected?.id === item.id) setSelected((prev) => ({ ...prev, ...updated }));
      toast({ title: 'Onay güncellendi', description: `${item.title} → ${statusLabel(status)}` });
    } catch (err) {
      toast({ title: 'Onay güncellenemedi', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  if (!canManageApprovals) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-personnel-approvals-page">
        <div>
          <h1 className="text-3xl font-bold font-heading">Onay Merkezi</h1>
          <p className="text-muted-foreground mt-1">Bu ekran yalnızca yönetici ve idari roller için açıktır.</p>
        </div>
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">Bu modüle erişim yetkiniz bulunmuyor.</CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-personnel-approvals-page">
      <div className="rounded-[28px] border border-border p-7 text-white shadow-xl" style={{ background: 'radial-gradient(circle at top left, var(--brand-a-400, rgba(34,197,94,0.18)), transparent 30%), linear-gradient(135deg, var(--brand-p-900, #0f172a) 0%, var(--brand-p-800, #132b4c) 50%, var(--brand-p-700, #14532d) 100%)' }}>
        <div className="max-w-3xl">
          <Badge className="border-foreground/20 bg-foreground/10 text-white">Onay Merkezi</Badge>
          <h1 className="mt-4 text-3xl font-bold font-heading">Onay / İş Akışı</h1>
          <p className="mt-2 text-sm text-foreground/80">İzin, satınalma, masraf, evrak ve personel talepleri tek merkezden onaylanır ya da reddedilir. Tüm kararlar denetim kaydına işlenir.</p>
        </div>
      </div>
      {error ? <ErrorBanner title="Onaylar alınamadı" message={error} onRetry={loadApprovals} /> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          [stats.total, 'Toplam Talep', ShieldCheck],
          [stats.pending, 'İncelemede', Clock3],
          [stats.approved, 'Onaylandı', CheckCircle2],
          [stats.rejected, 'Reddedildi', XCircle],
        ].map(([value, label, Icon]) => (
          <Card key={label}>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
              </div>
              <Icon className="h-5 w-5 text-brand-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Bekleyen onay talebi bulunmuyor. Diğer modüller (izin, satınalma, masraf, evrak) talep oluşturdukça burada listelenir.</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <Card key={item.id} className="overflow-hidden border-border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{item.title}</p>
                      <Badge className="bg-muted text-muted-foreground">{item.category}</Badge>
                      <Badge variant="outline">{statusLabel(item.status)}</Badge>
                      {item.priority && item.priority !== 'Normal' ? <Badge className="bg-amber-100 text-amber-700">{item.priority}</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {item.requesterName || 'Talep eden yok'}{item.unit ? ` • ${item.unit}` : ''}{money(item.amount) ? ` • ${money(item.amount)}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelected(item)}><Eye className="h-4 w-4 mr-2" />Detay</Button>
                    <Button size="sm" disabled={busyId === item.id || item.status === 'Approved'} className="bg-emerald-600 hover:bg-emerald-700" onClick={() => decide(item, 'Approved')}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />Onayla
                    </Button>
                    <Button variant="outline" size="sm" disabled={busyId === item.id || item.status === 'Rejected'} className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => decide(item, 'Rejected')}>
                      <XCircle className="mr-2 h-4 w-4" />Reddet
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.title || 'Onay detayı'}</DialogTitle>
            <DialogDescription>Yönetici ve idari ekip için onay/iş akışı detayı.</DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-5">
              <div className="rounded-[24px] border p-6 text-white" style={{ background: 'radial-gradient(circle at top left, var(--brand-a-400, rgba(250,204,21,0.16)), transparent 34%), linear-gradient(135deg, var(--brand-p-900, #0f172a) 0%, var(--brand-p-800, #1d4d63) 55%, var(--brand-p-700, #166534) 100%)' }}>
                <Badge className="border-foreground/15 bg-foreground/10 text-white">{statusLabel(selected.status)}</Badge>
                <h3 className="mt-4 text-2xl font-semibold">{selected.title}</h3>
                <p className="mt-2 text-sm text-foreground/80">{selected.category}{selected.unit ? ` • ${selected.unit}` : ''}</p>
              </div>
              {selected.description ? <p className="text-sm text-muted-foreground">{selected.description}</p> : null}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-primary" />Talep Özeti</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Kategori</span><span className="font-medium">{selected.category}</span></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Tutar</span><span className="font-medium">{money(selected.amount) || '-'}</span></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Öncelik</span><span className="font-medium">{selected.priority || 'Normal'}</span></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Durum</span><span className="font-medium">{statusLabel(selected.status)}</span></div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-brand-primary" />Kaynak</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center gap-3"><User2 className="h-4 w-4 text-muted-foreground" /><span>{selected.requesterName || 'Talep eden yok'}</span></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Birim</span><span className="font-medium">{selected.unit || '-'}</span></div>
                    {selected.decidedByName ? <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Karar veren</span><span className="font-medium">{selected.decidedByName}</span></div> : null}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" disabled={!selected || busyId === selected?.id} className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => selected && decide(selected, 'Rejected')}>Reddet</Button>
            <Button disabled={!selected || busyId === selected?.id} className="bg-emerald-600 hover:bg-emerald-700" onClick={() => selected && decide(selected, 'Approved')}>Onayla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
