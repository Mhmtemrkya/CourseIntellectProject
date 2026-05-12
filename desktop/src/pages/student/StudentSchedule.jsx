import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Clock3 } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { useApp } from '../../context/AppContext';
import { fetchScheduleEntries, fetchStudents } from '../../lib/api/modules';
import { filterScheduleForStudent, resolveCurrentStudent } from '../../lib/userMatching';

const DAY_ORDER = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

function dayIndex(day) {
  const idx = DAY_ORDER.indexOf(day);
  return idx === -1 ? 99 : idx;
}

export default function StudentSchedule() {
  const { user } = useApp();
  const [scheduleEntries, setScheduleEntries] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSchedule = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      // Tek doğruluk kaynağı: /api/schedule. Öğrencinin sınıf adına göre filtrele.
      // LIVE_LESSON duyuruları artık kullanılmıyor; canlı dersler /s/notifications
      // ve duyuru listesinde görünür.
      const [schedule, studentList] = await Promise.all([
        fetchScheduleEntries().catch(() => []),
        fetchStudents().catch(() => []),
      ]);
      setScheduleEntries(Array.isArray(schedule) ? schedule : []);
      setStudents(Array.isArray(studentList) ? studentList : []);
    } catch (err) {
      setError(err.message || 'Ders programı alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const currentStudent = useMemo(() => resolveCurrentStudent(user, students), [user, students]);
  const className = currentStudent?.className || '';

  const lessons = useMemo(() => {
    return filterScheduleForStudent(scheduleEntries, className)
      .map((entry) => ({
        id: entry.id,
        title: entry.subject || 'Ders',
        teacher: entry.teacher || '',
        className: entry.className || className,
        day: entry.day || '',
        time: entry.time || '',
      }))
      .sort((a, b) => {
        const dayDiff = dayIndex(a.day) - dayIndex(b.day);
        if (dayDiff !== 0) return dayDiff;
        return String(a.time).localeCompare(String(b.time));
      });
  }, [scheduleEntries, className]);

  const groupedByDay = useMemo(() => {
    const map = new Map();
    lessons.forEach((lesson) => {
      const key = lesson.day || 'Belirsiz';
      const bucket = map.get(key) || [];
      bucket.push(lesson);
      map.set(key, bucket);
    });
    return Array.from(map.entries());
  }, [lessons]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="student-schedule-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Ders Programı</h1>
        <p className="text-muted-foreground mt-1">
          {className ? `${className} sınıfının haftalık programı.` : 'Sınıf bilgisi alınamadı; lütfen kurum yönetimine başvurun.'}
        </p>
      </div>

      {error ? <ErrorBanner title="Ders programı alınamadı" message={error} onRetry={loadSchedule} /> : null}

      {lessons.length === 0 && !error ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {className
              ? 'Henüz program kaydı yok. Kurum yöneticiniz program oluşturduğunda burada görünecek.'
              : 'Öğrenci kaydı bulunamadı.'}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-6">
        {groupedByDay.map(([day, items]) => (
          <div key={day} className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-brand-primary" />
              {day}
              <Badge variant="outline">{items.length} ders</Badge>
            </h2>
            <div className="grid gap-3">
              {items.map((lesson) => (
                <Card key={lesson.id}>
                  <CardContent className="p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="rounded-xl bg-brand-primary/10 p-3">
                        <CalendarDays className="h-6 w-6 text-brand-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">{lesson.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {lesson.className}{lesson.teacher ? ` • ${lesson.teacher}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className="mb-2 bg-brand-primary/10 text-brand-primary">
                        <Clock3 className="h-3 w-3 mr-1" />
                        {lesson.time || '—'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
