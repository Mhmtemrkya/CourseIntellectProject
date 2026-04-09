import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, CheckCircle2, Flame, PlusCircle, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchStudyPlan, saveStudyPlan } from '../../lib/api/modules';

export default function StudentStudyPlan() {
  const { user } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', duration: '30 dk', status: 'Bugun', reason: '', planType: 'Gunluk' });

  const loadPlan = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setData(await fetchStudyPlan());
    } catch (err) {
      setError(err.message || 'Çalışma planı alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const planItems = useMemo(
    () => (data?.planItemsSerialized ? JSON.parse(data.planItemsSerialized) : []),
    [data?.planItemsSerialized],
  );
  const groupedPlans = useMemo(() => ({
    Gunluk: planItems.filter((item) => item.planType === 'Gunluk' || item.status === 'Bugun'),
    Haftalik: planItems.filter((item) => item.planType === 'Haftalik'),
    Aylik: planItems.filter((item) => item.planType === 'Aylik'),
  }), [planItems]);

  const persistPlan = useCallback(async (nextItems, nextMeta = {}) => {
    await saveStudyPlan({
      studentName: user?.name || 'Ogrenci',
      planItemsSerialized: JSON.stringify(nextItems),
      streakCount: nextMeta.streakCount ?? data?.streakCount ?? 0,
      xpPoints: nextMeta.xpPoints ?? data?.xpPoints ?? 0,
      lastCompletedAt: nextMeta.lastCompletedAt ?? data?.lastCompletedAt ?? null,
    });
    setData((prev) => ({
      ...(prev || {}),
      planItemsSerialized: JSON.stringify(nextItems),
      streakCount: nextMeta.streakCount ?? prev?.streakCount ?? 0,
      xpPoints: nextMeta.xpPoints ?? prev?.xpPoints ?? 0,
      lastCompletedAt: nextMeta.lastCompletedAt ?? prev?.lastCompletedAt ?? null,
    }));
  }, [data?.lastCompletedAt, data?.streakCount, data?.xpPoints, user?.name]);

  const handleAddPlan = async () => {
    const nextItems = [
      ...planItems,
      {
        id: Date.now(),
        title: form.title,
        duration: form.duration,
        status: form.status,
        reason: form.reason,
        planType: form.planType,
        done: false,
      },
    ];
    await persistPlan(nextItems);
    setOpen(false);
    setForm({ title: '', duration: '30 dk', status: 'Bugun', reason: '', planType: 'Gunluk' });
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="student-study-plan-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Çalışma Planım</h1>
        <p className="text-muted-foreground mt-1">Mobil ile aynı mantıkta günlük, haftalık ve aylık çalışma planlarını yönet.</p>
      </div>

      {error ? <ErrorBanner title="Çalışma planı alınamadı" message={error} onRetry={loadPlan} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5 flex items-center gap-4"><Flame className="h-8 w-8 text-orange-500" /><div><p className="text-2xl font-bold">{data?.streakCount || 0}</p><p className="text-sm text-muted-foreground">Günlük seri</p></div></CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4"><Target className="h-8 w-8 text-brand-primary" /><div><p className="text-2xl font-bold">{data?.xpPoints || 0}</p><p className="text-sm text-muted-foreground">Toplam XP</p></div></CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4"><CalendarDays className="h-8 w-8 text-green-600" /><div><p className="text-2xl font-bold">{planItems.length}</p><p className="text-sm text-muted-foreground">Toplam plan</p></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seviye İlerlemesi</CardTitle>
          <CardDescription>Bir sonraki seviyeye kalan XP</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Seviye {Math.max(1, Math.floor((data?.xpPoints || 0) / 100) + 1)}</span>
            <span>{(data?.xpPoints || 0) % 100} / 100 XP</span>
          </div>
          <Progress value={(data?.xpPoints || 0) % 100} className="h-3" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Planlarım</CardTitle>
              <Button onClick={() => setOpen(true)} size="sm">
                <PlusCircle className="h-4 w-4 mr-2" />
                Plan Ekle
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {Object.entries(groupedPlans).map(([group, items]) => (
              <div key={group} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{group} Planlar</h3>
                  <Badge variant="outline">{items.length}</Badge>
                </div>
                {items.length === 0 ? <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Bu grupta henüz plan yok.</div> : null}
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border p-4">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.duration} • {item.reason || item.status}</p>
                    </div>
                    <Badge variant="outline">{item.status}</Badge>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bugünkü Öneriler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {planItems.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-start gap-3 rounded-xl bg-muted/40 p-4">
                <CheckCircle2 className={`h-5 w-5 mt-0.5 ${item.done ? 'text-green-600' : 'text-muted-foreground'}`} />
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.reason || item.status}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Çalışma Planı</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Plan başlığı" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder="Süre" value={form.duration} onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))} />
              <Select value={form.planType} onValueChange={(value) => setForm((prev) => ({ ...prev, planType: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gunluk">Günlük</SelectItem>
                  <SelectItem value="Haftalik">Haftalık</SelectItem>
                  <SelectItem value="Aylik">Aylık</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Bugun">Bugün</SelectItem>
                <SelectItem value="Siradaki">Sıradaki</SelectItem>
                <SelectItem value="Tekrar">Tekrar</SelectItem>
                <SelectItem value="Hafta Sonu">Hafta Sonu</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Not / amaç" value={form.reason} onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button onClick={handleAddPlan} disabled={!form.title.trim()}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
