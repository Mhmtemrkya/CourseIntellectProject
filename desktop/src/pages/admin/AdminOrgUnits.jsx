import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Plus, Pencil, Trash2, X, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  fetchOrgUnits, createOrgUnit, updateOrgUnit, deleteOrgUnit,
} from '../../lib/api/modules';

const UNIT_TYPES = ['Kampüs', 'Birim', 'Departman'];
const emptyForm = { name: '', unitType: 'Birim', parentUnitId: '', managerName: '', note: '' };

export default function AdminOrgUnits() {
  const { toast } = useToast();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setUnits(await fetchOrgUnits());
    } catch (err) {
      setError(err.message || 'Birimler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const roots = useMemo(() => units.filter((u) => !u.parentUnitId), [units]);
  const childrenOf = useCallback((id) => units.filter((u) => u.parentUnitId === id), [units]);

  const resetForm = () => { setForm(emptyForm); setEditingId(null); };

  const submit = async () => {
    if (!form.name.trim()) { toast({ title: 'Birim adı zorunlu.', variant: 'destructive' }); return; }
    const payload = {
      name: form.name.trim(),
      unitType: form.unitType,
      parentUnitId: form.parentUnitId || null,
      managerName: form.managerName.trim() || null,
      note: form.note.trim() || null,
    };
    try {
      setBusy(true);
      if (editingId) await updateOrgUnit(editingId, payload);
      else await createOrgUnit(payload);
      toast({ title: editingId ? 'Birim güncellendi' : 'Birim eklendi' });
      resetForm();
      await load();
    } catch (err) {
      toast({ title: 'İşlem başarısız', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const startEdit = (u) => {
    setEditingId(u.id);
    setForm({ name: u.name, unitType: u.unitType, parentUnitId: u.parentUnitId || '', managerName: u.managerName || '', note: u.note || '' });
  };

  const remove = async (u) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`"${u.name}" birimini silmek istediğinize emin misiniz? Alt birimler köke taşınır.`)) return;
    try {
      setBusy(true);
      await deleteOrgUnit(u.id);
      await load();
    } catch (err) {
      toast({ title: 'Silinemedi', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  const renderUnit = (u, depth = 0) => (
    <div key={u.id}>
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3" style={{ marginLeft: depth * 20 }}>
        <div className="flex items-center gap-2 min-w-0">
          {depth > 0 ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <Building2 className="h-4 w-4 text-brand-primary" />}
          <span className="font-semibold">{u.name}</span>
          <Badge variant="outline">{u.unitType}</Badge>
          {u.managerName ? <span className="text-sm text-muted-foreground">• {u.managerName}</span> : null}
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={() => startEdit(u)}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="text-red-600" onClick={() => remove(u)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="mt-2 space-y-2">{childrenOf(u.id).map((c) => renderUnit(c, depth + 1))}</div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-org-units-page">
      <div>
        <h1 className="text-3xl font-bold font-heading flex items-center gap-2"><Building2 className="h-7 w-7 text-brand-primary" />Organizasyon Birimleri</h1>
        <p className="text-muted-foreground mt-1">Kampüs / birim / departman hiyerarşisi ve sorumluları.</p>
      </div>
      {error ? <ErrorBanner title="Birimler alınamadı" message={error} onRetry={load} /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {editingId ? 'Birimi Düzenle' : 'Yeni Birim'}
            {editingId ? <Button size="sm" variant="ghost" onClick={resetForm}><X className="mr-1 h-4 w-4" />Vazgeç</Button> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Birim adı" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.unitType} onChange={(e) => setForm((f) => ({ ...f, unitType: e.target.value }))}>
            {UNIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.parentUnitId} onChange={(e) => setForm((f) => ({ ...f, parentUnitId: e.target.value }))}>
            <option value="">Üst birim yok (kök)</option>
            {units.filter((u) => u.id !== editingId).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <Input placeholder="Sorumlu (opsiyonel)" value={form.managerName} onChange={(e) => setForm((f) => ({ ...f, managerName: e.target.value }))} />
          <Input className="md:col-span-2" placeholder="Not" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={submit} disabled={busy}><Plus className="mr-2 h-4 w-4" />{editingId ? 'Kaydet' : 'Birim Ekle'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Birim Ağacı ({units.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {units.length === 0 ? <p className="text-sm text-muted-foreground">Henüz birim yok.</p>
            : roots.length === 0 ? units.map((u) => renderUnit(u))
              : roots.map((u) => renderUnit(u))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
