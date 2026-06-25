import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck, ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, Clock, XCircle,
} from 'lucide-react';
import { PremiumPanel } from '../../components/ui/premium-dashboard';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { useApp } from '../../context/AppContext';
import { fetchMyAdminTasks, fetchMyDuties, fetchMyDutyStats, updateAdminTaskStatus } from '../../lib/api/modules';
import { useToast } from '../../hooks/use-toast';

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const PAGE_SIZE = 5;

// Nöbet türü → takvim noktası rengi (mockup lejantı).
const TYPE_COLOR = {
  'Sabah Nöbeti': '#f97316',
  'Öğle Arası': '#3b82f6',
  'İdari Nöbet': '#a855f7',
};
function typeColor(type) {
  return TYPE_COLOR[type] || '#94a3b8';
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
function formatDate(value) {
  const d = parseDate(value);
  return d ? d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
}

function statusBadge(duty) {
  const date = parseDate(duty.dutyDateUtc);
  const status = String(duty.status || '');
  if (status.toLowerCase().includes('iptal')) return { label: 'İptal Edildi', cls: 'border-rose-500/30 bg-rose-500/12 text-rose-300' };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (date && date < today) return { label: 'Tamamlandı', cls: 'border-emerald-500/30 bg-emerald-500/12 text-emerald-300' };
  if (date) {
    const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);
    if (diffDays <= 2) return { label: 'Yaklaşıyor', cls: 'border-amber-500/30 bg-amber-500/15 text-amber-300' };
  }
  return { label: 'Planlandı', cls: 'border-sky-500/25 bg-sky-500/12 text-sky-300' };
}

