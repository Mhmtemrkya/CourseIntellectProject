import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, CheckCircle2, Clock3, Download, Gauge, Route, ShieldCheck, Star } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { PremiumPanel, PremiumStatusPill } from '../../components/ui/premium-dashboard';
import { useToast } from '../../hooks/use-toast';
import { fetchDrivingLessons } from '../../lib/api/modules';
import {
  DRIVING_EVALUATION_CATEGORIES, DRIVING_EVALUATION_CRITERIA, downloadDrivingEvaluationCsv,
  evaluationScores, lessonAverage,
} from '../../lib/drivingEvaluation';
import { DrivingNotice, DrivingPage, DrivingPageHeader, DrivingStatCard, itemVariants } from './_shared';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days) => { const value = new Date(); value.setDate(value.getDate() - days); return value.toISOString().slice(0, 10); };
const dateTime = (value) => value ? new Date(value).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

export default function DrivingLessons() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({ from: daysAgo(30), to: today() });
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const toExclusive = new Date(`${filters.to}T00:00:00`);
      toExclusive.setDate(toExclusive.getDate() + 1);
      const rows = await fetchDrivingLessons({
        from: new Date(`${filters.from}T00:00:00`).toISOString(),
        to: toExclusive.toISOString(),
      });
      setLessons(Array.isArray(rows) ? rows : []);
    } catch (error) {
      toast({ title: 'Direksiyon dersleri alınamadı', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters.from, filters.to, toast]);

  useEffect(() => { load(); }, [load]);
  // Ders başlama/bitme canlı izlendiği için panel kendini tazeler.
  useEffect(() => { const timer = window.setInterval(() => load(true), 30000); return () => window.clearInterval(timer); }, [load]);

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

  return (
    <DrivingPage testId="driving-lessons-page">
      <DrivingPageHeader
        title="Direksiyon Dersleri"
        description="Ön kontrol, kilometre, değerlendirme ve harcanan ders süresini canlı izleyin."
        icon={Route}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        actions={(
          <>
            <label className="space-y-1 text-xs font-bold">
              <span>Başlangıç</span>
              <Input type="date" value={filters.from} max={filters.to} onChange={(e) => setFilters((x) => ({ ...x, from: e.target.value }))} />
            </label>
            <label className="space-y-1 text-xs font-bold">
              <span>Bitiş</span>
              <Input type="date" value={filters.to} min={filters.from} onChange={(e) => setFilters((x) => ({ ...x, to: e.target.value }))} />
            </label>
            <Button variant="outline" disabled={!lessons.length} onClick={exportReport}>
              <Download className="mr-2 h-4 w-4" />CSV Raporu
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <DrivingStatCard label="Devam Eden Ders" value={stats.ongoing} caption="Şu an direksiyonda" icon={Activity} tone="emerald" />
        <DrivingStatCard label="Tamamlanan Ders" value={stats.completed} caption="Seçili aralıkta" icon={CheckCircle2} tone="blue" />
        <DrivingStatCard label="İşlenen Süre" value={`${stats.minutes} dk`} caption="Defterden düşen" icon={Clock3} tone="brand" />
        <DrivingStatCard label="Ortalama Puan" value={`${stats.score} / 5`} caption="24 kriter ortalaması" icon={Star} tone="amber" />
      </div>

      <motion.div variants={itemVariants}>
        <PremiumPanel title="Kategori Performansı" description="Değerlendirme kategorilerinin ortalaması">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ left: 8, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--foreground) / 0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  formatter={(value) => [`${value} / 5`, 'Ortalama']}
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 12,
                    color: 'hsl(var(--foreground))',
                  }}
                />
                <Bar dataKey="puan" fill="hsl(var(--brand-accent))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PremiumPanel>
      </motion.div>

      <motion.div variants={itemVariants}>
        <PremiumPanel title="Ders Hareketleri" description={`${lessons.length} ders kaydı`}>
          {loading ? (
            <div className="flex min-h-52 items-center justify-center"><LoadingDots /></div>
          ) : lessons.length === 0 ? (
            <DrivingNotice icon={Route} title="Bu tarih aralığında ders hareketi yok." message="Tarih aralığını genişletmeyi deneyin." />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {lessons.map((lesson) => {
                const score = lessonAverage(lesson);
                const details = evaluationScores(lesson);
                const completed = Boolean(lesson.completedAtUtc);
                const allChecks = lesson.brakesOk && lesson.tiresOk && lesson.lightsOk && lesson.fluidsOk;
                return (
                  <div key={lesson.id} className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-5 transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--brand-accent)/0.28)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-black">{lesson.studentName}</h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">{lesson.instructorName} • {lesson.vehiclePlate}</p>
                      </div>
                      <PremiumStatusPill tone={completed ? 'done' : 'live'}>
                        {completed ? 'Tamamlandı' : 'Devam Ediyor'}
                      </PremiumStatusPill>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                      <div className="rounded-xl border border-foreground/10 bg-background/60 p-3">
                        <Clock3 className="mb-1 h-4 w-4 text-[hsl(var(--brand-accent))]" />
                        <b>{dateTime(lesson.startedAtUtc)}</b>
                        <p className="text-xs text-muted-foreground">{completed ? `${lesson.chargedMinutes} dakika işlendi` : 'Ders aktif'}</p>
                      </div>
                      <div className="rounded-xl border border-foreground/10 bg-background/60 p-3">
                        <Gauge className="mb-1 h-4 w-4 text-cyan-500" />
                        <b>{lesson.startKilometer} → {lesson.endKilometer ?? '...'} km</b>
                        <p className="text-xs text-muted-foreground">Araç kilometre kaydı</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <PremiumStatusPill tone={allChecks ? 'done' : 'danger'}>
                        <ShieldCheck className="mr-1 h-3.5 w-3.5" />Ön kontrol {allChecks ? 'tam' : 'eksik'}
                      </PremiumStatusPill>
                      {score != null ? (
                        <PremiumStatusPill tone="warn"><Star className="mr-1 h-3.5 w-3.5" />{score.toFixed(1)} / 5</PremiumStatusPill>
                      ) : null}
                    </div>
                    {Object.keys(details).length > 0 ? (
                      <details className="mt-3 rounded-xl border border-foreground/10 p-3">
                        <summary className="cursor-pointer text-sm font-bold">24 kriterli değerlendirmeyi göster</summary>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {DRIVING_EVALUATION_CRITERIA.filter((item) => details[item.key] != null).map((item) => (
                            <div key={item.key} className="flex justify-between gap-2 text-xs">
                              <span className="text-muted-foreground">{item.label}</span>
                              <b>{details[item.key]} / 5</b>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                    {(lesson.instructorNote || lesson.preCheckNote) ? (
                      <div className="mt-3 rounded-xl border border-dashed border-foreground/15 p-3 text-xs text-muted-foreground">
                        {lesson.instructorNote || lesson.preCheckNote}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </PremiumPanel>
      </motion.div>
    </DrivingPage>
  );
}
