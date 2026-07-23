import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, CheckCircle2, Clock3, Download, Gauge, Plus, Route, ShieldCheck, Star } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { PremiumPanel, PremiumStatusPill } from '../../components/ui/premium-dashboard';
import { useToast } from '../../hooks/use-toast';
import { fetchDrivingAppointments, fetchDrivingLessons, recordManualDrivingLesson } from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import {
  DRIVING_EVALUATION_CRITERIA, downloadDrivingEvaluationCsv,
  evaluationScores, lessonAverage,
} from '../../lib/drivingEvaluation';
import { DrivingNotice, DrivingPage, DrivingPageHeader, DrivingStatCard, itemVariants } from './_shared';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days) => { const value = new Date(); value.setDate(value.getDate() - days); return value.toISOString().slice(0, 10); };
const dateTime = (value) => value ? new Date(value).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
const localInput = (value) => {
  const date = value ? new Date(value) : new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const initialManualForm = () => ({
  appointmentId: '',
  startedAtUtc: localInput(),
  completedAtUtc: localInput(),
  startKilometer: '',
  endKilometer: '',
  trafficRulesScore: '3',
  vehicleControlScore: '3',
  maneuversScore: '3',
  safetyScore: '3',
  instructorNote: '',
  reason: '',
});

export default function DrivingLessons({ embedded = false }) {
  const { toast } = useToast();
  const { can } = useDrivingPermissions();
  const [filters, setFilters] = useState({ from: daysAgo(30), to: today() });
  const [lessons, setLessons] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualForm, setManualForm] = useState(initialManualForm);
  const canRecordManual = can(DRIVING.lessonManualRecord);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const toExclusive = new Date(`${filters.to}T00:00:00`);
      toExclusive.setDate(toExclusive.getDate() + 1);
      const params = {
        from: new Date(`${filters.from}T00:00:00`).toISOString(),
        to: toExclusive.toISOString(),
      };
      const [rows, appointmentRows] = await Promise.all([
        fetchDrivingLessons(params),
        canRecordManual ? fetchDrivingAppointments(params) : Promise.resolve([]),
      ]);
      setLessons(Array.isArray(rows) ? rows : []);
      setAppointments(Array.isArray(appointmentRows) ? appointmentRows : []);
    } catch (error) {
      toast({ title: 'Direksiyon dersleri alınamadı', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canRecordManual, filters.from, filters.to, toast]);

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

  const eligibleAppointments = useMemo(() => {
    const lessonAppointmentIds = new Set(lessons.map((lesson) => lesson.appointmentId));
    return appointments.filter((appointment) =>
      ['Planned', 'Approved', 'CheckedIn'].includes(appointment.status)
      && !lessonAppointmentIds.has(appointment.id)
      && new Date(appointment.endsAtUtc) <= new Date());
  }, [appointments, lessons]);

  const exportReport = () => {
    downloadDrivingEvaluationCsv(`surus-degerlendirmeleri-${filters.from}-${filters.to}.csv`, lessons);
    toast({ title: 'Ayrıntılı sürüş raporu indirildi', description: `${lessons.length} ders ve 24 kriter dışa aktarıldı.` });
  };

  const selectManualAppointment = (appointmentId) => {
    const appointment = eligibleAppointments.find((item) => item.id === appointmentId);
    setManualForm((current) => ({
      ...current,
      appointmentId,
      startedAtUtc: appointment ? localInput(appointment.startsAtUtc) : current.startedAtUtc,
      completedAtUtc: appointment ? localInput(appointment.endsAtUtc) : current.completedAtUtc,
    }));
  };

  const saveManualLesson = async (event) => {
    event.preventDefault();
    if (manualForm.reason.trim().length < 10) {
      toast({ title: 'Gerekçe zorunlu', description: 'Manuel kayıt gerekçesi en az 10 karakter olmalıdır.', variant: 'destructive' });
      return;
    }
    setManualSaving(true);
    try {
      await recordManualDrivingLesson({
        ...manualForm,
        startedAtUtc: new Date(manualForm.startedAtUtc).toISOString(),
        completedAtUtc: new Date(manualForm.completedAtUtc).toISOString(),
        startKilometer: Number(manualForm.startKilometer),
        endKilometer: Number(manualForm.endKilometer),
        trafficRulesScore: Number(manualForm.trafficRulesScore),
        vehicleControlScore: Number(manualForm.vehicleControlScore),
        maneuversScore: Number(manualForm.maneuversScore),
        safetyScore: Number(manualForm.safetyScore),
        instructorNote: manualForm.instructorNote.trim(),
        reason: manualForm.reason.trim(),
      });
      toast({ title: 'Ders hareketi güvenle kaydedildi', description: 'Ders hakkı, kilometre ve denetim kaydı birlikte güncellendi.' });
      setManualForm(initialManualForm());
      setManualOpen(false);
      await load(true);
    } catch (error) {
      toast({ title: 'Ders hareketi kaydedilemedi', description: error.message, variant: 'destructive' });
    } finally {
      setManualSaving(false);
    }
  };

  const Wrapper = embedded ? Fragment : DrivingPage;
  const wrapperProps = embedded ? {} : { testId: 'driving-lessons-page' };

  return (
    <Wrapper {...wrapperProps}>
      <DrivingPageHeader
        title="Direksiyon Dersleri"
        description="Ön kontrol, kilometre, değerlendirme ve harcanan ders süresini canlı izleyin."
        icon={Route}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        actions={(
          <>
            <label className="w-full space-y-1 text-xs font-bold sm:w-auto">
              <span>Başlangıç</span>
              <Input className="w-full sm:w-auto" type="date" value={filters.from} max={filters.to} onChange={(e) => setFilters((x) => ({ ...x, from: e.target.value }))} />
            </label>
            <label className="w-full space-y-1 text-xs font-bold sm:w-auto">
              <span>Bitiş</span>
              <Input className="w-full sm:w-auto" type="date" value={filters.to} min={filters.from} onChange={(e) => setFilters((x) => ({ ...x, to: e.target.value }))} />
            </label>
            <Button className="w-full sm:w-auto" variant="outline" disabled={!lessons.length} onClick={exportReport}>
              <Download className="mr-2 h-4 w-4" />CSV Raporu
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:h-full">
        <DrivingStatCard label="Devam Eden Ders" value={stats.ongoing} caption="Şu an direksiyonda" icon={Activity} tone="emerald" />
        <DrivingStatCard label="Tamamlanan Ders" value={stats.completed} caption="Seçili aralıkta" icon={CheckCircle2} tone="blue" />
        <DrivingStatCard label="İşlenen Süre" value={`${stats.minutes} dk`} caption="Defterden düşen" icon={Clock3} tone="brand" />
        <DrivingStatCard label="Ortalama Puan" value={`${stats.score} / 5`} caption="24 kriter ortalaması" icon={Star} tone="amber" />
      </div>

      <motion.div variants={itemVariants}>
        <PremiumPanel
          title="Ders Hareketleri"
          description={`${lessons.length} ders kaydı`}
          action={canRecordManual ? (
            <Button size="sm" onClick={() => setManualOpen((value) => !value)}>
              <Plus className="mr-1.5 h-4 w-4" /><span className="hidden sm:inline">Yeni Ders Kaydı</span><span className="sm:hidden">Yeni</span>
            </Button>
          ) : null}
        >
          {manualOpen && canRecordManual ? (
            <form className="mb-5 space-y-4 rounded-2xl border border-[hsl(var(--brand-accent)/0.3)] bg-[hsl(var(--brand-accent)/0.04)] p-4" onSubmit={saveManualLesson}>
              <div>
                <h3 className="font-black">Yetkili manuel ders hareketi</h3>
                <p className="mt-1 text-xs text-muted-foreground">Yalnızca geçmiş ve henüz işlenmemiş bir randevu seçilebilir. İşlem ders bakiyesine, araç kilometresine ve denetim kaydına birlikte yansır.</p>
              </div>
              <label className="block space-y-1.5 text-sm font-semibold">
                <span>Planlanmış randevu</span>
                <select required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={manualForm.appointmentId} onChange={(e) => selectManualAppointment(e.target.value)}>
                  <option value="">Randevu seçin</option>
                  {eligibleAppointments.map((item) => (
                    <option key={item.id} value={item.id}>{dateTime(item.startsAtUtc)} • {item.studentName} • {item.instructorName} • {item.vehiclePlate}</option>
                  ))}
                </select>
              </label>
              {eligibleAppointments.length === 0 ? <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Bu tarih aralığında manuel kayda uygun geçmiş randevu bulunmuyor.</p> : null}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-1.5 text-sm font-semibold"><span>Başlangıç</span><Input required type="datetime-local" value={manualForm.startedAtUtc} onChange={(e) => setManualForm((x) => ({ ...x, startedAtUtc: e.target.value }))} /></label>
                <label className="space-y-1.5 text-sm font-semibold"><span>Bitiş</span><Input required type="datetime-local" value={manualForm.completedAtUtc} onChange={(e) => setManualForm((x) => ({ ...x, completedAtUtc: e.target.value }))} /></label>
                <label className="space-y-1.5 text-sm font-semibold"><span>Başlangıç km</span><Input required inputMode="numeric" type="number" min="0" value={manualForm.startKilometer} onChange={(e) => setManualForm((x) => ({ ...x, startKilometer: e.target.value }))} /></label>
                <label className="space-y-1.5 text-sm font-semibold"><span>Bitiş km</span><Input required inputMode="numeric" type="number" min="0" value={manualForm.endKilometer} onChange={(e) => setManualForm((x) => ({ ...x, endKilometer: e.target.value }))} /></label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['trafficRulesScore', 'Trafik kuralları'],
                  ['vehicleControlScore', 'Araç hâkimiyeti'],
                  ['maneuversScore', 'Manevralar'],
                  ['safetyScore', 'Güvenlik'],
                ].map(([key, label]) => (
                  <label key={key} className="space-y-1.5 text-sm font-semibold"><span>{label} (1-5)</span><Input required type="number" min="1" max="5" value={manualForm[key]} onChange={(e) => setManualForm((x) => ({ ...x, [key]: e.target.value }))} /></label>
                ))}
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <label className="space-y-1.5 text-sm font-semibold"><span>Ders notu</span><Input maxLength={2000} placeholder="Derste çalışılan konular ve gözlemler" value={manualForm.instructorNote} onChange={(e) => setManualForm((x) => ({ ...x, instructorNote: e.target.value }))} /></label>
                <label className="space-y-1.5 text-sm font-semibold"><span>Manuel kayıt gerekçesi</span><Input required minLength={10} maxLength={500} placeholder="Neden sonradan girildi? (en az 10 karakter)" value={manualForm.reason} onChange={(e) => setManualForm((x) => ({ ...x, reason: e.target.value }))} /></label>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setManualOpen(false)}>Vazgeç</Button>
                <Button disabled={manualSaving || !manualForm.appointmentId}>{manualSaving ? 'Kaydediliyor…' : 'Ders Hareketini Kaydet'}</Button>
              </div>
            </form>
          ) : null}
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
    </Wrapper>
  );
}
