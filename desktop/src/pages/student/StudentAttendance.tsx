import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Download,
  FileText, ShieldCheck, XCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { AnimatedValue } from '../../components/ui/premium-dashboard';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchAttendance } from '../../lib/api/modules';

function normalize(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u');
}

function toStatus(status = '') {
  const key = normalize(status);
  if (key.includes('katildi')) return 'present';
  if (key.includes('gec')) return 'late';
  if (key.includes('izin')) return 'excuse';
  return 'absent';
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return value || '-';
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' }).format(date);
}

function downloadCsv(records) {
  const rows = [
    ['Ders', 'Sınıf', 'Tarih', 'Durum'],
    ...records.map((item) => [item.lesson, item.className, item.lessonDate, item.status]),
  ];
  const content = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'devamsizlik-bilgilerim.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

function Metric({ icon: Icon, label, value, hint, tone }) {
  const tones = {
    green: 'from-emerald-500/20 to-emerald-500/5 text-emerald-300 border-emerald-500/15',
    orange: 'from-orange-500/20 to-orange-500/5 text-orange-300 border-orange-500/15',
    blue: 'from-blue-500/20 to-blue-500/5 text-blue-300 border-blue-500/15',
    purple: 'from-purple-500/20 to-purple-500/5 text-purple-300 border-purple-500/15',
  };
  return (
    <div className={`ci-rise rounded-2xl border bg-gradient-to-br p-5 ${tones[tone]}`}>
      <Icon className="h-6 w-6" />
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-black text-foreground"><AnimatedValue value={value} /></p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default function StudentAttendance() {
  const { user } = useApp();
  const [records, setRecords] = useState([]);
  const [period, setPeriod] = useState('2024 - 2025 / 2. Dönem');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setRecords(await fetchAttendance({ studentName: user?.name || '' }));
    } catch (err) {
      setError(err.message || 'Devamsızlık kayıtları alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user?.name]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const stats = useMemo(() => {
    const present = records.filter((item) => toStatus(item.status) === 'present').length;
    const late = records.filter((item) => toStatus(item.status) === 'late').length;
    const excuse = records.filter((item) => toStatus(item.status) === 'excuse').length;
    const absent = records.filter((item) => toStatus(item.status) === 'absent').length;
    const total = records.length || 0;
    const rate = total ? Math.round(((present + late + excuse) / total) * 100) : 0;
    return { present, late, excuse, absent, total, rate, remaining: Math.max(0, 20 - absent) };
  }, [records]);

  const bySubject = useMemo(() => {
    const map = new Map();
    records.forEach((item) => {
      const subject = item.lesson || 'Ders';
      const next = map.get(subject) || { subject, present: 0, absent: 0, total: 0 };
      next.total += 1;
      if (toStatus(item.status) === 'absent') next.absent += 1;
      else next.present += 1;
      map.set(subject, next);
    });
    return Array.from(map.values()).map((item) => ({
      ...item,
      rate: item.total ? Math.round((item.present / item.total) * 100) : 0,
    }));
  }, [records]);

  const latestAbsences = useMemo(() => records
    .filter((item) => toStatus(item.status) === 'absent')
    .sort((a, b) => new Date(b.lessonDate) - new Date(a.lessonDate))
    .slice(0, 5), [records]);

  const calendarDays = useMemo(() => {
    const base = new Date();
    const year = base.getFullYear();
    const month = base.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    return Array.from({ length: 35 }, (_, index) => {
      const date = new Date(year, month, index - startOffset + 1);
      const iso = date.toISOString().slice(0, 10);
      const dayRecords = records.filter((item) => String(item.lessonDate || '').slice(0, 10) === iso);
      const hasAbsent = dayRecords.some((item) => toStatus(item.status) === 'absent');
      const hasPresent = dayRecords.some((item) => toStatus(item.status) !== 'absent');
      return { date, iso, inMonth: date.getMonth() === month, hasAbsent, hasPresent };
    });
  }, [records]);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5" data-testid="student-attendance-page">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">Devamsızlık Bilgilerim</h1>
          <p className="text-sm text-muted-foreground">Devamsızlık durumunu buradan takip edebilirsin.</p>
        </div>
        <div className="flex gap-2">
          <select value={period} onChange={(event) => setPeriod(event.target.value)} className="h-11 rounded-xl border bg-background px-3 text-sm">
            <option>2024 - 2025 / 2. Dönem</option>
            <option>2024 - 2025 / 1. Dönem</option>
          </select>
          <Button variant="outline" className="rounded-xl" onClick={() => downloadCsv(records)}><Download className="mr-2 h-4 w-4" /> İndir</Button>
        </div>
      </div>

      {error ? <ErrorBanner title="Devamsızlık alınamadı" message={error} onRetry={loadAttendance} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={CheckCircle2} label="Toplam Devam Günü" value={stats.present + stats.late + stats.excuse} hint={`%${stats.rate}.0`} tone="green" />
        <Metric icon={XCircle} label="Toplam Devamsız Gün" value={stats.absent} hint={`%${stats.total ? Math.round((stats.absent / stats.total) * 100) : 0}.0`} tone="orange" />
        <Metric icon={CalendarDays} label="Devamsızlık Hakkım" value="20" hint="Günden / Dönem" tone="blue" />
        <Metric icon={ShieldCheck} label="Kalan Hakkım" value={stats.remaining} hint="Gün" tone="purple" />
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="font-black">Devam Oranım</h2>
        <div className="mt-5 flex items-center gap-4">
          <span className="text-3xl font-black text-emerald-500">%{stats.rate}.0</span>
          <Progress value={stats.rate} className="h-3 flex-1" />
          <span className="text-sm font-bold">%{stats.rate}.0</span>
        </div>
        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          <span>Dönem sonu devamsızlık sınırı %30'dur.</span>
          <span>Sınır: %30.0</span>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-black">Aylık Devamsızlık Takvimi</h2>
            <div className="flex gap-1"><ChevronLeft className="h-4 w-4" /><ChevronRight className="h-4 w-4" /></div>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
            {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((item) => <span key={item}>{item}</span>)}
          </div>
          <div className="mt-3 grid grid-cols-7 gap-2">
            {calendarDays.map((day) => (
              <div key={day.iso} className={`flex h-10 items-center justify-center rounded-full text-sm font-black ${!day.inMonth ? 'text-muted-foreground/40' : day.hasAbsent ? 'bg-rose-500 text-white' : day.hasPresent ? 'bg-emerald-500 text-white' : 'bg-muted text-foreground'}`}>
                {day.date.getDate()}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span><i className="mr-2 inline-block h-3 w-3 rounded-full bg-emerald-500" />Devam Ettim</span>
            <span><i className="mr-2 inline-block h-3 w-3 rounded-full bg-rose-500" />Devamsızlık</span>
            <span><i className="mr-2 inline-block h-3 w-3 rounded-full bg-slate-500" />Hafta Sonu</span>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-black">Son Devamsızlıklarım</h2>
          <div className="mt-4 space-y-3">
            {latestAbsences.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Devamsızlık kaydı yok.</div>
            ) : latestAbsences.map((item) => (
              <div key={item.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-bold">{formatDate(item.lessonDate)}</p><p className="text-xs text-muted-foreground">{item.lesson}</p></div>
                  <span className="text-xs font-black text-rose-500">Tüm Gün</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-black">Ders Bazlı Devamsızlık</h2>
          <div className="mt-4 space-y-4">
            {bySubject.map((item) => (
              <div key={item.subject} className="grid gap-3 md:grid-cols-[140px_1fr_80px_80px_80px] md:items-center">
                <span className="font-medium">{item.subject}</span>
                <Progress value={item.rate} className="h-2" />
                <span className="font-bold text-emerald-500">%{item.rate}.0</span>
                <span>{item.present}</span>
                <span>{item.absent}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <FileText className="h-8 w-8 text-blue-500" />
          <p className="mt-4 text-sm leading-6 text-muted-foreground">Devamsızlık sınırınız %30'dur. Sınırı aştığınız takdirde dönem sonu başarınızı olumsuz etkileyebilir.</p>
        </div>
      </div>
    </motion.div>
  );
}
