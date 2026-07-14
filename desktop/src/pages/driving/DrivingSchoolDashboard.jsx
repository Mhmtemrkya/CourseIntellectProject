import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Banknote, BookOpen, Brain, CalendarClock, CarFront, GraduationCap,
  RefreshCw, ShieldCheck, Users, Wrench,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { fetchDrivingSchoolDashboard } from '../../lib/api/modules';
import { useNavigate } from 'react-router-dom';

const KPI_META = [
  ['activeStudents', 'Aktif Öğrenci', Users, '#3b82f6'],
  ['todayDrivingLessons', 'Bugünkü Direksiyon', CarFront, '#f97316'],
  ['todayTheoryLessons', 'Bugünkü Teorik Ders', GraduationCap, '#8b5cf6'],
  ['activeInstructors', 'Aktif Öğretmen', Users, '#10b981'],
  ['activeVehicles', 'Aktif Araç', CarFront, '#06b6d4'],
  ['vehiclesInMaintenance', 'Bakımdaki Araç', Wrench, '#ef4444'],
  ['missingDocuments', 'Eksik Evrak', AlertTriangle, '#f59e0b'],
  ['expiringDocuments', 'Yaklaşan Evrak Bitişi', ShieldCheck, '#eab308'],
  ['upcomingExams', 'Yaklaşan Sınav', CalendarClock, '#6366f1'],
  ['todayCollections', 'Bugünkü Tahsilat', Banknote, '#16a34a'],
];

export default function DrivingSchoolDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setData(await fetchDrivingSchoolDashboard()); }
    catch (err) { setError(err.message || 'Sürücü kursu paneli yüklenemedi.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const series = data?.charts?.monthlyRegistrations || [];
  const maximum = useMemo(() => Math.max(1, ...series.map((item) => Number(item.value) || 0)), [series]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2"><Badge className="border-0 bg-orange-500/15 text-orange-600"><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Güvenli kurum alanı</Badge></div>
          <h1 className="text-3xl font-black tracking-tight">Sürücü Kursu Operasyon Merkezi</h1>
          <p className="mt-1 text-muted-foreground">Öğrenci, ders, öğretmen ve filo operasyonlarının canlı özeti</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Yenile</Button>
      </div>

      {error ? <ErrorBanner title="Panel açılamadı" message={error} onRetry={load} /> : null}

      {data && <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {KPI_META.map(([key, label, Icon, color], index) => {
            const raw = data.kpis?.[key] ?? 0;
            const value = key === 'todayCollections' ? `₺${Number(raw).toLocaleString('tr-TR')}` : raw;
            return <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035 }}>
              <Card className="overflow-hidden border-foreground/10 shadow-sm">
                <CardContent className="flex items-center gap-4 p-5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ color, backgroundColor: `${color}18` }}><Icon className="h-6 w-6" /></span>
                  <div><p className="text-2xl font-black">{value}</p><p className="text-xs font-semibold text-muted-foreground">{label}</p></div>
                </CardContent>
              </Card>
            </motion.div>;
          })}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          <Card className="border-foreground/10 shadow-sm">
            <CardHeader><CardTitle>Aylık Yeni Kayıtlar</CardTitle></CardHeader>
            <CardContent>
              <div className="flex h-64 items-end gap-3 rounded-2xl bg-gradient-to-b from-orange-500/5 to-transparent p-5">
                {series.map((item) => <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-xs font-bold">{item.value}</span>
                  <div className="w-full rounded-t-xl bg-gradient-to-t from-orange-600 to-amber-400 shadow-sm transition-all" style={{ height: `${Math.max(5, (Number(item.value) / maximum) * 82)}%` }} />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-foreground/10 shadow-sm">
            <CardHeader><CardTitle>Operasyon Uyarıları</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(data.alerts || []).length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center text-center"><ShieldCheck className="h-10 w-10 text-emerald-500" /><p className="mt-3 font-bold">Kritik uyarı yok</p><p className="mt-1 text-sm text-muted-foreground">Evrak, bakım ve çakışma kontrolleri güncel.</p></div> : data.alerts.map((alert, index) => <div key={`${alert.type}-${alert.title}-${index}`} className={`rounded-xl border p-3 ${alert.severity === 'Critical' ? 'border-red-500/30 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}><div className="flex items-center justify-between gap-2"><b>{alert.title}</b><Badge className={alert.severity === 'Critical' ? 'bg-red-500' : 'bg-amber-500'}>{alert.severity === 'Critical' ? 'Kritik' : 'Uyarı'}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{alert.message}</p></div>)}
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <button type="button" onClick={() => navigate('/content')} className="flex items-center gap-4 rounded-2xl border border-foreground/10 bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-orange-500/40">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-500"><BookOpen /></span><span><b className="block">Konu Anlatımı</b><span className="text-sm text-muted-foreground">Mevcut video, PDF ve içerik yönetimini kullan</span></span>
          </button>
          <button type="button" onClick={() => navigate('/questions')} className="flex items-center gap-4 rounded-2xl border border-foreground/10 bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-orange-500/40">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-500"><Brain /></span><span><b className="block">Soru Bankası</b><span className="text-sm text-muted-foreground">Mevcut soru stüdyosu ve sınav altyapısını kullan</span></span>
          </button>
        </div>
      </>}
    </motion.div>
  );
}