function DutyCalendar({ duties }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthLabel = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(cursor);

  const byDay = useMemo(() => {
    const map = new Map();
    duties.forEach((duty) => {
      const d = parseDate(duty.dutyDateUtc);
      if (d && d.getFullYear() === year && d.getMonth() === month) {
        const list = map.get(d.getDate()) || [];
        list.push(duty);
        map.set(d.getDate(), list);
      }
    });
    return map;
  }, [duties, year, month]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="grid h-7 w-7 place-items-center rounded-lg border border-foreground/10 text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
        <span className="text-sm font-bold capitalize">{monthLabel} Takvimi</span>
        <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="grid h-7 w-7 place-items-center rounded-lg border border-foreground/10 text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {WEEKDAYS.map((day) => <span key={day} className="py-1 font-semibold">{day}</span>)}
        {cells.map((day, index) => {
          if (!day) return <span key={`e${index}`} />;
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const dayDuties = byDay.get(day) || [];
          return (
            <div key={day} className={`relative grid h-9 place-items-center rounded-lg text-xs font-medium ${isToday ? 'bg-[hsl(var(--brand-accent))] text-white' : 'text-foreground'}`}>
              {day}
              {dayDuties.length > 0 ? (
                <span className="absolute bottom-1 flex gap-0.5">
                  {dayDuties.slice(0, 3).map((duty, i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: isToday ? '#fff' : typeColor(duty.dutyType) }} />
                  ))}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#f97316' }} />Sabah Nöbeti</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#3b82f6' }} />Öğle Arası</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#a855f7' }} />İdari Nöbet</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#94a3b8' }} />Diğer</span>
      </div>
    </div>
  );
}

function DutyTable({ duties, emptyText }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(duties.length / PAGE_SIZE));
  const current = duties.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (duties.length === 0) {
    return <div className="rounded-2xl border border-dashed border-foreground/10 p-8 text-center text-sm text-muted-foreground">{emptyText}</div>;
  }

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-foreground/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Tarih</th>
              <th className="px-4 py-3 font-semibold">Gün</th>
              <th className="px-4 py-3 font-semibold">Nöbet Yeri</th>
              <th className="px-4 py-3 font-semibold">Nöbet Türü</th>
              <th className="px-4 py-3 font-semibold">Nöbet Saati</th>
              <th className="px-4 py-3 font-semibold">Açıklama</th>
              <th className="px-4 py-3 font-semibold">Durum</th>
            </tr>
          </thead>
          <tbody>
            {current.map((duty) => {
              const badge = statusBadge(duty);
              return (
                <tr key={duty.id} className="border-b border-foreground/[0.06] last:border-0 hover:bg-foreground/[0.03]">
                  <td className="px-4 py-3 font-medium">{formatDate(duty.dutyDateUtc)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{duty.day || '—'}</td>
                  <td className="px-4 py-3">{duty.location || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: typeColor(duty.dutyType) }} />
                      {duty.dutyType}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{duty.startTime} - {duty.endTime}</td>
                  <td className="px-4 py-3 text-muted-foreground">{duty.description || '—'}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, duties.length)} / {duties.length} nöbet</span>
        <div className="flex items-center gap-1">
          <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-foreground/10 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)} className={`h-8 w-8 rounded-lg text-sm font-semibold ${p === page ? 'bg-[hsl(var(--brand-accent))] text-white' : 'border border-foreground/10 text-muted-foreground'}`}>{p}</button>
          ))}
          <button disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-foreground/10 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

export default function TeacherDuties() {
  const { toast } = useToast();
  useApp();
  const [tab, setTab] = useState('upcoming');
  const [all, setAll] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [rejectingTask, setRejectingTask] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [taskBusy, setTaskBusy] = useState(false);
  const [stats, setStats] = useState({ total: 0, completed: 0, planned: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [duties, statResp, taskResp] = await Promise.all([
        fetchMyDuties('all'),
        fetchMyDutyStats().catch(() => null),
        fetchMyAdminTasks().catch(() => []),
      ]);
      setAll(Array.isArray(duties) ? duties : []);
      setMyTasks(Array.isArray(taskResp) ? taskResp : []);
      if (statResp) setStats(statResp);
    } catch (err) {
      setError(err.message || 'Nöbetler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const upcoming = useMemo(() => all.filter((d) => { const x = parseDate(d.dutyDateUtc); return x && x >= today; }), [all, today]);
  const past = useMemo(() => all.filter((d) => { const x = parseDate(d.dutyDateUtc); return x && x < today; }), [all, today]);
  const respondTask = async (task, status, reason = null) => {
    try {
      setTaskBusy(true);
      const updated = await updateAdminTaskStatus(task.id, status, reason);
      setMyTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, ...updated } : item)));
      toast({ title: status === 'Accepted' ? 'Görev kabul edildi' : 'Görev kabul edilmedi' });
      setRejectingTask(null);
      setRejectReason('');
    } catch (err) {
      toast({ title: 'Görev güncellenemedi', description: err.message, variant: 'destructive' });
    } finally {
      setTaskBusy(false);
    }
  };

  if (loading) {
    return <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4"><LoadingDots /><p className="text-muted-foreground">Nöbetler yükleniyor...</p></div>;
  }

  const summaryCards = [
    ['Toplam Nöbet', stats.total, CalendarDays, 'text-sky-400'],
    ['Tamamlanan', stats.completed, CheckCircle2, 'text-emerald-400'],
    ['Planlanan', stats.planned, Clock, 'text-amber-400'],
    ['İptal Edilen', stats.cancelled, XCircle, 'text-rose-400'],
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5" data-testid="teacher-duties-page">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[hsl(var(--brand-accent)/0.14)] text-[hsl(var(--brand-accent))]"><ShieldCheck className="h-6 w-6" /></div>
        <div>
          <h1 className="text-xl font-black tracking-tight text-[hsl(var(--brand-accent))]">Görevlerim</h1>
          <p className="text-sm text-muted-foreground">Size atanan idari görevleri kabul edebilir, nöbetlerinizi görüntüleyebilirsiniz.</p>
        </div>
      </div>

      {error ? <ErrorBanner title="Nöbetler alınamadı" message={error} onRetry={load} /> : null}

      <PremiumPanel title="Atanan Görevlerim" description="Görev merkezinden size atanan işler">
        {myTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-foreground/10 p-8 text-center text-sm text-muted-foreground">Size atanmış görev bulunmuyor.</div>
        ) : (
          <div className="space-y-3">
            {myTasks.map((task) => (
              <div key={task.id} className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{task.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{task.description || 'Açıklama yok'}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Başlangıç: {task.startDateUtc ? new Date(task.startDateUtc).toLocaleString('tr-TR') : '—'} · Bitiş: {task.endDateUtc ? new Date(task.endDateUtc).toLocaleString('tr-TR') : '—'}
                    </p>
                    {task.rejectionReason ? (
                      <p className="mt-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-xs text-rose-300">Mazeret: {task.rejectionReason}</p>
                    ) : null}
                  </div>
                  <span className="rounded-full border px-3 py-1 text-xs font-semibold">{task.status}</span>
                </div>
                {task.responseStatus === 'Pending' || task.status === 'PendingAcceptance' ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" disabled={taskBusy} className="bg-emerald-600 hover:bg-emerald-700" onClick={() => respondTask(task, 'Accepted')}>Kabul ediyorum</Button>
                    <Button size="sm" variant="outline" disabled={taskBusy} className="border-rose-300 text-rose-500" onClick={() => setRejectingTask(task)}>Kabul etmiyorum</Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </PremiumPanel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-4">
          <div className="flex flex-wrap gap-1 rounded-full border border-foreground/10 bg-foreground/[0.04] p-0.5 w-fit">
            {[['upcoming', 'Gelecek Nöbetlerim'], ['past', 'Geçmiş Nöbetlerim'], ['calendar', 'Aylık Takvim'], ['stats', 'İstatistikler']].map(([value, label]) => (
              <button key={value} onClick={() => setTab(value)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${tab === value ? 'bg-[hsl(var(--brand-accent))] text-white' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>
            ))}
          </div>

          <PremiumPanel
            title={tab === 'past' ? 'Geçmiş Nöbetlerim' : tab === 'calendar' ? 'Aylık Takvim' : tab === 'stats' ? 'İstatistikler' : 'Gelecek Nöbetlerim'}
            description={tab === 'upcoming' ? `${upcoming.length} yaklaşan nöbet` : tab === 'past' ? `${past.length} geçmiş nöbet` : tab === 'stats' ? 'Bu ayki nöbet dağılımı' : 'Nöbet günleriniz'}
          >
            {tab === 'upcoming' ? <DutyTable duties={upcoming} emptyText="Yaklaşan nöbetiniz yok." /> : null}
            {tab === 'past' ? <DutyTable duties={past} emptyText="Geçmiş nöbetiniz yok." /> : null}
            {tab === 'calendar' ? <DutyCalendar duties={all} /> : null}
            {tab === 'stats' ? (
              <div className="grid grid-cols-2 gap-3">
                {summaryCards.map(([label, value, Icon, color]) => (
                  <div key={label} className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4">
                    <Icon className={`h-6 w-6 ${color}`} />
                    <p className="mt-2 text-2xl font-black">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </PremiumPanel>
        </div>

        <div className="space-y-5">
          <PremiumPanel title="Nöbet Takvimi" description="Aylık nöbet dağılımı">
            <DutyCalendar duties={all} />
          </PremiumPanel>
          <PremiumPanel title="Bu Ayki Özetim" description="Nöbet durumun">
            <div className="grid grid-cols-2 gap-3">
              {summaryCards.map(([label, value, Icon, color]) => (
                <div key={label} className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-3">
                  <Icon className={`h-5 w-5 ${color}`} />
                  <p className="mt-1.5 text-xl font-black">{value}</p>
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </PremiumPanel>
        </div>
      </div>

      <Dialog open={!!rejectingTask} onOpenChange={(open) => !open && setRejectingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Görevi kabul etmeme nedeni</DialogTitle>
          </DialogHeader>
          <Textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Mazeretinizi yazın..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingTask(null)}>Vazgeç</Button>
            <Button variant="destructive" disabled={taskBusy || !rejectReason.trim()} onClick={() => rejectingTask && respondTask(rejectingTask, 'Rejected', rejectReason)}>
              Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
