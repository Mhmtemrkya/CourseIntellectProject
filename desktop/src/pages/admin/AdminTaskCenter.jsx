import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare2, Plus, Play, Check, Clock3, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { FeatureGate } from '../../components/FeatureGate';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { fetchAdminTasks, createAdminTask, updateAdminTaskStatus, fetchStaff } from '../../lib/api/modules';
import { formatDate, formatDateTime } from '../../lib/format';

const STATUS = [
  ['PendingAcceptance', 'Kabul Bekliyor'],
  ['Accepted', 'Kabul Edildi'],
  ['Rejected', 'Kabul Edilmedi'],
  ['Open', 'Açık'],
  ['InProgress', 'Devam Ediyor'],
  ['Done', 'Tamamlandı'],
];
const PRIORITIES = ['Düşük', 'Normal', 'Yüksek', 'Acil'];

function dueInfo(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days < 0) return { tone: 'text-red-600', label: 'Gecikti', icon: AlertTriangle };
  if (days <= 3) return { tone: 'text-amber-600', label: `${days} gün`, icon: Clock3 };
  return { tone: 'text-muted-foreground', label: formatDate(date), icon: Clock3 };
}

export default function AdminTaskCenter() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', category: 'Genel', assignedToName: '', priority: 'Normal', startDate: '', endDate: '' });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [taskItems, staffItems] = await Promise.all([
        fetchAdminTasks(),
        fetchStaff().catch(() => []),
      ]);
      setTasks(taskItems);
      setStaff(Array.isArray(staffItems) ? staffItems : []);
    } catch (err) {
      setError(err.message || 'Görevler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const byStatus = useMemo(() => {
    const map = { PendingAcceptance: [], Accepted: [], Rejected: [], Open: [], InProgress: [], Done: [], Cancelled: [] };
    tasks.forEach((t) => { (map[t.status] || (map[t.status] = [])).push(t); });
    return map;
  }, [tasks]);

  const create = async () => {
    if (!form.title.trim()) { toast({ title: 'Başlık zorunlu.', variant: 'destructive' }); return; }
    const assignee = staff.find((item) => (item.fullName || item.name || '').trim() === form.assignedToName.trim());
    try {
      setBusy(true);
      await createAdminTask({
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || 'Genel',
        assignedToUserId: assignee?.userId || null,
        assignedToName: form.assignedToName.trim() || null,
        priority: form.priority,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      });
      toast({ title: 'Görev oluşturuldu' });
      setForm({ title: '', description: '', category: 'Genel', assignedToName: '', priority: 'Normal', startDate: '', endDate: '' });
      await load();
    } catch (err) {
      toast({ title: 'Görev oluşturulamadı', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const setStatus = async (item, status) => {
    try {
      setBusy(true);
      const updated = await updateAdminTaskStatus(item.id, status);
      setTasks((prev) => prev.map((t) => (t.id === item.id ? { ...t, ...updated } : t)));
    } catch (err) {
      toast({ title: 'Güncellenemedi', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-task-center-page">
      <div>
        <h1 className="text-3xl font-bold font-heading flex items-center gap-2"><CheckSquare2 className="h-7 w-7 text-brand-primary" />Görev / İş Takip Merkezi</h1>
        <p className="text-muted-foreground mt-1">İdari görevleri başlangıç/bitiş zamanı ile ata, kabul durumlarını ve mazeretleri takip et.</p>
      </div>
      {error ? <ErrorBanner title="Görevler alınamadı" message={error} onRetry={load} /> : null}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" />Yeni Görev</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Başlık" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <div>
            <Input list="admin-task-assignees" placeholder="Atanan kişi" value={form.assignedToName} onChange={(e) => setForm((f) => ({ ...f, assignedToName: e.target.value }))} />
            <datalist id="admin-task-assignees">
              {staff.map((item) => <option key={item.id || item.userId || item.fullName} value={item.fullName || item.name || ''} />)}
            </datalist>
          </div>
          <Input placeholder="Kategori" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <div>
            <label className="text-xs text-muted-foreground">Göreve başlama tarihi ve saati</label>
            <Input type="datetime-local" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Görev bitimi tarihi ve saati</label>
            <Input type="datetime-local" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
          </div>
          <Textarea className="md:col-span-2" placeholder="Açıklama" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <div className="md:col-span-2 flex justify-end"><FeatureGate module="tasks" action="create"><Button onClick={create} disabled={busy}>Görev Ekle</Button></FeatureGate></div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {STATUS.map(([key, label]) => (
          <Card key={key}>
            <CardHeader><CardTitle className="text-base flex items-center justify-between">{label}<Badge variant="outline">{(byStatus[key] || []).length}</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(byStatus[key] || []).length === 0 ? <p className="text-sm text-muted-foreground">—</p>
                : byStatus[key].map((item) => {
                  const due = dueInfo(item.endDateUtc || item.dueDateUtc);
                  return (
                    <div key={item.id} className="rounded-xl border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm">{item.title}</p>
                        {item.priority && item.priority !== 'Normal' ? <Badge className="bg-amber-100 text-amber-700 text-[10px]">{item.priority}</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.assignedToName || 'Atanmadı'} • {item.category}
                        {due ? <span className={`ml-2 inline-flex items-center gap-1 ${due.tone}`}><due.icon className="h-3 w-3" />{due.label}</span> : null}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Başlangıç: {item.startDateUtc ? formatDateTime(item.startDateUtc) : '—'} · Bitiş: {item.endDateUtc ? formatDateTime(item.endDateUtc) : '—'}
                      </p>
                      {item.rejectionReason ? (
                        <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                          <span className="font-semibold">Mazeret:</span> {item.rejectionReason}
                        </div>
                      ) : null}
                      <div className="mt-2 flex gap-2">
                        {!['PendingAcceptance', 'Rejected', 'InProgress', 'Done'].includes(key) ? <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus(item, 'InProgress')}><Play className="mr-1 h-3 w-3" />Başlat</Button> : null}
                        {!['PendingAcceptance', 'Rejected', 'Done'].includes(key) ? <Button size="sm" disabled={busy} className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setStatus(item, 'Done')}><Check className="mr-1 h-3 w-3" />Tamamla</Button> : null}
                        {key === 'Rejected' ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600"><XCircle className="h-3 w-3" />Kabul edilmedi</span> : null}
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
