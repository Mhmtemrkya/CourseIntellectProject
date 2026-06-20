import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Calendar, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  Clock, Download, Eye, FileText, Filter, MoreVertical, Plus, RefreshCw, Save,
  Search, Upload, Users, X, XCircle,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import { useToast } from '../hooks/use-toast';
import { fetchAttendance, fetchClasses, fetchStudents, saveAttendance } from '../lib/api/modules';

const statusLabels = {
  Katildi: 'Devam Etti',
  Gec: 'Gecikmeli',
  Izinli: 'İzinli',
  Devamsiz: 'Devamsız',
};

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

function toStatus(value = '') {
  const key = normalize(value);
  if (key.includes('katildi') || key.includes('present')) return 'Katildi';
  if (key.includes('gec') || key.includes('late')) return 'Gec';
  if (key.includes('izin')) return 'Izinli';
  return 'Devamsiz';
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function downloadCsv(filename, rows) {
  const content = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function StatCard({ icon: Icon, label, value, hint, tone }) {
  const tones = {
    blue: 'from-blue-500/20 to-blue-500/5 text-blue-300 border-blue-500/15',
    green: 'from-emerald-500/20 to-emerald-500/5 text-emerald-300 border-emerald-500/15',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-300 border-amber-500/15',
    purple: 'from-purple-500/20 to-purple-500/5 text-purple-300 border-purple-500/15',
    red: 'from-rose-500/20 to-rose-500/5 text-rose-300 border-rose-500/15',
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-5 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/10">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-black text-foreground">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}

export default function Attendance() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedLesson, setSelectedLesson] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [dateFrom, setDateFrom] = useState(() => new Date(new Date().setDate(new Date().getDate() - 14)).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [addForm, setAddForm] = useState({ studentName: '', lesson: 'Genel Ders', date: new Date().toISOString().slice(0, 10), status: 'Devamsiz' });

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
      setError(err.message || 'Devamsızlık verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const lessons = useMemo(() => [...new Set(records.map((item) => item.lesson).filter(Boolean))], [records]);

  const classStudents = useMemo(() => students.filter((item) => !selectedClass || item.className === selectedClass), [selectedClass, students]);

  const filteredRecords = useMemo(() => records.filter((item) => {
    const date = String(item.lessonDate || '').slice(0, 10);
    const matchesClass = !selectedClass || item.className === selectedClass;
    const matchesLesson = selectedLesson === 'all' || item.lesson === selectedLesson;
    const matchesType = selectedType === 'all' || toStatus(item.status) === selectedType;
    const matchesDate = (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
    return matchesClass && matchesLesson && matchesType && matchesDate;
  }), [dateFrom, dateTo, records, selectedClass, selectedLesson, selectedType]);

  const studentRows = useMemo(() => classStudents.map((student) => {
    const studentRecords = filteredRecords.filter((item) => normalize(item.studentName) === normalize(student.fullName));
    const absent = studentRecords.filter((item) => toStatus(item.status) === 'Devamsiz').length;
    const late = studentRecords.filter((item) => toStatus(item.status) === 'Gec').length;
    const present = studentRecords.filter((item) => ['Katildi', 'Gec', 'Izinli'].includes(toStatus(item.status))).length;
    const total = studentRecords.length || 0;
    const absenceRate = total ? Math.round((absent / total) * 100) : 0;
    const latestAbsence = studentRecords
      .filter((item) => toStatus(item.status) === 'Devamsiz')
      .sort((a, b) => new Date(b.lessonDate) - new Date(a.lessonDate))[0];
    return { ...student, present, absent, late, total, absenceRate, latestAbsence, records: studentRecords };
  }), [classStudents, filteredRecords]);

  const summary = useMemo(() => {
    const totalStudents = classStudents.length;
    const absentStudents = studentRows.filter((item) => item.absent > 0).length;
    const presentStudents = Math.max(0, totalStudents - absentStudents);
    const totalAbsent = studentRows.reduce((sum, item) => sum + item.absent, 0);
    const totalDays = filteredRecords.length;
    return {
      totalStudents,
      presentStudents,
      absentStudents,
      totalDays,
      totalAbsent,
      absenceRate: totalDays ? Math.round((totalAbsent / totalDays) * 100) : 0,
    };
  }, [classStudents.length, filteredRecords.length, studentRows]);

  const selectedDetail = useMemo(() => {
    if (!selectedStudent) return null;
    return studentRows.find((item) => item.id === selectedStudent.id || item.fullName === selectedStudent.fullName) || selectedStudent;
  }, [selectedStudent, studentRows]);

  const calendarDays = useMemo(() => {
    const base = new Date(dateTo || new Date());
    const year = base.getFullYear();
    const month = base.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    return Array.from({ length: 35 }, (_, index) => {
      const date = new Date(year, month, index - startOffset + 1);
      const iso = date.toISOString().slice(0, 10);
      const dayRecords = selectedDetail?.records?.filter((item) => String(item.lessonDate || '').slice(0, 10) === iso) || [];
      const hasAbsent = dayRecords.some((item) => toStatus(item.status) === 'Devamsiz');
      const hasPresent = dayRecords.some((item) => ['Katildi', 'Gec', 'Izinli'].includes(toStatus(item.status)));
      return { date, iso, inMonth: date.getMonth() === month, hasAbsent, hasPresent };
    });
  }, [dateTo, selectedDetail]);

  const exportReport = () => {
    downloadCsv('devamsizlik-raporu.csv', [
      ['Öğrenci', 'Sınıf', 'Devam Eden Gün', 'Devamsız Gün', 'Oran', 'Son Devamsızlık'],
      ...studentRows.map((item) => [item.fullName, item.className, item.present, item.absent, `%${item.absenceRate}`, formatDate(item.latestAbsence?.lessonDate)]),
    ]);
    toast({ title: 'Devamsızlık raporu indirildi' });
  };

  const saveSingleAbsence = async () => {
    const student = students.find((item) => normalize(item.fullName) === normalize(addForm.studentName));
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
        students: [{ name: student.fullName, status: addForm.status === 'Katildi' ? 'present' : addForm.status === 'Gec' ? 'late' : addForm.status === 'Izinli' ? 'excuse' : 'absent' }],
      });
      setRecords((prev) => [...payload, ...prev]);
      setAddOpen(false);
      toast({ title: 'Devamsızlık kaydı eklendi' });
    } catch (err) {
      toast({ title: 'Kayıt eklenemedi', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
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
      const created = [];
      for (const row of rows) {
        const [studentName, lesson = 'Genel Ders', date = new Date().toISOString().slice(0, 10), status = 'Devamsiz'] = row;
        const student = students.find((item) => normalize(item.fullName) === normalize(studentName));
        if (!student) continue;
        const payload = await saveAttendance({
          className: student.className,
          lesson,
          lessonDate: date,
          students: [{ name: student.fullName, status: toStatus(status) === 'Katildi' ? 'present' : toStatus(status) === 'Gec' ? 'late' : toStatus(status) === 'Izinli' ? 'excuse' : 'absent' }],
        });
        created.push(...payload);
      }
      setRecords((prev) => [...created, ...prev]);
      setBulkOpen(false);
      setBulkText('');
      toast({ title: 'Toplu giriş tamamlandı', description: `${created.length} kayıt işlendi.` });
    } catch (err) {
      toast({ title: 'Toplu giriş başarısız', description: err.message || 'Tekrar deneyin.', variant: 'destructive' });
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
          <Button className="rounded-xl bg-orange-500 text-white hover:bg-orange-600" onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" /> Devamsızlık Ekle</Button>
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
        <StatCard icon={CheckCircle2} label="Toplam Devam Eden" value={summary.presentStudents} hint={`%${summary.totalStudents ? Math.round((summary.presentStudents / summary.totalStudents) * 100) : 0}`} tone="green" />
        <StatCard icon={Clock} label="Toplam Devamsız" value={summary.absentStudents} hint={`%${summary.totalStudents ? Math.round((summary.absentStudents / summary.totalStudents) * 100) : 0}`} tone="amber" />
        <StatCard icon={Calendar} label="Toplam Gün" value={summary.totalDays} tone="purple" />
        <StatCard icon={CalendarDays} label="Toplam Devamsızlık" value={summary.totalAbsent} hint="Gün" tone="red" />
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
                  <th className="px-5 py-4 text-center">Devam Eden Gün</th>
                  <th className="px-5 py-4 text-center">Devamsız Gün</th>
                  <th className="px-5 py-4 text-center">Devamsızlık Oranı</th>
                  <th className="px-5 py-4 text-center">Son Devamsızlık</th>
                  <th className="px-5 py-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {studentRows.map((student, index) => (
                  <tr key={student.id || student.fullName} className={`border-b last:border-b-0 ${selectedDetail?.fullName === student.fullName ? 'bg-blue-500/10' : ''}`}>
                    <td className="px-5 py-4">{index + 1}</td>
                    <td className="px-5 py-4">
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
                        <Button variant="outline" size="icon" className="rounded-xl" onClick={() => { setSelectedStudent(student); setDrawerOpen(true); }}><Eye className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" className="rounded-xl" onClick={() => { setAddForm((prev) => ({ ...prev, studentName: student.fullName })); setAddOpen(true); }}><Calendar className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" className="rounded-xl" onClick={() => toast({ title: student.fullName, description: `Devamsızlık oranı %${student.absenceRate}` })}><MoreVertical className="h-4 w-4" /></Button>
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
                  <StatMini label="Devam Eden Gün" value={selectedDetail.present} tone="green" />
                  <StatMini label="Devamsız Gün" value={selectedDetail.absent} tone="red" />
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
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-[conic-gradient(#22C55E_0_70%,#EF4444_70%_100%)]">
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
              {studentRows.some((item) => item.absenceRate >= 30)
                ? 'Bazı öğrenciler %30 sınırına ulaştı veya geçti.'
                : 'Kritik devamsızlık sınırına ulaşan öğrenci yok.'}
            </div>
          </div>
        </aside>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-background sm:max-w-xl">
          <SheetHeader><SheetTitle>{selectedDetail?.fullName} Devamsızlık Detayı</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-3">
            {(selectedDetail?.records || []).map((item) => (
              <div key={item.id} className="rounded-2xl border p-4">
                <div className="flex items-center justify-between">
                  <div><p className="font-bold">{item.lesson}</p><p className="text-sm text-muted-foreground">{formatDate(item.lessonDate)}</p></div>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">{statusLabels[toStatus(item.status)]}</span>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="w-full bg-background sm:max-w-md">
          <SheetHeader><SheetTitle>Devamsızlık Ekle</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <label><span className="mb-1 block text-xs text-muted-foreground">Öğrenci</span><Input list="student-list" value={addForm.studentName} onChange={(event) => setAddForm((prev) => ({ ...prev, studentName: event.target.value }))} /><datalist id="student-list">{students.map((item) => <option key={item.id || item.fullName} value={item.fullName} />)}</datalist></label>
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

function StatMini({ label, value, tone }) {
  const tones = {
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

function MiniCalendar({ days }) {
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
