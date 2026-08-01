import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ClipboardList,
  Eye,
  GraduationCap,
  Mail,
  Percent,
  Phone,
  Users,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import DirectoryPage, { DIRECTORY_ALL } from '../../components/directory/DirectoryPage';
import { useApp } from '../../context/AppContext';
import { assetUrl } from '../../lib/assetUrl';
import { isUserPassive, userStatusLabel } from '../../lib/userStatus';
import {
  fetchAttendance,
  fetchExamResults,
  fetchScheduleEntries,
  fetchStudents,
} from '../../lib/api/modules';

const normalize = (value = '') => String(value).trim().toLocaleLowerCase('tr-TR');

/**
 * Öğretmenin KENDİ öğrencileri.
 *
 * Öğretmenin sorumlu olduğu sınıflar ders programından çözülür (kendi adına
 * yazılmış dersler); böylece ayrı bir atama tablosuna gerek kalmaz ve program
 * değişince liste kendiliğinden güncellenir. Sınıf filtresi bu küme üzerinden
 * çalışır. Öğretmen yalnız okuma yapar — pasifleştirme/düzenleme yoktur.
 */
export default function TeacherStudents() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [students, setStudents] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [examResults, setExamResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState(DIRECTORY_ALL);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [studentList, scheduleRows, attendanceRows, examRows] = await Promise.all([
        fetchStudents(),
        fetchScheduleEntries().catch(() => []),
        fetchAttendance().catch(() => []),
        fetchExamResults().catch(() => []),
      ]);
      setStudents(Array.isArray(studentList) ? studentList : []);
      setSchedule(Array.isArray(scheduleRows) ? scheduleRows : []);
      setAttendance(Array.isArray(attendanceRows) ? attendanceRows : []);
      setExamResults(Array.isArray(examRows) ? examRows : []);
    } catch (err) {
      setError(err.message || 'Öğrenci listesi alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Öğretmenin dersine girdiği sınıflar + verdiği dersler.
  const { myClasses, lessonsByClass } = useMemo(() => {
    const me = normalize(user?.name);
    const mine = schedule.filter((row) => normalize(row.teacher) === me);
    const classes = [...new Set(mine.map((row) => row.className).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'tr'));
    const lessons = new Map();
    mine.forEach((row) => {
      if (!row.className) return;
      const list = lessons.get(row.className) || new Set();
      if (row.subject) list.add(row.subject);
      lessons.set(row.className, list);
    });
    return { myClasses: classes, lessonsByClass: lessons };
  }, [schedule, user?.name]);

  const myStudents = useMemo(() => {
    const classKeys = new Set(myClasses.map(normalize));
    return students
      .filter((student) => !isUserPassive(student.status))
      .filter((student) => classKeys.size === 0 || classKeys.has(normalize(student.className)))
      .map((student) => {
        const rows = attendance.filter((row) => normalize(row.studentName) === normalize(student.fullName));
        const present = rows.filter((row) => normalize(row.status).includes('katildi')).length;
        const lastExam = examResults
          .filter((row) => normalize(row.studentName) === normalize(student.fullName))
          .sort((a, b) => String(b.dateLabel || '').localeCompare(String(a.dateLabel || '')))[0];
        return {
          ...student,
          attendanceRate: rows.length > 0 ? Math.round((present / rows.length) * 100) : 0,
          lastExamScore: lastExam?.score ?? null,
          lastExamTitle: lastExam?.examTitle || '',
        };
      });
  }, [students, myClasses, attendance, examResults]);

  const filtered = useMemo(() => myStudents.filter((student) => {
    const haystack = `${student.fullName} ${student.parentName} ${student.username}`.toLowerCase();
    if (!haystack.includes(search.toLowerCase())) return false;
    if (classFilter !== DIRECTORY_ALL && student.className !== classFilter) return false;
    return true;
  }), [myStudents, search, classFilter]);

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;
  }

  const averageAttendance = myStudents.length
    ? Math.round(myStudents.reduce((sum, student) => sum + student.attendanceRate, 0) / myStudents.length)
    : 0;
  const scored = myStudents.filter((student) => student.lastExamScore != null);
  const averageScore = scored.length
    ? Math.round(scored.reduce((sum, student) => sum + Number(student.lastExamScore || 0), 0) / scored.length)
    : 0;

  return (
    <DirectoryPage
      testId="teacher-students-page"
      title="Öğrencilerim"
      subtitle={myClasses.length > 0
        ? `${myClasses.join(', ')} sınıflarında ${myStudents.length} öğrenci`
        : `${myStudents.length} öğrenci`}
      rangeLabel={(from, to, total) => `${total} öğrenciden ${from}-${to} arası gösteriliyor`}
      emptyTitle="Öğrenci bulunamadı"
      emptyDescription={myClasses.length === 0
        ? 'Ders programında adınıza yazılmış bir sınıf yok. Yönetimden ders programınızı kontrol edin.'
        : 'Filtreleri değiştirin.'}
      banner={error ? <ErrorBanner title="Öğrenciler alınamadı" message={error} onRetry={load} /> : null}
      actions={(
        <>
          <Button variant="outline" onClick={() => navigate('/t/attendance')}>
            <ClipboardList className="mr-2 h-4 w-4" /> Yoklama
          </Button>
          <Button variant="outline" onClick={() => navigate('/t/grade-entry')}>
            <GraduationCap className="mr-2 h-4 w-4" /> Not Girişi
          </Button>
        </>
      )}
      stats={[
        { label: 'Öğrencim', value: myStudents.length, caption: `${myClasses.length} sınıf`, icon: Users, tint: 'bg-sky-500/12 text-sky-600' },
        { label: 'Sınıf Sayısı', value: myClasses.length, caption: 'Derse girdiğim şube', icon: BookOpen, tint: 'bg-violet-500/12 text-violet-600' },
        { label: 'Ortalama Devam', value: `%${averageAttendance}`, caption: 'Tüm kayıtlar', icon: Percent, tint: 'bg-emerald-500/12 text-emerald-600' },
        { label: 'Sınav Ortalaması', value: averageScore, caption: `${scored.length} öğrencinin son sınavı`, icon: GraduationCap, tint: 'bg-amber-500/12 text-amber-600' },
      ]}
      search={{ value: search, onChange: setSearch, placeholder: 'Öğrenci ara...' }}
      filters={[
        { value: classFilter, onChange: setClassFilter, placeholder: 'Tüm Sınıflar', options: myClasses },
      ]}
      rows={filtered}
      getRowId={(student) => student.id}
      columns={[
        {
          key: 'fullName',
          label: 'Öğrenci',
          sortable: true,
          width: 'minmax(0,2fr)',
          render: (student) => (
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                {student.photoUrl ? <AvatarImage src={assetUrl(student.photoUrl)} alt={student.fullName} className="object-cover" /> : null}
                <AvatarFallback className="bg-brand-primary text-white">
                  {student.fullName.split(' ').map((part) => part[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold">{student.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {student.schoolNumber ? `Öğrenci No: ${student.schoolNumber}` : student.username}
                </p>
              </div>
            </div>
          ),
        },
        {
          key: 'className',
          label: 'Sınıf - Ders',
          sortable: true,
          width: 'minmax(0,1.1fr)',
          render: (student) => (
            <div className="min-w-0">
              <Badge variant="outline">{student.className || '—'}</Badge>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {[...(lessonsByClass.get(student.className) || [])].join(', ') || '—'}
              </p>
            </div>
          ),
        },
        {
          key: 'parentName',
          label: 'Veli',
          width: 'minmax(0,1.2fr)',
          render: (student) => (
            <div className="min-w-0 text-xs">
              <p className="truncate font-medium">{student.parentName || '—'}</p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-muted-foreground">
                <Phone className="h-3 w-3" />{student.parentPhone || '—'}
              </p>
            </div>
          ),
        },
        {
          key: 'attendanceRate',
          label: 'Devam',
          sortable: true,
          width: 'minmax(0,0.6fr)',
          render: (student) => (
            <span className={`font-semibold tabular-nums ${student.attendanceRate < 75 ? 'text-amber-600' : ''}`}>
              %{student.attendanceRate}
            </span>
          ),
        },
        {
          key: 'lastExamScore',
          label: 'Son Sınav',
          sortable: true,
          width: 'minmax(0,0.8fr)',
          render: (student) => (student.lastExamScore == null
            ? <span className="text-xs text-muted-foreground">—</span>
            : (
              <div className="min-w-0">
                <p className="font-semibold tabular-nums">{student.lastExamScore}</p>
                <p className="truncate text-xs text-muted-foreground">{student.lastExamTitle}</p>
              </div>
            )),
        },
        {
          key: 'status',
          label: 'Durum',
          width: 'minmax(0,0.6fr)',
          render: (student) => (
            <Badge className="bg-green-100 text-green-700">{userStatusLabel(student.status)}</Badge>
          ),
        },
      ]}
      rowActions={(student) => (
        <Button
          variant="ghost"
          size="icon"
          title="Öğrenci sorularını aç"
          onClick={() => navigate(`/t/questions?student=${encodeURIComponent(student.fullName)}`)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      )}
      cardRender={(student) => (
        <div className="flex w-full flex-col gap-3 rounded-2xl border border-foreground/10 bg-background/60 p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              {student.photoUrl ? <AvatarImage src={assetUrl(student.photoUrl)} alt={student.fullName} className="object-cover" /> : null}
              <AvatarFallback className="bg-brand-primary text-white">
                {student.fullName.split(' ').map((part) => part[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{student.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{student.className}</p>
            </div>
            <Badge variant="outline">%{student.attendanceRate}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            <p className="truncate">Veli: {student.parentName || '—'}</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate"><Mail className="h-3 w-3" />{student.parentEmail || '—'}</p>
          </div>
        </div>
      )}
    />
  );
}
