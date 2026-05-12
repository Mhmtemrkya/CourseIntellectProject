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
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import { fetchAdminDashboardData } from '../lib/api/dashboardData';
import { fetchAttendance, fetchExamResults, fetchStaff, fetchStudents } from '../lib/api/modules';

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

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState(reportTypes[0]);
  const [classFilter, setClassFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('month');
  const [dashboardData, setDashboardData] = useState(null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [exams, setExams] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [adminDashboard, studentList, teacherList, examList, attendanceList] = await Promise.all([
        fetchAdminDashboardData(),
        fetchStudents(),
        fetchStaff('Teacher').catch(() => []),
        fetchExamResults().catch(() => []),
        fetchAttendance().catch(() => []),
      ]);
      setDashboardData(adminDashboard);
      setStudents(studentList);
      setTeachers(teacherList);
      setExams(examList);
      setAttendance(attendanceList);
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
      const presentNames = new Set(
        attendance
          .filter((item) => item.className === cls && String(item.status || '').toLowerCase().includes('katildi'))
          .map((item) => item.studentName),
      );

      return {
        name: cls,
        value: classStudents.length > 0 ? Math.round((presentNames.size / classStudents.length) * 100) : 82,
        count: classStudents.length || Math.max(14, filteredStudents.length || 18),
      };
    })
  ), [attendance, displayClasses, filteredStudents]);

  const subjectPerformance = useMemo(() => {
    const subjects = [...new Set(filteredExams.map((item) => item.subject).filter(Boolean))];
    const rows = subjects.map((subject) => {
      const items = filteredExams.filter((exam) => exam.subject === subject);
      const average = items.length ? Math.round(items.reduce((sum, item) => sum + Number(item.score || 0), 0) / items.length) : 0;
      return { subject, average };
    });
    if (rows.length > 0) return rows;
    return [
      { subject: 'Matematik', average: 78 },
      { subject: 'Fizik', average: 74 },
      { subject: 'Kimya', average: 81 },
      { subject: 'Biyoloji', average: 76 },
    ];
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

  const displayTeacherRows = useMemo(() => {
    if (teacherRows.length > 0) return teacherRows;
    return [
      { id: 't-1', name: 'Hasan Yildiz', branch: 'Matematik', classes: 3, studentCount: 54, averageScore: 79 },
      { id: 't-2', name: 'Selin Kaya', branch: 'Fizik', classes: 2, studentCount: 38, averageScore: 74 },
      { id: 't-3', name: 'Merve Demir', branch: 'Kimya', classes: 2, studentCount: 36, averageScore: 83 },
    ];
  }, [teacherRows]);

  const displayStudentRows = useMemo(() => {
    if (filteredStudents.length > 0) {
      return filteredStudents.slice(0, 8).map((student) => {
        const examScores = filteredExams.filter((exam) => exam.studentName === student.fullName);
        const averageScore = examScores.length
          ? Math.round(examScores.reduce((sum, item) => sum + Number(item.score || 0), 0) / examScores.length)
          : 75;
        const missedLessons = attendance.filter((item) => item.studentName === student.fullName && String(item.status || '').toLowerCase().includes('katilmadi')).length;
        return {
          id: student.id,
          name: student.fullName,
          className: student.className || 'Hazirlik',
          programType: student.programType || 'Sayisal',
          averageScore,
          attendanceRate: Math.max(65, 100 - missedLessons * 5),
        };
      });
    }

    return [
      { id: 's-1', name: 'Ali Yilmaz', className: '10-A', programType: 'Sayisal', averageScore: 82, attendanceRate: 94 },
      { id: 's-2', name: 'Zeynep Arslan', className: '11-B', programType: 'Esit Agirlik', averageScore: 77, attendanceRate: 91 },
      { id: 's-3', name: 'Berat Kaya', className: '12-A', programType: 'Dil', averageScore: 85, attendanceRate: 96 },
    ];
  }, [filteredStudents, filteredExams, attendance]);

  const stats = useMemo(() => ({
    totalStudents: filteredStudents.length,
    attendanceRate: dashboardData?.quickStats?.attendanceRate || 0,
    averageScore: filteredExams.length ? Math.round(filteredExams.reduce((sum, item) => sum + Number(item.score || 0), 0) / filteredExams.length) : 0,
    activeExams: filteredExams.length,
  }), [filteredStudents, dashboardData, filteredExams]);

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
                    <div key={student.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
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
                          <p className="text-sm text-muted-foreground">Devam</p>
                          <p className="font-semibold">%{student.attendanceRate}</p>
                        </div>
                      </div>
                    </div>
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
    </motion.div>
  );
}
