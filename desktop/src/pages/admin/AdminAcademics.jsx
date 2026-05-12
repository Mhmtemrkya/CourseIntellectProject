import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  Calendar,
  ClipboardCheck,
  GraduationCap,
  School,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import {
  fetchAttendance,
  fetchClasses,
  fetchExamResults,
  fetchScheduleEntries,
  fetchStaff,
  fetchStudents,
} from '../../lib/api/modules';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeClassName(item) {
  if (typeof item === 'string') return item;
  return item?.name || item?.className || item?.title || '';
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeText(value = '') {
  return String(value).trim().toLowerCase();
}

function attendanceRate(entries) {
  if (entries.length === 0) return 0;
  const present = entries.filter((item) => {
    const status = normalizeText(item.status);
    return status.includes('katildi') || status.includes('present');
  }).length;
  return Math.round((present / entries.length) * 100);
}

export default function AdminAcademics() {
  const navigate = useNavigate();
  const [payload, setPayload] = useState({
    students: [],
    teachers: [],
    classes: [],
    attendance: [],
    exams: [],
    schedule: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [students, teachers, classes, attendance, exams, schedule] = await Promise.all([
        fetchStudents().catch(() => []),
        fetchStaff('Teacher').catch(() => []),
        fetchClasses().catch(() => []),
        fetchAttendance().catch(() => []),
        fetchExamResults().catch(() => []),
        fetchScheduleEntries().catch(() => []),
      ]);
      setPayload({
        students: asArray(students),
        teachers: asArray(teachers),
        classes: asArray(classes),
        attendance: asArray(attendance),
        exams: asArray(exams),
        schedule: asArray(schedule),
      });
    } catch (err) {
      setError(err.message || 'Akademik veriler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const classModels = useMemo(() => {
    const names = new Set([
      ...payload.classes.map(normalizeClassName),
      ...payload.students.map((item) => item.className),
      ...payload.schedule.map((item) => item.className),
    ].filter(Boolean));

    return [...names].sort((a, b) => a.localeCompare(b, 'tr')).map((name) => {
      const students = payload.students.filter((item) => item.className === name);
      const attendance = payload.attendance.filter((item) => item.className === name);
      const exams = payload.exams.filter((item) => item.className === name);
      const schedule = payload.schedule.filter((item) => item.className === name);
      const examAverage = exams.length > 0
        ? Math.round(exams.reduce((sum, item) => sum + safeNumber(item.score), 0) / exams.length)
        : 0;

      return {
        name,
        studentCount: students.length,
        lessonCount: schedule.length,
        attendanceRate: attendanceRate(attendance),
        examAverage,
      };
    });
  }, [payload]);

  const teacherModels = useMemo(() => payload.teachers.map((teacher) => {
    const branch = teacher.departmentOrBranch || teacher.branch || 'Branş yok';
    const teacherSchedule = payload.schedule.filter((item) => {
      const value = `${item.teacherName || item.teacher || ''}`.trim();
      return value && value === teacher.fullName;
    });
    return {
      id: teacher.id || teacher.username || teacher.fullName,
      name: teacher.fullName,
      branch,
      lessonCount: teacherSchedule.length,
      assignedClasses: teacher.assignedClasses || [],
      status: teacher.isActive === false ? 'Pasif' : 'Aktif',
    };
  }), [payload.schedule, payload.teachers]);

  const metrics = useMemo(() => {
    const examAverage = payload.exams.length > 0
      ? Math.round(payload.exams.reduce((sum, item) => sum + safeNumber(item.score), 0) / payload.exams.length)
      : 0;
    return {
      classes: classModels.length,
      teachers: payload.teachers.length,
      institutionAverage: examAverage,
      attendance: attendanceRate(payload.attendance),
    };
  }, [classModels.length, payload]);

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="admin-academics-page">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Badge variant="outline">Akademik yönetim</Badge>
            <h1 className="mt-3 text-3xl font-bold font-heading">Akademik Yönetim</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Sınıf durumu, öğretmen yükleri, sınav ortalamaları ve yoklama sinyallerini tek ekranda izle.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ['Sınıf', metrics.classes],
              ['Öğretmen', metrics.teachers],
              ['Ortalama', metrics.institutionAverage],
              ['Yoklama', `%${metrics.attendance}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border bg-muted/30 px-5 py-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {error ? <ErrorBanner title="Akademik veri yüklenemedi" message={error} onRetry={loadData} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Ders Programı', 'Canlı program ve slot yönetimi', Calendar, '/schedule'],
          ['Kurs Yönetimi', 'Kurs kataloğu ve programlar', BookOpen, '/admin/courses'],
          ['Rapor Merkezi', 'Akademik raporlar', BarChart3, '/reports'],
          ['Sınav Sonuçları', 'Deneme ve yazılı sonuçları', ClipboardCheck, '/exams'],
        ].map(([title, detail, Icon, path]) => (
          <Card key={title} className="cursor-pointer transition-colors hover:bg-muted/30" onClick={() => navigate(path)}>
            <CardContent className="p-5">
              <Icon className="h-7 w-7 text-brand-primary" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
              <Button variant="outline" size="sm" className="mt-4">Aç</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5 text-brand-primary" />
              Sınıf Durumu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {classModels.map((item) => (
              <div key={item.name} className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.studentCount} öğrenci - {item.lessonCount} program slotu
                    </p>
                  </div>
                  <Badge variant="outline">Ortalama {item.examAverage || '-'}</Badge>
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex justify-between text-sm">
                    <span>Yoklama oranı</span>
                    <span>%{item.attendanceRate}</span>
                  </div>
                  <Progress value={item.attendanceRate} />
                </div>
              </div>
            ))}
            {classModels.length === 0 ? <p className="text-sm text-muted-foreground">Kayıtlı sınıf bulunamadı.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-brand-primary" />
              Öğretmen Sağlığı
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {teacherModels.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.branch}</p>
                  </div>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {item.lessonCount} program slotu - {item.assignedClasses.length || 0} atanmış sınıf
                </p>
              </div>
            ))}
            {teacherModels.length === 0 ? <p className="text-sm text-muted-foreground">Kayıtlı öğretmen bulunamadı.</p> : null}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
