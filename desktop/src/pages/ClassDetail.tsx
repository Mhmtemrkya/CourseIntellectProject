import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, CalendarDays, ChevronRight, Clock3, GraduationCap,
  Mail, Search, UserCheck, Users,
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ErrorBanner } from '../components/ui/AlertBanner';
import { LoadingDots } from '../components/animations/AnimatedIcon';
import {
  fetchPlatformConfigurations,
  fetchStaff,
  fetchStudents,
} from '../lib/api/modules';
import { isUserPassive, userStatusLabel } from '../lib/userStatus';

function normalize(value = '') {
  return String(value)
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u');
}

function sameId(left, right) {
  return left != null && right != null && String(left) === String(right);
}

function initials(value = '') {
  return String(value).split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CI';
}

function decodeClassName(value = '') {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeConfig(item) {
  try {
    return JSON.parse(item?.payloadJson || '{}');
  } catch {
    return null;
  }
}

function Card({ children, className = '' }) {
  return <section className={`rounded-2xl border border-foreground/10 bg-[hsl(var(--ci-card))] shadow-sm ${className}`}>{children}</section>;
}

function SectionHeader({ icon: Icon, title, description, count }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-foreground/10 px-5 py-4 sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-bold text-foreground">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {count != null ? <Badge variant="outline" className="shrink-0">{count}</Badge> : null}
    </div>
  );
}

