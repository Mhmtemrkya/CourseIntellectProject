import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Clock3, Download, Gauge, RefreshCw, Route, ShieldCheck, Star } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import { fetchDrivingLessons } from '../../lib/api/modules';
import {
  DRIVING_EVALUATION_CATEGORIES, DRIVING_EVALUATION_CRITERIA, downloadDrivingEvaluationCsv,
  evaluationScores, lessonAverage,
} from '../../lib/drivingEvaluation';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days) => { const value = new Date(); value.setDate(value.getDate() - days); return value.toISOString().slice(0, 10); };
const dateTime = (value) => value ? new Date(value).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

function Metric({ icon: Icon, label, value, tone }) {
  return <Card className="overflow-hidden"><CardContent className="flex items-center gap-4 p-5"><div className={`rounded-2xl p-3 ${tone}`}><Icon className="h-6 w-6" /></div><div><p className="text-2xl font-black">{value}</p><p className="text-xs font-semibold text-muted-foreground">{label}</p></div></CardContent></Card>;
}

export default function DrivingLessons() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({ from: daysAgo(30), to: today() });
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const toExclusive = new Date(`${filters.to}T00:00:00`); toExclusive.setDate(toExclusive.getDate() + 1);
      const rows = await fetchDrivingLessons({ from: new Date(`${filters.from}T00:00:00`).toISOString(), to: toExclusive.toISOString() });
      setLessons(Array.isArray(rows) ? rows : []);
    } catch (error) {
      toast({ title: 'Direksiyon dersleri alınamadı', description: error.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [filters.from, filters.to, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const timer = window.setInterval(load, 30000); return () => window.clearInterval(timer); }, [load]);

  const stats = useMemo(() => {
    const completed = lessons.filter((x) => x.completedAtUtc);
    const scores = completed.map(lessonAverage).filter(Number.isFinite);
    return {
      ongoing: lessons.length - completed.length,
      completed: completed.length,
      minutes: completed.reduce((sum, x) => sum + (x.chargedMinutes || 0), 0),
      score: scores.length ? (scores.reduce((sum, x) => sum + x, 0) / scores.length).toFixed(1) : '-',
    };
  }, [lessons]);

  const categoryData = useMemo(() => DRIVING_EVALUATION_CATEGORIES.map((category) => {
    const values = lessons.map((lesson) => lesson[category.scoreKey]).filter((value) => value != null).map(Number).filter(Number.isFinite);
    return { name: category.label, puan: values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0 };
  }), [lessons]);

  const exportReport = () => {
    downloadDrivingEvaluationCsv(`surus-degerlendirmeleri-${filters.from}-${filters.to}.csv`, lessons);
    toast({ title: 'Ayrıntılı sürüş raporu indirildi', description: `${lessons.length} ders ve 24 kriter dışa aktarıldı.` });
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-black tracking-tight">Direksiyon Dersleri</h1><p className="text-muted-foreground">Ön kontrol, kilometre, değerlendirme ve harcanan ders süresini canlı izleyin.</p></div>
      <div className="flex flex-wrap items-end gap-2"><label className="space-y-1 text-xs font-bold"><span>Başlangıç</span><Input type="date" value={filters.from} max={filters.to} onChange={(e) => setFilters((x) => ({ ...x, from: e.target.value }))} /></label><label className="space-y-1 text-xs font-bold"><span>Bitiş</span><Input type="date" value={filters.to} min={filters.from} onChange={(e) => setFilters((x) => ({ ...x, to: e.target.value }))} /></label><Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Yenile</Button><Button variant="outline" disabled={!lessons.length} onClick={exportReport}><Download className="mr-2 h-4 w-4" />CSV Raporu</Button></div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={Activity} label="Devam eden ders" value={stats.ongoing} tone="bg-emerald-500/10 text-emerald-600" />
      <Metric icon={CheckCircle2} label="Tamamlanan ders" value={stats.completed} tone="bg-blue-500/10 text-blue-600" />
      <Metric icon={Clock3} label="İşlenen toplam süre" value={`${stats.minutes} dk`} tone="bg-orange-500/10 text-orange-600" />
      <Metric icon={Star} label="Ortalama değerlendirme" value={`${stats.score} / 5`} tone="bg-amber-500/10 text-amber-600" />
    </div>
    <Card>
      <CardHeader><CardTitle>Kategori performansı</CardTitle></CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} margin={{ left: 8, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} />
              <Tooltip formatter={(value) => [`${value} / 5`, 'Ortalama']} />
              <Bar dataKey="puan" fill="#f97316" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Route className="text-orange-500" />Ders hareketleri</CardTitle></CardHeader>
      <CardContent>
        {loading ? <div className="flex min-h-52 items-center justify-center"><LoadingDots /></div> : lessons.length === 0 ? <div className="flex min-h-52 flex-col items-center justify-center text-center text-muted-foreground"><Route className="mb-3 h-12 w-12 text-orange-400" /><b>Bu tarih aralığında ders hareketi yok.</b></div> : <div className="grid gap-4 xl:grid-cols-2">{lessons.map((lesson) => {
          const score = lessonAverage(lesson); const details = evaluationScores(lesson); const completed = Boolean(lesson.completedAtUtc); const allChecks = lesson.brakesOk && lesson.tiresOk && lesson.lightsOk && lesson.fluidsOk;
          return <div key={lesson.id} className="rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black">{lesson.studentName}</h3><p className="text-sm text-muted-foreground">{lesson.instructorName} • {lesson.vehiclePlate}</p></div><Badge className={completed ? 'bg-slate-600' : 'bg-emerald-600'}>{completed ? 'Tamamlandı' : 'Devam Ediyor'}</Badge></div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><div className="rounded-xl bg-muted/60 p-3"><Clock3 className="mb-1 h-4 w-4 text-orange-500" /><b>{dateTime(lesson.startedAtUtc)}</b><p className="text-xs text-muted-foreground">{completed ? `${lesson.chargedMinutes} dakika işlendi` : 'Ders aktif'}</p></div><div className="rounded-xl bg-muted/60 p-3"><Gauge className="mb-1 h-4 w-4 text-cyan-500" /><b>{lesson.startKilometer} → {lesson.endKilometer ?? '...'} km</b><p className="text-xs text-muted-foreground">Araç kilometre kaydı</p></div></div>
            <div className="mt-3 flex flex-wrap items-center gap-2"><Badge variant="outline" className={allChecks ? 'border-emerald-500/40 text-emerald-600' : 'border-red-500/40 text-red-600'}><ShieldCheck className="mr-1 h-3.5 w-3.5" />Ön kontrol {allChecks ? 'tam' : 'eksik'}</Badge>{score != null && <Badge variant="outline" className="border-amber-500/40 text-amber-600"><Star className="mr-1 h-3.5 w-3.5" />{score.toFixed(1)} / 5</Badge>}</div>
            {Object.keys(details).length > 0 && <details className="mt-3 rounded-xl border p-3"><summary className="cursor-pointer text-sm font-bold">24 kriterli değerlendirmeyi göster</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{DRIVING_EVALUATION_CRITERIA.filter((item) => details[item.key] != null).map((item) => <div key={item.key} className="flex justify-between gap-2 text-xs"><span className="text-muted-foreground">{item.label}</span><b>{details[item.key]} / 5</b></div>)}</div></details>}
            {(lesson.instructorNote || lesson.preCheckNote) && <div className="mt-3 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">{lesson.instructorNote || lesson.preCheckNote}</div>}
          </div>;
        })}</div>}
      </CardContent>
    </Card>
  </div>;
}
