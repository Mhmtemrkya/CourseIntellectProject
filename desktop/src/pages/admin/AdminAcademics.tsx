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
  UserMinus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import {
  fetchAttendance,
  fetchClasses,
  fetchLeaves,
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

function dateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function filterByPeriod(entries, period) {
  if (period === 'term') return entries;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') start.setDate(start.getDate() - 6);
  if (period === 'month') start.setMonth(start.getMonth() - 1);
  return entries.filter((item) => {
    const date = new Date(item.lessonDate || item.date || item.createdAtUtc || '');
    if (Number.isNaN(date.getTime())) return false;
    if (period === 'day') return dateKey(date) === dateKey(now);
    return date >= start && date <= now;
  });
}

const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

export default function AdminAcademics() {
  const navigate = useNavigate();
  const [payload, setPayload] = useState({
    students: [],
    teachers: [],
    classes: [],
    attendance: [],
    schedule: [],
    leaves: [],
  });
  const [classPeriod, setClassPeriod] = useState('week');
  const [teacherPeriod, setTeacherPeriod] = useState('week');
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [students, teachers, classes, attendance, schedule, leaves] = await Promise.all([
        fetchStudents().catch(() => []),
        fetchStaff('Teacher').catch(() => []),
        fetchClasses().catch(() => []),
        fetchAttendance().catch(() => []),
        fetchScheduleEntries().catch(() => []),
        fetchLeaves().catch(() => []),
      ]);
      setPayload({
        students: asArray(students),
        teachers: asArray(teachers),
        classes: asArray(classes),
        attendance: asArray(attendance),
        schedule: asArray(schedule),
        leaves: asArray(leaves),
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
      const attendance = filterByPeriod(payload.attendance.filter((item) => item.className === name), classPeriod);
      const schedule = payload.schedule.filter((item) => item.className === name);

      return {
        name,
        studentCount: students.length,
        weeklyLessonHours: schedule.length,
        attendanceRate: attendanceRate(attendance),
      };
    });
  }, [classPeriod, payload]);

  const teacherModels = useMemo(() => payload.teachers.map((teacher) => {
    const branch = teacher.departmentOrBranch || teacher.branch || 'Branş yok';
    const todayName = DAY_NAMES[new Date().getDay()];
    const teacherSchedule = payload.schedule.filter((item) => {
      const value = `${item.teacherName || item.teacher || ''}`.trim();
      return value && value === teacher.fullName;
    });
    const periodSchedule = teacherPeriod === 'day'
      ? teacherSchedule.filter((item) => normalizeText(item.day) === normalizeText(todayName))
      : teacherSchedule;
    const lessonCount = teacherPeriod === 'month' ? periodSchedule.length * 4 : periodSchedule.length;
    return {
      id: teacher.id || teacher.username || teacher.fullName,
      name: teacher.fullName,
      branch,
      lessonCount,
      lessons: periodSchedule,
      status: teacher.isActive === false ? 'Pasif' : 'Aktif',
    };
  }), [payload.schedule, payload.teachers, teacherPeriod]);

  const metrics = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const leaveCount = payload.leaves.filter((item) => {
      const status = normalizeText(item.status);
      const start = new Date(item.startDateUtc || item.startDate || '');
      const end = new Date(item.endDateUtc || item.endDate || '');
      return (status.includes('approved') || status.includes('onay'))
        && !Number.isNaN(start.getTime())
        && !Number.isNaN(end.getTime())
        && start < todayEnd
        && end >= todayStart;
    }).length;
    return {
      classes: classModels.length,
      teachers: payload.teachers.length,
      leaveCount,
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
              Sınıf devam oranları, ders saatleri ve öğretmen durumunu tek ekranda izle.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Sınıf', metrics.classes],
              ['Öğretmen', metrics.teachers],
              ['İzinli Öğretmen', metrics.leaveCount, UserMinus],
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
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={classPeriod} onChange={(event) => setClassPeriod(event.target.value)}>
              <option value="day">Günlük</option>
              <option value="week">Haftalık</option>
              <option value="month">Aylık</option>
              <option value="term">Dönemlik</option>
            </select>
          </CardHeader>
          <CardContent className="space-y-3">
            {classModels.map((item) => (
              <div key={item.name} className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.studentCount} öğrenci - {item.weeklyLessonHours} haftalık ders saati
                    </p>
                  </div>
                  <Badge variant="outline">{item.weeklyLessonHours} saat</Badge>
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex justify-between text-sm">
                    <span>Devam oranı</span>
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
              Öğretmen Durumu
            </CardTitle>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={teacherPeriod} onChange={(event) => setTeacherPeriod(event.target.value)}>
              <option value="day">Günlük</option>
              <option value="week">Haftalık</option>
              <option value="month">Aylık</option>
            </select>
          </CardHeader>
          <CardContent className="space-y-3">
            {teacherModels.slice(0, 8).map((item) => (
              <button type="button" key={item.id} className="w-full rounded-xl border bg-muted/20 p-4 text-left transition-colors hover:bg-muted/40" onClick={() => setSelectedTeacher(item)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.branch}</p>
                  </div>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {item.lessonCount} ders saati · Detay için tıklayın
                </p>
              </button>
            ))}
            {teacherModels.length === 0 ? <p className="text-sm text-muted-foreground">Kayıtlı öğretmen bulunamadı.</p> : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedTeacher} onOpenChange={(open) => !open && setSelectedTeacher(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTeacher?.name || 'Öğretmen'} · Ders Detayı</DialogTitle>
            <DialogDescription>
              {teacherPeriod === 'day' ? 'Bugünkü dersleri' : teacherPeriod === 'month' ? 'Aylık tahmini ders yükü haftalık programdan hesaplanır.' : 'Haftalık ders programı'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(selectedTeacher?.lessons || []).length > 0 ? selectedTeacher.lessons.map((lesson, index) => (
              <div key={`${lesson.day}-${lesson.time}-${index}`} className="rounded-xl border p-4">
                <p className="font-semibold">{lesson.subject || lesson.lesson || 'Ders'} · {lesson.className || 'Sınıf belirtilmemiş'}</p>
                <p className="text-sm text-muted-foreground">{lesson.day || 'Gün'} · {lesson.time || `${lesson.startTime || ''}-${lesson.endTime || ''}`}</p>
              </div>
            )) : (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Bu dönem filtresinde ders bulunmuyor.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
