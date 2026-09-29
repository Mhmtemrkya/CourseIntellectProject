import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpenCheck, Plus } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Label } from '../../components/ui/label';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  assignGuidanceInventory,
  fetchGuidanceInventories,
  fetchGuidanceOverview,
} from '../../lib/api/modules';

const INVENTORY_TYPES = {
  'ogrenme-stili': 'Öğrenme Stili',
  'sinav-kaygisi': 'Sınav Kaygısı Ölçeği',
  'ilgi-envanteri': 'İlgi Envanteri',
};

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function GuidanceInventories() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ studentName: '', inventoryType: 'ogrenme-stili' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [inventories, overview] = await Promise.all([
        fetchGuidanceInventories(),
        fetchGuidanceOverview().catch(() => []),
      ]);
      setItems(inventories);
      setStudents(overview);
    } catch (err) {
      setError(err?.message || 'Envanterler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    total: items.length,
    completed: items.filter((i) => i.status === 'Tamamlandı').length,
  }), [items]);

  const assign = async () => {
    if (!form.studentName) return;
    setSaving(true);
    try {
      await assignGuidanceInventory(form);
      toast({ title: 'Envanter atandı', description: `${form.studentName} • ${INVENTORY_TYPES[form.inventoryType]}` });
      setDialogOpen(false);
      load();
    } catch (err) {
      toast({ title: 'Atanamadı', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <div className="space-y-6" data-testid="guidance-inventories">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Envanterler</h1>
          <p className="text-sm text-muted-foreground">
            Atanan anket/envanterler ve tamamlanma durumu ({stats.completed}/{stats.total} tamamlandı).
          </p>
        </div>
        <Button className="rounded-xl" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Envanter Ata
        </Button>
      </div>

      {error ? <ErrorBanner title="Hata" message={error} onRetry={load} /> : null}

      {items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
          <BookOpenCheck className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Henüz envanter atanmadı.</p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card shadow-sm">
          {items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-3 border-b p-4 last:border-b-0">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => navigate(`/g/student/${encodeURIComponent(item.studentName)}`)}
              >
                <p className="truncate font-bold">{item.studentName}</p>
                <p className="text-sm text-muted-foreground">{INVENTORY_TYPES[item.inventoryType] || item.inventoryType}</p>
              </button>
              <span className="text-xs text-muted-foreground">Atandı: {formatDate(item.assignedAtUtc)}</span>
              <Badge variant="outline" className={`rounded-lg ${item.status === 'Tamamlandı' ? 'border-emerald-500/30 text-emerald-600' : 'border-amber-500/30 text-amber-500'}`}>
                {item.status}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Envanter Ata</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Öğrenci</Label>
              <Select value={form.studentName || undefined} onValueChange={(v) => setForm((p) => ({ ...p, studentName: v }))}>
                <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Öğrenci seçin" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.studentName} value={s.studentName}>{s.studentName} ({s.className})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Envanter Türü</Label>
              <Select value={form.inventoryType} onValueChange={(v) => setForm((p) => ({ ...p, inventoryType: v }))}>
                <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INVENTORY_TYPES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDialogOpen(false)}>Vazgeç</Button>
            <Button className="rounded-xl" onClick={assign} disabled={saving || !form.studentName}>
              {saving ? 'Atanıyor...' : 'Ata'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
