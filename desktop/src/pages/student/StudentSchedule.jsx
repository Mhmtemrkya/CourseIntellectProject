import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Video } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ErrorBanner } from '../../components/ui/AlertBanner';
import { LoadingDots } from '../../components/animations/AnimatedIcon';
import { fetchAnnouncements } from '../../lib/api/modules';

function parseLiveLessons(items) {
  return items
    .filter((item) => String(item.detail || '').startsWith('LIVE_LESSON'))
    .map((item) => {
      const meta = {};
      String(item.detail || '')
        .split('\n')
        .slice(1)
        .forEach((line) => {
          const index = line.indexOf('=');
          if (index > 0) meta[line.slice(0, index)] = line.slice(index + 1);
        });
      return {
        id: item.id,
        title: item.title,
        teacher: meta.teacher || 'Öğretmen',
        className: meta.class || '',
        platform: meta.platform || 'Canli Ders',
        startsAt: meta.datetime ? new Date(meta.datetime) : null,
      };
    })
    .sort((a, b) => (a.startsAt?.getTime() || 0) - (b.startsAt?.getTime() || 0));
}

export default function StudentSchedule() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSchedule = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setAnnouncements(await fetchAnnouncements('Ogrenci'));
    } catch (err) {
      setError(err.message || 'Ders programı alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const lessons = useMemo(() => parseLiveLessons(announcements), [announcements]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingDots /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="student-schedule-page">
      <div>
        <h1 className="text-3xl font-bold font-heading">Ders Programı</h1>
        <p className="text-muted-foreground mt-1">Canlı backend ders kayıtlarıyla haftalık görünüm.</p>
      </div>

      {error ? <ErrorBanner title="Ders programı alınamadı" message={error} onRetry={loadSchedule} /> : null}

      <div className="grid gap-4">
        {lessons.map((lesson) => (
          <Card key={lesson.id}>
            <CardContent className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-brand-primary/10 p-3">
                  <CalendarDays className="h-6 w-6 text-brand-primary" />
                </div>
                <div>
                  <p className="font-semibold text-lg">{lesson.title}</p>
                  <p className="text-sm text-muted-foreground">{lesson.className} • {lesson.teacher}</p>
                </div>
              </div>
              <div className="text-right">
                <Badge className="mb-2 bg-red-100 text-red-700">
                  <Video className="h-3 w-3 mr-1" />
                  {lesson.platform}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {lesson.startsAt ? new Intl.DateTimeFormat('tr-TR', { weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(lesson.startsAt) : 'Saat yok'}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
