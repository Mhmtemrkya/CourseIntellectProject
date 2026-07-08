import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { FeatureGate } from '../../components/FeatureGate';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { fetchOrgUnits, createOrgUnit, deleteOrgUnit } from '../../lib/api/modules';

const BRANCH_TYPES = ['şube', 'sube', 'kampüs', 'kampus'];

const emptyForm = { name: '', unitType: 'Şube', managerName: '', note: '' };

export default function AdminBranchRegistration() {
  const { toast } = useToast();
  const [units, setUnits] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setUnits(await fetchOrgUnits());
    } catch (err) {
      setError(err.message || 'Şubeler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const branches = useMemo(
    () => units.filter((u) => BRANCH_TYPES.includes(String(u.unitType || '').toLowerCase())),
    [units],
  );

  const submit = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Şube adı zorunludur.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      await createOrgUnit({
        name: form.name.trim(),
        unitType: form.unitType,
        parentUnitId: null,
        managerName: form.managerName.trim() || null,
        note: form.note.trim() || null,
      });
      toast({ title: 'Şube oluşturuldu', description: `${form.name.trim()} kaydedildi.` });
      setForm(emptyForm);
      await load();
    } catch (err) {
      toast({ title: 'Şube oluşturulamadı', description: err?.response?.data?.message || err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (unit) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`"${unit.name}" şubesini silmek istediğinize emin misiniz?`)) return;
    try {
      await deleteOrgUnit(unit.id);
      toast({ title: 'Şube silindi' });
      await load();
    } catch (err) {
      toast({ title: 'Silinemedi', description: err.message, variant: 'destructive' });
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-branch-registration-page">
      <div>
        <h1 className="text-3xl font-bold font-heading flex items-center gap-2"><Building2 className="h-7 w-7 text-brand-primary" />Şube Kaydı</h1>
        <p className="text-muted-foreground mt-1">Kuruma yeni şube ekleyin. Oluşturulan şubeler giriş ekranında ve şube seçiminde listelenir.</p>
      </div>

      {error ? <ErrorBanner title="Şubeler alınamadı" message={error} onRetry={load} /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader><CardTitle>Yeni Şube</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Şube Adı</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Örn: Merkez Şube" />
            </div>
            <div className="space-y-2">
              <Label>Tür</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.unitType} onChange={(e) => setForm((f) => ({ ...f, unitType: e.target.value }))}>
                <option value="Şube">Şube</option>
                <option value="Kampüs">Kampüs</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Sorumlu (opsiyonel)</Label>
              <Input value={form.managerName} onChange={(e) => setForm((f) => ({ ...f, managerName: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Not (opsiyonel)</Label>
              <Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <FeatureGate module="registrations" action="branch-register"><Button onClick={submit} disabled={saving}><Plus className="mr-2 h-4 w-4" />{saving ? 'Kaydediliyor...' : 'Şubeyi Kaydet'}</Button></FeatureGate>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Kayıtlı Şubeler ({branches.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {branches.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz şube kaydı yok.</p>
            ) : branches.map((unit) => (
              <div key={unit.id} className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3">
                <div className="min-w-0">
                  <p className="font-semibold">{unit.name}</p>
                  <p className="text-xs text-muted-foreground">{unit.managerName || 'Sorumlu atanmadı'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{unit.unitType}</Badge>
                  <Button size="icon" variant="ghost" className="text-red-600" onClick={() => remove(unit)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
