import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CheckSquare2, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { fetchPlatformConfigurations, upsertPlatformConfiguration } from '../../lib/api/modules';
import { fetchAdminDashboardData } from '../../lib/api/dashboardData';

export default function AdminTaskCenter() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [savedTasks, setSavedTasks] = useState([]);
  const [detailTask, setDetailTask] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: '', detail: '', route: '/admin/task-center', priority: 'Orta' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [dashboard, configs] = await Promise.all([
        fetchAdminDashboardData(),
        fetchPlatformConfigurations('admin-task-center').catch(() => []),
      ]);
      const manual = (configs || []).flatMap((item) => {
        try {
          const parsed = JSON.parse(item.payloadJson || '{}');
          return parsed?.tasks ? parsed.tasks : [];
        } catch {
          return [];
        }
      });
      setData(dashboard);
      setSavedTasks(manual);
    } catch (err) {
      setError(err.message || 'Görev merkezi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const tasks = useMemo(() => [
    ...(data?.pendingItems || []).map((item) => ({ id: item.id, title: item.studentName, detail: item.question, type: 'Mesaj', route: '/chat' })),
    ...(data?.activities || []).map((item) => ({ id: item.id, title: item.message, detail: item.time, type: 'Duyuru', route: '/admin/announcements' })),
    ...savedTasks,
  ].slice(0, 20), [data, savedTasks]);

  const persistTasks = async (nextTasks) => {
    await upsertPlatformConfiguration({
      configurationType: 'admin-task-center',
      scopeKey: 'global',
      displayName: 'ADMIN_TASK_CENTER',
      payloadJson: JSON.stringify({ tasks: nextTasks }),
    });
    setSavedTasks(nextTasks);
  };

  const handleCreateTask = async () => {
    const nextTask = {
      id: `manual-${Date.now()}`,
      title: form.title,
      detail: form.detail,
      type: form.priority,
      route: form.route,
    };
    const nextTasks = [nextTask, ...savedTasks];
    try {
      await persistTasks(nextTasks);
      setCreateOpen(false);
      setForm({ title: '', detail: '', route: '/admin/task-center', priority: 'Orta' });
      toast({ title: 'Görev oluşturuldu', description: 'Yeni görev backend üzerinde kaydedildi.' });
    } catch (err) {
      toast({ title: 'Görev oluşturulamadı', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const nextTasks = savedTasks.filter((item) => item.id !== taskId);
      await persistTasks(nextTasks);
      setDetailTask(null);
      toast({ title: 'Görev silindi', description: 'Görev listesi güncellendi.' });
    } catch (err) {
      toast({ title: 'Görev silinemedi', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-task-center-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Görev Merkezi</h1>
        <p className="text-muted-foreground mt-1">Anlık yönetici görev kuyruğu</p>
      </div>
      <div className="flex justify-end">
        <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Görev
        </Button>
      </div>
      {error ? <ErrorBanner title="Görev merkezi alınamadı" message={error} onRetry={loadTasks} /> : null}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CheckSquare2 className="h-5 w-5 text-brand-primary" />Görevler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.map((task) => (
            <button type="button" key={task.id} className="w-full rounded-xl border p-4 flex items-center justify-between gap-4 text-left hover:bg-muted/40 transition-colors" onClick={() => setDetailTask(task)}>
              <div>
                <p className="font-medium">{task.title}</p>
                <p className="text-sm text-muted-foreground">{task.detail}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{task.type}</Badge>
                <Button variant="outline" size="sm" onClick={() => navigate(task.route)}>Git</Button>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Görev Oluştur</DialogTitle>
            <DialogDescription>Yönetici ve idari ekip için kalıcı görev kaydı oluşturun.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Görev başlığı</Label>
              <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Detay</Label>
              <Textarea value={form.detail} onChange={(e) => setForm((prev) => ({ ...prev, detail: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>İptal</Button>
            <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={handleCreateTask}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailTask} onOpenChange={(open) => !open && setDetailTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailTask?.title || 'Görev detayı'}</DialogTitle>
            <DialogDescription>Görev içeriği ve ilgili işlem akışı.</DialogDescription>
          </DialogHeader>
          {detailTask ? <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">{detailTask.detail}</div> : null}
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => detailTask && navigate(detailTask.route)}>İlgili Modülü Aç</Button>
            <div className="flex gap-2">
              {String(detailTask?.id || '').startsWith('manual-') ? (
                <Button variant="destructive" onClick={() => handleDeleteTask(detailTask.id)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Sil
                </Button>
              ) : null}
              <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={() => setDetailTask(null)}>Kapat</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
