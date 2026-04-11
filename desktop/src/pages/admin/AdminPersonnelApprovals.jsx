import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, Eye, ShieldCheck, XCircle, Clock3, Sparkles, Mail, Building2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { useApp } from '../../context/AppContext';
import {
  createNotification,
  fetchPlatformConfigurations,
  fetchStaff,
  upsertPlatformConfiguration,
} from '../../lib/api/modules';

export default function AdminPersonnelApprovals() {
  const { user } = useApp();
  const { toast } = useToast();
  const [staff, setStaff] = useState([]);
  const [selected, setSelected] = useState(null);
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadApprovals = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [staffItems, saved] = await Promise.all([
        fetchStaff().catch(() => []),
        fetchPlatformConfigurations('personnel-approvals').catch(() => []),
      ]);
      setStaff(staffItems);
      const nextStatuses = {};
      (saved || []).forEach((item) => {
        try {
          const parsed = JSON.parse(item.payloadJson || '{}');
          nextStatuses[item.scopeKey] = parsed.status;
        } catch {}
      });
      setStatuses(nextStatuses);
    } catch (err) {
      setError(err.message || 'Personel onayları alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApprovals(); }, [loadApprovals]);

  const items = useMemo(() => staff.slice(0, 12), [staff]);
  const canManageApprovals = ['admin', 'administrative'].includes(String(user?.backendRole || user?.role || '').toLowerCase());

  const updateStatus = async (item, status) => {
    try {
      await upsertPlatformConfiguration({
        configurationType: 'personnel-approvals',
        scopeKey: item.id,
        displayName: `PERSONNEL_APPROVAL::${item.fullName}`,
        payloadJson: JSON.stringify({ status }),
      });
      await createNotification({
        title: `Personel Onayı ${status}`,
        message: `${item.fullName} için personel onay durumu ${status} olarak güncellendi.`,
        timeLabel: 'Az once',
        audience: 'Staff',
        targetRole: item.role || 'Teacher',
        category: 'PersonnelApproval',
      }).catch(() => null);
      setStatuses((prev) => ({ ...prev, [item.id]: status }));
      toast({ title: 'Onay durumu güncellendi', description: `${item.fullName} için durum ${status} olarak kaydedildi.` });
    } catch (err) {
      toast({ title: 'Onay güncellenemedi', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  if (!canManageApprovals) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-personnel-approvals-page">
        <div>
          <h1 className="text-3xl font-bold font-heading">Personel Onayları</h1>
          <p className="text-muted-foreground mt-1">Bu ekran yalnızca yönetici ve idari roller için açıktır.</p>
        </div>
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Bu modüle erişim yetkiniz bulunmuyor.
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-personnel-approvals-page">
      <div className="rounded-[28px] border border-border p-7 text-white shadow-xl" style={{ background: 'radial-gradient(circle at top left, var(--brand-a-400, rgba(34,197,94,0.18)), transparent 30%), linear-gradient(135deg, var(--brand-p-900, #0f172a) 0%, var(--brand-p-800, #132b4c) 50%, var(--brand-p-700, #14532d) 100%)' }}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Badge className="border-white/20 bg-white/10 text-white">Onay Merkezi</Badge>
            <h1 className="mt-4 text-3xl font-bold font-heading">Personel Onayları</h1>
            <p className="mt-2 text-sm text-white/80">Başvuruları daha net kartlarla inceleyin, anında onaylayın ya da reddedin.</p>
          </div>
        </div>
      </div>
      {error ? <ErrorBanner title="Personel onayları alınamadı" message={error} onRetry={loadApprovals} /> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          [items.length, 'Toplam Kayıt', ShieldCheck],
          [items.filter((item) => !statuses[item.id]).length, 'İncelemede', Clock3],
          [items.filter((item) => statuses[item.id] === 'Onaylandı').length, 'Onaylandı', CheckCircle2],
          [items.filter((item) => statuses[item.id] === 'Reddedildi').length, 'Reddedildi', XCircle],
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
      <div className="grid gap-4">
        {items.map((item) => (
          <Card key={item.id} className="overflow-hidden border-border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{item.fullName}</p>
                    <Badge className="bg-muted text-muted-foreground">{item.role}</Badge>
                    <Badge variant="outline"><CheckCircle2 className="mr-1 h-3 w-3" />{statuses[item.id] || 'İncelemede'}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{item.role} • {item.department || item.campus || 'Birim yok'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelected(item)}><Eye className="h-4 w-4 mr-2" />Detay</Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => updateStatus(item, 'Onaylandı')}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Onayla
                  </Button>
                  <Button variant="outline" size="sm" className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => updateStatus(item, 'Reddedildi')}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reddet
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selected?.fullName || 'Personel detayı'}</DialogTitle>
            <DialogDescription>Yönetici ve idari ekip için personel onay ekranı.</DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-5">
              <div className="rounded-[24px] border p-6 text-white" style={{ background: 'radial-gradient(circle at top left, var(--brand-a-400, rgba(250,204,21,0.16)), transparent 34%), linear-gradient(135deg, var(--brand-p-900, #0f172a) 0%, var(--brand-p-800, #1d4d63) 55%, var(--brand-p-700, #166534) 100%)' }}>
                <Badge className="border-white/15 bg-white/10 text-white">{statuses[selected.id] || 'İncelemede'}</Badge>
                <h3 className="mt-4 text-2xl font-semibold">{selected.fullName}</h3>
                <p className="mt-2 text-sm text-white/80">{selected.role} • {selected.department || selected.campus || 'Birim yok'}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Rol</p><p className="mt-1 font-semibold">{selected.role}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Birim</p><p className="mt-1 font-semibold">{selected.department || selected.campus || '-'}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Durum</p><p className="mt-1 font-semibold">{statuses[selected.id] || 'İncelemede'}</p></CardContent></Card>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-primary" />Onay Özeti</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Kimlik</span><span className="font-medium">{selected.id}</span></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Durum</span><span className="font-medium">{statuses[selected.id] || 'İncelemede'}</span></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">İşlem</span><span className="font-medium">Yönetici onayı bekliyor</span></div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-brand-primary" />İletişim</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" /><span>{selected.email || selected.username || 'İletişim bilgisi yok'}</span></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Kampüs</span><span className="font-medium">{selected.campus || '-'}</span></div>
                    <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Birim</span><span className="font-medium">{selected.department || '-'}</span></div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => selected && updateStatus(selected, 'Reddedildi')}>Reddet</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => selected && updateStatus(selected, 'Onaylandı')}>Onayla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
