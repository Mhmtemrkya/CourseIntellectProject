import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays, CheckCircle2, XCircle, Package, Undo2, UserCog,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { FeatureGate } from '../../components/FeatureGate';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  fetchStaff, fetchLeaves, createLeave, decideLeave, fetchLeaveBalance,
  fetchStaffAssets, assignStaffAsset, returnStaffAsset,
} from '../../lib/api/modules';

const LEAVE_TYPES = ['Yıllık', 'Mazeret', 'Hastalık', 'Ücretsiz'];
const STATUS_LABEL = { Pending: 'İncelemede', Approved: 'Onaylandı', Rejected: 'Reddedildi' };

export default function AdminStaffHr() {
  const { toast } = useToast();
  const [staff, setStaff] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [assets, setAssets] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [leaveForm, setLeaveForm] = useState({ staffName: '', leaveType: 'Yıllık', startDate: '', endDate: '', reason: '' });
  const [assetForm, setAssetForm] = useState({ staffName: '', assetName: '', assetCode: '', note: '' });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [staffItems, leaveItems, assetItems] = await Promise.all([
        fetchStaff().catch(() => []),
        fetchLeaves().catch(() => []),
        fetchStaffAssets().catch(() => []),
      ]);
      setStaff(Array.isArray(staffItems) ? staffItems : []);
      setLeaves(leaveItems);
      setAssets(assetItems);
    } catch (err) {
      setError(err.message || 'Personel İK verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const staffNames = useMemo(() => staff.map((s) => s.fullName).filter(Boolean), [staff]);

  const loadBalance = useCallback(async (name) => {
    if (!name) { setBalance(null); return; }
    try { setBalance(await fetchLeaveBalance(name)); } catch { setBalance(null); }
  }, []);

  const submitLeave = async () => {
    if (!leaveForm.staffName.trim() || !leaveForm.startDate || !leaveForm.endDate) {
      toast({ title: 'Personel, başlangıç ve bitiş zorunlu.', variant: 'destructive' });
      return;
    }
    try {
      setBusy(true);
      await createLeave({
        staffName: leaveForm.staffName.trim(),
        leaveType: leaveForm.leaveType,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason.trim(),
      });
      toast({ title: 'İzin talebi oluşturuldu', description: 'Onay merkezine düştü.' });
      setLeaveForm({ staffName: '', leaveType: 'Yıllık', startDate: '', endDate: '', reason: '' });
      await load();
    } catch (err) {
      toast({ title: 'İzin oluşturulamadı', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const decide = async (item, status) => {
    try {
      setBusy(true);
      const updated = await decideLeave(item.id, { status });
      setLeaves((prev) => prev.map((row) => (row.id === item.id ? { ...row, ...updated } : row)));
      toast({ title: 'İzin güncellendi', description: `${item.staffName} → ${STATUS_LABEL[status] || status}` });
      if (balance && item.staffName === leaveForm.staffName) loadBalance(item.staffName);
    } catch (err) {
      toast({ title: 'İşlem başarısız', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const submitAsset = async () => {
    if (!assetForm.staffName.trim() || !assetForm.assetName.trim()) {
      toast({ title: 'Personel ve demirbaş adı zorunlu.', variant: 'destructive' });
      return;
    }
    try {
      setBusy(true);
      await assignStaffAsset({
        staffName: assetForm.staffName.trim(),
        assetName: assetForm.assetName.trim(),
        assetCode: assetForm.assetCode.trim(),
        note: assetForm.note.trim(),
      });
      toast({ title: 'Zimmet atandı' });
      setAssetForm({ staffName: '', assetName: '', assetCode: '', note: '' });
      await load();
    } catch (err) {
      toast({ title: 'Zimmet atanamadı', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const returnAsset = async (item) => {
    try {
      setBusy(true);
      const updated = await returnStaffAsset(item.id);
      setAssets((prev) => prev.map((row) => (row.id === item.id ? { ...row, ...updated } : row)));
      toast({ title: 'Zimmet iade alındı' });
    } catch (err) {
      toast({ title: 'İşlem başarısız', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-staff-hr-page">
      <div>
        <h1 className="text-3xl font-bold font-heading flex items-center gap-2"><UserCog className="h-7 w-7 text-brand-primary" />Personel / İK</h1>
        <p className="text-muted-foreground mt-1">İzin talepleri (onay merkezine bağlı), izin bakiyesi ve demirbaş zimmeti.</p>
      </div>
      {error ? <ErrorBanner title="Veri alınamadı" message={error} onRetry={load} /> : null}

      <datalist id="hr-staff-names">
        {staffNames.map((n) => <option key={n} value={n} />)}
      </datalist>

      <Tabs defaultValue="leaves">
        <TabsList>
          <TabsTrigger value="leaves"><CalendarDays className="mr-2 h-4 w-4" />İzinler</TabsTrigger>
          <TabsTrigger value="assets"><Package className="mr-2 h-4 w-4" />Zimmet</TabsTrigger>
        </TabsList>

        <TabsContent value="leaves" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Yeni İzin Talebi</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Input list="hr-staff-names" placeholder="Personel adı" value={leaveForm.staffName}
                onChange={(e) => { setLeaveForm((f) => ({ ...f, staffName: e.target.value })); loadBalance(e.target.value.trim()); }} />
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={leaveForm.leaveType}
                onChange={(e) => setLeaveForm((f) => ({ ...f, leaveType: e.target.value }))}>
                {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <Input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm((f) => ({ ...f, startDate: e.target.value }))} />
              <Input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm((f) => ({ ...f, endDate: e.target.value }))} />
              <Input className="md:col-span-2" placeholder="Açıklama" value={leaveForm.reason} onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))} />
              <div className="md:col-span-2 flex items-center justify-between">
                {balance ? (
                  <p className="text-sm text-muted-foreground">Yıllık izin bakiyesi: <b>{balance.remainingDays}</b> / {balance.entitlement} gün (kullanılan {balance.usedDays})</p>
                ) : <span />}
                <FeatureGate module="staff-hr" action="leave-approve"><Button onClick={submitLeave} disabled={busy}>Talep Oluştur</Button></FeatureGate>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {leaves.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">İzin talebi yok.</CardContent></Card>
              : leaves.map((item) => (
                <Card key={item.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{item.staffName}</span>
                        <Badge variant="outline">{item.leaveType}</Badge>
                        <Badge>{STATUS_LABEL[item.status] || item.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {String(item.startDateUtc).split('T')[0]} → {String(item.endDateUtc).split('T')[0]} • {item.days} gün
                        {item.reason ? ` • ${item.reason}` : ''}
                      </p>
                    </div>
                    {item.status === 'Pending' ? (
                      <div className="flex gap-2">
                        <Button size="sm" disabled={busy} className="bg-emerald-600 hover:bg-emerald-700" onClick={() => decide(item, 'Approved')}><CheckCircle2 className="mr-1 h-4 w-4" />Onayla</Button>
                        <Button size="sm" variant="outline" disabled={busy} className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => decide(item, 'Rejected')}><XCircle className="mr-1 h-4 w-4" />Reddet</Button>
                      </div>
                    ) : <span className="text-sm text-muted-foreground">{item.decidedByName}</span>}
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="assets" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Zimmet Ata</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Input list="hr-staff-names" placeholder="Personel adı" value={assetForm.staffName} onChange={(e) => setAssetForm((f) => ({ ...f, staffName: e.target.value }))} />
              <Input placeholder="Demirbaş adı (örn: Laptop)" value={assetForm.assetName} onChange={(e) => setAssetForm((f) => ({ ...f, assetName: e.target.value }))} />
              <Input placeholder="Demirbaş kodu / seri" value={assetForm.assetCode} onChange={(e) => setAssetForm((f) => ({ ...f, assetCode: e.target.value }))} />
              <Input placeholder="Not" value={assetForm.note} onChange={(e) => setAssetForm((f) => ({ ...f, note: e.target.value }))} />
              <div className="md:col-span-2 flex justify-end"><Button onClick={submitAsset} disabled={busy}>Zimmetle</Button></div>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {assets.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Zimmet kaydı yok.</CardContent></Card>
              : assets.map((item) => (
                <Card key={item.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{item.assetName}</span>
                        {item.assetCode ? <Badge variant="outline">{item.assetCode}</Badge> : null}
                        <Badge className={item.status === 'Returned' ? 'bg-muted text-muted-foreground' : ''}>{item.status === 'Returned' ? 'İade Edildi' : 'Zimmetli'}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{item.staffName} • {String(item.assignedAtUtc).split('T')[0]}{item.note ? ` • ${item.note}` : ''}</p>
                    </div>
                    {item.status !== 'Returned' ? (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => returnAsset(item)}><Undo2 className="mr-1 h-4 w-4" />İade Al</Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
