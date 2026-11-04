import { KpiCard } from '@/components/ui/kpi-card';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Calendar, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  Clock, Eye, FileText, Filter, MoreVertical, Plus, Save,
  Search, Trash2, Upload, Users, X,
} from 'lucide-react';
import { FeatureGate } from '../components/FeatureGate';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import { useToast } from '../hooks/use-toast';
import { deleteAttendanceRecord, fetchAttendance, fetchClasses, fetchStudents, saveAttendance } from '../lib/api/modules';
import { errorMessage } from '../lib/errors';
import { belongsToStudent, toAttendanceStatus, type AttendanceStatus } from '../lib/attendanceStatus';
import type { AttendanceEntryDto, StudentSummaryDto } from '../types/api/generated';
import type { IconComponent } from '../types/ui';
import { localDateKey, localDateKeyOffset } from '../lib/localDate';
import { absenceDayCounts, absenceLimitFor } from '../lib/absenceLimits';

type StatTone = 'blue' | 'green' | 'amber' | 'purple' | 'red';
type MiniTone = 'green' | 'red' | 'amber' | 'blue';

/** Öğrenci satırı: seçili süzgeçteki devam özetiyle birlikte. */
interface StudentAttendanceRow extends StudentSummaryDto {
  present: number;
  absent: number;
  late: number;
  total: number;
  absenceRate: number;
  latestAbsence: AttendanceEntryDto | undefined;
  records: AttendanceEntryDto[];
}

interface CalendarDay {
  date: Date;
  iso: string;
  inMonth: boolean;
  hasAbsent: boolean;
  hasPresent: boolean;
}

const byLessonDateDesc = (a: AttendanceEntryDto, b: AttendanceEntryDto) => new Date(b.lessonDate).getTime() - new Date(a.lessonDate).getTime();

const dayKey = (value: string | null | undefined) => String(value || '').slice(0, 10);

/** Sunucu, kaydedilen öğrencinin o ders/günkü eski kaydının yerine yenisini yazar; listede de aynısı yapılır. */
function mergeSaved(prev: readonly AttendanceEntryDto[], saved: readonly AttendanceEntryDto[]): AttendanceEntryDto[] {
  const sameSlot = (a: AttendanceEntryDto, b: AttendanceEntryDto) =>
    normalize(a.className) === normalize(b.className)
    && normalize(a.lesson) === normalize(b.lesson)
    && dayKey(a.lessonDate) === dayKey(b.lessonDate)
    && (b.studentId ? a.studentId === b.studentId || (!a.studentId && normalize(a.studentName) === normalize(b.studentName)) : !a.studentId && normalize(a.studentName) === normalize(b.studentName));
  return [...saved, ...prev.filter((item) => !saved.some((entry) => sameSlot(item, entry)))];
}

const toApiStatus = (status: string) => {
  const canonical = toAttendanceStatus(status);
  return canonical === 'Katildi' ? 'present' : canonical === 'Gec' ? 'late' : canonical === 'Izinli' ? 'excuse' : 'absent';
};

const studentOptionLabel = (student: StudentSummaryDto) =>
  [student.fullName, student.className, student.schoolNumber ? `No ${student.schoolNumber}` : ''].filter(Boolean).join(' · ');

const statusLabels: Record<AttendanceStatus, string> = {
  Katildi: 'Devam Etti',
  Gec: 'Gecikmeli',
  Izinli: 'İzinli',
  Devamsiz: 'Devamsız',
};

