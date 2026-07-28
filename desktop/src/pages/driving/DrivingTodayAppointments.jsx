import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CarFront, CheckCircle2, Clock, RefreshCw, UserCheck, UserX } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useToast } from '../../hooks/use-toast';
import { fetchDrivingTodayAppointments, markDrivingAttendance } from '../../lib/api/modules';
import { DRIVING, useDrivingPermissions } from '../../lib/drivingPermissions';
import { DrivingLoading, DrivingNotice, DrivingStatCard } from './_shared';
import ConsentCompletionGate, { useConsentGate } from '../../components/consent/ConsentCompletionGate';

const todayInput = () => {
  const d = new Date(Date.now() + 3 * 3600 * 1000); // UTC+3 yerel gün
  return d.toISOString().slice(0, 10);
};
const timeRange = (a, b) => {
  const f = (v) => new Date(v).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return `${f(a)} – ${f(b)}`;
};

// Durum → rozet tonu.
const STATUS_TONE = {
  Completed: 'border-emerald-400/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200',
  NoShow: 'border-rose-400/40 bg-rose-500/12 text-rose-700 dark:text-rose-200',
  Planned: 'border-sky-400/40 bg-sky-500/12 text-sky-700 dark:text-sky-200',
  Approved: 'border-sky-400/40 bg-sky-500/12 text-sky-700 dark:text-sky-200',
  CheckedIn: 'border-amber-400/40 bg-amber-500/12 text-amber-700 dark:text-amber-200',
  InProgress: 'border-amber-400/40 bg-amber-500/12 text-amber-700 dark:text-amber-200',
};

export default function DrivingTodayAppointments() {
  const { toast } = useToast();
  const { can } = useDrivingPermissions();
  const canView = can(DRIVING.lessonViewAll);
  const canMark = can(DRIVING.lessonMarkNoShow);

  const [date, setDate] = useState(todayInput);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const gate = useConsentGate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchDrivingTodayAppointments(date));
    } catch (e) {
      toast({ title: 'Randevular alınamadı', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [date, toast]);

  useEffect(() => { load(); }, [load]);

  const items = data?.items || [];
  const summary = data?.summary || { total: 0, completed: 0, awaitingAttendance: 0, noShow: 0 };

  // "Geldi" = ders fiilen verildi. Onam kapısı burada devreye girer; YUMUŞAKTIR —
  // eksik form uyarır ama "İmzasız devam et" ile geçilebilir, ofisin işi durmaz.
  const markArrived = (item) => gate.run(() => mark(item, true), { appointmentId: item.id });

  const mark = async (item, attended) => {
    setBusyId(`${item.id}:${attended}`);
    try {
      const res = await markDrivingAttendance(item.id, attended);
      toast({
        title: attended ? 'Geldi olarak işaretlendi' : 'Gelmedi olarak işaretlendi',
        description: attended
          ? 'Ders süresi pakete işlenmiş kaldı.'
          : `Süre pakete iade edildi (${res.refundedMinutes} dk). Süreden düşülmedi.`,
      });
      await load();
    } catch (e) {
      toast({ title: 'İşaretlenemedi', description: e?.response?.data?.message || e.message, variant: 'destructive' });
    } finally {
      setBusyId('');
    }
  };

  const grouped = useMemo(() => ({
    awaiting: items.filter((x) => x.canMarkAttendance),
    others: items.filter((x) => !x.canMarkAttendance),
  }), [items]);

  if (loading && !data) return <DrivingLoading />;
  if (!canView) {
    return <DrivingNotice icon={Clock} title="Yetki yok" message="Bugünün randevularını görüntülemek için ders görüntüleme izniniz olmalı." />;
  }

  const row = (item) => (
    <section key={item.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-foreground/10 p-4">
      <div className="flex min-w-[64px] flex-col items-center rounded-xl bg-foreground/[0.04] px-3 py-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="mt-1 whitespace-nowrap text-xs font-bold">{timeRange(item.startsAtUtc, item.endsAtUtc)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <b className="truncate">{item.studentName}</b>
          <Badge variant="outline" className={STATUS_TONE[item.status] || ''}>{item.statusLabel}</Badge>
          {item.autoCompleted && !item.attendanceConfirmed && (
            <Badge variant="outline" className="border-amber-400/40 text-amber-700 dark:text-amber-200">Yoklama bekliyor</Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.instructorName || 'Eğitmen atanmadı'}
          {item.plate ? <> • <CarFront className="inline h-3 w-3" /> {item.plate}</> : null}
          {' • '}{item.scheduledMinutes} dk
          {item.chargedMinutes ? ` • işlenen: ${item.chargedMinutes} dk` : ''}
        </p>
      </div>
      {item.canMarkAttendance && canMark ? (
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" disabled={!!busyId} onClick={() => markArrived(item)}
            className="border-emerald-400/50 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300">
            <UserCheck className="mr-1 h-4 w-4" />Geldi
          </Button>
          <Button size="sm" variant="outline" disabled={!!busyId} onClick={() => mark(item, false)}
            className="border-rose-400/50 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300">
            <UserX className="mr-1 h-4 w-4" />Gelmedi
          </Button>
        </div>
      ) : item.attendanceConfirmed ? (
        <Badge variant="outline" className="shrink-0 border-foreground/15 text-muted-foreground">Teyit edildi</Badge>
      ) : null}
    </section>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />Gün
          <Input type="date" className="h-10 w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Yenile
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <DrivingStatCard label="Randevu" value={summary.total} caption="Bu gün" icon={CalendarDays} tone="brand" />
        <DrivingStatCard label="Yoklama bekleyen" value={summary.awaitingAttendance} caption="Geldi/gelmedi" icon={Clock} tone="amber" />
        <DrivingStatCard label="Tamamlanan" value={summary.completed} caption="İşlendi" icon={CheckCircle2} tone="emerald" />
        <DrivingStatCard label="Gelmedi" value={summary.noShow} caption="İade edildi" icon={UserX} tone="rose" />
      </div>

      <p className="text-xs text-muted-foreground">
        Randevu saati geçen dersler otomatik <b>Tamamlandı</b> olur ve süre pakete işlenir. Öğrenci gelmediyse
        aşağıdan <b>Gelmedi</b> işaretleyin — süre pakete iade edilir, düşülmez.
      </p>

      {items.length === 0 ? (
        <DrivingNotice icon={CalendarDays} title="Bu gün için randevu yok" message="Seçili günde direksiyon randevusu bulunmuyor." />
      ) : (
        <div className="space-y-4">
          {grouped.awaiting.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-black text-amber-700 dark:text-amber-300">Yoklama Bekleyenler</h3>
              {grouped.awaiting.map(row)}
            </div>
          )}
          {grouped.others.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-black text-muted-foreground">Diğer Randevular</h3>
              {grouped.others.map(row)}
            </div>
          )}
        </div>
      )}

      <ConsentCompletionGate {...gate.props} />
    </div>
  );
}
