import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Download,
  Filter,
  Users,
  GraduationCap,
  ClipboardCheck,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Wallet,
  ReceiptText,
  NotebookPen,
  Phone,
  Mail,
  UserRound,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import { fetchAdminDashboardData } from '../lib/api/dashboardData';
import {
  fetchAccountingDashboard,
  fetchAttendance,
  fetchExamResults,
  fetchStaff,
  fetchStudents,
  updateStudent,
} from '../lib/api/modules';
import { formatCurrency, parseFinanceMoney } from '../lib/financeDocuments';
import { useToast } from '../hooks/use-toast';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const reportTypes = [
  { id: 'attendance', name: 'Devamsızlık Raporu', icon: ClipboardCheck, description: 'Öğrenci devamsızlık özeti' },
  { id: 'performance', name: 'Performans Raporu', icon: BarChart3, description: 'Sınav ve ödev performansı' },
  { id: 'students', name: 'Öğrenci Listesi', icon: Users, description: 'Detaylı öğrenci bilgileri' },
  { id: 'teachers', name: 'Öğretmen Raporu', icon: GraduationCap, description: 'Öğretmen aktivite özeti' },
];

const STUDENT_REPORT_NOTES_KEY = 'courseintellect:student-report-notes';

function normalizeLookup(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replaceAll('İ', 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function getStudentName(student) {
  return student?.fullName || student?.name || [student?.firstName, student?.lastName].filter(Boolean).join(' ') || 'Öğrenci';
}

function getStudentKey(student) {
  return String(student?.id || student?.studentId || student?.username || getStudentName(student));
}

function getInitials(name) {
  return String(name || 'Ö')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('tr-TR');
}

function formatDate(value) {
  if (!value) return 'Tarih yok';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('tr-TR');
}

function isPaidStatus(status) {
  const normalized = normalizeLookup(status).replace(/\s+/g, '');
  return normalized.includes('odendi') || normalized.includes('paid') || normalized.includes('tahsil');
}

function recordMatchesStudent(record, student) {
  if (!record || !student) return false;
  const studentIds = [
    student.id,
    student.studentId,
    student.username,
    student.identityNumber,
    student.tcNo,
    student.nationalId,
  ].filter(Boolean).map((value) => normalizeLookup(value));

  const recordIds = [
    record.studentId,
    record.studentUserId,
    record.userId,
    record.username,
    record.identityNumber,
    record.tcNo,
    record.nationalId,
  ].filter(Boolean).map((value) => normalizeLookup(value));

  if (recordIds.some((id) => studentIds.includes(id))) return true;

  const studentNames = [
    getStudentName(student),
    student.fullName,
    student.name,
    student.username,
  ].filter(Boolean).map((value) => normalizeLookup(value));

  const recordTexts = [
    record.studentName,
    record.student,
    record.name,
    record.fullName,
    record.title,
    record.subtitle,
    record.description,
    record.note,
  ].filter(Boolean).map((value) => normalizeLookup(value));

  return recordTexts.some((text) => studentNames.some((name) => name.length > 2 && (text === name || text.includes(name))));
}

function buildStudentUpdatePayload(student, note) {
  return {
    fullName: getStudentName(student),
    tcNo: student.tcNo || student.identityNumber || student.nationalId || '',
    className: student.className || '',
    currentSchool: student.currentSchool || student.school || '',
    schoolNumber: student.schoolNumber || student.studentNumber || student.number || '',
    birthDate: student.birthDate || '',
    programType: student.programType || '',
    parentName: student.parentName || student.guardianName || student.parentFullName || '',
    parentPhone: student.parentPhone || student.guardianPhone || '',
    parentEmail: student.parentEmail || student.guardianEmail || '',
    address: student.address || '',
    note,
  };
}

function downloadText(name, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(name, rows) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function AdministrativeReportOverview() {
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState(reportTypes[0]);
  const [classFilter, setClassFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('month');
  const [dashboardData, setDashboardData] = useState(null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [exams, setExams] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [accountingDashboard, setAccountingDashboard] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [studentNotes, setStudentNotes] = useState(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(window.localStorage.getItem(STUDENT_REPORT_NOTES_KEY) || '{}') || {};
    } catch {
      return {};
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [adminDashboard, studentList, teacherList, examList, attendanceList, financeDashboard] = await Promise.all([
        fetchAdminDashboardData(),
        fetchStudents(),
        fetchStaff('Teacher').catch(() => []),
        fetchExamResults().catch(() => []),
        fetchAttendance().catch(() => []),
        fetchAccountingDashboard().catch(() => null),
      ]);
      setDashboardData(adminDashboard);
      setStudents(studentList);
      setTeachers(teacherList);
      setExams(examList);
      setAttendance(attendanceList);
      setAccountingDashboard(financeDashboard);
    } catch (err) {
      setError(err.message || 'Rapor verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const classes = useMemo(() => [...new Set(students.map((item) => item.className).filter(Boolean))], [students]);
  const displayClasses = useMemo(() => {
    if (classes.length > 0) return classes;
    if (classFilter !== 'all') return [classFilter];
    return [];
  }, [classes, classFilter]);

  const filteredStudents = useMemo(() => (
    classFilter === 'all' ? students : students.filter((student) => student.className === classFilter)
  ), [students, classFilter]);

  const filteredExams = useMemo(() => (
    classFilter === 'all' ? exams : exams.filter((exam) => exam.className === classFilter || exam.title?.includes(classFilter))
  ), [exams, classFilter]);

  const attendanceRows = useMemo(() => (
    displayClasses.map((cls) => {
      const classStudents = filteredStudents.filter((student) => student.className === cls);
      const classRecords = attendance.filter((item) => item.className === cls);
      const presentRecords = classRecords.filter((item) => normalizeLookup(item.status).includes('katildi'));
      const value = classRecords.length > 0
        ? Math.round((presentRecords.length / classRecords.length) * 100)
        : 0;
      return {
        name: cls,
        value,
        count: classStudents.length,
      };
    })
  ), [attendance, displayClasses, filteredStudents]);

  const subjectPerformance = useMemo(() => {
    const subjects = [...new Set(filteredExams.map((item) => item.subject).filter(Boolean))];
    return subjects.map((subject) => {
      const items = filteredExams.filter((exam) => exam.subject === subject);
      const average = items.length ? Math.round(items.reduce((sum, item) => sum + Number(item.score || 0), 0) / items.length) : 0;
      return { subject, average };
    });
  }, [filteredExams]);

  const teacherRows = useMemo(() => (
    teachers.map((teacher) => {
      const assignedClasses = teacher.assignedClasses || [];
      const scopedStudents = students.filter((student) => assignedClasses.includes(student.className));
      const scopedExams = filteredExams.filter((exam) => {
        const teacherName = String(teacher.fullName || '').trim().toLowerCase();
        const examTeacher = String(exam.teacher || exam.teacherName || '').trim().toLowerCase();
        return teacherName && examTeacher === teacherName;
      });

      return {
        id: teacher.id,
        name: teacher.fullName,
        branch: teacher.departmentOrBranch || teacher.role,
        classes: assignedClasses.length,
        studentCount: scopedStudents.length,
        averageScore: scopedExams.length
          ? Math.round(scopedExams.reduce((sum, item) => sum + Number(item.score || 0), 0) / scopedExams.length)
          : 0,
      };
    })
  ), [teachers, students, filteredExams]);

  const displayTeacherRows = teacherRows;

  const displayStudentRows = useMemo(() => (
    filteredStudents.slice(0, 8).map((student) => {
      const examScores = filteredExams.filter((exam) => recordMatchesStudent(exam, student));
      const averageScore = examScores.length
        ? Math.round(examScores.reduce((sum, item) => sum + Number(item.score || 0), 0) / examScores.length)
        : 0;
      const studentAttendance = attendance.filter((item) => recordMatchesStudent(item, student));
      const presentCount = studentAttendance.filter((item) => normalizeLookup(item.status).includes('katildi')).length;
      const attendanceRate = studentAttendance.length
        ? Math.round((presentCount / studentAttendance.length) * 100)
        : 0;
      return {
        id: student.id,
        name: student.fullName,
        className: student.className || 'Sınıf yok',
        programType: student.programType || 'Belirtilmemiş',
        averageScore,
        attendanceRate,
        enrollmentNet: Number(student.enrollmentNet || 0),
        enrollmentPaid: Number(student.enrollmentPaid || 0),
        enrollmentBalance: Number(student.enrollmentBalance || 0),
        enrollmentCurrency: student.enrollmentCurrency || 'TRY',
        enrollmentStatus: student.enrollmentStatus || 'Kayıt yok',
        enrollmentOverdueCount: Number(student.enrollmentOverdueCount || 0),
        raw: student,
      };
    })
  ), [filteredStudents, filteredExams, attendance]);

  const stats = useMemo(() => ({
    totalStudents: filteredStudents.length,
    attendanceRate: dashboardData?.quickStats?.attendanceRate || 0,
    averageScore: filteredExams.length ? Math.round(filteredExams.reduce((sum, item) => sum + Number(item.score || 0), 0) / filteredExams.length) : 0,
    activeExams: filteredExams.length,
  }), [filteredStudents, dashboardData, filteredExams]);

  const selectedStudentDetail = useMemo(() => {
    if (!selectedStudent) return null;

    const student = selectedStudent.raw || selectedStudent;
    const studentExams = exams.filter((exam) => recordMatchesStudent(exam, student));
    const studentAttendance = attendance.filter((item) => recordMatchesStudent(item, student));
    const installments = (accountingDashboard?.installments || []).filter((item) => recordMatchesStudent(item, student));
    const collectionSource = accountingDashboard?.collections?.length
      ? accountingDashboard.collections
      : accountingDashboard?.recentCollections || [];
    const collections = collectionSource.filter((item) => recordMatchesStudent(item, student));
    const invoices = (accountingDashboard?.invoices || []).filter((item) => recordMatchesStudent(item, student));
    const averageScore = studentExams.length
      ? Math.round(studentExams.reduce((sum, item) => sum + Number(item.score || item.point || 0), 0) / studentExams.length)
      : selectedStudent.averageScore || 0;
    const presentLessons = studentAttendance.filter((item) => normalizeLookup(item.status).includes('katildi')).length;
    const attendanceRate = studentAttendance.length ? Math.round((presentLessons / studentAttendance.length) * 100) : 0;
    const paidInstallments = installments.filter((item) => isPaidStatus(item.status));
    const unpaidInstallments = installments.filter((item) => !isPaidStatus(item.status));
    const installmentTotal = installments.reduce((sum, item) => sum + parseFinanceMoney(item.amount), 0);
    const invoiceTotal = invoices.reduce((sum, item) => sum + parseFinanceMoney(item.amount), 0);
    const collectionTotal = collections.reduce((sum, item) => sum + parseFinanceMoney(item.amount), 0);
    const remainingBalance = Math.max(0, installmentTotal + invoiceTotal - collectionTotal);

    // Tahsilat dağılımı — gerçek ödeme verisinden hesaplanır (sıfır sabit değil).
    // Peşinat: kayıt peşinatı olarak işaretlenen tahsilatlar (not/yöntem "peşinat").
    // Diğer: nakit/kart/havale dışında kalan yöntemler (çek, senet, belirtilmemiş vb.).
    const isDownPayment = (item) =>
      normalizeLookup(item.note).includes('pesinat') || normalizeLookup(item.method).includes('pesinat');
    const isKnownMethod = (item) => {
      const method = normalizeLookup(item.method);
      return (
        method.includes('nakit') ||
        method.includes('kart') || method.includes('card') || method.includes('pos') || method.includes('kredi') ||
        method.includes('havale') || method.includes('eft') || method.includes('banka') || method.includes('transfer')
      );
    };
    const downPaymentTotal = collections
      .filter(isDownPayment)
      .reduce((sum, item) => sum + parseFinanceMoney(item.amount), 0);
    const cashTotal = collections
      .filter((item) => normalizeLookup(item.method).includes('nakit'))
      .reduce((sum, item) => sum + parseFinanceMoney(item.amount), 0);
    const cardBankTotal = collections
      .filter((item) => {
        const method = normalizeLookup(item.method);
        return (
          method.includes('kart') || method.includes('card') || method.includes('pos') || method.includes('kredi') ||
          method.includes('havale') || method.includes('eft') || method.includes('banka') || method.includes('transfer')
        );
      })
      .reduce((sum, item) => sum + parseFinanceMoney(item.amount), 0);
    const otherMethodTotal = collections
      .filter((item) => !isKnownMethod(item))
      .reduce((sum, item) => sum + parseFinanceMoney(item.amount), 0);

    return {
      student,
      name: getStudentName(student),
      key: getStudentKey(student),
      studentExams,
      studentAttendance,
      installments,
      collections,
      invoices,
      averageScore,
      attendanceRate,
      paidInstallments,
      unpaidInstallments,
      installmentTotal,
      invoiceTotal,
      collectionTotal,
      remainingBalance,
      downPaymentTotal,
      cashTotal,
      cardBankTotal,
      otherMethodTotal,
    };
  }, [accountingDashboard, attendance, exams, selectedStudent]);

  useEffect(() => {
    if (!selectedStudentDetail) return;
    const profileNote = selectedStudentDetail.student.note || '';
    setStudentNotes((prev) => {
      if (Object.prototype.hasOwnProperty.call(prev, selectedStudentDetail.key)) return prev;
      return { ...prev, [selectedStudentDetail.key]: profileNote };
    });
  }, [selectedStudentDetail]);

  const saveStudentNoteDraft = useCallback((student, note) => {
    const key = getStudentKey(student);
    setStudentNotes((prev) => {
      const next = { ...prev, [key]: note };
      try {
        window.localStorage.setItem(STUDENT_REPORT_NOTES_KEY, JSON.stringify(next));
      } catch {
        // Local storage can be unavailable in some embedded shells; the note still stays in memory.
      }
      return next;
    });
  }, []);

  const persistStudentNote = useCallback(async () => {
    if (!selectedStudentDetail?.student?.id) {
      toast({
        title: 'Not kaydedilemedi',
        description: 'Bu öğrenci için backend kimliği bulunamadı.',
        variant: 'destructive',
      });
      return;
    }

    const note = studentNotes[selectedStudentDetail.key] || '';
    try {
      setNoteSaving(true);
      const updated = await updateStudent(
        selectedStudentDetail.student.id,
        buildStudentUpdatePayload(selectedStudentDetail.student, note),
      );
      const updatedStudent = { ...selectedStudentDetail.student, ...updated, note: updated?.note ?? note };
      setStudents((prev) => prev.map((student) => (student.id === updatedStudent.id ? updatedStudent : student)));
      setSelectedStudent((prev) => (prev ? {
        ...prev,
        raw: updatedStudent,
        name: getStudentName(updatedStudent),
        className: updatedStudent.className || prev.className,
        programType: updatedStudent.programType || prev.programType,
      } : prev));
      toast({
        title: 'Not kaydedildi',
        description: 'Öğrenci profilindeki özel not güncellendi.',
      });
    } catch (err) {
      toast({
        title: 'Not kaydedilemedi',
        description: err.message || 'Tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setNoteSaving(false);
    }
  }, [selectedStudentDetail, studentNotes, toast]);

  const handleDownload = () => {
    if (selectedReport?.id === 'attendance') {
      downloadCsv('devamsizlik-raporu.csv', [
        ['Sınıf', 'Öğrenci Sayısı', 'Devam Oranı'],
        ...attendanceRows.map((row) => [row.name, row.count, `${row.value}%`]),
      ]);
      return;
    }

    if (selectedReport?.id === 'performance') {
      downloadCsv('performans-raporu.csv', [
        ['Ders', 'Ortalama'],
        ...subjectPerformance.map((row) => [row.subject, row.average]),
      ]);
      return;
    }

    if (selectedReport?.id === 'teachers') {
      downloadCsv('ogretmen-raporu.csv', [
        ['Öğretmen', 'Branş', 'Sınıf', 'Öğrenci', 'Ortalama'],
        ...displayTeacherRows.map((row) => [row.name, row.branch, row.classes, row.studentCount, row.averageScore]),
      ]);
      return;
    }

    if (selectedReport?.id === 'students') {
      downloadCsv('ogrenci-raporu.csv', [
        ['Öğrenci', 'Sınıf', 'Program', 'Ortalama', 'Devam'],
        ...displayStudentRows.map((row) => [row.name, row.className, row.programType, row.averageScore, row.attendanceRate]),
      ]);
      return;
    }

    const content = [
      `Rapor: ${selectedReport.name}`,
      `Sinif Filtresi: ${classFilter}`,
      `Donem: ${periodFilter}`,
      `Toplam Ogrenci: ${stats.totalStudents}`,
      `Devam Orani: ${stats.attendanceRate}%`,
      `Ortalama Puan: ${stats.averageScore}`,
      `Aktif Sinav: ${stats.activeExams}`,
      '',
      'Ogrenci Ozeti:',
      ...displayStudentRows.slice(0, 5).map((student) => `- ${student.name} | ${student.className} | Ortalama ${student.averageScore} | Devam ${student.attendanceRate}%`),
    ].join('\n');
    downloadText(`course-intellect-report-${selectedReport.id}.txt`, content);
  };

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6" data-testid="reports-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading">Raporlar</h1>
          <p className="text-muted-foreground mt-1">Detaylı analiz ve raporlar</p>
        </div>
        <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Rapor İndir
        </Button>
      </div>

      {error ? <ErrorBanner title="Raporlar alınamadı" message={error} onRetry={loadReports} /> : null}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rapor Türleri</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="p-4 space-y-2">
                  {reportTypes.map((report) => {
                    const Icon = report.icon;
                    return (
                      <motion.div
                        key={report.id}
                        whileHover={{ x: 4 }}
                        onClick={() => setSelectedReport(report)}
                        className={`p-4 rounded-lg cursor-pointer transition-all ${selectedReport?.id === report.id ? 'bg-brand-primary text-white' : 'hover:bg-muted'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${selectedReport?.id === report.id ? 'bg-white/20' : 'bg-muted'}`}>
                            <Icon className={`h-5 w-5 ${selectedReport?.id === report.id ? 'text-white' : 'text-brand-primary'}`} />
                          </div>
                          <div>
                            <p className="font-medium">{report.name}</p>
                            <p className={`text-xs ${selectedReport?.id === report.id ? 'text-white/70' : 'text-muted-foreground'}`}>
                              {report.description}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filtreler:</span>
                </div>
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Sınıf" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Sınıflar</SelectItem>
                    {classes.map((cls) => <SelectItem key={cls} value={cls}>{cls}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Dönem" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Bu Hafta</SelectItem>
                    <SelectItem value="month">Bu Ay</SelectItem>
                    <SelectItem value="semester">Bu Dönem</SelectItem>
                    <SelectItem value="year">Bu Yıl</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              [stats.totalStudents, 'Toplam Öğrenci', TrendingUp, 'text-green-500'],
              [`${stats.attendanceRate}%`, 'Devam Oranı', TrendingUp, 'text-green-500'],
              [stats.averageScore, 'Ortalama Puan', TrendingDown, 'text-red-500'],
              [stats.activeExams, 'Aktif Sınav', BarChart3, 'text-brand-primary'],
            ].map(([value, label, Icon, color]) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="text-2xl font-bold">{value}</p>
                    </div>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{selectedReport?.name}</CardTitle>
              <CardDescription>{selectedReport?.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedReport?.id === 'attendance' ? (
                <div className="space-y-4">
                  {attendanceRows.map((cls) => (
                    <div key={cls.name} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{cls.name}</Badge>
                        <span className="text-sm">{cls.count} öğrenci</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-32">
                          <Progress value={cls.value} className="h-2" />
                        </div>
                        <span className="text-sm font-bold w-12 text-right">{cls.value}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {selectedReport?.id === 'performance' ? (
                <div className="space-y-4">
                  {subjectPerformance.map((item) => (
                    <div key={item.subject} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <span className="font-medium">{item.subject}</span>
                      <div className="flex items-center gap-4">
                        <div className="w-32">
                          <Progress value={item.average} className="h-2" />
                        </div>
                        <span className="text-sm font-bold w-12 text-right">{item.average}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {selectedReport?.id === 'teachers' ? (
                <div className="space-y-4">
                  {displayTeacherRows.map((teacher) => (
                    <div key={teacher.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{teacher.name}</p>
                        <p className="text-sm text-muted-foreground">{teacher.branch}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-6 text-right">
                        <div>
                          <p className="text-sm text-muted-foreground">Sınıf</p>
                          <p className="font-semibold">{teacher.classes}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Öğrenci</p>
                          <p className="font-semibold">{teacher.studentCount}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Ortalama</p>
                          <p className="font-semibold">{teacher.averageScore}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {selectedReport?.id === 'students' ? (
                <div className="space-y-4">
                  {displayStudentRows.map((student) => (
                    <button
                      type="button"
                      key={student.id}
                      onClick={() => setSelectedStudent(student)}
                      className="w-full flex items-center justify-between p-4 rounded-lg bg-muted/50 text-left transition-colors hover:bg-brand-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{student.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline">{student.className}</Badge>
                          <span>{student.programType}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-6 text-right">
                        <div>
                          <p className="text-sm text-muted-foreground">Ortalama</p>
                          <p className="font-semibold">{student.averageScore}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Devam</p>
                          <p className="font-semibold">%{student.attendanceRate}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Kalan Borç</p>
                          <p className={`font-semibold ${student.enrollmentBalance > 0 ? (student.enrollmentOverdueCount > 0 ? 'text-red-500' : 'text-amber-600') : 'text-green-600'}`}>
                            {student.enrollmentNet > 0
                              ? `${student.enrollmentBalance.toLocaleString('tr-TR')} ₺`
                              : '—'}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                  <div className="flex justify-end">
                    <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      Metin Raporu İndir
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!selectedStudentDetail} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          {selectedStudentDetail ? (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary/10 text-xl font-bold text-brand-primary">
                      {getInitials(selectedStudentDetail.name)}
                    </div>
                    <div>
                      <DialogTitle className="text-2xl">{selectedStudentDetail.name}</DialogTitle>
                      <DialogDescription>
                        Öğrenciye ait akademik, finansal ve iletişim kayıtları
                      </DialogDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="w-fit">
                    {selectedStudentDetail.student.className || selectedStudent.className || 'Sınıf yok'}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="grid gap-4 md:grid-cols-4">
                {[
                  [formatCurrency(selectedStudentDetail.remainingBalance), 'Kalan ödeme', Wallet, 'text-amber-600'],
                  [selectedStudentDetail.installments.length, 'Taksit kaydı', ReceiptText, 'text-brand-primary'],
                  [formatCurrency(selectedStudentDetail.collectionTotal), 'Tahsil edilen', CheckCircle2, 'text-green-600'],
                  [`%${selectedStudentDetail.attendanceRate}`, 'Devam oranı', ClipboardCheck, 'text-blue-600'],
                ].map(([value, label, Icon, color]) => (
                  <div key={label} className="rounded-2xl border bg-muted/30 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-muted-foreground">{label}</p>
                        <p className="mt-1 text-xl font-bold">{value}</p>
                      </div>
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <UserRound className="h-5 w-5 text-brand-primary" />
                      Kimlik ve İletişim
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {[
                      ['Öğrenci No', selectedStudentDetail.student.studentNumber || selectedStudentDetail.student.number || selectedStudentDetail.student.username],
                      ['TC Kimlik', selectedStudentDetail.student.identityNumber || selectedStudentDetail.student.tcNo || selectedStudentDetail.student.nationalId],
                      ['Program', selectedStudentDetail.student.programType || selectedStudent.programType],
                      ['Veli', selectedStudentDetail.student.parentName || selectedStudentDetail.student.guardianName || selectedStudentDetail.student.parentFullName],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-start justify-between gap-4 rounded-xl bg-muted/40 p-3">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="text-right font-medium">{value || 'Bilgi yok'}</span>
                      </div>
                    ))}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedStudentDetail.student.phone || selectedStudentDetail.student.parentPhone || 'Telefon yok'}</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="break-all">{selectedStudentDetail.student.email || selectedStudentDetail.student.parentEmail || 'E-posta yok'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <BarChart3 className="h-5 w-5 text-brand-primary" />
                      Akademik Durum
                    </CardTitle>
                    <CardDescription>Sınav, not ve devam özeti</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-muted/40 p-4">
                        <p className="text-sm text-muted-foreground">Ortalama</p>
                        <p className="mt-1 text-2xl font-bold">{selectedStudentDetail.averageScore}</p>
                      </div>
                      <div className="rounded-2xl bg-muted/40 p-4">
                        <p className="text-sm text-muted-foreground">Sınav Kaydı</p>
                        <p className="mt-1 text-2xl font-bold">{selectedStudentDetail.studentExams.length}</p>
                      </div>
                      <div className="rounded-2xl bg-muted/40 p-4">
                        <p className="text-sm text-muted-foreground">Devamsızlık Kaydı</p>
                        <p className="mt-1 text-2xl font-bold">{selectedStudentDetail.studentAttendance.length}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {selectedStudentDetail.studentExams.slice(0, 5).map((exam, index) => (
                        <div key={exam.id || `${exam.title}-${index}`} className="flex items-center justify-between rounded-xl border p-3">
                          <div>
                            <p className="font-medium">{exam.title || exam.examName || exam.subject || 'Sınav'}</p>
                            <p className="text-sm text-muted-foreground">{exam.subject || exam.className || 'Ders bilgisi yok'}</p>
                          </div>
                          <Badge variant="outline">{exam.score || exam.point || 0} puan</Badge>
                        </div>
                      ))}
                      {selectedStudentDetail.studentExams.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Sınav kaydı bulunamadı.</div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Wallet className="h-5 w-5 text-brand-primary" />
                    Finans Özeti
                  </CardTitle>
                  <CardDescription>Taksit, fatura, tahsilat ve kalan ödeme durumu</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-5">
                    {[
                      [formatCurrency(selectedStudentDetail.installmentTotal), 'Taksit toplamı'],
                      [selectedStudentDetail.paidInstallments.length, 'Ödenen taksit'],
                      [selectedStudentDetail.unpaidInstallments.length, 'Bekleyen taksit'],
                      [formatCurrency(selectedStudentDetail.invoiceTotal), 'Fatura toplamı'],
                      [formatCurrency(selectedStudentDetail.remainingBalance), 'Kalan ödeme'],
                    ].map(([value, label]) => (
                      <div key={label} className="rounded-2xl bg-muted/40 p-4">
                        <p className="text-sm text-muted-foreground">{label}</p>
                        <p className="mt-1 text-lg font-bold">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Tahsilat dağılımı — peşinat ve diğer dahil, gerçek değerler */}
                  <div>
                    <p className="mb-2 text-sm font-semibold text-muted-foreground">Tahsilat dağılımı</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        [formatCurrency(selectedStudentDetail.cashTotal), 'Nakit'],
                        [formatCurrency(selectedStudentDetail.cardBankTotal), 'Kart / Havale'],
                        [formatCurrency(selectedStudentDetail.downPaymentTotal), 'Peşinat'],
                        [formatCurrency(selectedStudentDetail.otherMethodTotal), 'Diğer'],
                      ].map(([value, label]) => (
                        <div key={label} className="rounded-2xl border border-border bg-muted/30 p-4">
                          <p className="text-sm text-muted-foreground">{label}</p>
                          <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    {[
                      ['Taksitler', selectedStudentDetail.installments, ReceiptText, (item) => item.due || item.dueDate, (item) => item.status || 'Planlandı'],
                      ['Tahsilatlar', selectedStudentDetail.collections, CheckCircle2, (item) => item.time || item.date || item.createdAt, (item) => item.method || item.note || 'İşlendi'],
                      ['Faturalar', selectedStudentDetail.invoices, FileText, (item) => item.due || item.dueDate || item.createdAt, (item) => item.status || item.category || 'Fatura'],
                    ].map(([title, records, Icon, dateGetter, statusGetter]) => (
                      <div key={title} className="rounded-2xl border p-4">
                        <div className="mb-3 flex items-center gap-2 font-semibold">
                          <Icon className="h-4 w-4 text-brand-primary" />
                          {title}
                        </div>
                        <div className="space-y-2">
                          {records.slice(0, 5).map((item, index) => (
                            <div key={item.id || `${title}-${index}`} className="rounded-xl bg-muted/40 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">{item.title || item.name || item.student || selectedStudentDetail.name}</p>
                                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <CalendarDays className="h-3 w-3" />
                                    {formatDate(dateGetter(item))}
                                  </p>
                                </div>
                                <Badge variant={isPaidStatus(statusGetter(item)) ? 'default' : 'outline'}>
                                  {statusGetter(item)}
                                </Badge>
                              </div>
                              <p className="mt-2 font-semibold">{formatCurrency(item.amount)}</p>
                            </div>
                          ))}
                          {records.length === 0 ? (
                            <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Kayıt yok.</div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <NotebookPen className="h-5 w-5 text-brand-primary" />
                    Özel Not
                  </CardTitle>
                  <CardDescription>Kurum yöneticisi ve idari personel için öğrenciye özel not alanı</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={studentNotes[selectedStudentDetail.key] || ''}
                    onChange={(event) => saveStudentNoteDraft(selectedStudentDetail.student, event.target.value)}
                    placeholder="Öğrenciyle ilgili finans, veli görüşmesi veya takip notu girin..."
                    className="min-h-28"
                  />
                  <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" />
                      Not öğrenci profilindeki özel not alanına kaydedilir.
                    </div>
                    <Button type="button" onClick={persistStudentNote} disabled={noteSaving} className="bg-brand-primary hover:bg-brand-primary/90">
                      {noteSaving ? 'Kaydediliyor...' : 'Notu Kaydet'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {selectedStudentDetail.remainingBalance > 0 ? (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  <AlertCircle className="mt-0.5 h-5 w-5" />
                  <div>
                    <p className="font-semibold">Bekleyen ödeme var</p>
                    <p className="text-sm">Bu öğrencinin görünen kalan ödeme tutarı {formatCurrency(selectedStudentDetail.remainingBalance)}.</p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

export default function Reports() {
  return <AdministrativeReportOverview />;
}
