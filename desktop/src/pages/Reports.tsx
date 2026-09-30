import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import {
  FileText,
  Download,
  Filter,
  Users,
  GraduationCap,
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
import { fetchReportStudents, type ReportStudentRow } from '../lib/api/reports';
import { formatCurrency, parseFinanceMoney } from '../lib/financeDocuments';
import { downloadSchoolAsistReportPdf } from '../lib/schoolAsistReportPdf';
import { useToast } from '../hooks/use-toast';
import { formatDate as formatShortDate, formatMoney } from '../lib/format';
import { errorMessage, isRecord } from '../lib/errors';
import type { AdminDashboardData } from '../lib/api/dashboardData';
import type { AccountingDashboard } from '../lib/api/accounting';
import type {
  AttendanceEntryDto, ExamResultDto, StaffSummaryDto, StudentSummaryDto, UpdateStudentRequest,
} from '../types/api/generated';
import type { IconComponent } from '../types/ui';

interface ReportType {
  id: 'performance' | 'students' | 'teachers';
  name: string;
  icon: IconComponent;
  description: string;
}

/** Öğrenci listesi satırı; kayıt/finans özeti /api/reports/students'tan gelir. */
type StudentReportRow = {
  id: string;
  name: string;
  className: string;
  programType: string;
  averageScore: number;
  attendanceRate: number;
  enrollmentNet: number;
  enrollmentPaid: number;
  enrollmentBalance: number;
  enrollmentCurrency: string;
  enrollmentStatus: string;
  enrollmentOverdueCount: number;
  raw: StudentSummaryDto;
};

/** Öğrenci detayındaki taksit/tahsilat/fatura listelerinin ortak satırı. */
interface DetailRecord {
  key: string;
  title: string;
  date: string | null;
  status: string;
  amount: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const PERFORMANCE_REPORT: ReportType = { id: 'performance', name: 'Performans Raporu', icon: BarChart3, description: 'Sınav ve ödev performansı' };

const reportTypes: readonly ReportType[] = [
  PERFORMANCE_REPORT,
  { id: 'students', name: 'Öğrenci Listesi', icon: Users, description: 'Detaylı öğrenci bilgileri' },
  { id: 'teachers', name: 'Öğretmen Raporu', icon: GraduationCap, description: 'Öğretmen aktivite özeti' },
];

const STUDENT_REPORT_NOTES_KEY = 'courseintellect:student-report-notes';

function normalizeLookup(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replaceAll('İ', 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

function getStudentName(student: StudentSummaryDto) {
  return student.fullName || 'Öğrenci';
}

function getStudentKey(student: StudentSummaryDto) {
  return String(student.id || student.username || getStudentName(student));
}

function getInitials(name: string) {
  return String(name || 'Ö')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('tr-TR');
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Tarih yok';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return formatShortDate(date);
}

function isPaidStatus(status: string | null | undefined) {
  const normalized = normalizeLookup(status).replace(/\s+/g, '');
  return normalized.includes('odendi') || normalized.includes('paid') || normalized.includes('tahsil');
}

/**
 * Sınav, yoklama ve finans kayıtlarında öğrenciyi taşıyan metin alanları.
 * Kayıtlar öğrenci kimliği taşımaz; eşleşme ada göre yapılır.
 */
interface StudentLinkedRecord {
  studentName?: string;
  student?: string;
  name?: string;
  title?: string;
  subtitle?: string;
  note?: string;
}

function recordMatchesStudent(record: StudentLinkedRecord, student: StudentSummaryDto) {
  const studentNames = [
    getStudentName(student),
    student.fullName,
    student.username,
  ].filter(Boolean).map((value) => normalizeLookup(value));

  const recordTexts = [
    record.studentName,
    record.student,
    record.name,
    record.title,
    record.subtitle,
    record.note,
  ].filter(Boolean).map((value) => normalizeLookup(value));

  return recordTexts.some((text) => studentNames.some((name) => name.length > 2 && (text === name || text.includes(name))));
}

function buildStudentUpdatePayload(student: StudentSummaryDto, note: string): UpdateStudentRequest {
  return {
    fullName: getStudentName(student),
    tcNo: student.tcNo || '',
    className: student.className || '',
    currentSchool: student.currentSchool || '',
    schoolNumber: student.schoolNumber || '',
    birthDate: student.birthDate || '',
    programType: student.programType || '',
    parentName: student.parentName || '',
    parentPhone: student.parentPhone || '',
    parentEmail: student.parentEmail || '',
    address: student.address || '',
    note,
  };
}

function readSavedNotes(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STUDENT_REPORT_NOTES_KEY) || '{}');
    if (!isRecord(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  } catch {
    return {};
  }
}

function AdministrativeReportOverview() {
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<ReportType>(PERFORMANCE_REPORT);
  const [classFilter, setClassFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('month');
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [students, setStudents] = useState<StudentSummaryDto[]>([]);
  const [enrollmentRows, setEnrollmentRows] = useState<ReportStudentRow[]>([]);
  const [teachers, setTeachers] = useState<StaffSummaryDto[]>([]);
  const [exams, setExams] = useState<ExamResultDto[]>([]);
  const [attendance, setAttendance] = useState<AttendanceEntryDto[]>([]);
  const [accountingDashboard, setAccountingDashboard] = useState<AccountingDashboard | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentReportRow | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [studentNotes, setStudentNotes] = useState<Record<string, string>>(readSavedNotes);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [adminDashboard, studentList, reportStudentList, teacherList, examList, attendanceList, financeDashboard] = await Promise.all([
        fetchAdminDashboardData(),
        fetchStudents(),
        // Kayıt/finans özeti (kalan borç) yalnız rapor ucunda hesaplanır.
        fetchReportStudents().catch(() => []),
        fetchStaff('Teacher').catch(() => []),
        fetchExamResults().catch(() => []),
        fetchAttendance().catch(() => []),
        fetchAccountingDashboard().catch(() => null),
      ]);
      setDashboardData(adminDashboard);
      setStudents(studentList ?? []);
      setEnrollmentRows(reportStudentList ?? []);
      setTeachers(teacherList ?? []);
      setExams(examList ?? []);
      setAttendance(attendanceList ?? []);
      setAccountingDashboard(financeDashboard);
    } catch (err) {
      setError(errorMessage(err, 'Rapor verileri alınamadı.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
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
    classFilter === 'all' ? exams : exams.filter((exam) => exam.className === classFilter || exam.examTitle?.includes(classFilter))
  ), [exams, classFilter]);

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

      return {
        id: teacher.id,
        name: teacher.fullName,
        branch: teacher.departmentOrBranch || teacher.role,
        classes: assignedClasses.length,
        studentCount: scopedStudents.length,
        // Sınav sonucu (ExamResultDto) öğretmen bilgisi taşımaz; öğretmen bazlı
        // ortalama sunucu bu alanı eklemeden hesaplanamaz.
        averageScore: 0,
      };
    })
  ), [teachers, students]);

  const displayTeacherRows = teacherRows;

  const enrollmentById = useMemo(() => new Map(enrollmentRows.map((row) => [row.id, row])), [enrollmentRows]);

  const displayStudentRows = useMemo(() => (
    filteredStudents.map((student): StudentReportRow => {
      const examScores = filteredExams.filter((exam) => recordMatchesStudent(exam, student));
      const averageScore = examScores.length
        ? Math.round(examScores.reduce((sum, item) => sum + Number(item.score || 0), 0) / examScores.length)
        : 0;
      const studentAttendance = attendance.filter((item) => recordMatchesStudent(item, student));
      const presentCount = studentAttendance.filter((item) => normalizeLookup(item.status).includes('katildi')).length;
      const attendanceRate = studentAttendance.length
        ? Math.round((presentCount / studentAttendance.length) * 100)
        : 0;
      const enrollment = enrollmentById.get(student.id);
      return {
        id: student.id,
        name: student.fullName,
        className: student.className || 'Sınıf yok',
        programType: student.programType || 'Belirtilmemiş',
        averageScore,
        attendanceRate,
        enrollmentNet: Number(enrollment?.enrollmentNet || 0),
        enrollmentPaid: Number(enrollment?.enrollmentPaid || 0),
        enrollmentBalance: Number(enrollment?.enrollmentBalance || 0),
        enrollmentCurrency: enrollment?.enrollmentCurrency || 'TRY',
        enrollmentStatus: enrollment?.enrollmentStatus || 'Kayıt yok',
        enrollmentOverdueCount: Number(enrollment?.enrollmentOverdueCount || 0),
        raw: student,
      };
    })
  ), [filteredStudents, filteredExams, attendance, enrollmentById]);

  const stats = useMemo(() => ({
    totalStudents: filteredStudents.length,
    attendanceRate: dashboardData?.stats.todayAttendanceRate || 0,
    averageScore: filteredExams.length ? Math.round(filteredExams.reduce((sum, item) => sum + Number(item.score || 0), 0) / filteredExams.length) : 0,
    activeExams: filteredExams.length,
  }), [filteredStudents, dashboardData, filteredExams]);

  const selectedStudentDetail = useMemo(() => {
    if (!selectedStudent) return null;

    const student = selectedStudent.raw;
    const studentExams = exams.filter((exam) => recordMatchesStudent(exam, student));
    const studentAttendance = attendance.filter((item) => recordMatchesStudent(item, student));
    const installments = (accountingDashboard?.installments || []).filter((item) => recordMatchesStudent(item, student));
    const collections = (accountingDashboard?.collections || []).filter((item) => recordMatchesStudent(item, student));
    const invoices = (accountingDashboard?.invoices || []).filter((item) => recordMatchesStudent(item, student));
    const averageScore = studentExams.length
      ? Math.round(studentExams.reduce((sum, item) => sum + Number(item.score || 0), 0) / studentExams.length)
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
    const isDownPayment = (item: { note: string; method: string }) =>
      normalizeLookup(item.note).includes('pesinat') || normalizeLookup(item.method).includes('pesinat');
    const isKnownMethod = (item: { method: string }) => {
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

    const name = getStudentName(student);
    const installmentRecords = installments.map((item, index): DetailRecord => ({
      key: item.id || `installment-${index}`,
      title: item.student || name,
      date: item.due,
      status: item.status || 'Planlandı',
      amount: item.amount,
    }));
    const collectionRecords = collections.map((item, index): DetailRecord => ({
      key: item.id || `collection-${index}`,
      title: item.name || name,
      date: item.time,
      status: item.method || item.note || 'İşlendi',
      amount: item.amount,
    }));
    const invoiceRecords = invoices.map((item, index): DetailRecord => ({
      key: item.id || `invoice-${index}`,
      title: item.title || name,
      date: item.dueDateUtc || item.issueDateUtc,
      status: item.status || item.category || 'Fatura',
      amount: item.amount,
    }));

    return {
      student,
      name,
      key: getStudentKey(student),
      studentExams,
      studentAttendance,
      installments,
      collections,
      invoices,
      installmentRecords,
      collectionRecords,
      invoiceRecords,
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

  const saveStudentNoteDraft = useCallback((student: StudentSummaryDto, note: string) => {
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
        description: errorMessage(err, 'Tekrar deneyin.'),
        variant: 'destructive',
      });
    } finally {
      setNoteSaving(false);
    }
  }, [selectedStudentDetail, studentNotes, toast]);

  const handleDownload = async () => {
    const reportRows = selectedReport?.id === 'teachers'
      ? displayTeacherRows
      : selectedReport?.id === 'students'
        ? displayStudentRows
        : subjectPerformance;

    try {
      await downloadSchoolAsistReportPdf({
        report: selectedReport,
        classFilter,
        periodFilter,
        stats,
        rows: reportRows,
      });
      toast({
        title: 'PDF hazırlandı',
        description: `${selectedReport.name} SchoolAsist markasıyla indirildi.`,
      });
    } catch (err) {
      toast({
        title: 'PDF oluşturulamadı',
        description: errorMessage(err, 'Lütfen tekrar deneyin.'),
        variant: 'destructive',
      });
    }
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
          PDF Raporu İndir
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

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {([
              [stats.totalStudents, 'Toplam Öğrenci', TrendingUp, 'text-green-500'],
              [stats.averageScore, 'Ortalama Puan', TrendingDown, 'text-red-500'],
              [stats.activeExams, 'Aktif Sınav', BarChart3, 'text-brand-primary'],
            ] satisfies ReadonlyArray<readonly [number, string, IconComponent, string]>).map(([value, label, Icon, color]) => (
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
              {selectedReport?.id === 'performance' ? (
                <div className="space-y-4">
                  {subjectPerformance.map((item) => (
                    <div key={item.subject} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <span className="font-medium">{item.subject}</span>
                      <span className="text-lg font-bold">{item.average}%</span>
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
                  {displayStudentRows.slice(0, 8).map((student) => (
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
                      <div className="grid grid-cols-2 gap-6 text-right">
                        <div>
                          <p className="text-sm text-muted-foreground">Ortalama</p>
                          <p className="font-semibold">{student.averageScore}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Kalan Borç</p>
                          <p className={`font-semibold ${student.enrollmentBalance > 0 ? (student.enrollmentOverdueCount > 0 ? 'text-red-500' : 'text-amber-600') : 'text-green-600'}`}>
                            {student.enrollmentNet > 0
                              ? formatMoney(student.enrollmentBalance)
                              : '—'}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                  <div className="flex justify-end">
                    <Button className="bg-brand-primary hover:bg-brand-primary/90" onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      PDF Raporu İndir
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
                    {selectedStudentDetail.student.className || selectedStudent?.className || 'Sınıf yok'}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="grid gap-4 md:grid-cols-3">
                {([
                  [formatCurrency(selectedStudentDetail.remainingBalance), 'Kalan ödeme', Wallet, 'text-amber-600'],
                  [selectedStudentDetail.installments.length, 'Taksit kaydı', ReceiptText, 'text-brand-primary'],
                  [formatCurrency(selectedStudentDetail.collectionTotal), 'Tahsil edilen', CheckCircle2, 'text-green-600'],
                ] satisfies ReadonlyArray<readonly [string | number, string, IconComponent, string]>).map(([value, label, Icon, color]) => (
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
                      ['Öğrenci No', selectedStudentDetail.student.schoolNumber || selectedStudentDetail.student.username],
                      ['TC Kimlik', selectedStudentDetail.student.tcNo],
                      ['Program', selectedStudentDetail.student.programType || selectedStudent?.programType],
                      ['Veli', selectedStudentDetail.student.parentName],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-start justify-between gap-4 rounded-xl bg-muted/40 p-3">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="text-right font-medium">{value || 'Bilgi yok'}</span>
                      </div>
                    ))}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedStudentDetail.student.parentPhone || 'Telefon yok'}</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="break-all">{selectedStudentDetail.student.parentEmail || 'E-posta yok'}</span>
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
                    <CardDescription>Sınav ve not özeti</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-muted/40 p-4">
                        <p className="text-sm text-muted-foreground">Ortalama</p>
                        <p className="mt-1 text-2xl font-bold">{selectedStudentDetail.averageScore}</p>
                      </div>
                      <div className="rounded-2xl bg-muted/40 p-4">
                        <p className="text-sm text-muted-foreground">Sınav Kaydı</p>
                        <p className="mt-1 text-2xl font-bold">{selectedStudentDetail.studentExams.length}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {selectedStudentDetail.studentExams.slice(0, 5).map((exam, index) => (
                        <div key={exam.id || `${exam.examTitle}-${index}`} className="flex items-center justify-between rounded-xl border p-3">
                          <div>
                            <p className="font-medium">{exam.examTitle || exam.subject || 'Sınav'}</p>
                            <p className="text-sm text-muted-foreground">{exam.subject || exam.className || 'Ders bilgisi yok'}</p>
                          </div>
                          <Badge variant="outline">{exam.score || 0} puan</Badge>
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
                    {([
                      ['Taksitler', selectedStudentDetail.installmentRecords, ReceiptText],
                      ['Tahsilatlar', selectedStudentDetail.collectionRecords, CheckCircle2],
                      ['Faturalar', selectedStudentDetail.invoiceRecords, FileText],
                    ] satisfies ReadonlyArray<readonly [string, DetailRecord[], IconComponent]>).map(([title, records, Icon]) => (
                      <div key={title} className="rounded-2xl border p-4">
                        <div className="mb-3 flex items-center gap-2 font-semibold">
                          <Icon className="h-4 w-4 text-brand-primary" />
                          {title}
                        </div>
                        <div className="space-y-2">
                          {records.slice(0, 5).map((item, index) => (
                            <div key={item.key || `${title}-${index}`} className="rounded-xl bg-muted/40 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">{item.title}</p>
                                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <CalendarDays className="h-3 w-3" />
                                    {formatDate(item.date)}
                                  </p>
                                </div>
                                <Badge variant={isPaidStatus(item.status) ? 'default' : 'outline'}>
                                  {item.status}
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
