import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardList, Send, CheckCircle2, Clock3, XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { createApproval, fetchMyApprovals } from '../../lib/api/modules';

const TYPES = ['Erken Çıkış', 'İzin', 'Gezi Onamı', 'KVKK / Fotoğraf Onamı', 'Kayıt Yenileme', 'Diğer'];
const STATUS_META = {
  Pending: ['İncelemede', 'text-amber-600', Clock3],
  Approved: ['Onaylandı', 'text-emerald-600', CheckCircle2],
  Rejected: ['Reddedildi', 'text-red-600', XCircle],
};

export default function ParentRequests() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ type: 'Erken Çıkış', child: '', date: '', description: '' });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setItems(await fetchMyApprovals());
    } catch (err) {
      setError(err.message || 'Talepler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.child.trim()) { toast({ title: 'Öğrenci adı zorunlu.', variant: 'destructive' }); return; }
    try {
      setBusy(true);
      const titleParts = [form.type, form.child.trim()];
      if (form.date) titleParts.push(form.date);
      await createApproval({
        category: form.type,
        title: titleParts.join(' • '),
        description: form.description.trim() || null,
        priority: form.type === 'Erken Çıkış' ? 'Yüksek' : 'Normal',
        unit: 'Veli',
        referenceType: 'ParentRequest',
      });
      toast({ title: 'Talebiniz iletildi', description: 'İdari onaya gönderildi.' });
      setForm({ type: 'Erken Çıkış', child: '', date: '', description: '' });
      await load();
    } catch (err) {
      toast({ title: 'Talep gönderilemedi', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="parent-requests-page">
      <div>
        <h1 className="text-3xl font-bold font-heading flex items-center gap-2"><ClipboardList className="h-7 w-7 text-brand-primary" />Taleplerim</h1>
        <p className="text-muted-foreground mt-1">Erken çıkış, izin, gezi/KVKK onamı ve kayıt yenileme taleplerinizi iletin; idari onay durumunu takip edin.</p>
      </div>
      {error ? <ErrorBanner title="Talepler alınamadı" message={error} onRetry={load} /> : null}

      <Card>
        <CardHeader><CardTitle>Yeni Talep</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Input placeholder="Öğrenci adı" value={form.child} onChange={(e) => setForm((f) => ({ ...f, child: e.target.value }))} />
          <div>
            <label className="text-xs text-muted-foreground">Tarih (varsa)</label>
            <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </div>
          <Textarea className="md:col-span-2" placeholder="Açıklama" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={submit} disabled={busy}><Send className="mr-2 h-4 w-4" />Talebi Gönder</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {items.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Henüz talebiniz yok.</CardContent></Card>
          : items.map((item) => {
            const [label, tone, Icon] = STATUS_META[item.status] || STATUS_META.Pending;
            return (
              <Card key={item.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{item.title}</span>
                      <Badge variant="outline">{item.category}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description || '—'} • {new Date(item.createdAtUtc).toLocaleDateString('tr-TR')}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 font-semibold ${tone}`}><Icon className="h-4 w-4" />{label}</span>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </motion.div>
  );
}
