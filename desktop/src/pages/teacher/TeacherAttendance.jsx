import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, CalendarDays, Check, CheckCircle2, ChevronDown, ClipboardList,
  Clock3, Download, FileText, History, Info, MoreVertical, QrCode, RefreshCw,
  Save, Search, Users, XCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Progress } from '../../components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../components/ui/sheet';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useToast } from '../../hooks/use-toast';
import {
  closeAttendanceQrSession,
  fetchAttendance,
  fetchAttendanceQrSessions,
  fetchScheduleEntries,
  fetchStudents,
  openAttendanceQrSession,
  saveAttendance,
} from '../../lib/api/modules';

const statuses = [
  { value: 'present', api: 'present', label: 'Katıldı', color: 'emerald', icon: CheckCircle2 },
  { value: 'late', api: 'late', label: 'Gecikmeli', color: 'amber', icon: Clock3 },
  { value: 'absent', api: 'absent', label: 'Katılmadı', color: 'rose', icon: XCircle },
];

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

function toUiStatus(value = '') {
  const key = normalize(value);
  if (key.includes('katildi') || key.includes('present')) return 'present';
  if (key.includes('gec') || key.includes('late')) return 'late';
  return 'absent';
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  }).format(date);
}

function formatTime(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function downloadTextFile(filename, content, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function StatCard({ icon: Icon, label, value, tone }) {
  const tones = {
    blue: 'from-blue-500/20 to-blue-500/5 text-blue-300 border-blue-400/15',
    green: 'from-emerald-500/20 to-emerald-500/5 text-emerald-300 border-emerald-400/15',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-300 border-amber-400/15',
    red: 'from-rose-500/20 to-rose-500/5 text-rose-300 border-rose-400/15',
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-5 ${tones[tone]}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-slate-400">{label}</p>
          <p className="text-3xl font-black text-white dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function TeacherAttendance() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [qrSessions, setQrSessions] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedLesson, setSelectedLesson] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('qr');
  const [studentStatuses, setStudentStatuses] = useState({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [notes, setNotes] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [studentList, records, scheduleRows, sessions] = await Promise.all([
        fetchStudents(),
        fetchAttendance().catch(() => []),
        fetchScheduleEntries().catch(() => []),
        fetchAttendanceQrSessions().catch(() => []),
      ]);
      setStudents(Array.isArray(studentList) ? studentList : []);
      setAttendanceRecords(Array.isArray(records) ? records : []);
      setSchedule(Array.isArray(scheduleRows) ? scheduleRows : []);
      setQrSessions(Array.isArray(sessions) ? sessions : []);

      const firstClass = [...new Set([
        ...(studentList || []).map((item) => item.className).filter(Boolean),
        ...(records || []).map((item) => item.className).filter(Boolean),
        ...(scheduleRows || []).map((item) => item.className).filter(Boolean),
      ])][0] || '';
      setSelectedClass((prev) => prev || firstClass);
    } catch (err) {
      setError(err.message || 'Yoklama verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const classes = useMemo(() => [...new Set([
    ...students.map((item) => item.className).filter(Boolean),
    ...attendanceRecords.map((item) => item.className).filter(Boolean),
    ...schedule.map((item) => item.className).filter(Boolean),
  ])].sort((a, b) => a.localeCompare(b, 'tr')), [attendanceRecords, schedule, students]);

  const lessons = useMemo(() => [...new Set([
    ...schedule.filter((item) => item.className === selectedClass).map((item) => item.subject || item.lesson).filter(Boolean),
    ...attendanceRecords.filter((item) => item.className === selectedClass).map((item) => item.lesson).filter(Boolean),
    'Genel Ders',
  ])], [attendanceRecords, schedule, selectedClass]);

  useEffect(() => {
    if (!selectedLesson && lessons.length > 0) {
      setSelectedLesson(lessons[0]);
    }
  }, [lessons, selectedLesson]);

  const classStudents = useMemo(() => students.filter((item) => item.className === selectedClass), [selectedClass, students]);

  useEffect(() => {
    const next = {};
    classStudents.forEach((student) => {
      const existing = attendanceRecords.find((record) => (
        normalize(record.studentName) === normalize(student.fullName)
        && normalize(record.className) === normalize(selectedClass)
        && normalize(record.lesson) === normalize(selectedLesson)
        && String(record.lessonDate || '').slice(0, 10) === selectedDate
      ));
      next[student.id || student.fullName] = existing ? toUiStatus(existing.status) : 'present';
    });
    setStudentStatuses(next);
  }, [attendanceRecords, classStudents, selectedClass, selectedDate, selectedLesson]);

  const selectedQrSession = useMemo(() => qrSessions
    .filter((item) => item.status === 'Active'
      && item.className === selectedClass
      && item.lessonTitle === selectedLesson
      && new Date(item.expiresAtUtc) > new Date())
    .sort((a, b) => new Date(b.openedAtUtc) - new Date(a.openedAtUtc))[0] || null, [qrSessions, selectedClass, selectedLesson]);

  const counts = useMemo(() => classStudents.reduce((acc, student) => {
    const key = student.id || student.fullName;
    const status = studentStatuses[key] || 'present';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, { present: 0, late: 0, absent: 0 }), [classStudents, studentStatuses]);

  const attendanceRate = classStudents.length ? Math.round(((counts.present + counts.late) / classStudents.length) * 100) : 0;

  const filteredStudents = useMemo(() => classStudents.filter((student) => {
    const key = student.id || student.fullName;
    const status = studentStatuses[key] || 'present';
    const matchesSearch = !search || `${student.fullName} ${student.schoolNumber || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [classStudents, search, statusFilter, studentStatuses]);

  const openQr = async () => {
    if (!selectedClass || !selectedLesson) {
      toast({ title: 'Sınıf ve ders seçin', variant: 'destructive' });
      return;
    }
    try {
      const session = await openAttendanceQrSession({
        className: selectedClass,
        lessonTitle: selectedLesson,
        durationMinutes: 30,
      });
      setQrSessions((prev) => [session, ...prev.filter((item) => item.id !== session.id)]);
      setMethod('qr');
      toast({ title: 'QR yoklama açıldı', description: 'Öğrenciler mobil uygulamadan katılım işleyebilir.' });
    } catch (err) {
      toast({ title: 'QR oturumu açılamadı', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    }
  };

  const closeQr = async () => {
    if (!selectedQrSession) return;
    try {
      const closed = await closeAttendanceQrSession(selectedQrSession.id);
      setQrSessions((prev) => prev.map((item) => (item.id === closed.id ? closed : item)));
      toast({ title: 'QR oturumu kapatıldı' });
    } catch (err) {
      toast({ title: 'QR kapatılamadı', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    }
  };

  const setStatus = (student, status) => {
    const key = student.id || student.fullName;
    setStudentStatuses((prev) => ({ ...prev, [key]: status }));
  };

  const setAll = (status) => {
    const next = {};
    classStudents.forEach((student) => {
      next[student.id || student.fullName] = status;
    });
    setStudentStatuses(next);
    toast({ title: `Tüm öğrenciler ${statuses.find((item) => item.value === status)?.label || status} olarak işaretlendi.` });
  };

  const applyQrScansToManual = () => {
    if (!selectedQrSession) return;
    const scanned = selectedQrSession.scannedStudents || [];
    const next = {};
    classStudents.forEach((student) => {
      const matched = scanned.some((scan) => normalize(scan.studentName) === normalize(student.fullName));
      next[student.id || student.fullName] = matched ? 'present' : (studentStatuses[student.id || student.fullName] || 'absent');
    });
    setStudentStatuses(next);
    toast({ title: 'QR katılımları manuel listeye işlendi' });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = await saveAttendance({
        className: selectedClass,
        lesson: selectedLesson || 'Genel Ders',
        lessonDate: selectedDate,
        students: classStudents.map((student) => {
          const uiStatus = studentStatuses[student.id || student.fullName] || 'present';
          return {
            name: student.fullName,
            status: statuses.find((item) => item.value === uiStatus)?.api || 'present',
          };
        }),
      });
      setAttendanceRecords((prev) => {
        const filtered = prev.filter((item) => !(
          normalize(item.className) === normalize(selectedClass)
          && normalize(item.lesson) === normalize(selectedLesson)
          && String(item.lessonDate || '').slice(0, 10) === selectedDate
        ));
        return [...payload, ...filtered];
      });
      toast({ title: 'Yoklama kaydedildi', description: `${selectedClass} • ${selectedLesson} backend’e yazıldı.` });
    } catch (err) {
      toast({ title: 'Yoklama kaydedilemedi', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const downloadQr = () => {
    if (!selectedQrSession) return;
    const payload = JSON.stringify({ token: selectedQrSession.token, className: selectedClass, lesson: selectedLesson });
    window.open(`https://api.qrserver.com/v1/create-qr-code/?size=768x768&data=${encodeURIComponent(payload)}`, '_blank', 'noopener,noreferrer');
  };

  const downloadHistory = () => {
    const rows = [
      ['Öğrenci', 'Sınıf', 'Ders', 'Tarih', 'Durum'],
      ...attendanceRecords.map((item) => [item.studentName, item.className, item.lesson, item.lessonDate, item.status]),
    ];
    downloadTextFile('yoklama-gecmisi.csv', rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n'));
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 text-slate-950 dark:text-white" data-testid="teacher-attendance-page">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-2xl font-black tracking-tight md:text-3xl">Yoklama Alma</h1>
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" /> {formatDate(selectedDate)}</span>
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="h-4 w-4" /> {formatTime(new Date())}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">QR kod ve manuel yoklama aynı sayfada, mevcut backend ile çalışır.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => setHistoryOpen(true)}><History className="mr-2 h-4 w-4" /> Geçmiş Yoklamalar</Button>
          <Button variant="outline" className="rounded-xl" onClick={downloadHistory}><Download className="mr-2 h-4 w-4" /> Rapor İndir</Button>
          <Button className="rounded-xl bg-orange-500 text-white hover:bg-orange-600" onClick={handleSave} disabled={saving || classStudents.length === 0}>
            <Save className="mr-2 h-4 w-4" /> {saving ? 'Kaydediliyor...' : 'Yoklamayı Kaydet'}
          </Button>
        </div>
      </div>

      {error ? <ErrorBanner title="Yoklama verisi alınamadı" message={error} onRetry={load} /> : null}

      <div className="grid gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm lg:grid-cols-[1fr_1fr] xl:grid-cols-[1fr_1.8fr]">
        <div>
          <p className="mb-3 text-sm font-bold">Yoklama Yöntemi</p>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/50 p-1">
            <button type="button" onClick={() => setMethod('qr')} className={`rounded-xl px-4 py-3 text-sm font-bold transition ${method === 'qr' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-muted-foreground hover:bg-background'}`}>
              <QrCode className="mr-2 inline h-4 w-4" /> QR Kod ile Yoklama
            </button>
            <button type="button" onClick={() => setMethod('manual')} className={`rounded-xl px-4 py-3 text-sm font-bold transition ${method === 'manual' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-muted-foreground hover:bg-background'}`}>
              <ClipboardList className="mr-2 inline h-4 w-4" /> Manuel Yoklama
            </button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label>
            <span className="mb-1 block text-xs text-muted-foreground">Sınıf</span>
            <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)} className="h-11 w-full rounded-xl border bg-background px-3 text-sm">
              {classes.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs text-muted-foreground">Ders</span>
            <select value={selectedLesson} onChange={(event) => setSelectedLesson(event.target.value)} className="h-11 w-full rounded-xl border bg-background px-3 text-sm">
              {lessons.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs text-muted-foreground">Tarih</span>
            <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="h-11 rounded-xl" />
          </label>
          <div>
            <span className="mb-1 block text-xs text-muted-foreground">Öğrenci Sayısı</span>
            <div className="flex h-11 items-center rounded-xl border bg-background px-3 text-sm font-bold">{classStudents.length} öğrenci</div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)_330px]">
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-black">{method === 'qr' ? 'QR Kod ile Yoklama' : 'Hızlı İşlemler'}</h2>
            {method === 'qr' ? (
              <div className="mt-4 text-center">
                {selectedQrSession ? (
                  <>
                    <img
                      alt="Yoklama QR"
                      className="mx-auto h-56 w-56 rounded-2xl border bg-white p-3"
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(JSON.stringify({ token: selectedQrSession.token, className: selectedClass, lesson: selectedLesson }))}`}
                    />
                    <p className="mt-4 text-sm text-muted-foreground">Bu QR kod {formatTime(selectedQrSession.expiresAtUtc)} saatine kadar geçerlidir.</p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Button variant="outline" className="rounded-xl" onClick={downloadQr}><Download className="mr-2 h-4 w-4" /> İndir</Button>
                      <Button variant="outline" className="rounded-xl border-rose-300 text-rose-600 hover:bg-rose-50" onClick={closeQr}>Kapat</Button>
                    </div>
                    <Button className="mt-2 w-full rounded-xl bg-blue-600 text-white hover:bg-blue-700" onClick={applyQrScansToManual}>
                      QR Katılımlarını Listeye İşle
                    </Button>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed p-6">
                    <QrCode className="mx-auto h-16 w-16 text-blue-500" />
                    <p className="mt-3 text-sm text-muted-foreground">Bu ders için aktif QR yoklama yok.</p>
                    <Button className="mt-4 rounded-xl bg-blue-600 text-white hover:bg-blue-700" onClick={openQr}>QR Oturumu Aç</Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 grid gap-2">
                <Button variant="outline" className="justify-start rounded-xl" onClick={() => setAll('present')}><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" /> Tümünü Katıldı Yap</Button>
                <Button variant="outline" className="justify-start rounded-xl" onClick={() => setAll('late')}><Clock3 className="mr-2 h-4 w-4 text-amber-500" /> Tümünü Gecikmeli Yap</Button>
                <Button variant="outline" className="justify-start rounded-xl" onClick={() => setAll('absent')}><XCircle className="mr-2 h-4 w-4 text-rose-500" /> Tümünü Katılmadı Yap</Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={CheckCircle2} label="Katıldı" value={counts.present} tone="green" />
            <StatCard icon={Clock3} label="Gecikmeli" value={counts.late} tone="amber" />
            <StatCard icon={XCircle} label="Katılmadı" value={counts.absent} tone="red" />
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-900 dark:text-blue-100">
            <Info className="mb-2 h-5 w-5" />
            QR kod aktif olduğunda öğrenciler mobil uygulama üzerinden kodu okutarak yoklamaya katılabilir.
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-black">Manuel Yoklama</h2>
              <p className="text-sm text-muted-foreground">Öğrenci durumunu manuel olarak işaretleyin.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Öğrenci ara..." className="h-10 rounded-xl pl-9" />
              </div>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-xl border bg-background px-3 text-sm">
                <option value="all">Duruma Göre Filtrele</option>
                {statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border">
            <div className="hidden grid-cols-[56px_minmax(190px,1fr)_360px_48px] border-b bg-muted/40 px-4 py-3 text-xs font-bold text-muted-foreground lg:grid">
              <span>No</span><span>Öğrenci Adı Soyadı</span><span>Durum</span><span>İşlem</span>
            </div>
            {filteredStudents.map((student, index) => {
              const active = studentStatuses[student.id || student.fullName] || 'present';
              return (
                <div key={student.id || student.fullName} className="grid gap-3 border-b px-4 py-3 last:border-b-0 lg:grid-cols-[56px_minmax(190px,1fr)_360px_48px] lg:items-center">
                  <span className="text-sm text-muted-foreground">{index + 1}</span>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">{student.fullName?.slice(0, 2)?.toUpperCase()}</div>
                    <div>
                      <p className="font-bold">{student.fullName}</p>
                      <p className="text-xs text-muted-foreground">{student.className} • {student.schoolNumber || student.username}</p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {statuses.map((status) => (
                      <button
                        key={status.value}
                        type="button"
                        onClick={() => setStatus(student, status.value)}
                        className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                          active === status.value
                            ? status.value === 'present'
                              ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600'
                              : status.value === 'late'
                                ? 'border-amber-500 bg-amber-500/15 text-amber-600'
                                : 'border-rose-500 bg-rose-500/15 text-rose-600'
                            : 'border-border bg-background hover:bg-muted'
                        }`}
                      >
                        {active === status.value ? <Check className="mr-1 inline h-4 w-4" /> : null}
                        {status.label}
                      </button>
                    ))}
                  </div>
                  <Button variant="outline" size="icon" className="rounded-xl" onClick={() => toast({ title: `${student.fullName}`, description: `${selectedLesson} için durum: ${statuses.find((item) => item.value === active)?.label}` })}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-black">Günlük Devamsızlık Özeti</h2>
            <div className="mt-5 flex items-center gap-5">
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-[conic-gradient(#22C55E_0_var(--rate),#F59E0B_var(--rate)_calc(var(--rate)+10%),#EF4444_calc(var(--rate)+10%)_100%)]" style={{ '--rate': `${attendanceRate}%` }}>
                <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-card">
                  <span className="text-2xl font-black">%{attendanceRate}</span>
                  <span className="text-xs text-muted-foreground">Katılım</span>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />Katıldı {counts.present}</p>
                <p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-500" />Gecikmeli {counts.late}</p>
                <p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-rose-500" />Katılmadı {counts.absent}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-black">Sınıf Devamsızlık Oranı</h2>
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-sm"><span>Sınıf ortalaması</span><b>%{attendanceRate}</b></div>
              <Progress value={attendanceRate} className="h-3" />
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-black">Yoklama Notları</h2>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value.slice(0, 250))} placeholder="Not eklemek için buraya yazın..." className="mt-4 min-h-[120px] rounded-xl" />
            <p className="mt-2 text-right text-xs text-muted-foreground">{notes.length} / 250</p>
          </div>
        </div>
      </div>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-background sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Geçmiş Yoklamalar</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {attendanceRecords.slice(0, 60).map((item) => (
              <div key={item.id} className="rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-bold">{item.studentName}</p>
                    <p className="text-sm text-muted-foreground">{item.className} • {item.lesson}</p>
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">{item.status}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(item.lessonDate)}</p>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
