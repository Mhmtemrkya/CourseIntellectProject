import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  Download, Mail, Phone, ShieldAlert, XCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchAttendance, fetchStudents } from '../../lib/api/modules';

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
  anchor.download = 'veli-devamsizlik-raporu.csv';
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
    <div className={`rounded-2xl border bg-gradient-to-br p-5 ${tones[tone]}`}>
      <Icon className="h-6 w-6" />
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-black text-foreground">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default function ParentAttendance() {
  const { user } = useApp();
  const [children, setChildren] = useState([]);
  const [selectedChildKey, setSelectedChildKey] = useState('');
  const [attendance, setAttendance] = useState([]);
  const [period, setPeriod] = useState('2024 - 2025 / 2. Dönem');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const students = await fetchStudents();
      const linkedChildren = (students || []).filter((item) => (
        normalize(item.parentName) === normalize(user?.name)
        || normalize(item.parentEmail).includes(normalize(user?.username))
        || normalize(item.parentPhone).includes(normalize(user?.phone))
      ));
      setChildren(linkedChildren);
      const current = linkedChildren[0] || null;
      setSelectedChildKey(current?.username || current?.fullName || '');
      setAttendance(current ? await fetchAttendance({ studentName: current.fullName }) : []);
    } catch (err) {
      setError(err.message || 'Devamsızlık verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const selectedChild = useMemo(() => children.find((child) => (child.username || child.fullName) === selectedChildKey) || children[0] || null, [children, selectedChildKey]);

  const handleChildChange = async (value) => {
    setSelectedChildKey(value);
    const child = children.find((item) => (item.username || item.fullName) === value);
    setAttendance(child ? await fetchAttendance({ studentName: child.fullName }) : []);
  };

  const stats = useMemo(() => {
    const present = attendance.filter((item) => toStatus(item.status) === 'present').length;
    const late = attendance.filter((item) => toStatus(item.status) === 'late').length;
    const excuse = attendance.filter((item) => toStatus(item.status) === 'excuse').length;
    const absent = attendance.filter((item) => toStatus(item.status) === 'absent').length;
    const total = attendance.length || 0;
    const rate = total ? Math.round(((present + late + excuse) / total) * 100) : 0;
    const absentRate = total ? Math.round((absent / total) * 100) : 0;
    return { present, late, excuse, absent, total, rate, absentRate, remaining: Math.max(0, 20 - absent) };
  }, [attendance]);

  const subjectRows = useMemo(() => {
    const map = new Map();
    attendance.forEach((item) => {
      const subject = item.lesson || 'Ders';
      const next = map.get(subject) || { subject, present: 0, absent: 0, total: 0 };
      next.total += 1;
      if (toStatus(item.status) === 'absent') next.absent += 1;
      else next.present += 1;
      map.set(subject, next);
    });
    return Array.from(map.values()).map((item) => ({ ...item, rate: item.total ? Math.round((item.present / item.total) * 100) : 0 }));
  }, [attendance]);

  const latestAbsences = useMemo(() => attendance
    .filter((item) => toStatus(item.status) === 'absent')
    .sort((a, b) => new Date(b.lessonDate) - new Date(a.lessonDate))
    .slice(0, 5), [attendance]);

  const calendarDays = useMemo(() => {
    const base = new Date();
    const year = base.getFullYear();
    const month = base.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    return Array.from({ length: 35 }, (_, index) => {
      const date = new Date(year, month, index - startOffset + 1);
      const iso = date.toISOString().slice(0, 10);
      const dayRecords = attendance.filter((item) => String(item.lessonDate || '').slice(0, 10) === iso);
      const hasAbsent = dayRecords.some((item) => toStatus(item.status) === 'absent');
      const hasPresent = dayRecords.some((item) => toStatus(item.status) !== 'absent');
      return { date, iso, inMonth: date.getMonth() === month, hasAbsent, hasPresent };
    });
  }, [attendance]);

  const contactSchool = () => {
    const subject = encodeURIComponent(`${selectedChild?.fullName || 'Öğrenci'} devamsızlık görüşmesi`);
    window.location.href = `mailto:info@courseintellect.com?subject=${subject}`;
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5" data-testid="parent-attendance-page">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">Devamsızlık Bilgileri</h1>
          <p className="text-sm text-muted-foreground">Çocuğunuzun devamsızlık durumunu buradan takip edebilirsiniz.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {children.length > 0 ? (
            <select value={selectedChildKey} onChange={(event) => handleChildChange(event.target.value)} className="h-11 rounded-xl border bg-background px-3 text-sm">
              {children.map((child) => <option key={child.username || child.fullName} value={child.username || child.fullName}>{child.fullName} • {child.className}</option>)}
            </select>
          ) : null}
          <select value={period} onChange={(event) => setPeriod(event.target.value)} className="h-11 rounded-xl border bg-background px-3 text-sm">
            <option>2024 - 2025 / 2. Dönem</option>
            <option>2024 - 2025 / 1. Dönem</option>
          </select>
          <Button variant="outline" className="rounded-xl" onClick={() => downloadCsv(attendance)}><Download className="mr-2 h-4 w-4" /> İndir</Button>
        </div>
      </div>

      {error ? <ErrorBanner title="Devamsızlık alınamadı" message={error} onRetry={loadAttendance} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={CheckCircle2} label="Toplam Devam Günü" value={stats.present + stats.late + stats.excuse} hint={`%${stats.rate}.0`} tone="green" />
        <Metric icon={XCircle} label="Toplam Devamsız Gün" value={stats.absent} hint={`%${stats.absentRate}.0`} tone="orange" />
        <Metric icon={CalendarDays} label="Devamsızlık Hakkı" value="20" hint="Gün / Dönem" tone="blue" />
        <Metric icon={ShieldAlert} label="Kalan Hakkı" value={stats.remaining} hint="Gün" tone="purple" />
      </div>

      {stats.absentRate > 0 ? (
        <div className="rounded-2xl border border-orange-500/25 bg-orange-500/10 p-4 text-sm text-orange-800 dark:text-orange-100">
          <AlertTriangle className="mr-2 inline h-5 w-5" />
          Devamsızlık sınırı %30'dur. Lütfen düzenli devam etmesine özen gösteriniz.
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-black">Devamsızlık Oranı</h2>
          <div className="mt-5 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-center">
            <div className="relative flex h-56 w-56 items-center justify-center rounded-full bg-[conic-gradient(#22C55E_0_var(--rate),#EF4444_var(--rate)_100%)]" style={{ '--rate': `${stats.rate}%` }}>
              <div className="flex h-40 w-40 flex-col items-center justify-center rounded-full bg-card">
                <span className="text-3xl font-black">%{stats.absentRate}.0</span>
                <span className="text-xs text-muted-foreground">Devamsızlık Oranı</span>
              </div>
            </div>
            <div className="space-y-4">
              <Legend label="Devam Günü" value={`${stats.present + stats.late + stats.excuse} Gün (%${stats.rate}.0)`} color="bg-emerald-500" />
              <Legend label="Devamsız Gün" value={`${stats.absent} Gün (%${stats.absentRate}.0)`} color="bg-rose-500" />
              <Legend label="Kalan Hakkı" value={`${stats.remaining} Gün`} color="bg-purple-500" />
              <Legend label="Sınır" value="%30.0" color="bg-orange-500" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-black">Son Devamsızlıklar</h2>
          <div className="mt-4 space-y-3">
            {latestAbsences.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Devamsızlık yok.</p> : latestAbsences.map((item) => (
              <div key={item.id} className="rounded-xl border p-3">
                <div className="flex justify-between gap-3">
                  <div><p className="font-bold">{formatDate(item.lessonDate)}</p><p className="text-xs text-muted-foreground">{item.lesson}</p></div>
                  <span className="text-xs font-black text-rose-500">Tüm Gün</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
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
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-black">Ders Bazlı Devamsızlık</h2>
          <div className="mt-4 space-y-4">
            {subjectRows.map((item) => (
              <div key={item.subject}>
                <div className="mb-2 flex justify-between text-sm">
                  <span>{item.subject}</span>
                  <span className={item.absent > 0 ? 'font-bold text-orange-500' : 'font-bold text-emerald-500'}>{item.absent}</span>
                </div>
                <Progress value={item.rate} className="h-2" />
              </div>
            ))}
          </div>
          <Button variant="outline" className="mt-5 w-full rounded-xl border-purple-500/40 text-purple-600" onClick={() => downloadCsv(attendance)}>Detaylı Rapor</Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-black">Devamsızlık Bilgilendirme</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Devamsızlık sınırını aşmaması için öğrencinin düzenli okula devam etmesi başarı durumunu olumlu etkiler. Herhangi bir sorun için okul yönetimi ile iletişime geçebilirsiniz.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => window.location.href = 'tel:+902121112233'}><Phone className="mr-2 h-4 w-4" /> Ara</Button>
            <Button className="rounded-xl bg-purple-600 text-white hover:bg-purple-700" onClick={contactSchool}><Mail className="mr-2 h-4 w-4" /> Okul ile İletişime Geç</Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Legend({ label, value, color }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border p-3">
      <span className="flex items-center gap-2 text-sm"><i className={`h-3 w-3 rounded-full ${color}`} />{label}</span>
      <b>{value}</b>
    </div>
  );
}