function normalize(value: string | null | undefined = '') {
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

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function downloadCsv(filename: string, rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>) {
  const content = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function StatCard({ icon: Icon, label, value, hint, tone }: { icon: IconComponent; label: string; value: number; hint?: string; tone: StatTone }) {
  return <KpiCard icon={Icon} label={label} value={value} caption={hint} tone={tone === 'green' ? 'emerald' : tone === 'red' ? 'rose' : tone === 'purple' ? 'violet' : tone} />;
}

export default function Attendance() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [students, setStudents] = useState<StudentSummaryDto[]>([]);
  const [records, setRecords] = useState<AttendanceEntryDto[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedLesson, setSelectedLesson] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [dateFrom, setDateFrom] = useState(() => localDateKeyOffset(-14));
  const [dateTo, setDateTo] = useState(() => localDateKey());
  const [selectedStudent, setSelectedStudent] = useState<StudentAttendanceRow | null>(null);
  const [manageStudent, setManageStudent] = useState<StudentAttendanceRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [addForm, setAddForm] = useState({ studentId: '', lesson: 'Genel Ders', date: localDateKey(), status: 'Devamsiz' });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [studentList, attendanceList, classList] = await Promise.all([
        fetchStudents(),
        fetchAttendance().catch(() => []),
        fetchClasses().catch(() => []),
      ]);
      const safeStudents = Array.isArray(studentList) ? studentList : [];
      const safeRecords = Array.isArray(attendanceList) ? attendanceList : [];
      const classNames = [...new Set([
        ...(Array.isArray(classList) ? classList : []),
        ...safeStudents.map((item) => item.className).filter(Boolean),
        ...safeRecords.map((item) => item.className).filter(Boolean),
      ])].sort((a, b) => a.localeCompare(b, 'tr'));
      setStudents(safeStudents);
      setRecords(safeRecords);
      setClasses(classNames);
      setSelectedClass((prev) => prev || classNames[0] || '');
    } catch (err) {
      setError(errorMessage(err, 'Devamsızlık verileri alınamadı.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const lessons = useMemo(() => [...new Set(records.map((item) => item.lesson).filter(Boolean))], [records]);

  const classStudents = useMemo(() => students.filter((item) => !selectedClass || item.className === selectedClass), [selectedClass, students]);

  const filteredRecords = useMemo(() => records.filter((item) => {
    const date = String(item.lessonDate || '').slice(0, 10);
    const matchesClass = !selectedClass || item.className === selectedClass;
    const matchesLesson = selectedLesson === 'all' || item.lesson === selectedLesson;
    const matchesType = selectedType === 'all' || toAttendanceStatus(item.status) === selectedType;
    const matchesDate = (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
    return matchesClass && matchesLesson && matchesType && matchesDate;
  }), [dateFrom, dateTo, records, selectedClass, selectedLesson, selectedType]);

  const studentRows = useMemo(() => classStudents.map((student): StudentAttendanceRow => {
    const studentRecords = filteredRecords.filter((item) => belongsToStudent(item, student));
    const absent = studentRecords.filter((item) => toAttendanceStatus(item.status) === 'Devamsiz').length;
    const late = studentRecords.filter((item) => toAttendanceStatus(item.status) === 'Gec').length;
    const present = studentRecords.filter((item) => ['Katildi', 'Gec', 'Izinli'].includes(toAttendanceStatus(item.status))).length;
    const total = studentRecords.length || 0;
    const absenceRate = total ? Math.round((absent / total) * 100) : 0;
    const latestAbsence = studentRecords
      .filter((item) => toAttendanceStatus(item.status) === 'Devamsiz')
      .sort(byLessonDateDesc)[0];
    return { ...student, present, absent, late, total, absenceRate, latestAbsence, records: studentRecords };
  }), [classStudents, filteredRecords]);

  const summary = useMemo(() => {
    const totalStudents = classStudents.length;
    const absentStudents = studentRows.filter((item) => item.absent > 0).length;
    const presentStudents = Math.max(0, totalStudents - absentStudents);
    const totalAbsent = studentRows.reduce((sum, item) => sum + item.absent, 0);
    // Kayıt sayısı öğrenci × ders'tir; gün sayısı ayrı tarihlerden çıkar.
    const totalLessons = filteredRecords.length;
    const totalDays = new Set(filteredRecords.map((item) => dayKey(item.lessonDate)).filter(Boolean)).size;
    return {
      totalStudents,
      presentStudents,
      absentStudents,
      totalDays,
      totalLessons,
      totalAbsent,
      absenceRate: totalLessons ? Math.round((totalAbsent / totalLessons) * 100) : 0,
    };
  }, [classStudents.length, filteredRecords.length, studentRows]);

  // Lisede yönetmelik sınırı gün bazındadır (özürsüz 10 / toplam 30). Diğer seviyelerde
  // doğrulanmış sabit sayı olmadığından yalnız "yüksek devamsızlık" eşiği (%30) uyarı olarak
  // gösterilir; eskiden bu eşik herkese yasal sınır gibi yazılıyordu.
  const absenceWarning = useMemo(() => {
    let overLimit = 0;
    let nearLimit = 0;
    let highRate = 0;
    studentRows.forEach((row) => {
      const limit = absenceLimitFor(row.className);
      if (limit) {
        const days = absenceDayCounts(row.records);
        if (days.unexcusedDays > limit.unexcusedDays || days.totalDays > limit.totalDays) overLimit += 1;
        else if (days.unexcusedDays >= limit.unexcusedDays - 2 || days.totalDays >= limit.totalDays - 5) nearLimit += 1;
      } else if (row.absenceRate >= 30) {
        highRate += 1;
      }
    });
    const parts = [
      overLimit ? `${overLimit} öğrenci yönetmelik sınırını aştı (özürsüz 10 / toplam 30 gün).` : '',
      nearLimit ? `${nearLimit} öğrenci sınıra yaklaştı.` : '',
      highRate ? `${highRate} öğrencinin devamsızlığı derslerin %30'unu geçti.` : '',
    ].filter(Boolean);
    return parts.length ? parts.join(' ') : 'Sınıra ulaşan ya da yüksek devamsızlığı olan öğrenci yok.';
  }, [studentRows]);

  const selectedDetail = useMemo(() => {
    if (!selectedStudent) return null;
    return studentRows.find((item) => item.id === selectedStudent.id) || selectedStudent;
  }, [selectedStudent, studentRows]);

  const calendarDays = useMemo((): CalendarDay[] => {
    const base = new Date(dateTo || new Date());
    const year = base.getFullYear();
    const month = base.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    return Array.from({ length: 35 }, (_, index) => {
      const date = new Date(year, month, index - startOffset + 1);
      const iso = localDateKey(date);
      const dayRecords = selectedDetail?.records?.filter((item) => String(item.lessonDate || '').slice(0, 10) === iso) || [];
      const hasAbsent = dayRecords.some((item) => toAttendanceStatus(item.status) === 'Devamsiz');
      const hasPresent = dayRecords.some((item) => ['Katildi', 'Gec', 'Izinli'].includes(toAttendanceStatus(item.status)));
      return { date, iso, inMonth: date.getMonth() === month, hasAbsent, hasPresent };
    });
  }, [dateTo, selectedDetail]);

  const exportReport = () => {
    downloadCsv('devamsizlik-raporu.csv', [
      ['Öğrenci', 'Sınıf', 'Katıldığı Ders', 'Devamsız Ders', 'Devamsızlık Oranı', 'Son Devamsızlık'],
      ...studentRows.map((item) => [item.fullName, item.className, item.present, item.absent, `%${item.absenceRate}`, formatDate(item.latestAbsence?.lessonDate)]),
    ]);
    toast({ title: 'Devamsızlık raporu indirildi' });
  };

  const manageRecords = useMemo(() => {
    if (!manageStudent) return [];
    return records
      .filter((item) => belongsToStudent(item, manageStudent))
      .sort(byLessonDateDesc);
  }, [manageStudent, records]);

  const handleDeleteRecord = async (record: AttendanceEntryDto) => {
    try {
      setDeletingId(record.id);
      await deleteAttendanceRecord(record.id);
      setRecords((prev) => prev.filter((item) => item.id !== record.id));
      toast({ title: 'Kayıt silindi', description: `${record.lesson || 'Ders'} • ${formatDate(record.lessonDate)}` });
    } catch (err) {
      toast({ title: 'Kayıt silinemedi', description: errorMessage(err, 'Tekrar deneyin.'), variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const saveSingleAbsence = async () => {
    const student = students.find((item) => item.id === addForm.studentId);
    if (!student) {
      toast({ title: 'Öğrenci bulunamadı', description: 'Listeden geçerli bir öğrenci seçin.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const payload = await saveAttendance({
        className: student.className,
        lesson: addForm.lesson || 'Genel Ders',
        lessonDate: addForm.date,
        students: [{ name: student.fullName, studentId: student.id, status: toApiStatus(addForm.status) }],
      });
      setRecords((prev) => mergeSaved(prev, payload ?? []));
      setAddOpen(false);
      toast({ title: 'Devamsızlık kaydı eklendi' });
    } catch (err) {
      toast({ title: 'Kayıt eklenemedi', description: errorMessage(err, 'Tekrar deneyin.'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const saveBulk = async () => {
    const rows = bulkText.split('\n').map((line) => line.split(',').map((cell) => cell.trim())).filter((row) => row.length >= 2);
    if (rows.length === 0) {
      toast({ title: 'Toplu giriş boş', description: 'Her satır: öğrenci adı, ders, tarih, durum', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const created: AttendanceEntryDto[] = [];
      const skipped: string[] = [];
      for (const row of rows) {
        const [studentName, lesson = 'Genel Ders', date = localDateKey(), status = 'Devamsiz'] = row;
        // Aynı adlı birden çok öğrenci varsa tahmin edilmez; satır atlanıp bildirilir.
        const matches = students.filter((item) => normalize(item.fullName) === normalize(studentName));
        const student = matches.length === 1 ? matches[0] : undefined;
        if (!student) {
          skipped.push(matches.length > 1 ? `${studentName} (aynı adlı ${matches.length} öğrenci)` : `${studentName} (bulunamadı)`);
          continue;
        }
        const payload = await saveAttendance({
          className: student.className,
          lesson,
          lessonDate: date,
          students: [{ name: student.fullName, studentId: student.id, status: toApiStatus(status) }],
        });
        created.push(...(payload ?? []));
      }
      setRecords((prev) => mergeSaved(prev, created));
      if (skipped.length === 0) {
        setBulkOpen(false);
        setBulkText('');
      }
      toast({
        title: 'Toplu giriş tamamlandı',
        description: skipped.length
          ? `${created.length} kayıt işlendi. İşlenmeyen satırlar: ${skipped.join(', ')}. Bunları tek tek "Devamsızlık Ekle" ile girin.`
          : `${created.length} kayıt işlendi.`,
        variant: skipped.length ? 'destructive' : undefined,
      });
    } catch (err) {
      toast({ title: 'Toplu giriş başarısız', description: errorMessage(err, 'Tekrar deneyin.'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5" data-testid="attendance-page">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">Devamsızlık</h1>
          <p className="text-sm text-muted-foreground">Sınıf ve ders bazında devamsızlık takibi yapabilir, raporları görüntüleyebilirsiniz.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl" onClick={exportReport}><FileText className="mr-2 h-4 w-4" /> Devamsızlık Raporu</Button>
          <Button className="rounded-xl bg-blue-600 text-white hover:bg-blue-700" onClick={() => setBulkOpen(true)}><Upload className="mr-2 h-4 w-4" /> Toplu Devamsızlık Girişi</Button>
          <FeatureGate module="attendance" action="take"><Button className="rounded-xl bg-orange-500 text-white hover:bg-orange-600" onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" /> Devamsızlık Ekle</Button></FeatureGate>
        </div>
      </div>

      {error ? <ErrorBanner title="Devamsızlık alınamadı" message={error} onRetry={load} /> : null}

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_1fr_auto]">
          <label>
            <span className="mb-1 block text-xs text-muted-foreground">Sınıf</span>
            <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)} className="h-11 w-full rounded-xl border bg-background px-3 text-sm">
              {classes.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs text-muted-foreground">Ders</span>
            <select value={selectedLesson} onChange={(event) => setSelectedLesson(event.target.value)} className="h-11 w-full rounded-xl border bg-background px-3 text-sm">
              <option value="all">Tüm Dersler</option>
              {lessons.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs text-muted-foreground">Tarih Aralığı</span>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-11 rounded-xl" />
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-11 rounded-xl" />
            </div>
          </label>
          <label>
            <span className="mb-1 block text-xs text-muted-foreground">Devamsızlık Türü</span>
            <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)} className="h-11 w-full rounded-xl border bg-background px-3 text-sm">
              <option value="all">Tümü</option>
              <option value="Devamsiz">Devamsız</option>
              <option value="Gec">Gecikmeli</option>
              <option value="Izinli">İzinli</option>
              <option value="Katildi">Devam Etti</option>
            </select>
          </label>
          <Button variant="outline" className="mt-auto h-11 rounded-xl" onClick={load}><Filter className="mr-2 h-4 w-4" /> Filtrele</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Users} label="Toplam Öğrenci" value={summary.totalStudents} tone="blue" />
        <StatCard icon={CheckCircle2} label="Devamsızlığı Olmayan" value={summary.presentStudents} hint={`%${summary.totalStudents ? Math.round((summary.presentStudents / summary.totalStudents) * 100) : 0}`} tone="green" />
        <StatCard icon={Clock} label="Devamsızlığı Olan" value={summary.absentStudents} hint={`%${summary.totalStudents ? Math.round((summary.absentStudents / summary.totalStudents) * 100) : 0}`} tone="amber" />
        <StatCard icon={Calendar} label="Toplam Gün" value={summary.totalDays} hint={`${summary.totalLessons} ders kaydı`} tone="purple" />
        <StatCard icon={CalendarDays} label="Toplam Devamsızlık" value={summary.totalAbsent} hint="Ders" tone="red" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b p-5">
            <h2 className="font-black">Öğrenci Devamsızlık Listesi</h2>
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Öğrenci ara..." className="h-10 rounded-xl pl-9" onChange={(event) => {
                const match = studentRows.find((item) => normalize(item.fullName).includes(normalize(event.target.value)));
                if (event.target.value && match) setSelectedStudent(match);
              }} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-4 text-left">No</th>
                  <th className="px-5 py-4 text-left">Öğrenci Adı Soyadı</th>
                  <th className="px-5 py-4 text-center">Katıldığı Ders</th>
                  <th className="px-5 py-4 text-center">Devamsız Ders</th>
                  <th className="px-5 py-4 text-center">Devamsızlık Oranı</th>
                  <th className="px-5 py-4 text-center">Son Devamsızlık</th>
                  <th className="px-5 py-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {studentRows.map((student, index) => (
                  <tr key={student.id || student.fullName} className={`border-b last:border-b-0 ${selectedDetail?.id === student.id ? 'bg-blue-500/10' : ''}`}>
                    <td className="px-5 py-4">{index + 1}</td>
                    <td className="cursor-pointer px-5 py-4" onClick={() => setSelectedStudent(student)}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">{student.fullName?.slice(0, 2)?.toUpperCase()}</div>
                        <div><p className="font-bold">{student.fullName}</p><p className="text-xs text-muted-foreground">{student.className}</p></div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center font-bold">{student.present}</td>
                    <td className="px-5 py-4 text-center font-bold">{student.absent}</td>
                    <td className={`px-5 py-4 text-center font-black ${student.absenceRate >= 30 ? 'text-rose-500' : student.absenceRate >= 15 ? 'text-orange-500' : 'text-emerald-500'}`}>%{student.absenceRate}</td>
                    <td className="px-5 py-4 text-center font-bold text-rose-500">{student.latestAbsence ? formatDate(student.latestAbsence.lessonDate) : '-'}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setSelectedStudent(student)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" className="rounded-xl" onClick={() => { setAddForm((prev) => ({ ...prev, studentId: student.id })); setAddOpen(true); }}><Calendar className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setManageStudent(student)}><MoreVertical className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-black">{selectedDetail?.fullName || 'Öğrenci Detayı'}</h2>
              <Button variant="ghost" size="icon" onClick={() => setSelectedStudent(null)}><X className="h-4 w-4" /></Button>
            </div>
            {selectedDetail ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <StatMini label="Katıldığı Ders" value={selectedDetail.present} tone="green" />
                  <StatMini label="Devamsız Ders" value={selectedDetail.absent} tone="red" />
                  <StatMini label="Devamsızlık Oranı" value={`%${selectedDetail.absenceRate}`} tone="amber" />
                  <StatMini label="Son Devamsızlık" value={formatDate(selectedDetail.latestAbsence?.lessonDate)} tone="blue" />
                </div>
                <MiniCalendar days={calendarDays} />
              </>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Detay görmek için listeden öğrenci seçin.</p>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-black">Devamsızlık Dağılımı</h2>
            <div className="mt-5 flex items-center gap-5">
              {/* Halka gerçek orandan çizilir; eskiden sabit %70/%30 boyanıyordu. */}
              <div
                className="relative flex h-32 w-32 items-center justify-center rounded-full"
                style={{ background: summary.totalLessons ? `conic-gradient(#22C55E 0 ${100 - summary.absenceRate}%, #EF4444 ${100 - summary.absenceRate}% 100%)` : 'hsl(var(--muted))' }}
              >
                <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-card">
                  <span className="text-2xl font-black">%{summary.absenceRate}</span>
                  <span className="text-xs text-muted-foreground">Oran</span>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />Devam Eden</p>
                <p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-rose-500" />Devamsız</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-black">Devamsızlık Uyarıları</h2>
            <div className="mt-4 rounded-xl border border-orange-500/25 bg-orange-500/10 p-4 text-sm text-orange-800 dark:text-orange-100">
              <AlertTriangle className="mb-2 h-5 w-5" />
              {absenceWarning}
            </div>
          </div>
        </aside>
      </div>

      <Dialog open={!!manageStudent} onOpenChange={(open) => !open && setManageStudent(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{manageStudent?.fullName} — Devamsızlık İşlemleri</DialogTitle>
            <DialogDescription>Öğrencinin devamsızlık kayıtlarını görüntüleyin ve silin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {manageRecords.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Bu öğrenci için kayıt bulunmuyor.</p>
            ) : manageRecords.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border p-4">
                <div>
                  <p className="font-bold">{item.lesson || 'Ders'}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(item.lessonDate)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">{statusLabels[toAttendanceStatus(item.status)]}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => handleDeleteRecord(item)}
                    disabled={deletingId === item.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="w-full bg-background sm:max-w-md">
          <SheetHeader><SheetTitle>Devamsızlık Ekle</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <label><span className="mb-1 block text-xs text-muted-foreground">Öğrenci</span><select value={addForm.studentId} onChange={(event) => setAddForm((prev) => ({ ...prev, studentId: event.target.value }))} className="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-testid="attendance-add-student"><option value="">Öğrenci seçin</option>{students.map((item) => <option key={item.id} value={item.id}>{studentOptionLabel(item)}</option>)}</select></label>
            <label><span className="mb-1 block text-xs text-muted-foreground">Ders</span><Input value={addForm.lesson} onChange={(event) => setAddForm((prev) => ({ ...prev, lesson: event.target.value }))} /></label>
            <label><span className="mb-1 block text-xs text-muted-foreground">Tarih</span><Input type="date" value={addForm.date} onChange={(event) => setAddForm((prev) => ({ ...prev, date: event.target.value }))} /></label>
            <label><span className="mb-1 block text-xs text-muted-foreground">Durum</span><select value={addForm.status} onChange={(event) => setAddForm((prev) => ({ ...prev, status: event.target.value }))} className="h-10 w-full rounded-xl border bg-background px-3 text-sm"><option value="Devamsiz">Devamsız</option><option value="Gec">Gecikmeli</option><option value="Izinli">İzinli</option><option value="Katildi">Devam Etti</option></select></label>
            <Button className="w-full rounded-xl bg-orange-500 text-white hover:bg-orange-600" onClick={saveSingleAbsence} disabled={saving}><Save className="mr-2 h-4 w-4" /> Kaydet</Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={bulkOpen} onOpenChange={setBulkOpen}>
        <SheetContent side="right" className="w-full bg-background sm:max-w-xl">
          <SheetHeader><SheetTitle>Toplu Devamsızlık Girişi</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">Her satır: Öğrenci Adı, Ders, Tarih, Durum</p>
            <Textarea value={bulkText} onChange={(event) => setBulkText(event.target.value)} className="min-h-[260px]" placeholder={'Mehmet Yılmaz, Matematik, 2025-05-15, Devamsız\nZeynep Kaya, Türkçe, 2025-05-15, Gec'} />
            <Button className="w-full rounded-xl bg-blue-600 text-white hover:bg-blue-700" onClick={saveBulk} disabled={saving}><Upload className="mr-2 h-4 w-4" /> Toplu Kaydet</Button>
          </div>
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}

function StatMini({ label, value, tone }: { label: string; value: string | number; tone: MiniTone }) {
  const tones: Record<MiniTone, string> = {
    green: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600',
    red: 'border-rose-500/20 bg-rose-500/10 text-rose-600',
    amber: 'border-orange-500/25 bg-orange-500/10 text-orange-600',
    blue: 'border-blue-500/20 bg-blue-500/10 text-blue-600',
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function MiniCalendar({ days }: { days: CalendarDay[] }) {
  return (
    <div className="mt-5 rounded-2xl border p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-bold">Aylık Takvim</h3>
        <div className="flex gap-1"><ChevronLeft className="h-4 w-4" /><ChevronRight className="h-4 w-4" /></div>
      </div>
      <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
        {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="mt-3 grid grid-cols-7 gap-2">
        {days.map((day) => (
          <div key={day.iso} className={`flex h-8 items-center justify-center rounded-full text-xs font-bold ${!day.inMonth ? 'text-muted-foreground/40' : day.hasAbsent ? 'bg-rose-500 text-white' : day.hasPresent ? 'bg-emerald-500 text-white' : 'bg-muted text-foreground'}`}>
            {day.date.getDate()}
          </div>
        ))}
      </div>
    </div>
  );
}