function MetricCard({ label, value, detail, icon: Icon, tone }) {
  return (
    <Card className="min-h-[132px] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-foreground">{value}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: tone }}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-2 truncate text-sm text-muted-foreground">{detail}</p>
    </Card>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="px-5 py-12 text-center sm:px-6">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default function ClassDetail() {
  const navigate = useNavigate();
  const { className: routeClassName = '' } = useParams();
  const className = decodeClassName(routeClassName);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [config, setConfig] = useState(null);
  const [studentQuery, setStudentQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [studentRows, teacherRows, configurationRows] = await Promise.all([
        fetchStudents(),
        fetchStaff('Teacher').catch(() => []),
        fetchPlatformConfigurations('class-management').catch(() => []),
      ]);
      const decodedConfigs = (configurationRows || []).map(decodeConfig).filter(Boolean);
      setStudents(Array.isArray(studentRows) ? studentRows : []);
      setTeachers(Array.isArray(teacherRows) ? teacherRows : []);
      setConfig(decodedConfigs.find((item) => normalize(item.name) === normalize(className)) || null);
    } catch (requestError) {
      setError(requestError.message || 'Sınıf detayları alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [className]);

  useEffect(() => {
    load();
  }, [load]);

  const classStudents = useMemo(() => students
    .filter((student) => normalize(student.className) === normalize(className))
    .sort((left, right) => String(left.fullName || '').localeCompare(String(right.fullName || ''), 'tr')),
  [className, students]);

  const activeStudentCount = useMemo(
    () => classStudents.filter((student) => !isUserPassive(student.status)).length,
    [classStudents],
  );

  const courseAssignments = useMemo(() => (Array.isArray(config?.courses) ? config.courses : []).map((course, index) => ({
    ...course,
    key: `${course.courseName || course.name || 'ders'}-${index}`,
    courseName: course.courseName || course.name || course.title || 'Ders',
    weeklyHours: Number(course.weeklyHours || 0),
  })), [config]);

  const advisor = useMemo(() => teachers.find((teacher) => (
    sameId(teacher.id, config?.advisorTeacherId)
    || normalize(teacher.homeroomClass) === normalize(className)
  )), [className, config, teachers]);

  const classTeachers = useMemo(() => {
    const configuredIds = new Set([
      ...(Array.isArray(config?.teachers) ? config.teachers : []).map((item) => String(typeof item === 'object' ? item.teacherId : item)),
      ...courseAssignments.map((course) => String(course.teacherId)),
      String(config?.advisorTeacherId),
    ].filter((id) => id && id !== 'null' && id !== 'undefined'));

    return teachers.filter((teacher) => (
      configuredIds.has(String(teacher.id))
      || normalize(teacher.homeroomClass) === normalize(className)
      || (Array.isArray(teacher.assignedClasses) && teacher.assignedClasses.some((item) => normalize(item) === normalize(className)))
    )).sort((left, right) => String(left.fullName || '').localeCompare(String(right.fullName || ''), 'tr'));
  }, [className, config, courseAssignments, teachers]);

  const filteredStudents = useMemo(() => {
    const query = normalize(studentQuery);
    if (!query) return classStudents;
    return classStudents.filter((student) => normalize(`${student.fullName} ${student.schoolNumber} ${student.parentName}`).includes(query));
  }, [classStudents, studentQuery]);

  const totalWeeklyHours = useMemo(() => courseAssignments.reduce((sum, course) => sum + course.weeklyHours, 0), [courseAssignments]);
  const color = config?.themeColor || '#2563EB';
  const classExists = Boolean(config) || classStudents.length > 0;

  if (loading) {
    return <div className="flex min-h-[55vh] items-center justify-center"><LoadingDots /></div>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/classes')}><ArrowLeft className="mr-2 h-4 w-4" /> Sınıflara dön</Button>
        <ErrorBanner message={error} />
      </div>
    );
  }

  if (!classExists) {
    return (
      <Card className="mx-auto max-w-xl p-8 text-center">
        <h1 className="text-xl font-bold">Sınıf bulunamadı</h1>
        <p className="mt-2 text-sm text-muted-foreground">Bu sınıf silinmiş veya kurumunuza ait olmayabilir.</p>
        <Button className="mt-5" onClick={() => navigate('/classes')}><ArrowLeft className="mr-2 h-4 w-4" /> Sınıflara dön</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5 pb-8 text-foreground sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" className="w-fit px-0 hover:bg-transparent" onClick={() => navigate('/classes')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Sınıflar ve Gruplar
        </Button>
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate(`/classes?manage=${encodeURIComponent(className)}`)}>
          Sınıfı yönet <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <header className="relative overflow-hidden rounded-3xl border border-foreground/10 bg-[hsl(var(--ci-card))] p-5 shadow-sm sm:p-7">
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: color }} />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-black text-white shadow-lg" style={{ background: color }}>
            {initials(className)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{className}</h1>
              <Badge variant="outline">{config?.institutionUnit || 'Okul'}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              {config?.description || 'Sınıf öğrencileri, öğretmenleri ve ders planı tek ekranda.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {config?.academicYear || 'Dönem belirtilmedi'}</span>
              <span>{config?.grade || 'Seviye belirtilmedi'}</span>
              <span>{config?.section || 'Şube belirtilmedi'}</span>
              <span>{config?.code || 'Sınıf kodu yok'}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Aktif öğrenci" value={activeStudentCount} detail={`${classStudents.length} toplam kayıt`} icon={GraduationCap} tone="#2563EB" />
        <MetricCard label="Öğretmen" value={classTeachers.length} detail={advisor ? `${advisor.fullName} danışman` : 'Danışman atanmamış'} icon={Users} tone="#06B6D4" />
        <MetricCard label="Ders" value={courseAssignments.length} detail={`${courseAssignments.filter((course) => course.teacherId).length} öğretmen atamalı`} icon={BookOpen} tone="#7C3AED" />
        <MetricCard label="Haftalık plan" value={`${totalWeeklyHours} sa`} detail="Tanımlanan ders saati" icon={Clock3} tone="#F59E0B" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <Card className="overflow-hidden">
          <SectionHeader icon={GraduationCap} title="Sınıf Öğrencileri" description="Bu sınıfa kayıtlı öğrenci listesi" count={classStudents.length} />
          <div className="border-b border-foreground/10 p-4 sm:px-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Ad, okul numarası veya veli adı ara..." className="h-11 bg-background/60 pl-10" />
            </div>
          </div>
          {filteredStudents.length === 0 ? (
            <EmptyState title={classStudents.length ? 'Aramayla eşleşen öğrenci yok' : 'Bu sınıfta öğrenci yok'} description={classStudents.length ? 'Farklı bir ad veya okul numarası deneyin.' : 'Sınıf yönetiminden öğrenci ataması yapabilirsiniz.'} />
          ) : (
            <div className="divide-y divide-foreground/10">
              {filteredStudents.map((student) => (
                <div key={student.id} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-foreground/[0.025] sm:px-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-sm font-bold text-blue-700 dark:text-blue-300">{initials(student.fullName)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{student.fullName || 'İsimsiz öğrenci'}</p>
                    <p className="truncate text-xs text-muted-foreground">Okul No: {student.schoolNumber || '—'}{student.parentName ? ` • Veli: ${student.parentName}` : ''}</p>
                  </div>
                  <Badge variant="outline" className={isUserPassive(student.status) ? 'border-red-500/30 text-red-600' : 'border-emerald-500/30 text-emerald-600'}>
                    {userStatusLabel(student.status)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="overflow-hidden">
            <SectionHeader icon={UserCheck} title="Sınıf Danışmanı" description="Sınıfın akademik sorumlusu" />
            {advisor ? (
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black text-white" style={{ background: color }}>{initials(advisor.fullName)}</div>
                  <div className="min-w-0">
                    <p className="truncate font-bold">{advisor.fullName}</p>
                    <p className="truncate text-sm text-muted-foreground">{advisor.departmentOrBranch || 'Branş belirtilmedi'}</p>
                  </div>
                </div>
                {advisor.email ? <p className="mt-4 flex items-center gap-2 truncate text-sm text-muted-foreground"><Mail className="h-4 w-4 shrink-0" /> {advisor.email}</p> : null}
              </div>
            ) : <EmptyState title="Danışman atanmamış" description="Sınıf yönetiminden bir sınıf danışmanı seçebilirsiniz." />}
          </Card>

          <Card className="overflow-hidden">
            <SectionHeader icon={Users} title="Sınıf Öğretmenleri" description="Bu sınıfa tanımlı öğretmenler" count={classTeachers.length} />
            {classTeachers.length === 0 ? <EmptyState title="Öğretmen atanmamış" description="Ders planında öğretmen seçildiğinde burada görünür." /> : (
              <div className="divide-y divide-foreground/10">
                {classTeachers.map((teacher) => {
                  const teacherCourses = courseAssignments.filter((course) => sameId(course.teacherId, teacher.id)).map((course) => course.courseName);
                  return (
                    <div key={teacher.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-xs font-bold text-cyan-700 dark:text-cyan-300">{initials(teacher.fullName)}</div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{teacher.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">{teacherCourses.join(', ') || teacher.departmentOrBranch || 'Ders ataması yok'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <SectionHeader icon={BookOpen} title="Ders ve Öğretmen Planı" description="Hangi derse hangi öğretmenin girdiği ve haftalık ders yükü" count={courseAssignments.length} />
        {courseAssignments.length === 0 ? <EmptyState title="Ders planı oluşturulmamış" description="Sınıf yönetiminden dersleri, öğretmenleri ve haftalık saatleri tanımlayabilirsiniz." /> : (
          <>
            <div className="hidden grid-cols-[minmax(180px,1fr)_minmax(220px,1.2fr)_140px_120px] gap-4 border-b border-foreground/10 bg-foreground/[0.025] px-6 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground md:grid">
              <span>Ders</span><span>Öğretmen</span><span>Haftalık saat</span><span>Tür</span>
            </div>
            <div className="divide-y divide-foreground/10">
              {courseAssignments.map((course) => {
                const teacher = teachers.find((item) => sameId(item.id, course.teacherId));
                return (
                  <div key={course.key} className="grid gap-3 px-5 py-4 transition hover:bg-foreground/[0.025] md:grid-cols-[minmax(180px,1fr)_minmax(220px,1.2fr)_140px_120px] md:items-center md:gap-4 md:px-6">
                    <div>
                      <p className="font-semibold">{course.courseName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground md:hidden">Ders</p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-xs font-bold text-violet-700 dark:text-violet-300">{teacher ? initials(teacher.fullName) : '—'}</div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{teacher?.fullName || 'Öğretmen atanmadı'}</p>
                        <p className="truncate text-xs text-muted-foreground">{teacher?.departmentOrBranch || 'Atama bekliyor'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4 text-muted-foreground" /> {course.weeklyHours} saat</div>
                    <Badge variant="outline" className="w-fit">{course.isRequired === false ? 'Seçmeli' : 'Zorunlu'}</Badge>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
